/**
 * Security Rule Verification Harness for the "Dirty Dozen" Payloads in security_spec.md.
 * Intended to be run against the Firestore Emulator with @firebase/rules-unit-testing.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '01. Unauthenticated Write',
    auth: null,
    path: 'stories/story_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '02. Unverified Email Write',
    auth: { uid: 'user_1', email_verified: false },
    path: 'stories/story_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '03. Owner Spoofing',
    auth: { uid: 'attacker_uid', email_verified: true },
    path: 'stories/story_1',
    payload: { id: 'story_1', ownerId: 'victim_uid', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '04. Shadow Field Injection (Create)',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/story_1',
    payload: { id: 'story_1', ownerId: 'user_1', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '05. Shadow Field Injection (Update)',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/story_1',
    payload: { hiddenFlag: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '06. ID Poisoning',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/bad$id..slash',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '07. Orphaned Branch Creation',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/missing_story/branches/branch_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '08. Cross-Owner Branch Creation',
    auth: { uid: 'attacker_uid', email_verified: true },
    path: 'stories/victim_story/branches/branch_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '09. Client Timestamp Forgery',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/story_1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Immutable Field Mutation',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/story_1',
    payload: { ownerId: 'other_user' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Terminal State Bypass',
    auth: { uid: 'user_1', email_verified: true },
    path: 'stories/archived_story',
    payload: { title: 'Post-archive edit' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unfiltered List Scraping',
    auth: { uid: 'attacker_uid', email_verified: true },
    collection: 'stories',
    expected: 'PERMISSION_DENIED',
  },
];
