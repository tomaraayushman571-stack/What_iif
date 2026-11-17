export type StoryMedium =
  | 'movie'
  | 'series'
  | 'anime'
  | 'manga'
  | 'novel'
  | 'uploaded_video';

export type DivergenceDepth = 'ripple' | 'cascade' | 'inversion';

export type NarrativeFormat = 'prose' | 'screenplay' | 'episode_outline';

export interface TurningPoint {
  title: string;
  timestampOrChapter: string;
  description: string;
  canonChoice: string;
  emotionalStakes: string;
}

export interface CharacterProfile {
  name: string;
  role: string;
  coreDesire: string;
  fatalFlaw: string;
  arcSummary: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AuthorProfile {
  name: string;
  worldview: string;
  recurringMotifs: string[];
  pacingStyle: string;
  characterPhilosophy: string;
  previousWorksSummary: string;
  signatureEndingBias: string;
  groundingSources: GroundingSource[];
}

export interface StoryAnalysis {
  id: string;
  ownerId: string;
  title: string;
  medium: StoryMedium;
  creatorName: string;
  sourceType: 'title' | 'upload';
  uploadedFileName?: string;
  logline: string;
  synopsis: string;
  themes: string[];
  turningPoints: TurningPoint[];
  characters: CharacterProfile[];
  authorProfile: AuthorProfile;
  status: 'analyzed' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ButterflyStep {
  step: string;
  affectedCharacter: string;
  consequence: string;
  echoFromCanon: string;
}

export interface CanonComparison {
  canonOutcome: string;
  alteredOutcome: string;
  thematicShift: string;
}

export interface StoryBranch {
  id: string;
  storyId: string;
  ownerId: string;
  pivotTitle: string;
  userChange: string;
  divergenceDepth: DivergenceDepth;
  authorReasoning: string;
  butterflyChain: ButterflyStep[];
  alternateNarrative: string;
  canonVsAltered: CanonComparison;
  status: 'generated' | 'pinned';
  createdAt?: unknown;
  updatedAt?: unknown;
}
