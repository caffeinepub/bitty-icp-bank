# BITTY ICP BANK

## Current State
Token prices (ICP/USD and BITTYICP/USD) are fetched directly from the browser via:
- CoinGecko API for ICP/USD
- ICPSwap API for BITTYICP/USD

Both are failing silently due to CORS restrictions and CoinGecko's new API key requirement. USD values on all balance cards show nothing.

## Requested Changes (Diff)

### Add
- Two new backend methods: `getIcpUsdPrice()` and `getBittyUsdPrice()` that use HTTP outcalls to fetch prices server-side
- `http-outcalls` component to enable canister HTTP requests
- Transform function for deterministic HTTP responses

### Modify
- `useTokenPrices` hook in `useQueries.ts`: replace direct browser fetches with calls to the new backend methods
- ICP/USD source: switch from CoinGecko to Coinbase API (`https://api.coinbase.com/v2/prices/ICP-USD/spot`) via backend outcall
- BITTYICP/USD source: keep ICPSwap but route through backend outcall

### Remove
- Direct browser `fetch()` calls for both prices in frontend

## Implementation Plan
1. Select `http-outcalls` component
2. Add HTTP types, management canister actor, and cycle import to main.mo
3. Add `findAfter` text parser helper
4. Add `transformResponse` query method (required for consensus)
5. Add `getIcpUsdPrice()` shared method: calls Coinbase, parses `"amount":"X"` field
6. Add `getBittyUsdPrice()` shared method: calls ICPSwap token endpoint, parses price
7. Update both backend.d.ts files to include the two new methods
8. Update `useTokenPrices` to call backend methods via actor instead of browser fetch
