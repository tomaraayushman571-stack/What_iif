import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { StoryAnalysis, StoryBranch } from '../types/story';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `item_${Date.now()}`;
}

function clampStr(value: string | undefined, maxLen: number, fallback = ''): string {
  const str = (value ?? fallback).trim();
  if (!str) return fallback;
  return str.slice(0, maxLen);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const payload: Record<string, unknown> = {
      uid: user.uid,
      displayName: clampStr(user.displayName ?? user.email?.split('@')[0], 120, 'Reader'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      payload.photoURL = clampStr(user.photoURL, 500);
    }
    await setDoc(ref, payload, { merge: false }).catch(async () => {
      // If profile already exists, update mutable fields only
      const updatePayload: Record<string, unknown> = {
        displayName: clampStr(user.displayName ?? user.email?.split('@')[0], 120, 'Reader'),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        updatePayload.photoURL = clampStr(user.photoURL, 500);
      }
      await updateDoc(ref, updatePayload);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function sanitizeStoryForFirestore(story: StoryAnalysis, ownerId: string): Record<string, unknown> {
  const id = sanitizeId(story.id);
  const themes = (story.themes || []).slice(0, 12).map((t) => clampStr(t, 120, 'Theme'));
  const turningPoints = (story.turningPoints || []).slice(0, 20).map((tp) => ({
    title: clampStr(tp.title, 240, 'Turning Point'),
    timestampOrChapter: clampStr(tp.timestampOrChapter, 120, 'Key Moment'),
    description: clampStr(tp.description, 1200, 'Narrative pivot'),
    canonChoice: clampStr(tp.canonChoice, 800, 'Canonical choice'),
    emotionalStakes: clampStr(tp.emotionalStakes, 600, 'High stakes'),
  }));
  const characters = (story.characters || []).slice(0, 25).map((ch) => ({
    name: clampStr(ch.name, 160, 'Character'),
    role: clampStr(ch.role, 160, 'Role'),
    coreDesire: clampStr(ch.coreDesire, 600, 'Desire'),
    fatalFlaw: clampStr(ch.fatalFlaw, 600, 'Flaw'),
    arcSummary: clampStr(ch.arcSummary, 1000, 'Arc'),
  }));

  const ap = story.authorProfile;
  const authorProfile = {
    name: clampStr(ap?.name || story.creatorName, 160, 'Creator'),
    worldview: clampStr(ap?.worldview, 4000, 'Moral consequence drives character transformation.'),
    recurringMotifs: (ap?.recurringMotifs || []).slice(0, 15).map((m) => clampStr(m, 200, 'Motif')),
    pacingStyle: clampStr(ap?.pacingStyle, 2000, 'Deliberate escalation toward crisis.'),
    characterPhilosophy: clampStr(ap?.characterPhilosophy, 3000, 'Characters face the cost of their own flaws.'),
    previousWorksSummary: clampStr(ap?.previousWorksSummary, 6000, 'Draws on thematic patterns across earlier works.'),
    signatureEndingBias: clampStr(ap?.signatureEndingBias, 2000, 'Earned, bittersweet consequences.'),
    groundingSources: (ap?.groundingSources || []).slice(0, 15).map((g) => ({
      title: clampStr(g.title, 200, 'Reference'),
      uri: clampStr(g.uri, 600, 'https://example.com'),
    })),
  };

  const payload: Record<string, unknown> = {
    id,
    ownerId,
    title: clampStr(story.title, 200, 'Untitled Story'),
    medium: story.medium,
    creatorName: clampStr(story.creatorName, 160, 'Creator'),
    sourceType: story.sourceType,
    logline: clampStr(story.logline, 2000, 'Story logline'),
    synopsis: clampStr(story.synopsis, 12000, 'Story synopsis'),
    themes,
    turningPoints,
    characters,
    authorProfile,
    status: 'analyzed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (story.uploadedFileName) {
    payload.uploadedFileName = clampStr(story.uploadedFileName, 260);
  }

  return payload;
}

export async function saveStoryToFirestore(story: StoryAnalysis, ownerId: string): Promise<void> {
  const id = sanitizeId(story.id);
  const path = `stories/${id}`;
  try {
    const payload = sanitizeStoryForFirestore({ ...story, id }, ownerId);
    await setDoc(doc(db, 'stories', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function archiveStoryInFirestore(storyId: string): Promise<void> {
  const id = sanitizeId(storyId);
  const path = `stories/${id}`;
  try {
    await updateDoc(doc(db, 'stories', id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStoryFromFirestore(storyId: string): Promise<void> {
  const id = sanitizeId(storyId);
  const path = `stories/${id}`;
  try {
    await deleteDoc(doc(db, 'stories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBranchToFirestore(branch: StoryBranch, ownerId: string): Promise<void> {
  const storyId = sanitizeId(branch.storyId);
  const branchId = sanitizeId(branch.id);
  const path = `stories/${storyId}/branches/${branchId}`;
  try {
    const payload = {
      id: branchId,
      storyId,
      ownerId,
      pivotTitle: clampStr(branch.pivotTitle, 240, 'Custom Pivot'),
      userChange: clampStr(branch.userChange, 3000, 'Counterfactual intervention'),
      divergenceDepth: branch.divergenceDepth,
      authorReasoning: clampStr(branch.authorReasoning, 8000, 'Author reasoning'),
      butterflyChain: (branch.butterflyChain || []).slice(0, 15).map((b) => ({
        step: clampStr(b.step, 240, 'Step'),
        affectedCharacter: clampStr(b.affectedCharacter, 160, 'Character'),
        consequence: clampStr(b.consequence, 1200, 'Consequence'),
        echoFromCanon: clampStr(b.echoFromCanon, 800, 'Echo'),
      })),
      alternateNarrative: clampStr(branch.alternateNarrative, 30000, 'Alternate narrative'),
      canonVsAltered: {
        canonOutcome: clampStr(branch.canonVsAltered?.canonOutcome, 3000, 'Canon outcome'),
        alteredOutcome: clampStr(branch.canonVsAltered?.alteredOutcome, 3000, 'Altered outcome'),
        thematicShift: clampStr(branch.canonVsAltered?.thematicShift, 3000, 'Thematic shift'),
      },
      status: branch.status === 'pinned' ? 'pinned' : 'generated',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'stories', storyId, 'branches', branchId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBranchInFirestore(branch: StoryBranch): Promise<void> {
  const storyId = sanitizeId(branch.storyId);
  const branchId = sanitizeId(branch.id);
  const path = `stories/${storyId}/branches/${branchId}`;
  try {
    await updateDoc(doc(db, 'stories', storyId, 'branches', branchId), {
      authorReasoning: clampStr(branch.authorReasoning, 8000, 'Author reasoning'),
      butterflyChain: (branch.butterflyChain || []).slice(0, 15).map((b) => ({
        step: clampStr(b.step, 240, 'Step'),
        affectedCharacter: clampStr(b.affectedCharacter, 160, 'Character'),
        consequence: clampStr(b.consequence, 1200, 'Consequence'),
        echoFromCanon: clampStr(b.echoFromCanon, 800, 'Echo'),
      })),
      alternateNarrative: clampStr(branch.alternateNarrative, 30000, 'Alternate narrative'),
      canonVsAltered: {
        canonOutcome: clampStr(branch.canonVsAltered?.canonOutcome, 3000, 'Canon outcome'),
        alteredOutcome: clampStr(branch.canonVsAltered?.alteredOutcome, 3000, 'Altered outcome'),
        thematicShift: clampStr(branch.canonVsAltered?.thematicShift, 3000, 'Thematic shift'),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleBranchPinInFirestore(
  storyId: string,
  branchId: string,
  nextStatus: 'generated' | 'pinned'
): Promise<void> {
  const sId = sanitizeId(storyId);
  const bId = sanitizeId(branchId);
  const path = `stories/${sId}/branches/${bId}`;
  try {
    await updateDoc(doc(db, 'stories', sId, 'branches', bId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBranchFromFirestore(storyId: string, branchId: string): Promise<void> {
  const sId = sanitizeId(storyId);
  const bId = sanitizeId(branchId);
  const path = `stories/${sId}/branches/${bId}`;
  try {
    await deleteDoc(doc(db, 'stories', sId, 'branches', bId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserStories(
  ownerId: string,
  onData: (stories: StoryAnalysis[]) => void
): Unsubscribe {
  const path = 'stories';
  const q = query(
    collection(db, 'stories'),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StoryAnalysis[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoryAnalysis;
        if (data.status !== 'archived') {
          items.push({ ...data, id: docSnap.id });
        }
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeStoryBranches(
  storyId: string,
  ownerId: string,
  onData: (branches: StoryBranch[]) => void
): Unsubscribe {
  const sId = sanitizeId(storyId);
  const path = `stories/${sId}/branches`;
  const q = query(
    collection(db, 'stories', sId, 'branches'),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StoryBranch[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoryBranch;
        items.push({ ...data, id: docSnap.id });
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
