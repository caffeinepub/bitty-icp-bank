# BITTY ICP BANK

## Current State
The app has:
- Monthly scheduled votes (ICP end-of-month, BITTYICP on 15th) and admin custom proposals
- A `distributeRewards` / `distributeCustomRewards` backend function that executes real on-chain ICRC-1 transfers to winning voters
- Admin manually sets the vote/pool amount via `setVoteAmount` / `setCustomProposalAmount`
- Admin manually clicks "Distribute Rewards" to trigger distribution
- After distribution, no remainder is sent back to treasury
- No auto-population of the vote amount from live treasury balance
- No auto-distribution trigger on finalization

## Requested Changes (Diff)

### Add
- `checkCanisterBalance` backend function: queries the canister's live ICP or BITTYICP balance from the ledger
- `autoDistributeOnFinalize` logic: when a vote/proposal is finalized (timer OR admin early-finalize), attempt distribution immediately if canister balance >= required amount
- `returnRemainderToTreasury` logic: after distribution completes, transfer remaining canister balance (minus fees) back to treasury principal `ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe`
- `getCanisterBalance` public query: returns current ICP and BITTYICP balance of canister for frontend to display
- `getPendingDistributions` query: returns any finalized pools where balance was insufficient at finalization time (pending admin manual trigger)
- Scheduled treasury vote auto-populate: when a monthly vote opens (or when `getMonthlyVotes` is called for an upcoming open), automatically read the live treasury wallet balance and set it as the vote amount
- Frontend: "PENDING DISTRIBUTION" admin notice when a pool was finalized but balance was insufficient -- shows the exact amount needed, with a manual "Distribute Now" button

### Modify
- `finalizeVote` backend: after creating the rewards pool entry, call the new auto-distribution check inline (async)
- `finalizeCustomProposal` backend: same -- auto-distribute after creating pool entry
- `distributeRewards` / `distributeCustomRewards`: after all voter transfers, calculate remainder and auto-send back to treasury
- Frontend VotingPage: add "PENDING DISTRIBUTION" admin panel section showing any pools awaiting manual trigger due to insufficient funds

### Remove
- Nothing removed; "Mark as Distributed" flag-only methods remain for legacy safety

## Implementation Plan
1. Add `getCanisterBalance` query to backend that calls both ICP and BITTYICP ledgers
2. Add treasury return helper: after distribution, compute remainder and transfer to treasury principal
3. Add `pendingDistributions` stable variable tracking finalized-but-underfunded pools
4. Modify `finalizeVote` and `finalizeCustomProposal` to:
   a. Check canister balance after creating the pool entry
   b. If sufficient: call distribution inline and send remainder back to treasury
   c. If insufficient: add to `pendingDistributions` stable list with amount needed
5. Modify `distributeRewards` and `distributeCustomRewards` to send remainder to treasury after voter transfers
6. Add `getPendingDistributions` query for frontend admin to see unfunded pools
7. Add `removePendingDistribution` called automatically after successful distribution
8. Frontend: add "PENDING DISTRIBUTION" notice in admin section of VotingPage showing pools needing funds, with a "Distribute Now" button that calls the existing distribute function
9. For scheduled vote auto-populate: set the vote amount from the live treasury balance when the vote opens (the frontend already fetches treasury balances; pass current treasury balance into `setVoteAmount` when a vote transitions to LIVE status)
