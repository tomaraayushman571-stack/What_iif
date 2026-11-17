import { useRef } from 'react';
import { ArrowRight, ExternalLink, GitBranch, Play } from 'lucide-react';
import type { StoryAnalysis, TurningPoint } from '../types/story';
import { EditorialImage } from './EditorialImage';

interface AnalysisViewProps {
  story: StoryAnalysis;
  localMediaUrl: string | null;
  onSelectPivotForWhatIf: (pivot: TurningPoint) => void;
  onOpenCustomWhatIf: () => void;
}

function parseTimestampToSeconds(label: string): number | null {
  const match = label.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  if (match[3] !== undefined) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function AnalysisView({
  story,
  localMediaUrl,
  onSelectPivotForWhatIf,
  onOpenCustomWhatIf,
}: AnalysisViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const seekToTimestamp = (label: string) => {
    const secs = parseTimestampToSeconds(label);
    if (secs !== null && videoRef.current) {
      videoRef.current.currentTime = secs;
      void videoRef.current.play().catch(() => {});
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const ap = story.authorProfile;

  return (
    <div className="space-y-12 pb-16">
      {/* Masthead */}
      <section className="border-b border-[#E5E0D5] pb-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
              <span className="font-semibold text-[#9A3412] capitalize">
                {story.medium.replace('_', ' ')}
              </span>
              <span aria-hidden="true">·</span>
              <span>Creator: {story.creatorName}</span>
              {story.uploadedFileName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{story.uploadedFileName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {story.turningPoints.length} Turning Points
              </span>
            </div>

            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#161514] [text-wrap:balance]">
              {story.title}
            </h1>

            <p className="text-base sm:text-lg text-[#44403C] leading-relaxed">
              {story.logline}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCustomWhatIf}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#9A3412] text-white text-sm font-medium rounded-lg hover:bg-[#7C2D12] transition-colors whitespace-nowrap shrink-0 self-start md:self-end"
          >
            <GitBranch className="w-4 h-4" aria-hidden="true" />
            <span>Open What-If Studio</span>
          </button>
        </div>

        {story.themes.length > 0 && (
          <div className="text-xs text-[#57534E] pt-1">
            <span className="font-semibold text-[#161514] mr-2">Core Themes:</span>
            {story.themes.map((theme, idx) => (
              <span key={theme}>
                {idx > 0 && (
                  <span aria-hidden="true" className="mx-2 text-[#A8A29E]">
                    ·
                  </span>
                )}
                <span>{theme}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Active Uploaded Media Player if present in session */}
      {localMediaUrl && (
        <section className="bg-white border border-[#E5E0D5] rounded-2xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-editorial text-xl font-semibold text-[#161514]">
              Uploaded Media Screening Room
            </h2>
            <span className="text-xs text-[#78716C]">
              Click any timestamp below to jump directly to that turning point
            </span>
          </div>
          <video
            ref={videoRef}
            src={localMediaUrl}
            controls
            playsInline
            className="w-full max-h-[440px] rounded-xl bg-black"
          />
        </section>
      )}

      {/* 01. Story Synopsis & Character Architecture */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="font-editorial text-2xl font-semibold text-[#161514]">
            01. Whole Story Architecture
          </h2>
          <div className="text-[15px] text-[#292524] leading-[1.7] whitespace-pre-line">
            {story.synopsis}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-4">
            <h3 className="font-editorial text-xl font-semibold text-[#161514]">
              Key Characters &amp; Fatal Flaws
            </h3>
            <div className="divide-y divide-[#EFECE6]">
              {story.characters.map((ch) => (
                <div key={ch.name} className="py-4 first:pt-1 last:pb-1 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#161514]">{ch.name}</p>
                    <p className="text-xs text-[#78716C] truncate">{ch.role}</p>
                  </div>
                  <p className="text-xs text-[#44403C]">
                    <span className="font-medium text-[#161514]">Desire:</span> {ch.coreDesire}
                  </p>
                  <p className="text-xs text-[#9A3412]">
                    <span className="font-medium">Flaw:</span> {ch.fatalFlaw}
                  </p>
                  <p className="text-xs text-[#57534E] leading-relaxed">{ch.arcSummary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 02. Author / Writer Cognitive Dossier */}
      <section className="bg-white border border-[#E5E0D5] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-[#EFECE6] pb-6">
          <div className="lg:col-span-8 space-y-2">
            <p className="text-xs font-medium text-[#9A3412]">
              Author Cognitive Dossier · Synthesized from Previous Works
            </p>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#161514]">
              02. Inside {ap.name}’s Storytelling Mind
            </h2>
            <p className="text-sm text-[#57534E] leading-relaxed max-w-3xl">
              {ap.worldview}
            </p>
          </div>
          <div className="lg:col-span-4 h-36 rounded-xl overflow-hidden border border-[#E5E0D5] bg-[#EFECE6]">
            <EditorialImage
              src="/src/assets/images/stage_manuscript_ink_1794924181624.jpg"
              alt="Annotated literary manuscript with bronze paperweight"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#161514]">
                Patterns from Previous Works
              </h3>
              <p className="text-sm text-[#44403C] leading-relaxed mt-1.5 whitespace-pre-line">
                {ap.previousWorksSummary}
              </p>
            </div>
            <div className="pt-3 border-t border-[#EFECE6]">
              <h3 className="text-sm font-semibold text-[#161514]">
                Character &amp; Consequence Philosophy
              </h3>
              <p className="text-sm text-[#44403C] leading-relaxed mt-1.5">
                {ap.characterPhilosophy}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#161514]">
                Pacing &amp; Structural Rhythm
              </h3>
              <p className="text-sm text-[#44403C] leading-relaxed mt-1.5">
                {ap.pacingStyle}
              </p>
            </div>
            <div className="pt-3 border-t border-[#EFECE6]">
              <h3 className="text-sm font-semibold text-[#161514]">
                Signature Ending Tendency
              </h3>
              <p className="text-sm text-[#44403C] leading-relaxed mt-1.5">
                {ap.signatureEndingBias}
              </p>
            </div>
            {ap.recurringMotifs?.length > 0 && (
              <div className="pt-3 border-t border-[#EFECE6]">
                <h3 className="text-sm font-semibold text-[#161514]">Recurring Motifs</h3>
                <p className="text-sm text-[#57534E] mt-1.5">
                  {ap.recurringMotifs.join(' · ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {ap.groundingSources && ap.groundingSources.length > 0 && (
          <div className="pt-4 border-t border-[#EFECE6] space-y-2">
            <p className="text-xs font-semibold text-[#57534E]">
              Research Sources Consulted
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ap.groundingSources.map((src) => (
                <a
                  key={src.uri}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#9A3412] hover:underline"
                >
                  <span className="truncate max-w-[240px]">{src.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 03. Decisive Turning Points */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#161514]">
              03. Decisive Turning Points
            </h2>
            <p className="text-sm text-[#57534E] mt-1">
              Select any moment below to alter a character’s choice or incident and explore the
              author-faithful fallout.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E5E0D5] rounded-2xl divide-y divide-[#EFECE6]">
          {story.turningPoints.map((tp, index) => {
            const seekable = localMediaUrl && parseTimestampToSeconds(tp.timestampOrChapter) !== null;
            return (
              <div
                key={`${tp.title}-${index}`}
                className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                    <span className="font-mono tabular-nums font-medium text-[#161514]">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <span className="font-mono tabular-nums">{tp.timestampOrChapter}</span>
                    {seekable && (
                      <button
                        type="button"
                        onClick={() => seekToTimestamp(tp.timestampOrChapter)}
                        className="inline-flex items-center gap-1 text-[#9A3412] hover:underline font-medium"
                      >
                        <Play className="w-3 h-3" aria-hidden="true" />
                        <span>Jump to scene</span>
                      </button>
                    )}
                  </div>

                  <h3 className="font-editorial text-lg font-semibold text-[#161514]">
                    {tp.title}
                  </h3>
                  <p className="text-sm text-[#44403C] leading-relaxed">{tp.description}</p>
                  <div className="text-xs text-[#57534E] space-y-1 pt-1">
                    <p>
                      <span className="font-semibold text-[#161514]">Canonical Choice: </span>
                      {tp.canonChoice}
                    </p>
                    <p>
                      <span className="font-semibold text-[#161514]">Stakes: </span>
                      {tp.emotionalStakes}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPivotForWhatIf(tp)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#FAF8F4] border border-[#D6D0C4] text-[#161514] text-xs font-semibold rounded-lg hover:bg-[#161514] hover:text-white hover:border-[#161514] transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
                >
                  <span>Fork from This Moment</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
