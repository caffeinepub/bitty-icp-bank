# BITTY ICP BANK

## Current State
The voting page has a sign-in flow: user clicks Internet Identity, then manually pastes their principal ID, clicks Check to verify BITTYICP balance. Anyone can paste any principal -- not just their own wallet.

## Requested Changes (Diff)

### Add
- Plug wallet sign-in option alongside Internet Identity
- Fine print under each button: II = 'Supports NNS, Oisy, NFID, and any Internet Identity-based wallet'; Plug = 'Supports Plug browser extension wallet'
- After sign-in (either method), auto-use the authenticated principal (no paste input)
- Auto-check BITTYICP balance immediately on sign-in

### Modify
- Replace single sign-in button with two options (II + Plug) with fine print
- Replace principalInput state with authenticatedPrincipal derived from active session
- Auto-trigger balance check via useEffect when authenticatedPrincipal changes
- Update vote casting to use authenticatedPrincipal directly
- Update How It Works step to say 'connect your wallet' instead of paste principal

### Remove
- Manual paste principal ID input field
- Manual Check balance button

## Implementation Plan
1. Add Plug wallet logic via window.ic?.plug API (detect, connect, get principal)
2. Add plugPrincipal/plugConnected state; create unified activePrincipal
3. Two-button sign-in layout with fine print under each
4. useEffect auto-triggers balance check when activePrincipal changes
5. Remove paste input + Check button
6. Update vote casting and chat to use activePrincipal
