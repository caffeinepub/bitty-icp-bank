# BITTY ICP BANK

## Current State
The app displays ICP and BITTYICP treasury balances, NNS neuron stake, and Future Investment Fund. USD values are shown using CoinGecko (ICP) and ICPSwap (BITTYICP). ICPSwap is currently failing, leaving BITTYICP USD values blank. The total treasury banner only sums ICP treasury + neuron stake — BITTYICP balances are excluded. There is no admin field to set a manual BITTYICP price per token.

## Requested Changes (Diff)

### Add
- Backend: `stable var manualBittyPriceUSD : Text = ""` field
- Backend: update `getManualBalances` return type to include `bittyPriceUsd : Text`
- Backend: new `setManualBittyPrice(password: Text, price: Text) : async Bool` method
- Admin panel: "BITTYICP Price per Token (USD)" input field with Save/Clear buttons (persists to backend)
- Total treasury now sums ALL balances: ICP treasury + neuron stake (×ICP price) + BITTYICP treasury + Future Investment Fund (×BITTYICP price)
- Update total banner label to "Total Treasury Value" with subtitle reflecting all components

### Modify
- BITTYICP USD price resolution: ICPSwap live price is still tried first; manual admin price is used as fallback ONLY if ICPSwap returns null. Live always overrides manual.
- `useSetManualBittyPrice` mutation hook added to useQueries.ts
- `useTokenPrices` stays unchanged; fallback resolution handled in App.tsx using the stored manual price

### Remove
- Nothing removed

## Implementation Plan
1. Update `src/backend/main.mo`: add `manualBittyPriceUSD` stable var, update `getManualBalances` return type, add `setManualBittyPrice` method
2. Update `src/backend/backend.d.ts` and `src/frontend/src/declarations/backend.did.d.ts` + `backend.did.js` to reflect new signatures
3. Update `src/frontend/src/hooks/useQueries.ts`: add `useSetManualBittyPrice` mutation
4. Update `src/frontend/src/App.tsx`:
   - Extract `manualBittyPriceUsd` from `manualBalances.data`
   - Compute effective bittyUsd: `tokenPrices.data?.bittyUsd ?? (manualBittyPriceUsd ? Number(manualBittyPriceUsd) : null)`
   - Add BITTYICP price admin field in AdminPanel (local state + save/clear handlers)
   - Update total treasury calc to include all four balances
   - Update banner text
