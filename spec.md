# BITTY ICP BANK

## Current State

The app has:
- Monthly scheduled votes (ICP on 30th, BITTYICP on 15th) with `finalizeVote` and `distributeRewards` backend functions
- Custom/community proposals with `finalizeCustomProposal` and `distributeCustomRewards` backend functions
- Auto-populate vote amount when scheduled vote goes live (reads treasury balance, sets via `setVoteAmountFromTreasury`)
- `distributeRewardsInternal` and `distributeCustomRewardsInternal` private backend functions that execute on-chain ICRC-1 transfers to winning voters
- `sendRemainderToTreasury` that sends remaining canister balance back to `WALLET_PRINCIPAL` (treasury)
- `pendingDistributions` stable var tracks votes that couldn't auto-distribute due to insufficient funds
- Admin sees pending distribution warnings
- `HIDE_BALANCES` flag currently set to `true` — all balances show 0
- **Bug**: `finalizeCustomProposal` and `distributeCustomRewards` both call `sendRemainderToTreasury` instead of sending remainder to the admin-specified `destinationAddress` stored in `customProposalMeta`
- **Bug**: Neither `finalizeVote` nor `finalizeCustomProposal` actually triggers auto-distribution when canister is funded — the backend logs to `pendingDistributions` but doesn't call `distributeRewardsInternal` inline

## Requested Changes (Diff)

### Add
- Auto-distribution on finalization for scheduled votes: when `finalizeVote` is called and canister balance >= rewards needed, immediately call `distributeRewardsInternal` and then `sendRemainderToTreasury` (only scheduled votes send remainder to treasury)
- Auto-distribution on finalization for custom proposals: when `finalizeCustomProposal` is called and canister balance >= rewards needed, immediately call `distributeCustomRewardsInternal` then send remainder (winning %) to `destinationAddress` from `customProposalMeta`
- Pending distribution check: if canister balance is insufficient at finalization time, add to `pendingDistributions` so admin sees the shortfall notice
- Frontend pending distribution notice: admin sees "PENDING DISTRIBUTION" banner with exact amount needed and a manual "DISTRIBUTE NOW" button

### Modify
- Fix `finalizeCustomProposal` backend: after computing rewards, if funded → call `distributeCustomRewardsInternal` then send `voteAmount - rewardsTotal - fee` to `destinationAddress` (not treasury)
- Fix `distributeCustomRewards` public function: after distributing, send remainder to `destinationAddress` not treasury
- Restore live balances: set `HIDE_BALANCES = false` in frontend (App.tsx and/or VotingPage.tsx)
- `sendRemainderToCustomDestination(destination, voteType)`: new private backend function that sends remainder to a specified address instead of the hardwired treasury

### Remove
- Nothing removed

## Implementation Plan

1. **Backend (main.mo)**:
   - Add `sendRemainderToAddress(destination: Text, voteType: VoteType)` private function that sends canister balance minus fee to a given principal
   - Modify `finalizeVote`: after creating `RewardsPoolEntry`, immediately check canister balance; if sufficient call `distributeRewardsInternal` → `sendRemainderToTreasury`; if insufficient add to `pendingDistributions`
   - Modify `finalizeCustomProposal`: after creating `CustomRewardsPoolEntry`, immediately check balance; if sufficient call `distributeCustomRewardsInternal` → `sendRemainderToAddress(destinationAddress, voteType)`; if insufficient add to `pendingDistributions`
   - Modify `distributeCustomRewards` public function: after distributing, call `sendRemainderToAddress(destinationAddress)` instead of `sendRemainderToTreasury`
   - Ensure stable types are not broken (only append to existing stable vars, never change existing type shapes)

2. **Frontend (App.tsx)**:
   - Set `HIDE_BALANCES = false` to restore live prices and balances

3. **Frontend (VotingPage.tsx)**:
   - No logic changes needed; pending distribution banners already exist in UI
   - Ensure pending distribution warning shows exact shortfall amount and "DISTRIBUTE NOW" button for admin
