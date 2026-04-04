# BITTY ICP BANK

## Current State
The backend `finalizeVote` and `finalizeCustomProposal` functions already include auto-distribution logic: when called, they check the canister balance and auto-distribute rewards to winning voters, then send the remainder back to the treasury/destination. However, both functions require the admin password to execute, meaning a human admin must still manually click "Finalize Proposal" to trigger the process. The timer expiring alone does not trigger finalization.

## Requested Changes (Diff)

### Add
- Backend: `autoFinalizeExpired()` public function -- no password required. It iterates all monthly votes and custom proposals, identifies any where `closeTime` has passed and `isFinalized == false`, and calls the finalization + auto-distribution logic for each. This is safe to expose publicly because it only acts on time-expired votes (no admin-only data mutation).
- Frontend: Call `actor.autoFinalizeExpired()` inside the `loadVotes` polling loop (every 15 seconds) so any user visiting the page triggers finalization of expired votes automatically.

### Modify
- `loadVotes` in `VotingPage.tsx`: add a call to `autoFinalizeExpired()` before fetching vote state, so the UI always reflects the latest auto-finalized state.
- `backend.d.ts`: Add `autoFinalizeExpired` to the Backend interface.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `autoFinalizeExpired` to `main.mo` -- iterates `monthlyVotes` and `customProposals`, calls the internal finalize + distribute logic for expired non-finalized ones (reusing existing `distributeRewardsInternal` / `distributeCustomRewardsInternal` helpers).
2. Update `backend.d.ts` to include `autoFinalizeExpired(): Promise<void>`.
3. In `VotingPage.tsx` `loadVotes`, call `actor.autoFinalizeExpired()` before the `Promise.all` fetch so votes are finalized before the UI re-renders.
