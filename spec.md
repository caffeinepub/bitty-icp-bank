# BITTY ICP BANK

## Current State
- Main page shows TOTAL TREASURY VALUE banner at top, then CEO/How It Works, then wallet cards (Treasury, Neuron, Fund, Developments)
- Backend has `rewardTransactions` stable array recording every on-chain reward sent, with `tokenType` (#ICP | #BITTYICP) and `amount` in e8s
- No `getTotalRewardsDistributed` backend function exists
- No GOVERNANCE REWARDS section on the main page
- No GAMES AND REWARDS wallet tracked
- How It Works modal has no mention of the Games and Rewards wallet

## Requested Changes (Diff)

### Add
- **Backend**: `getTotalRewardsDistributed()` public query that sums all `rewardTransactions` by token type, returning `{ totalICP: Nat; totalBITTY: Nat }`
- **Frontend**: GOVERNANCE REWARDS section on main page, placed directly below the TOTAL TREASURY VALUE banner
  - Shows total $ICP distributed (in ICP units + USD value)
  - Shows total $BITTYICP distributed (in BITTYICP units + USD value)
  - Same gold/grey card style as other wallet cards
  - Calls `getTotalRewardsDistributed` on load, refreshes with prices
- **Frontend**: GAMES AND REWARDS wallet card in TREASURY BALANCES section
  - Principal: `gayym-bg32z-py45s-ev5ck-fkt2o-zgyhb-j4top-cb2p3-udrip-qsh7q-jae`
  - Shows both $ICP and $BITTYICP balances with USD values
  - Same card style as DEVELOPMENTS WALLET
  - Included in grandTotalUsd calculation
  - Clicking opens ICExplorer link for that principal
- **Frontend**: Update How It Works modal to add a section about the GAMES AND REWARDS wallet: "The Games and Rewards wallet is used to load the internal distribution wallet and fund community game rewards"

### Modify
- `grandTotalUsd` calculation to include the new GAMES AND REWARDS wallet balances
- `backend.d.ts` to expose `getTotalRewardsDistributed`

### Remove
- Nothing removed

## Implementation Plan
1. Add `getTotalRewardsDistributed` to `main.mo` — simple query summing `rewardTransactions` by tokenType
2. Add the function to `backend.d.ts`
3. In `App.tsx`:
   a. Add state for `govRewardsICP`, `govRewardsBITTY` (in token units, from backend)
   b. Fetch on load using `actor.getTotalRewardsDistributed()`
   c. Render GOVERNANCE REWARDS card below TOTAL TREASURY VALUE banner
   d. Add GAMES AND REWARDS wallet state (`gamesRewardsBittyBalance`, `gamesRewardsIcpBalance`, USD values)
   e. Fetch balances for `gayym-bg32z-py45s-ev5ck-fkt2o-zgyhb-j4top-cb2p3-udrip-qsh7q-jae`
   f. Include in grandTotalUsd
   g. Render GAMES AND REWARDS card in wallet section
   h. Update How It Works modal with Games and Rewards paragraph
