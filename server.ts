import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel, createPartFromUri } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const uploadDir = path.join(os.tmpdir(), 'auteurfork-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max upload for movies/episodes
  },
});

interface GroundingLink {
  title: string;
  uri: string;
}

function extractGroundingSources(response: unknown): GroundingLink[] {
  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const links: GroundingLink[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      links.push({
        uri: uri.slice(0, 580),
        title: (title || uri).slice(0, 180),
      });
    }
    if (links.length >= 10) break;
  }
  return links;
}

async function researchAuthorWithGrounding(
  ai: GoogleGenAI,
  creatorName: string,
  title: string,
  medium: string
): Promise<{ dossier: string; sources: GroundingLink[] }> {
  const prompt = `Research the writer, director, mangaka, or showrunner "${creatorName}" (creator associated with "${title}", medium: ${medium}).
Analyze their PREVIOUS works, interviews, narrative instincts, recurring moral dilemmas, pacing structure, character psychology, and how they typically resolve tension or tragedy.
Provide a rich analytical dossier covering:
1. Key previous works and what each reveals about their storytelling mind.
2. Their philosophical worldview and core thematic obsessions.
3. How they treat character agency, hubris, redemption, or unintended consequences.
4. Their pacing rhythm, dialogue cadence, and signature ending tendencies.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    },
  });

  return {
    dossier: response.text ?? '',
    sources: extractGroundingSources(response),
  };
}

const storyAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    creatorName: { type: Type.STRING },
    logline: { type: Type.STRING },
    synopsis: { type: Type.STRING },
    themes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    turningPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          timestampOrChapter: { type: Type.STRING },
          description: { type: Type.STRING },
          canonChoice: { type: Type.STRING },
          emotionalStakes: { type: Type.STRING },
        },
        required: ['title', 'timestampOrChapter', 'description', 'canonChoice', 'emotionalStakes'],
      },
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          coreDesire: { type: Type.STRING },
          fatalFlaw: { type: Type.STRING },
          arcSummary: { type: Type.STRING },
        },
        required: ['name', 'role', 'coreDesire', 'fatalFlaw', 'arcSummary'],
      },
    },
    authorProfile: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        worldview: { type: Type.STRING },
        recurringMotifs: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        pacingStyle: { type: Type.STRING },
        characterPhilosophy: { type: Type.STRING },
        previousWorksSummary: { type: Type.STRING },
        signatureEndingBias: { type: Type.STRING },
      },
      required: [
        'name',
        'worldview',
        'recurringMotifs',
        'pacingStyle',
        'characterPhilosophy',
        'previousWorksSummary',
        'signatureEndingBias',
      ],
    },
  },
  required: [
    'title',
    'creatorName',
    'logline',
    'synopsis',
    'themes',
    'turningPoints',
    'characters',
    'authorProfile',
  ],
};

const branchSchema = {
  type: Type.OBJECT,
  properties: {
    authorReasoning: { type: Type.STRING },
    butterflyChain: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.STRING },
          affectedCharacter: { type: Type.STRING },
          consequence: { type: Type.STRING },
          echoFromCanon: { type: Type.STRING },
        },
        required: ['step', 'affectedCharacter', 'consequence', 'echoFromCanon'],
      },
    },
    alternateNarrative: { type: Type.STRING },
    canonVsAltered: {
      type: Type.OBJECT,
      properties: {
        canonOutcome: { type: Type.STRING },
        alteredOutcome: { type: Type.STRING },
        thematicShift: { type: Type.STRING },
      },
      required: ['canonOutcome', 'alteredOutcome', 'thematicShift'],
    },
  },
  required: ['authorReasoning', 'butterflyChain', 'alternateNarrative', 'canonVsAltered'],
};

function formatApiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('GEMINI_API_KEY')) {
    return { status: 500, message: msg };
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API access denied. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit or quota reached on the Gemini API. Please wait a moment and try again.',
    };
  }
  return { status: 500, message: msg || 'Unexpected server error.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 1. Analyze an existing movie, web series, anime, manga, or novel + its creator's previous works
  app.post('/api/analyze-story', async (req: Request, res: Response) => {
    try {
      const { title, medium, creatorName, scopeNotes } = req.body as {
        title?: string;
        medium?: string;
        creatorName?: string;
        scopeNotes?: string;
      };

      if (!title?.trim()) {
        res.status(400).json({ error: 'Story title is required.' });
        return;
      }

      const ai = getAiClient();
      const effectiveMedium = medium?.trim() || 'movie';
      const effectiveCreator = creatorName?.trim() || `primary creator/writer of ${title.trim()}`;

      // Parallel grounded research on both the work and the creator's previous works
      const [authorResearch, storyResearch] = await Promise.all([
        researchAuthorWithGrounding(ai, effectiveCreator, title.trim(), effectiveMedium),
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Provide a comprehensive narrative breakdown of "${title.trim()}" (${effectiveMedium})${
            creatorName?.trim() ? ` by ${creatorName.trim()}` : ''
          }.${scopeNotes?.trim() ? `\nSpecific focus/notes from user: ${scopeNotes.trim()}` : ''}
Cover the full plot arc, central conflict, key characters with their desires and fatal flaws, and 5-8 decisive turning points (moments where a single choice or incident changed everything).`,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        }),
      ]);

      const combinedSources = [...authorResearch.sources];
      for (const s of extractGroundingSources(storyResearch)) {
        if (!combinedSources.some((existing) => existing.uri === s.uri) && combinedSources.length < 12) {
          combinedSources.push(s);
        }
      }

      const synthesisPrompt = `You are a master literary critic, dramaturge, and narrative psychologist.
Synthesize the full story breakdown and the writer/author cognitive profile into clean, authoritative structured JSON.

STORY RESEARCH:
${storyResearch.text ?? ''}

AUTHOR / CREATOR RESEARCH DOSSIER:
${authorResearch.dossier}

REQUIREMENTS:
- Identify the exact creator/writer/author name in "creatorName" and "authorProfile.name".
- "themes": 4 to 7 concise thematic phrases (under 80 chars each).
- "turningPoints": 5 to 8 decisive pivot moments in chronological order, specifying timestamp/episode/chapter, what happened, what choice was made, and the emotional stakes.
- "characters": 4 to 8 central characters with role, coreDesire, fatalFlaw, and arcSummary.
- "authorProfile": Deep psychological & structural profile grounded in their PREVIOUS works, showing *how this writer thinks* when characters make irreversible choices.`;

      const structured = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: synthesisPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: storyAnalysisSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const parsed = JSON.parse((structured.text ?? '{}').trim());
      parsed.authorProfile = {
        ...parsed.authorProfile,
        groundingSources: combinedSources,
      };

      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 2. Analyze an uploaded episode, movie, audio, subtitle, or script file
  app.post('/api/analyze-upload', upload.single('media'), async (req: Request, res: Response) => {
    const uploadedFile = req.file;
    let geminiFileName: string | null = null;

    try {
      if (!uploadedFile) {
        res.status(400).json({ error: 'Please select an episode, movie, audio, or script file to upload.' });
        return;
      }

      const { title, creatorName, medium, contextNotes } = req.body as {
        title?: string;
        creatorName?: string;
        medium?: string;
        contextNotes?: string;
      };

      const ai = getAiClient();
      const ext = path.extname(uploadedFile.originalname).toLowerCase();
      const isTextBased = ['.txt', '.md', '.srt', '.vtt', '.csv', '.json'].includes(ext) || uploadedFile.mimetype.startsWith('text/');

      let rawMediaAnalysis = '';

      if (isTextBased) {
        const textContent = await fs.promises.readFile(uploadedFile.path, 'utf-8');
        const truncated = textContent.slice(0, 180000);
        const textResp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Analyze this uploaded script/subtitle/manuscript file ("${uploadedFile.originalname}")${
            title?.trim() ? ` titled "${title.trim()}"` : ''
          }${creatorName?.trim() ? ` by ${creatorName.trim()}` : ''}.
${contextNotes?.trim() ? `User notes: ${contextNotes.trim()}\n` : ''}
Provide a detailed chronological scene-by-scene breakdown with timestamps/markers, all characters and their psychological motivations, the visual/tonal cues, and every pivotal turning point where an alternate decision or incident could branch the story.

CONTENT:
${truncated}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          },
        });
        rawMediaAnalysis = textResp.text ?? '';
      } else {
        const mimeType = uploadedFile.mimetype || (ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : ext === '.pdf' ? 'application/pdf' : 'video/mp4');

        const uploaded = await ai.files.upload({
          file: uploadedFile.path,
          config: {
            mimeType,
            displayName: uploadedFile.originalname,
          },
        });

        geminiFileName = uploaded.name ?? null;
        if (!geminiFileName) {
          throw new Error('Failed to register uploaded media file for analysis.');
        }

        // Poll until the uploaded movie/episode is ACTIVE
        let fileState = uploaded.state;
        let activeUri = uploaded.uri;
        let activeMime = uploaded.mimeType ?? mimeType;
        let attempts = 0;

        while (fileState === 'PROCESSING' && attempts < 60) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          const checked = await ai.files.get({ name: geminiFileName });
          fileState = checked.state;
          activeUri = checked.uri;
          activeMime = checked.mimeType ?? mimeType;
          attempts++;
        }

        if (fileState !== 'ACTIVE' || !activeUri) {
          throw new Error(`Media processing did not complete cleanly (state: ${fileState ?? 'unknown'}).`);
        }

        const mediaPart = createPartFromUri(activeUri, activeMime);
        const mediaResp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [
            mediaPart,
            `Watch/read this entire uploaded ${medium || 'episode/movie'} ("${uploadedFile.originalname}") carefully from start to finish.
${title?.trim() ? `Title provided by user: "${title.trim()}". ` : ''}
${creatorName?.trim() ? `Writer/Director provided by user: "${creatorName.trim()}". ` : ''}
${contextNotes?.trim() ? `Context notes: ${contextNotes.trim()}. ` : ''}

Extract:
1. Exact story logline and comprehensive chronological synopsis with concrete scene timestamps (MM:SS).
2. All visible/speaking characters, their underlying desires, flaws, and dynamics.
3. 5 to 8 decisive turning points with exact timestamps where a different decision or external incident would radically alter the narrative.
4. Directorial/writing style clues observable in pacing, framing, dialogue subtext, and thematic tension (plus identify the writer/director if recognizable or specified).`,
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          },
        });
        rawMediaAnalysis = mediaResp.text ?? '';
      }

      // Research the writer/director's previous works if a creator name is known or inferred
      const effectiveTitle = title?.trim() || path.basename(uploadedFile.originalname, ext);
      const effectiveCreator = creatorName?.trim() || '';
      let authorDossier = '';
      let groundingSources: GroundingLink[] = [];

      if (effectiveCreator) {
        const authorRes = await researchAuthorWithGrounding(
          ai,
          effectiveCreator,
          effectiveTitle,
          medium || 'uploaded_video'
        );
        authorDossier = authorRes.dossier;
        groundingSources = authorRes.sources;
      }

      const synthesisPrompt = `Synthesize the following direct media analysis${
        authorDossier ? ' and writer/director previous-works research' : ''
      } into structured JSON.

MEDIA FILE ANALYSIS (${uploadedFile.originalname}):
${rawMediaAnalysis}

${authorDossier ? `CREATOR / WRITER PREVIOUS WORKS DOSSIER:\n${authorDossier}` : 'Note: If no specific public creator was named, infer the storyteller’s narrative sensibility, pacing discipline, and moral logic directly from the uploaded work itself.'}

REQUIREMENTS:
- "title": Clear title ("${effectiveTitle}" or refined title from content).
- "creatorName": "${effectiveCreator || 'Inferred Storyteller (Uploaded Work)'}".
- "themes": 4 to 7 themes.
- "turningPoints": 5 to 8 timestamped pivot moments observed directly in the uploaded file.
- "characters": Key characters observed in the uploaded file.
- "authorProfile": Detailed profile of the creator's storytelling psychology and previous-work tendencies.`;

      const structured = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: synthesisPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: storyAnalysisSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const parsed = JSON.parse((structured.text ?? '{}').trim());
      parsed.uploadedFileName = uploadedFile.originalname;
      parsed.authorProfile = {
        ...parsed.authorProfile,
        groundingSources,
      };

      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    } finally {
      if (uploadedFile?.path) {
        fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      if (geminiFileName) {
        try {
          const ai = getAiClient();
          await ai.files.delete({ name: geminiFileName });
        } catch {
          // Ignore cleanup failures
        }
      }
    }
  });

  // 3. Generate Counterfactual "What If" story branch through the author's mind
  app.post('/api/generate-branch', async (req: Request, res: Response) => {
    try {
      const {
        story,
        pivotTitle,
        userChange,
        divergenceDepth,
        formatStyle,
      } = req.body as {
        story?: {
          title: string;
          medium: string;
          creatorName: string;
          logline: string;
          synopsis: string;
          characters: Array<{ name: string; role: string; coreDesire: string; fatalFlaw: string }>;
          authorProfile: {
            name: string;
            worldview: string;
            recurringMotifs: string[];
            pacingStyle: string;
            characterPhilosophy: string;
            previousWorksSummary: string;
            signatureEndingBias: string;
          };
        };
        pivotTitle?: string;
        userChange?: string;
        divergenceDepth?: 'ripple' | 'cascade' | 'inversion';
        formatStyle?: 'prose' | 'screenplay' | 'episode_outline';
      };

      if (!story || !userChange?.trim()) {
        res.status(400).json({ error: 'Story analysis and the counterfactual change are required.' });
        return;
      }

      const ai = getAiClient();
      const depthLabel =
        divergenceDepth === 'inversion'
          ? 'Thematic Inversion — overhaul the entire remaining trajectory and ending while preserving the author’s moral gravity'
          : divergenceDepth === 'cascade'
          ? 'Domino Cascade — trace multi-act consequences across every major subplot and character relationship'
          : 'Ripple Effect — focus tightly on the immediate aftermath, next scene/chapter/episode, and subtle psychological fallout';

      const formatInstruction =
        formatStyle === 'screenplay'
          ? 'Write "alternateNarrative" as a vivid screenplay/teleplay sequence with scene headings (INT./EXT.), visual action lines, and character dialogue that sounds unmistakably like the original writer.'
          : formatStyle === 'episode_outline'
          ? 'Write "alternateNarrative" as a structured Act-by-Act episode/chapter treatment detailing beats, confrontations, and closing image.'
          : 'Write "alternateNarrative" as immersive literary/narrative prose in the exact cadence, tone, and emotional restraint of the original creator.';

      const prompt = `You are simulating the creative mind of ${story.authorProfile.name || story.creatorName} rewriting their own work "${story.title}" (${story.medium}).

CANONICAL STORY CONTEXT:
Logline: ${story.logline}
Synopsis: ${story.synopsis}
Characters:
${story.characters.map((c) => `- ${c.name} (${c.role}): Desire = ${c.coreDesire}; Flaw = ${c.fatalFlaw}`).join('\n')}

AUTHOR COGNITIVE MODEL (FROM PREVIOUS WORKS & THIS STORY):
- Worldview: ${story.authorProfile.worldview}
- Previous Works Pattern: ${story.authorProfile.previousWorksSummary}
- Character Philosophy: ${story.authorProfile.characterPhilosophy}
- Pacing Style: ${story.authorProfile.pacingStyle}
- Recurring Motifs: ${story.authorProfile.recurringMotifs.join(', ')}
- Signature Ending Bias: ${story.authorProfile.signatureEndingBias}

USER'S COUNTERFACTUAL INTERVENTION:
- Pivot Point: ${pivotTitle || 'Custom Turning Point'}
- Proposed Change: ${userChange.trim()}
- Divergence Scope: ${depthLabel}

INSTRUCTIONS:
1. "authorReasoning": Explain clearly why ${story.authorProfile.name || story.creatorName} would steer the altered premise in THIS specific direction rather than cheap fan-fiction. Explicitly cite patterns from their previous works and character philosophy.
2. "butterflyChain": 5 to 7 causal steps showing how this single change ripples through characters' flaws and unresolved conflicts.
3. "alternateNarrative": ${formatInstruction} Aim for rich, gripping storytelling (600–1,000 words).
4. "canonVsAltered": Contrast canonOutcome, alteredOutcome, and thematicShift.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: branchSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // 4. Refine / continue an existing branch based on user direction
  app.post('/api/refine-branch', async (req: Request, res: Response) => {
    try {
      const { story, branch, refinementPrompt } = req.body as {
        story?: { title: string; creatorName: string; authorProfile: { name: string; worldview: string; pacingStyle: string } };
        branch?: {
          pivotTitle: string;
          userChange: string;
          authorReasoning: string;
          butterflyChain: Array<{ step: string; affectedCharacter: string; consequence: string; echoFromCanon: string }>;
          alternateNarrative: string;
          canonVsAltered: { canonOutcome: string; alteredOutcome: string; thematicShift: string };
        };
        refinementPrompt?: string;
      };

      if (!story || !branch || !refinementPrompt?.trim()) {
        res.status(400).json({ error: 'Story, branch, and refinement instruction are required.' });
        return;
      }

      const ai = getAiClient();
      const prompt = `You are continuing/refining an alternate timeline for "${story.title}" in the authentic voice of ${
        story.authorProfile?.name || story.creatorName
      } (Worldview: ${story.authorProfile?.worldview}; Pacing: ${story.authorProfile?.pacingStyle}).

EXISTING BRANCH:
Pivot: ${branch.pivotTitle}
Change: ${branch.userChange}
Current Narrative:
${branch.alternateNarrative}

USER REFINEMENT REQUEST:
${refinementPrompt.trim()}

Update the branch (authorReasoning, butterflyChain, alternateNarrative, canonVsAltered) to fulfill the user's request while staying fiercely loyal to the original writer's mind and character flaws.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: branchSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AuteurFork server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
