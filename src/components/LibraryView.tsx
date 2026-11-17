import { useState } from 'react';
import { ArrowRight, BookOpen, LogIn, Plus, Search, Trash2 } from 'lucide-react';
import type { StoryAnalysis } from '../types/story';

interface LibraryViewProps {
  stories: StoryAnalysis[];
  isSignedIn: boolean;
  onSignIn: () => void;
  onOpenStory: (story: StoryAnalysis) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onStartNew: () => void;
}

export function LibraryView({
  stories,
  isSignedIn,
  onSignIn,
  onOpenStory,
  onDeleteStory,
  onStartNew,
}: LibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mediumFilter, setMediumFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = stories.filter((s) => {
    const matchesSearch =
      !searchTerm.trim() ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.creatorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMedium = mediumFilter === 'all' || s.medium === mediumFilter;
    return matchesSearch && matchesMedium;
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteStory(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="border-b border-[#E5E0D5] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#161514]">
            Saved Story Archive
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            {isSignedIn
              ? 'Synced across your mobile and desktop devices.'
              : 'Stored in this browser session. Sign in with Google to sync across devices.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-white border border-[#D6D0C4] text-[#161514] text-xs font-semibold rounded-lg hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign in to Sync</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#161514] text-white text-xs font-semibold rounded-lg hover:bg-[#292524] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Analysis</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by story title or creator..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm bg-white border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
          />
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-[#F3EFE6] rounded-lg border border-[#E5E0D5]">
          {['all', 'movie', 'series', 'anime', 'novel', 'uploaded_video'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMediumFilter(m)}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 capitalize ${
                mediumFilter === m
                  ? 'bg-white text-[#161514] shadow-sm'
                  : 'text-[#57534E] hover:text-[#161514]'
              }`}
            >
              {m === 'uploaded_video' ? 'Uploads' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Stories List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E0D5] rounded-2xl p-10 text-center space-y-4">
          <BookOpen className="w-8 h-8 text-[#9A3412] mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-editorial text-xl font-semibold text-[#161514]">
              {stories.length === 0 ? 'No stories analyzed yet' : 'No matching stories found'}
            </h2>
            <p className="text-sm text-[#57534E] max-w-md mx-auto">
              {stories.length === 0
                ? 'Analyze a movie, series, anime, manga, novel, or upload an episode file to build your first story dossier.'
                : 'Try clearing your search or switching medium filters.'}
            </p>
          </div>
          {stories.length === 0 && (
            <button
              type="button"
              onClick={onStartNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#9A3412] text-white text-sm font-medium rounded-lg hover:bg-[#7C2D12] transition-colors"
            >
              <span>Analyze First Story</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E5E0D5] rounded-2xl p-6 flex flex-col justify-between gap-5 hover:border-[#C2B9A7] transition-colors"
            >
              <div className="space-y-3">
                <div className="text-xs text-[#57534E]">
                  <span className="font-semibold text-[#9A3412] capitalize">
                    {item.medium.replace('_', ' ')}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{item.creatorName}</span>
                </div>

                <h2 className="font-editorial text-xl font-semibold text-[#161514] leading-snug">
                  {item.title}
                </h2>

                <p className="text-sm text-[#57534E] line-clamp-3 leading-relaxed">
                  {item.logline}
                </p>
              </div>

              <div className="pt-4 border-t border-[#EFECE6] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenStory(item)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#161514] hover:text-[#9A3412] min-h-[44px] transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#78716C] hover:text-[#B91C1C] rounded-lg hover:bg-[#FEF2F2] transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
