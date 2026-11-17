# Security Specification — AuteurFork Firestore Rules

## 1. Data Invariants
1. **Identity Integrity**: A `UserProfile`, `StoryAnalysis`, or `StoryBranch` can only be created or modified by an authenticated, email-verified user whose `request.auth.uid` matches `ownerId` (or `uid`).
2. **Master Gate Relational Integrity**: A `StoryBranch` at `/stories/{storyId}/branches/{branchId}` cannot exist without an existing parent `StoryAnalysis` at `/stories/{storyId}` owned by the same `request.auth.uid`.
3. **Immutable Ownership & Temporal Integrity**: `ownerId`, `id`, `storyId`, and `createdAt` are immutable once created. All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
4. **Terminal State Lock**: Once a `StoryAnalysis` reaches `status == "archived"`, no further updates are permitted.
5. **Path & Payload Bounds**: All document IDs match `^[a-zA-Z0-9_\-]+$` (<= 128 chars). Every string and array enforces explicit `.size()` bounds. Unrecognized shadow fields are rejected via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.
6. **Zero PII Exposure & Query Enforcement**: No email/phone fields are stored on user documents, and `allow list` on `/stories` and `/stories/{storyId}/branches` enforces `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `/stories/story_1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Create `/stories/story_1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Owner Spoofing**: Create `/stories/story_1` with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection (Create)**: Create `/stories/story_1` with valid fields plus `"isAdmin": true` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection (Update)**: Update `/stories/story_1` adding `"hiddenFlag": true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Create `/stories/bad$id..slash` or >128 char ID -> `PERMISSION_DENIED`.
7. **Orphaned Branch Creation**: Create `/stories/missing_story/branches/b1` where parent `/stories/missing_story` does not exist -> `PERMISSION_DENIED`.
8. **Cross-Owner Branch Creation**: Create `/stories/victim_story/branches/b1` under a story owned by someone else -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Create `/stories/story_1` with `createdAt` set to a past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: Update `/stories/story_1` attempting to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
11. **Terminal State Bypass**: Update `/stories/story_1` after `status == "archived"` -> `PERMISSION_DENIED`.
12. **Unfiltered List Scraping**: Query `/stories` without `where("ownerId", "==", auth.uid)` -> `PERMISSION_DENIED`.
