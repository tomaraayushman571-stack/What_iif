import { useEffect, useState } from 'react';
import { Check, Copy, GitBranch, Loader2, Pin, RefreshCw } from 'lucide-react';
import type {
  DivergenceDepth,
  NarrativeFormat,
  StoryAnalysis,
  StoryBranch,
  TurningPoint,
} from '../types/story';

interface WhatIfStudioViewProps {
  story: StoryAnalysis;
  initialPivot: TurningPoint | null;
  branches: StoryBranch[];
  userId: string;
  onBranchCreated: (branch: StoryBranch) => Promise<void>;
  onBranchUpdated: (branch: StoryBranch) => Promise<void>;
  onTogglePin: (branch: StoryBranch) => Promise<void>;
}

const DEPTH_OPTIONS: Array<{ value: DivergenceDepth; label: string; hint: string }> = [
  {
    value: 'ripple',
    label: 'Ripple Effect',
    hint: 'Immediate aftermath & next scene/episode',
  },
  {
    value: 'cascade',
    label: 'Domino Cascade',
    hint: 'Multi-act subplot & character fallout',
  },
  {
    value: 'inversion',
    label: 'Ending Overhaul',
    hint: 'Full trajectory & climax divergence',
  },
];

const FORMAT_OPTIONS: Array<{ value: NarrativeFormat; label: string }> = [
  { value: 'prose', label: 'Literary Prose' },
  { value: 'screenplay', label: 'Screenplay / Script' },
  { value: 'episode_outline', label: 'Act Outline' },
];

export function WhatIfStudioView({
  story,
  initialPivot,
  branches,
  userId,
  onBranchCreated,
  onBranchUpdated,
  onTogglePin,
}: WhatIfStudioViewProps) {
  const [selectedPivotTitle, setSelectedPivotTitle] = useState<string>(
    initialPivot?.title || story.turningPoints[0]?.title || 'Custom Moment'
  );
  const [userChange, setUserChange] = useState<string>('');
  const [divergenceDepth, setDivergenceDepth] = useState<DivergenceDepth>('cascade');
  const [formatStyle, setFormatStyle] = useState<NarrativeFormat>('prose');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<string | null>(branches[0]?.id ?? null);

  useEffect(() => {
    if (initialPivot) {
      setSelectedPivotTitle(initialPivot.title);
    }
  }, [initialPivot]);

  useEffect(() => {
    if (!activeBranchId && branches.length > 0) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId]);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0] || null;

  const selectedTurningPoint = story.turningPoints.find(
    (tp) => tp.title === selectedPivotTitle
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userChange.trim()) {
      setErrorMsg('Describe the character choice or incident you want to change.');
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          pivotTitle: selectedPivotTitle,
          userChange: userChange.trim(),
          divergenceDepth,
          formatStyle,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate alternate timeline.');
      }

      const newBranch: StoryBranch = {
        id: `branch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        storyId: story.id,
        ownerId: userId,
        pivotTitle: selectedPivotTitle,
        userChange: userChange.trim(),
        divergenceDepth,
        authorReasoning: data.authorReasoning || '',
        butterflyChain: Array.isArray(data.butterflyChain) ? data.butterflyChain : [],
        alternateNarrative: data.alternateNarrative || '',
        canonVsAltered: data.canonVsAltered || {
          canonOutcome: '',
          alteredOutcome: '',
          thematicShift: '',
        },
        status: 'generated',
      };

      await onBranchCreated(newBranch);
      setActiveBranchId(newBranch.id);
      setUserChange('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate alternate timeline.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranch || !refinementText.trim()) return;

    setErrorMsg(null);
    setIsRefining(true);

    try {
      const response = await fetch('/api/refine-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          branch: activeBranch,
          refinementPrompt: refinementText.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine alternate timeline.');
      }

      const updated: StoryBranch = {
        ...activeBranch,
        authorReasoning: data.authorReasoning || activeBranch.authorReasoning,
        butterflyChain: Array.isArray(data.butterflyChain)
          ? data.butterflyChain
          : activeBranch.butterflyChain,
        alternateNarrative: data.alternateNarrative || activeBranch.alternateNarrative,
        canonVsAltered: data.canonVsAltered || activeBranch.canonVsAltered,
      };

      await onBranchUpdated(updated);
      setRefinementText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to refine timeline.');
    } finally {
      setIsRefining(false);
    }
  };

  const copyNarrative = async (branch: StoryBranch) => {
    try {
      await navigator.clipboard.writeText(branch.alternateNarrative);
      setCopiedId(branch.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <div className="border-b border-[#E5E0D5] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#9A3412]">
            {story.title} · Authored via {story.authorProfile.name}
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#161514] mt-1">
            Counterfactual What-If Studio
          </h1>
        </div>
        <p className="text-xs font-mono tabular-nums text-[#78716C]">
          {branches.length} {branches.length === 1 ? 'Branch' : 'Branches'} Explored
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Intervention Controls */}
        <aside className="lg:col-span-5 space-y-6">
          <form
            onSubmit={(e) => void handleGenerate(e)}
            className="bg-white border border-[#E5E0D5] rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <h2 className="font-editorial text-xl font-semibold text-[#161514]">
              Design Your Divergence
            </h2>

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
              >
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="pivot-select" className="block text-xs font-semibold text-[#44403C]">
                Turning Point / Anchor Moment
              </label>
              <select
                id="pivot-select"
                value={selectedPivotTitle}
                onChange={(e) => setSelectedPivotTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
              >
                {story.turningPoints.map((tp) => (
                  <option key={tp.title} value={tp.title}>
                    {tp.timestampOrChapter} — {tp.title}
                  </option>
                ))}
                <option value="Custom Moment">Custom Moment / Character Arc</option>
              </select>
              {selectedTurningPoint && (
                <p className="text-xs text-[#78716C] pt-1 leading-relaxed">
                  Canon choice: {selectedTurningPoint.canonChoice}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="user-change" className="block text-xs font-semibold text-[#44403C]">
                What Character Action or Incident Changes?
              </label>
              <textarea
                id="user-change"
                rows={4}
                required
                value={userChange}
                onChange={(e) => setUserChange(e.target.value)}
                placeholder="e.g. Instead of hiding the truth, the protagonist confesses before the raid—or an unexpected ally survives the ambush..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#44403C]">
                Divergence Depth
              </span>
              <div className="grid grid-cols-1 gap-2">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDivergenceDepth(opt.value)}
                    className={`p-3 min-h-[44px] rounded-xl border text-left transition-colors ${
                      divergenceDepth === opt.value
                        ? 'bg-[#161514] text-white border-[#161514]'
                        : 'bg-[#FAF8F4] text-[#161514] border-[#E5E0D5] hover:bg-[#F3EFE6]'
                    }`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p
                      className={`text-xs mt-0.5 ${
                        divergenceDepth === opt.value ? 'text-[#D6D3D1]' : 'text-[#78716C]'
                      }`}
                    >
                      {opt.hint}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#44403C]">
                Output Format
              </span>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormatStyle(opt.value)}
                    className={`px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      formatStyle === opt.value
                        ? 'bg-[#9A3412] text-white border-[#9A3412]'
                        : 'bg-[#FAF8F4] text-[#44403C] border-[#E5E0D5] hover:bg-[#F3EFE6]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] bg-[#9A3412] text-white text-sm font-medium rounded-xl hover:bg-[#7C2D12] disabled:opacity-60 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Writing as {story.authorProfile.name}...</span>
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4" aria-hidden="true" />
                  <span>Generate Alternate Timeline</span>
                </>
              )}
            </button>
          </form>

          {/* Branch History Switcher */}
          {branches.length > 0 && (
            <div className="bg-white border border-[#E5E0D5] rounded-2xl p-5 space-y-3">
              <h3 className="font-editorial text-base font-semibold text-[#161514]">
                Explored Timelines
              </h3>
              <div className="divide-y divide-[#EFECE6]">
                {branches.map((branch) => {
                  const isActive = activeBranch?.id === branch.id;
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => setActiveBranchId(branch.id)}
                      className={`w-full py-3 px-2.5 -mx-2.5 min-h-[44px] text-left rounded-lg transition-colors flex items-start justify-between gap-2 ${
                        isActive ? 'bg-[#F3EFE6]' : 'hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#161514] truncate">
                          {branch.pivotTitle}
                        </p>
                        <p className="text-xs text-[#57534E] line-clamp-2 mt-0.5">
                          {branch.userChange}
                        </p>
                      </div>
                      {branch.status === 'pinned' && (
                        <Pin className="w-3.5 h-3.5 text-[#9A3412] shrink-0 mt-0.5" aria-label="Pinned" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Right: Generated Narrative & Author Reasoning */}
        <main className="lg:col-span-7">
          {!activeBranch ? (
            <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 sm:p-12 text-center space-y-3">
              <GitBranch className="w-8 h-8 text-[#9A3412] mx-auto" aria-hidden="true" />
              <h2 className="font-editorial text-2xl font-semibold text-[#161514]">
                Ready to Fork the Canon
              </h2>
              <p className="text-sm text-[#57534E] max-w-md mx-auto leading-relaxed">
                Pick a turning point on the left and describe what happens differently. The agent
                will apply {story.authorProfile.name}’s psychological logic and previous-work
                instincts to chart the new trajectory.
              </p>
            </div>
          ) : (
            <article className="bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-8">
              {/* Branch Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#EFECE6] pb-6">
                <div className="space-y-2">
                  <div className="text-xs text-[#78716C]">
                    <span className="font-semibold text-[#9A3412] capitalize">
                      {activeBranch.divergenceDepth} Divergence
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>Pivot: {activeBranch.pivotTitle}</span>
                  </div>
                  <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#161514]">
                    “{activeBranch.userChange}”
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void onTogglePin(activeBranch)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors ${
                      activeBranch.status === 'pinned'
                        ? 'bg-[#9A3412] text-white border-[#9A3412]'
                        : 'bg-[#FAF8F4] text-[#44403C] border-[#D6D0C4] hover:bg-[#F3EFE6]'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{activeBranch.status === 'pinned' ? 'Pinned' : 'Pin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyNarrative(activeBranch)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium bg-[#FAF8F4] text-[#44403C] border border-[#D6D0C4] rounded-lg hover:bg-[#F3EFE6] transition-colors"
                  >
                    {copiedId === activeBranch.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Author's Reasoning Lens */}
              <section className="space-y-2 bg-[#FAF8F4] border border-[#E5E0D5] rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9A3412]">
                  Why {story.authorProfile.name} Would Write It This Way
                </h3>
                <p className="text-sm text-[#292524] leading-relaxed whitespace-pre-line">
                  {activeBranch.authorReasoning}
                </p>
              </section>

              {/* Butterfly Effect Causal Chain */}
              {activeBranch.butterflyChain.length > 0 && (
                <section className="space-y-4">
                  <h3 className="font-editorial text-lg font-semibold text-[#161514]">
                    Causal Butterfly Chain
                  </h3>
                  <div className="divide-y divide-[#EFECE6] border-y border-[#EFECE6]">
                    {activeBranch.butterflyChain.map((item, idx) => (
                      <div key={`${item.step}-${idx}`} className="py-3.5 space-y-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-semibold text-[#161514]">
                            <span className="font-mono tabular-nums text-[#9A3412] mr-2">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {item.step}
                          </p>
                          <span className="text-xs text-[#78716C] shrink-0">
                            {item.affectedCharacter}
                          </span>
                        </div>
                        <p className="text-sm text-[#44403C] leading-relaxed">{item.consequence}</p>
                        <p className="text-xs text-[#78716C]">
                          Canon echo: {item.echoFromCanon}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Full Alternate Narrative */}
              <section className="space-y-3">
                <h3 className="font-editorial text-lg font-semibold text-[#161514]">
                  Alternate Story Continuation
                </h3>
                <div className="text-[15px] text-[#1C1917] leading-[1.78] whitespace-pre-line max-w-[68ch]">
                  {activeBranch.alternateNarrative}
                </div>
              </section>

              {/* Canon vs Altered Comparison */}
              <section className="border-t border-[#EFECE6] pt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#78716C]">Canon Outcome</p>
                  <p className="text-sm text-[#44403C] leading-relaxed">
                    {activeBranch.canonVsAltered.canonOutcome}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#9A3412]">Altered Outcome</p>
                  <p className="text-sm text-[#161514] leading-relaxed">
                    {activeBranch.canonVsAltered.alteredOutcome}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#44403C]">Thematic Shift</p>
                  <p className="text-sm text-[#44403C] leading-relaxed">
                    {activeBranch.canonVsAltered.thematicShift}
                  </p>
                </div>
              </section>

              {/* Interactive Refinement Bar */}
              <form
                onSubmit={(e) => void handleRefine(e)}
                className="border-t border-[#EFECE6] pt-6 space-y-3"
              >
                <label
                  htmlFor="refine-input"
                  className="block text-xs font-semibold text-[#44403C]"
                >
                  Continue or Refine This Timeline
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="refine-input"
                    type="text"
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    placeholder="e.g. Zoom into the final confrontation as sharp dialogue, or show 6 months later..."
                    className="flex-1 px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
                  />
                  <button
                    type="submit"
                    disabled={isRefining || !refinementText.trim()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#161514] text-white text-xs font-medium rounded-lg hover:bg-[#292524] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Refining...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Refine Timeline</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
