# BITTY ICP BANK

## Current State
- `autoFinalizeExpired()` exists in the backend but is a regular public function — it only runs when a user visits the governance page and `loadVotes()` calls it.
- `finalizeVote` and `finalizeCustomProposal` are admin-only (require password) and can only be triggered by the admin clicking a button.
- No canister-level heartbeat or timer exists. Auto-finalization is not truly automatic.
- When a vote's timer expires and nobody visits the page, the vote stays open indefinitely.
- Auto-distribution on finalization works correctly IF the canister has funds at the moment of finalization.
- The frontend still shows manual "Finalize" buttons for the admin.

## Requested Changes (Diff)

### Add
- **Backend heartbeat**: Add `system func heartbeat()` to the Motoko backend that runs every ~1 hour (using a counter that increments each heartbeat cycle, which runs every ~1 second on ICP). The heartbeat calls `autoFinalizeExpiredInternal()` — the same logic currently in `autoFinalizeExpired()` — to finalize all expired votes and trigger distribution if funds are available.
- **Non-admin `autoFinalizeExpired`**: Keep the public function callable from the frontend (for on-page-load backup), but also have it run via heartbeat so page visits are not required.

### Modify
- The `system func heartbeat()` should run the finalization logic approximately every 3600 seconds (1 hour). Since heartbeat fires every ~1 second on ICP, use a counter: `if (heartbeatCount % 3600 == 0) { await* autoFinalizeExpiredInternal() }`.
- Remove the admin "Finalize Vote" and "Finalize Proposal" manual buttons from the frontend UI — they are no longer needed since finalization is automatic via heartbeat.
- Keep the "DISTRIBUTE NOW" manual button for the admin when the canister is underfunded (pending distributions).

### Remove
- Manual finalize buttons from VotingPage.tsx for both scheduled votes and custom proposals (admin no longer needs them).

## Implementation Plan
1. Add `stable var heartbeatCount : Nat = 0` to backend stable variables.
2. Add `system func heartbeat() : async () { heartbeatCount += 1; if (heartbeatCount % 3600 == 0) { await* autoFinalizeExpiredInternal() } }` — note: heartbeat must use `async*` for internal calls in Motoko.
3. Refactor existing `autoFinalizeExpired` public function to call a shared internal helper `autoFinalizeExpiredInternal()` so the logic is not duplicated.
4. Regenerate backend bindings (`backend.d.ts`).
5. In `VotingPage.tsx`, remove the admin "Finalize Vote" and "Finalize Custom Proposal" buttons. Keep the pending distribution warning and "DISTRIBUTE NOW" button.
