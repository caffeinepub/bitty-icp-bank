# BITTY ICP BANK

## Current State

The `VotingPage.tsx` is a single large component (~3593 lines) that renders:
- Scheduled monthly votes (ICP + BITTYICP) all inline
- Custom/community proposals inline
- Rewards pools inline (admin only)
- Wallet sign-in, verified wallets, voting power
- Community chat per vote
- Admin panel (create proposal, manage rewards, reset wallets)

All of these sections are stacked vertically on one page with no navigation. History is not separated. There are no dedicated history pages/routes. The backend has no reward transaction history tracking — `distributeRewards` sends tokens but records nothing about who got what or when.

## Requested Changes (Diff)

### Add
- **`/history/scheduled`** — Full-page history view showing ALL past scheduled treasury proposals (both ICP and BITTYICP), sorted newest first. Each card shows vote title, month/year, options, results, status (FINALIZED/DISTRIBUTED), and reward pool summary.
- **`/history/community`** — Full-page history view showing ALL past custom/community proposals, sorted newest first. Same card style.
- **RewardTransaction type in backend** — stable array of `RewardTransaction` records: `{ id, voteId, proposalId, recipient, amount, tokenType, timestamp, voteTitle }`. Written on every successful `icrc1_transfer` call inside `distributeRewards` and `distributeCustomRewards`.
- **`getMyRewardTransactions(callerPrincipal: string)`** — backend query returning all reward transactions for the given principal.
- **`getAllRewardTransactions()`** — admin-only query returning all transactions.
- **REWARDS section** on voting page — visible to signed-in users only. Shows:
  - Total $ICP rewards earned (sum of all ICP distribution transactions for user)
  - Total $BITTYICP rewards earned (sum of all BITTYICP transactions for user)
  - Transaction history list: each row shows vote/proposal title, amount, token type, date, and a link to IC Explorer for proof
- **Back button** on history pages linking back to the voting page

### Modify
- **SCHEDULED TREASURY PROPOSALS section** — show only the last 3-5 proposals by date regardless of status (mix of UPCOMING, LIVE, FINALIZED, DISTRIBUTED). Add a "VIEW FULL HISTORY" button that navigates to `/history/scheduled`.
- **TEAM / COMMUNITY PROPOSALS section** — show only the last 3-5 proposals by date regardless of status. Add a "VIEW FULL HISTORY" button that navigates to `/history/community`.
- **`distributeRewards`** — after each successful `icrc1_transfer`, append a `RewardTransaction` record to stable state.
- **`distributeCustomRewards`** — same as above.
- **`backend.d.ts`** — add `RewardTransaction` type and `getMyRewardTransactions`, `getAllRewardTransactions`, `distributeRewards`, `distributeCustomRewards` method signatures.
- **Voting page layout** — reorganize into clear labeled sections: SCHEDULED TREASURY PROPOSALS → TEAM/COMMUNITY PROPOSALS → REWARDS. Admin controls (finalize, distribute, set amounts, create proposal, reset wallets, canister deposit address) remain but are reorganized under each relevant section rather than a separate panel.

### Remove
- The old single combined vote list with no clear section separation
- The buried "Rewards Pool" section visible only to admin at the bottom — replaced by the new REWARDS section visible to all signed-in users (with user-specific data) plus admin-specific distribution controls inline with each proposal

## Implementation Plan

1. **Backend (Motoko main.mo)**:
   - Add `RewardTransaction` stable type and `rewardTransactions` stable array + `nextRewardTxId`
   - Modify `distributeRewards` to append a transaction record per successful transfer
   - Modify `distributeCustomRewards` to do the same
   - Add `getMyRewardTransactions(principal: Text)` public query
   - Add `getAllRewardTransactions(password: Text)` admin query

2. **Backend declarations (backend.d.ts)**:
   - Add `RewardTransaction` interface
   - Add `getMyRewardTransactions`, `getAllRewardTransactions` method signatures
   - Add `distributeRewards` and `distributeCustomRewards` method signatures (currently missing)

3. **Frontend routing (main.tsx / App.tsx)**:
   - Add routes: `/voting` (main), `/history/scheduled`, `/history/community`
   - Or use React state-based navigation if router is not already set up

4. **Frontend VotingPage.tsx restructure**:
   - Section 1: SCHEDULED TREASURY PROPOSALS — last 3-5 by date, VIEW FULL HISTORY button
   - Section 2: TEAM / COMMUNITY PROPOSALS — last 3-5 by date, VIEW FULL HISTORY button
   - Section 3: REWARDS — visible when signed in; total ICP earned, total BITTYICP earned, transaction history list with on-chain proof links
   - Admin controls inline per proposal (finalize, set amount, distribute) — not in a separate bottom panel

5. **New ScheduledHistoryPage.tsx** — full list of all monthly votes, sorted newest first
6. **New CommunityHistoryPage.tsx** — full list of all custom proposals, sorted newest first
