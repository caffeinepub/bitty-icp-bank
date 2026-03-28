# BITTY ICP BANK

## Current State

The voting page (`VotingPage.tsx`) has:
- Two monthly vote cards for ICP and BITTYICP treasury
- A RewardsPoolPanel showing pool breakdowns including voter-by-voter breakdown
- A canister deposit address card that appears to be visible to everyone
- No separation between admin-only content and public/voter content in the rewards section
- No personal "My Rewards" panel per voter

## Requested Changes (Diff)

### Add
- **Personal "My Rewards" panel**: For each signed-in voter, show a section (below the vote cards) listing:
  - Every past vote they participated in (by voteId and vote type)
  - Their voting power used in that vote
  - Their estimated reward share % (winning votes only)
  - Their estimated reward amount if pool amount is set
  - Whether rewards have been distributed for that vote
- **Public total distribution banner**: After each finalized vote, show a single line/card visible to ALL users saying "Total Distribution Rewards: X [ICP/BITTYICP]" — just the total pool amount, no breakdown of who gets what

### Modify
- **Canister deposit address**: Make it ADMIN ONLY — only visible when `isAdmin === true`. Remove it from public view entirely.
- **Detailed rewards pool breakdown** (voter-by-voter percentages, exact amounts to send, pool breakdowns): Visible to ADMIN ONLY. Non-admin users and non-signed-in users should NOT see this detail.
- **RewardsPoolPanel**: 
  - Admin sees: full breakdown, exact amounts, voter list, canister address, mark-as-distributed button
  - Signed-in voter sees: only their own rewards panel (My Rewards) — their votes participated in, their share
  - Public (not signed in) sees: only the "Total Distribution Rewards" total per completed vote

### Remove
- Canister deposit address card from public/voter view
- Voter breakdown table from non-admin views

## Implementation Plan

1. In `VotingPage.tsx`:
   - Move canister deposit address card inside `isAdmin` guard
   - Create a `MyRewardsPanel` component that shows a signed-in voter their own participation history and reward estimates (pulling from `voteAllocations` and `rewardsPools`)
   - Create a `PublicRewardsBanner` component that shows just "Total Distribution Rewards: X [token]" per finalized vote — visible to everyone after a vote is finalized
   - Modify `RewardsPoolPanel` so the detailed breakdown (voter list, exact amounts, mark distributed) is only rendered when `isAdmin === true`
   - Add `MyRewardsPanel` below vote cards for signed-in users (non-admin)
   - Public reward banner goes below vote cards for all users
2. No backend changes needed — all data is already available via `getRewardsPools()` and `getVoteAllocations()`
