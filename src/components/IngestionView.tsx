import { useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Film,
  FileText,
  Loader2,
  Tv,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type { StoryAnalysis, StoryMedium } from '../types/story';
import { EditorialImage } from './EditorialImage';

interface IngestionViewProps {
  onAnalysisComplete: (story: StoryAnalysis, localMediaUrl?: string | null) => void;
  userId: string;
}

const MEDIUM_OPTIONS: Array<{ value: StoryMedium; label: string }> = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Web Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'novel', label: 'Novel' },
];

const CURATED_STARTERS: Array<{
  title: string;
  medium: StoryMedium;
  creatorName: string;
  scopeNotes: string;
}> = [
  {
    title: 'Breaking Bad — Ozymandias',
    medium: 'series',
    creatorName: 'Vince Gilligan',
    scopeNotes: 'Season 5 Episode 14 desert confrontation and family fallout',
  },
  {
    title: 'Attack on Titan',
    medium: 'anime',
    creatorName: 'Hajime Isayama',
    scopeNotes: 'Shiganshina & Marley arc turning points',
  },
  {
    title: 'Inception',
    medium: 'movie',
    creatorName: 'Christopher Nolan',
    scopeNotes: 'Limbo mission, Mal projection, and Cobb’s guilt',
  },
  {
    title: 'The Great Gatsby',
    medium: 'novel',
    creatorName: 'F. Scott Fitzgerald',
    scopeNotes: 'Plaza Hotel confrontation and Daisy’s decision',
  },
];

const UPLOAD_STEPS = [
  'Uploading media file to studio...',
  'Inspecting scenes, dialogue, and turning points...',
  'Studying creator’s prior works and narrative habits...',
  'Structuring story architecture and character flaws...',
];

const TITLE_STEPS = [
  'Mapping full story arc and pivotal turning points...',
  'Researching creator’s previous works via Google Search...',
  'Modeling the writer’s moral & structural worldview...',
];

export function IngestionView({ onAnalysisComplete, userId }: IngestionViewProps) {
  const [mode, setMode] = useState<'title' | 'upload'>('title');

  // Title mode state
  const [title, setTitle] = useState('');
  const [medium, setMedium] = useState<StoryMedium>('movie');
  const [creatorName, setCreatorName] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');

  // Upload mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCreator, setUploadCreator] = useState('');
  const [uploadMedium, setUploadMedium] = useState<StoryMedium>('uploaded_video');
  const [uploadNotes, setUploadNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setErrorMsg(null);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
    }
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const clearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const captureVideoTimestamp = () => {
    const vid = videoPreviewRef.current;
    if (!vid) return;
    const totalSec = Math.floor(vid.currentTime);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    setUploadNotes((prev) =>
      prev.trim()
        ? `${prev.trim()}\nPay special attention to timestamp ${formatted}.`
        : `Pay special attention to timestamp ${formatted}.`
    );
  };

  const runTitleAnalysis = async (e?: React.FormEvent, override?: typeof CURATED_STARTERS[number]) => {
    if (e) e.preventDefault();
    const targetTitle = override ? override.title : title.trim();
    const targetMedium = override ? override.medium : medium;
    const targetCreator = override ? override.creatorName : creatorName.trim();
    const targetNotes = override ? override.scopeNotes : scopeNotes.trim();

    if (!targetTitle) {
      setErrorMsg('Please enter a movie, series, anime, manga, or novel title.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    setStepIndex(0);

    const interval = window.setInterval(() => {
      setStepIndex((prev) => (prev < TITLE_STEPS.length - 1 ? prev + 1 : prev));
    }, 3500);

    try {
      const response = await fetch('/api/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: targetTitle,
          medium: targetMedium,
          creatorName: targetCreator,
          scopeNotes: targetNotes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze story.');
      }

      const newStory: StoryAnalysis = {
        id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId: userId,
        title: data.title || targetTitle,
        medium: targetMedium,
        creatorName: data.creatorName || targetCreator || 'Creator',
        sourceType: 'title',
        logline: data.logline || '',
        synopsis: data.synopsis || '',
        themes: Array.isArray(data.themes) ? data.themes : [],
        turningPoints: Array.isArray(data.turningPoints) ? data.turningPoints : [],
        characters: Array.isArray(data.characters) ? data.characters : [],
        authorProfile: data.authorProfile,
        status: 'analyzed',
      };

      onAnalysisComplete(newStory, null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete analysis.');
    } finally {
      window.clearInterval(interval);
      setIsSubmitting(false);
    }
  };

  const runUploadAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a video episode, movie, audio, or script file first.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    setStepIndex(0);

    const interval = window.setInterval(() => {
      setStepIndex((prev) => (prev < UPLOAD_STEPS.length - 1 ? prev + 1 : prev));
    }, 4500);

    try {
      const formData = new FormData();
      formData.append('media', selectedFile);
      formData.append('title', uploadTitle.trim());
      formData.append('creatorName', uploadCreator.trim());
      formData.append('medium', uploadMedium);
      formData.append('contextNotes', uploadNotes.trim());

      const response = await fetch('/api/analyze-upload', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 413) {
        throw new Error(
          'This file exceeds the 4.5 MB serverless upload limit on Vercel. Try uploading an .srt/.txt script or a shorter clip under 4 MB.'
        );
      }

      const rawText = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        throw new Error(rawText.slice(0, 200) || 'Unexpected response from server.');
      }

      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to analyze uploaded file.'
        );
      }

      const newStory: StoryAnalysis = {
        id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerId: userId,
        title: (data.title as string) || uploadTitle.trim() || selectedFile.name,
        medium: uploadMedium,
        creatorName: (data.creatorName as string) || uploadCreator.trim() || 'Inferred Storyteller',
        sourceType: 'upload',
        uploadedFileName: (data.uploadedFileName as string) || selectedFile.name,
        logline: (data.logline as string) || '',
        synopsis: (data.synopsis as string) || '',
        themes: Array.isArray(data.themes) ? (data.themes as string[]) : [],
        turningPoints: Array.isArray(data.turningPoints)
          ? (data.turningPoints as StoryAnalysis['turningPoints'])
          : [],
        characters: Array.isArray(data.characters)
          ? (data.characters as StoryAnalysis['characters'])
          : [],
        authorProfile: data.authorProfile as StoryAnalysis['authorProfile'],
        status: 'analyzed',
      };

      onAnalysisComplete(newStory, previewUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to analyze uploaded media.');
    } finally {
      window.clearInterval(interval);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Split-Screen Editorial Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border-b border-[#E5E0D5] pb-10">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 py-2">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#9A3412] tracking-wide">
              Narrative Counterfactual Studio · Film, Series, Anime &amp; Literature
            </p>
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#161514] leading-[1.12] [text-wrap:balance]">
              Rewrite the turning point through the original author’s mind.
            </h1>
            <p className="text-base text-[#57534E] leading-relaxed max-w-2xl">
              Upload an episode or movie from your device—or enter any film, series, anime, manga,
              or novel. We dissect the full story arc, study the creator’s previous works, and trace
              how they would actually continue the story if one choice changed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode('upload');
                workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-[#161514] text-white text-sm font-medium rounded-lg hover:bg-[#292524] transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Upload Episode or Movie</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('title');
                workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-white border border-[#D6D0C4] text-[#161514] text-sm font-medium rounded-lg hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>Analyze Known Work</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-64 sm:h-72 lg:h-full w-full overflow-hidden rounded-xl border border-[#E5E0D5] bg-[#EFECE6]">
            <EditorialImage
              src="/src/assets/images/hero_storyboard_desk_1794924178926.jpg"
              alt="Screenwriter and novelist desk with annotated script pages and 35mm film strip"
              caption="Story & Author Analysis Desk"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Main Ingestion Workspace */}
      <section ref={workspaceRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white border border-[#E5E0D5] rounded-2xl p-5 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFECE6] pb-5">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#161514]">
                01. Feed the Story
              </h2>
              <p className="text-sm text-[#57534E] mt-1">
                Choose a published work or upload your own video, audio, or script file.
              </p>
            </div>

            {/* Segmented Mode Control */}
            <div
              role="tablist"
              aria-label="Story input method"
              className="inline-flex p-1 bg-[#F3EFE6] rounded-lg border border-[#E5E0D5] self-start sm:self-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'title'}
                onClick={() => {
                  setMode('title');
                  setErrorMsg(null);
                }}
                className={`px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'title'
                    ? 'bg-white text-[#161514] shadow-sm'
                    : 'text-[#57534E] hover:text-[#161514]'
                }`}
              >
                Title &amp; Creator
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'upload'}
                onClick={() => {
                  setMode('upload');
                  setErrorMsg(null);
                }}
                className={`px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'upload'
                    ? 'bg-white text-[#161514] shadow-sm'
                    : 'text-[#57534E] hover:text-[#161514]'
                }`}
              >
                Upload File
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#991B1B]"
            >
              <span className="font-semibold">Analysis Error: </span>
              {errorMsg}
            </div>
          )}

          {mode === 'title' ? (
            <form onSubmit={(e) => void runTitleAnalysis(e)} className="space-y-5">
              {/* Medium Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#44403C]">
                  Story Medium
                </label>
                <div className="flex flex-wrap gap-2">
                  {MEDIUM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMedium(opt.value)}
                      className={`px-3.5 py-2 min-h-[44px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        medium === opt.value
                          ? 'bg-[#161514] text-white border-[#161514]'
                          : 'bg-[#FAF8F4] text-[#44403C] border-[#E5E0D5] hover:bg-[#F3EFE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="story-title" className="block text-xs font-semibold text-[#44403C]">
                    Movie, Series, Anime, Manga, or Book Title
                  </label>
                  <input
                    id="story-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Death Note, Parasite, Dune..."
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40 focus:border-[#B45309]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="creator-name" className="block text-xs font-semibold text-[#44403C]">
                    Writer / Director / Author (Optional)
                  </label>
                  <input
                    id="creator-name"
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. Bong Joon-ho, Tsugumi Ohba..."
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40 focus:border-[#B45309]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="scope-notes" className="block text-xs font-semibold text-[#44403C]">
                  Specific Episode, Arc, or Context Notes (Optional)
                </label>
                <textarea
                  id="scope-notes"
                  rows={3}
                  value={scopeNotes}
                  onChange={(e) => setScopeNotes(e.target.value)}
                  placeholder="Optional: focus on a specific season, episode, manga arc, or paste a short plot summary..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40 focus:border-[#B45309]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-[#78716C]">
                  Uses Google Search grounding to examine the writer’s previous works and style.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-[#9A3412] text-white text-sm font-medium rounded-lg hover:bg-[#7C2D12] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Story &amp; Author Mind</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void runUploadAnalysis(e)} className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0] ?? null;
                  handleFileSelect(file);
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-[#9A3412] bg-[#FFF7ED]'
                    : 'border-[#D6D0C4] bg-[#FAF8F4] hover:border-[#A8A29E]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.srt,.vtt,.txt,.md,.pdf"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  className="hidden"
                />

                {!selectedFile ? (
                  <div className="space-y-3 py-2">
                    <div className="w-11 h-11 rounded-full bg-white border border-[#E5E0D5] flex items-center justify-center mx-auto text-[#9A3412]">
                      <Video className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#161514]">
                        Drop an episode, movie, audio drama, or script file here
                      </p>
                      <p className="text-xs text-[#78716C]">
                        Supports MP4, WebM, MOV, MKV, MP3, WAV, PDF, SRT, and TXT up to 500 MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-white border border-[#D6D0C4] rounded-lg text-xs font-medium text-[#161514] hover:bg-[#F3EFE6] transition-colors"
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      <span>Choose File from Device</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between gap-3 bg-white border border-[#E5E0D5] rounded-lg p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-[#9A3412] shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#161514] truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs font-mono tabular-nums text-[#78716C]">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedFile}
                        aria-label="Remove selected file"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#57534E] hover:text-[#161514] rounded-lg hover:bg-[#F3EFE6]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {previewUrl && selectedFile.type.startsWith('video/') && (
                      <div className="space-y-2">
                        <video
                          ref={videoPreviewRef}
                          src={previewUrl}
                          controls
                          playsInline
                          className="w-full max-h-72 rounded-lg bg-black border border-[#E5E0D5]"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[#78716C]">
                            Scrub to a scene you want analyzed and mark its timestamp.
                          </p>
                          <button
                            type="button"
                            onClick={captureVideoTimestamp}
                            className="px-3 py-1.5 min-h-[36px] text-xs font-medium bg-white border border-[#D6D0C4] rounded-md hover:bg-[#F3EFE6] whitespace-nowrap shrink-0"
                          >
                            Mark Current Timestamp
                          </button>
                        </div>
                      </div>
                    )}

                    {previewUrl && selectedFile.type.startsWith('audio/') && (
                      <audio src={previewUrl} controls className="w-full" />
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="upload-title" className="block text-xs font-semibold text-[#44403C]">
                    Episode / Movie Title
                  </label>
                  <input
                    id="upload-title"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Auto-detected or custom title"
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="upload-creator" className="block text-xs font-semibold text-[#44403C]">
                    Writer / Director (If Known)
                  </label>
                  <input
                    id="upload-creator"
                    type="text"
                    value={uploadCreator}
                    onChange={(e) => setUploadCreator(e.target.value)}
                    placeholder="Enables prior-works research"
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="upload-medium" className="block text-xs font-semibold text-[#44403C]">
                    Format
                  </label>
                  <select
                    id="upload-medium"
                    value={uploadMedium}
                    onChange={(e) => setUploadMedium(e.target.value as StoryMedium)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
                  >
                    <option value="uploaded_video">Uploaded Movie / Episode</option>
                    <option value="series">TV / Web Series Episode</option>
                    <option value="anime">Anime Episode</option>
                    <option value="movie">Feature Film</option>
                    <option value="novel">Script / Manuscript</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="upload-notes" className="block text-xs font-semibold text-[#44403C]">
                  Scene Focus or Background Context (Optional)
                </label>
                <textarea
                  id="upload-notes"
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Optional: tell the agent which character or timestamp matters most..."
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#D6D0C4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B45309]/40"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-[#78716C]">
                  Your file is processed directly for scene analysis and automatically cleaned up afterward.
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-[#9A3412] text-white text-sm font-medium rounded-lg hover:bg-[#7C2D12] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Processing File...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Uploaded Media</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {isSubmitting && (
            <div className="p-4 rounded-xl bg-[#FAF8F4] border border-[#E5E0D5] flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-[#9A3412] animate-spin shrink-0" aria-hidden="true" />
              <p className="text-sm text-[#161514] font-medium">
                {mode === 'upload' ? UPLOAD_STEPS[stepIndex] : TITLE_STEPS[stepIndex]}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: How the Agent Thinks + Quick Starters */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
            <div className="h-40 w-full overflow-hidden bg-[#EFECE6]">
              <EditorialImage
                src="/src/assets/images/stage_film_reel_1794924179457.jpg"
                alt="35mm cinema frames on archival light table with storyboard margin notes"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-editorial text-lg font-semibold text-[#161514]">
                Why the Author’s Mind Matters
              </h3>
              <p className="text-sm text-[#57534E] leading-relaxed">
                Generic fan-fiction ignores why a story hurt or thrilled you. By studying the
                writer’s past works—their moral traps, pacing cadence, and thematic obsessions—each
                alternate timeline feels authored, not invented at random.
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E5E0D5] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-lg font-semibold text-[#161514]">
                Quick-Start Studies
              </h3>
              <span className="text-xs text-[#78716C]">Live AI Analysis</span>
            </div>
            <div className="divide-y divide-[#EFECE6]">
              {CURATED_STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setMode('title');
                    setTitle(starter.title);
                    setMedium(starter.medium);
                    setCreatorName(starter.creatorName);
                    setScopeNotes(starter.scopeNotes);
                    void runTitleAnalysis(undefined, starter);
                  }}
                  className="w-full py-3 min-h-[44px] flex items-center justify-between gap-3 text-left hover:bg-[#FAF8F4] px-2 -mx-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#161514] truncate">{starter.title}</p>
                    <p className="text-xs text-[#78716C] truncate">
                      {starter.medium.charAt(0).toUpperCase() + starter.medium.slice(1)} ·{' '}
                      {starter.creatorName}
                    </p>
                  </div>
                  <div className="shrink-0 text-[#9A3412]">
                    {starter.medium === 'series' ? (
                      <Tv className="w-4 h-4" aria-hidden="true" />
                    ) : starter.medium === 'novel' ? (
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Film className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
