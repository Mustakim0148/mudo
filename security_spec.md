# MUDO Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Authenticated Session Gate**: Every read and write requires an authenticated Firebase session (`request.auth != null`, including Firebase Anonymous Authentication).
2. **No PII Storage**: Collections (`mudo_queues`, `mudo_rooms`, `mudo_games`, `presence`) store only `playerId`, `authUid`, and sanitized display names (`<= 24` chars) — never email addresses, phone numbers, or addresses.
3. **Queue Entry Ownership & Atomic Matching**:
   - A user can only create a queue entry with `authUid == request.auth.uid`, `status == 'waiting'`, `gameId == null`, and `createdAt == request.time`.
   - Queue entries can only transition from `'waiting'` to `'matched'` when the target `/mudo_games/{gameId}` document exists after the transaction (`existsAfter`).
   - Queue list queries must constrain `status == 'waiting'` and `targetCount in [2, 4]`.
4. **Friendly Room Integrity**:
   - Room codes follow `^MUDO-[A-Z0-9]{4}$` and are immutable after creation.
   - Room listing is strictly disabled (`allow list: if false`) to prevent enumeration.
   - Disbanded rooms are terminally locked (`existing().status != 'disbanded'`).
   - Transitioning a room to `'in_game'` requires `existsAfter(/mudo_games/{gameId})`.
5. **Authoritative Match Access & Terminal State Locking**:
   - Only users listed in `participantAuthUids` can read or update `/mudo_games/{gameId}` or write to `/mudo_games/{gameId}/presence/{playerId}`.
   - Once a game reaches `'ended'` or `'disbanded'`, all subsequent updates are rejected.
   - `createdAt`, `gameId`, `mode`, `playerCount`, and `participantAuthUids` are immutable after creation.
6. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `lastSeen` fields must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Room Create**: `auth = null` creating `/mudo_rooms/MUDO-ABCD` -> `PERMISSION_DENIED`.
2. **Unverified Email Queue Join**: `auth.token.email_verified = false` creating `/mudo_queues/p1` -> `PERMISSION_DENIED`.
3. **Auth UID Spoofing in Queue**: User A (`uidA`) creates `/mudo_queues/p1` with `authUid: 'uidB'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Room**: Create `/mudo_rooms/MUDO-ABCD` with extra ghost key `{ isAdmin: true }` -> `PERMISSION_DENIED`.
5. **ID Poisoning Attack**: Attempt `get` or `create` at `/mudo_rooms/` with 1.5KB junk document ID -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Create `/mudo_queues/p1` with `createdAt: new Date(0)` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
7. **Orphaned Match Transition**: Update `/mudo_queues/p1` to `status: 'matched', gameId: 'nonexistent'` without creating `/mudo_games/nonexistent` in the same batch -> `PERMISSION_DENIED`.
8. **Room Enumeration / Scraping**: List query on `collection(db, 'mudo_rooms')` -> `PERMISSION_DENIED`.
9. **Terminal Room Mutation**: Attempt to join or edit `/mudo_rooms/MUDO-ABCD` when `status == 'disbanded'` -> `PERMISSION_DENIED`.
10. **Outsider Game Spying / Tampering**: User C (not in `participantAuthUids`) attempts `get` or `update` on `/mudo_games/match_123` -> `PERMISSION_DENIED`.
11. **Terminal Game Replay/Tampering**: Attempt to update `/mudo_games/match_123` after `status == 'ended'` or `'disbanded'` -> `PERMISSION_DENIED`.
12. **Presence Impersonation**: User A writes `/mudo_games/match_123/presence/playerB` with `authUid: 'uidB'` -> `PERMISSION_DENIED`.
