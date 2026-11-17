import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { BookOpen, Compass, FolderArchive, GitBranch, LogIn, LogOut } from 'lucide-react';
import { auth, googleProvider } from './lib/firebase';
import {
  deleteStoryFromFirestore,
  ensureUserProfile,
  saveBranchToFirestore,
  saveStoryToFirestore,
  subscribeStoryBranches,
  subscribeUserStories,
  toggleBranchPinInFirestore,
  updateBranchInFirestore,
} from './lib/firestoreStore';
import type { StoryAnalysis, StoryBranch, TurningPoint } from './types/story';
import { IngestionView } from './components/IngestionView';
import { AnalysisView } from './components/AnalysisView';
import { WhatIfStudioView } from './components/WhatIfStudioView';
import { LibraryView } from './components/LibraryView';

type AppTab = 'analyze' | 'dossier' | 'whatif' | 'library';

const GUEST_STORIES_KEY = 'auteurfork_guest_stories_v1';
const GUEST_BRANCHES_KEY = 'auteurfork_guest_branches_v1';

function loadGuestStories(): StoryAnalysis[] {
  try {
    const raw = localStorage.getItem(GUEST_STORIES_KEY);
    return raw ? (JSON.parse(raw) as StoryAnalysis[]) : [];
  } catch {
    return [];
  }
}

function loadGuestBranches(): StoryBranch[] {
  try {
    const raw = localStorage.getItem(GUEST_BRANCHES_KEY);
    return raw ? (JSON.parse(raw) as StoryBranch[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('analyze');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stories, setStories] = useState<StoryAnalysis[]>(() => loadGuestStories());
  const [branches, setBranches] = useState<StoryBranch[]>(() => loadGuestBranches());
  const [activeStoryId, setActiveStoryId] = useState<string | null>(() => {
    const initial = loadGuestStories();
    return initial[0]?.id ?? null;
  });
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [selectedPivot, setSelectedPivot] = useState<TurningPoint | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void ensureUserProfile(nextUser);
      }
    });
    return () => unsub();
  }, []);

  // Firestore subscription when signed in; localStorage sync for guest mode
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setStories(loadGuestStories());
      setBranches(loadGuestBranches());
      return;
    }

    // Migrate any guest stories created before signing in
    const guestStories = loadGuestStories();
    const guestBranches = loadGuestBranches();
    if (guestStories.length > 0) {
      void (async () => {
        for (const s of guestStories) {
          await saveStoryToFirestore(s, user.uid);
        }
        for (const b of guestBranches) {
          await saveBranchToFirestore(b, user.uid);
        }
        localStorage.removeItem(GUEST_STORIES_KEY);
        localStorage.removeItem(GUEST_BRANCHES_KEY);
      })();
    }

    const unsubStories = subscribeUserStories(user.uid, (loaded) => {
      setStories(loaded);
      setActiveStoryId((prev) => {
        if (prev && loaded.some((s) => s.id === prev)) return prev;
        return loaded[0]?.id ?? null;
      });
    });

    return () => unsubStories();
  }, [authReady, user]);

  // Subscribe to branches of the active story when signed in
  useEffect(() => {
    if (!authReady || !user || !activeStoryId) return;
    const unsubBranches = subscribeStoryBranches(activeStoryId, user.uid, (loaded) => {
      setBranches(loaded);
    });
    return () => unsubBranches();
  }, [authReady, user, activeStoryId]);

  const activeStory = stories.find((s) => s.id === activeStoryId) || null;
  const activeBranches = user
    ? branches.filter((b) => b.storyId === activeStoryId)
    : branches.filter((b) => b.storyId === activeStoryId);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to complete Google sign-in.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveStoryId(null);
    setStories([]);
    setBranches([]);
    setActiveTab('analyze');
  };

  const handleAnalysisComplete = async (story: StoryAnalysis, mediaUrl?: string | null) => {
    if (localMediaUrl && localMediaUrl !== mediaUrl) {
      URL.revokeObjectURL(localMediaUrl);
    }
    setLocalMediaUrl(mediaUrl ?? null);
    setSelectedPivot(null);

    if (user) {
      await saveStoryToFirestore(story, user.uid);
    } else {
      const next = [story, ...stories];
      setStories(next);
      localStorage.setItem(GUEST_STORIES_KEY, JSON.stringify(next));
    }

    setActiveStoryId(story.id);
    setActiveTab('dossier');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBranchCreated = async (branch: StoryBranch) => {
    if (user) {
      await saveBranchToFirestore(branch, user.uid);
    } else {
      const next = [branch, ...branches];
      setBranches(next);
      localStorage.setItem(GUEST_BRANCHES_KEY, JSON.stringify(next));
    }
  };

  const handleBranchUpdated = async (branch: StoryBranch) => {
    if (user) {
      await updateBranchInFirestore(branch);
    } else {
      const next = branches.map((b) => (b.id === branch.id ? branch : b));
      setBranches(next);
      localStorage.setItem(GUEST_BRANCHES_KEY, JSON.stringify(next));
    }
  };

  const handleTogglePin = async (branch: StoryBranch) => {
    const nextStatus: 'generated' | 'pinned' =
      branch.status === 'pinned' ? 'generated' : 'pinned';
    if (user) {
      await toggleBranchPinInFirestore(branch.storyId, branch.id, nextStatus);
    } else {
      const next = branches.map((b) =>
        b.id === branch.id ? { ...b, status: nextStatus } : b
      );
      setBranches(next);
      localStorage.setItem(GUEST_BRANCHES_KEY, JSON.stringify(next));
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (user) {
      await deleteStoryFromFirestore(storyId);
    } else {
      const nextStories = stories.filter((s) => s.id !== storyId);
      const nextBranches = branches.filter((b) => b.storyId !== storyId);
      setStories(nextStories);
      setBranches(nextBranches);
      localStorage.setItem(GUEST_STORIES_KEY, JSON.stringify(nextStories));
      localStorage.setItem(GUEST_BRANCHES_KEY, JSON.stringify(nextBranches));
    }

    if (activeStoryId === storyId) {
      setActiveStoryId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#161514]">
      {/* Top Bar Contract: 3 zones (Wordmark — 4 nav links — 1 primary action) */}
      <header className="sticky top-0 z-30 h-12 md:h-16 bg-[#FAF8F4]/95 backdrop-blur-md border-b border-[#E5E0D5]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('analyze')}
            className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-[#161514] whitespace-nowrap shrink-0 text-left"
          >
            AuteurFork
          </button>

          {/* Zone 2: 4 Clean Single-Line Nav Links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('analyze')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'analyze'
                  ? 'border-[#9A3412] text-[#161514]'
                  : 'border-transparent text-[#57534E] hover:text-[#161514]'
              }`}
            >
              Analyze Story
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dossier')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'dossier'
                  ? 'border-[#9A3412] text-[#161514]'
                  : 'border-transparent text-[#57534E] hover:text-[#161514]'
              }`}
            >
              Author Mind
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatif')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'whatif'
                  ? 'border-[#9A3412] text-[#161514]'
                  : 'border-transparent text-[#57534E] hover:text-[#161514]'
              }`}
            >
              What-If Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'library'
                  ? 'border-[#9A3412] text-[#161514]'
                  : 'border-transparent text-[#57534E] hover:text-[#161514]'
              }`}
            >
              Saved Library
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] text-xs font-medium text-[#161514] bg-white border border-[#D6D0C4] rounded-lg hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
              >
                <span className="max-w-[110px] truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Account'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[38px] text-xs font-medium text-white bg-[#161514] rounded-lg hover:bg-[#292524] transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 md:pb-12">
        {authError && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
          >
            {authError}
          </div>
        )}

        {activeTab === 'analyze' && (
          <IngestionView
            onAnalysisComplete={(story, url) => void handleAnalysisComplete(story, url)}
            userId={user?.uid || 'guest'}
          />
        )}

        {activeTab === 'dossier' &&
          (activeStory ? (
            <AnalysisView
              story={activeStory}
              localMediaUrl={localMediaUrl}
              onSelectPivotForWhatIf={(pivot) => {
                setSelectedPivot(pivot);
                setActiveTab('whatif');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCustomWhatIf={() => {
                setSelectedPivot(null);
                setActiveTab('whatif');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : (
            <EmptyWorkspaceNotice
              title="No Story Loaded Yet"
              description="Analyze a movie, series, anime, manga, novel, or upload your own episode file to inspect the full story structure and the creator's cognitive dossier."
              onStart={() => setActiveTab('analyze')}
              hasSaved={stories.length > 0}
              onOpenLibrary={() => setActiveTab('library')}
            />
          ))}

        {activeTab === 'whatif' &&
          (activeStory ? (
            <WhatIfStudioView
              story={activeStory}
              initialPivot={selectedPivot}
              branches={activeBranches}
              userId={user?.uid || 'guest'}
              onBranchCreated={handleBranchCreated}
              onBranchUpdated={handleBranchUpdated}
              onTogglePin={handleTogglePin}
            />
          ) : (
            <EmptyWorkspaceNotice
              title="Analyze a Story Before Forking"
              description="First analyze a story or uploaded video so the agent understands its characters, turning points, and the original author’s creative instincts."
              onStart={() => setActiveTab('analyze')}
              hasSaved={stories.length > 0}
              onOpenLibrary={() => setActiveTab('library')}
            />
          ))}

        {activeTab === 'library' && (
          <LibraryView
            stories={stories}
            isSignedIn={Boolean(user)}
            onSignIn={() => void handleSignIn()}
            onOpenStory={(story) => {
              setActiveStoryId(story.id);
              setLocalMediaUrl(null);
              setActiveTab('dossier');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDeleteStory={handleDeleteStory}
            onStartNew={() => setActiveTab('analyze')}
          />
        )}
      </div>

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-[#E5E0D5] py-6 text-xs text-[#78716C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span>AuteurFork · Counterfactual Story &amp; Creator Analysis</span>
          <span>Accessible across desktop and mobile viewports</span>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Ergonomics, Combined Sticky <= 15%) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF8F4]/95 backdrop-blur-md border-t border-[#E5E0D5] pb-safe"
      >
        <div className="grid grid-cols-4 h-14 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('analyze')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'analyze' ? 'text-[#9A3412]' : 'text-[#57534E]'
            }`}
          >
            <Compass className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight">Analyze</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'dossier' ? 'text-[#9A3412]' : 'text-[#57534E]'
            }`}
          >
            <BookOpen className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight">Author</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatif')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'whatif' ? 'text-[#9A3412]' : 'text-[#57534E]'
            }`}
          >
            <GitBranch className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight">What-If</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'library' ? 'text-[#9A3412]' : 'text-[#57534E]'
            }`}
          >
            <FolderArchive className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-tight">Library</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function EmptyWorkspaceNotice({
  title,
  description,
  onStart,
  hasSaved,
  onOpenLibrary,
}: {
  title: string;
  description: string;
  onStart: () => void;
  hasSaved: boolean;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5 my-8">
      <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#161514]">
        {title}
      </h1>
      <p className="text-sm text-[#57534E] leading-relaxed">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onStart}
          className="px-5 py-2.5 min-h-[44px] bg-[#9A3412] text-white text-sm font-medium rounded-lg hover:bg-[#7C2D12] transition-colors"
        >
          Analyze a Story
        </button>
        {hasSaved && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="px-5 py-2.5 min-h-[44px] bg-white border border-[#D6D0C4] text-[#161514] text-sm font-medium rounded-lg hover:bg-[#F3EFE6] transition-colors"
          >
            Open Saved Library
          </button>
        )}
      </div>
    </div>
  );
}
