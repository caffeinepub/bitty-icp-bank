# BITTY ICP BANK

## Current State
- The voting page has a sign-in gate (II and Plug buttons) shown when not signed in
- The "My BITTY ICP Bank Wallet" (MyWalletPanel) renders when signed in, always visible
- The "BOOST YOUR VOTING POWER" banner only shows when signed in
- The Vote nav button in App.tsx reads just "Vote" with no icon
- The Bitty CEO mascot with speech bubble exists on the main page at `/assets/generated/bitty-ceo-cropped-transparent.dim_600x800.png`

## Requested Changes (Diff)

### Add
- A Bitty CEO mascot on the voting page (same image: `/assets/generated/bitty-ceo-cropped-transparent.dim_600x800.png`) with a cartoon speech bubble reading "MY BITTY ICP SAVINGS" -- placed above the sign-in gate / above the wallet section
- The mascot/bubble is clickable: toggles `walletOpen` state to show/hide the MyWalletPanel
- When user is NOT signed in and clicks the mascot: expand the panel to show the sign-in prompt (II + Plug buttons)
- The "BOOST YOUR VOTING POWER" banner should be visible to ALL users (not just signed-in) -- place it below the mascot/bubble toggle area, above the sign-in buttons
- A 💳 emoji before "Vote" text in the nav button in App.tsx (line 1233)

### Modify
- MyWalletPanel: hidden by default (`walletOpen` state = false), revealed when user clicks the mascot or bubble
- Sign-in gate: becomes part of the collapsible wallet panel -- shown inside when not signed in, full wallet panel when signed in
- "BOOST YOUR VOTING POWER" banner: remove the `isSignedIn &&` condition so it shows for everyone
- The voting page layout around lines 3152-3320 in VotingPage.tsx needs restructuring: mascot at top -> boost banner always visible -> collapsible wallet section (sign-in or full wallet panel based on auth state)

### Remove
- The standalone sign-in gate block (lines 3152-3280 in VotingPage.tsx) as a top-level always-visible element -- move sign-in buttons into the collapsible wallet section

## Implementation Plan
1. In App.tsx: add 💳 before "Vote" text in the nav button (line 1233)
2. In VotingPage.tsx:
   - Add `walletOpen` useState (default false)
   - Add Bitty CEO mascot + "MY BITTY ICP SAVINGS" speech bubble section above sign-in/wallet area -- same cartoon bubble style as main page (white box, thick black border, rounded, shadow, tail pointing down, Impact/bold font)
   - Make mascot + bubble clickable to toggle `walletOpen`
   - Move the sign-in gate inside the collapsible wallet panel (AnimatePresence with height animation)
   - "BOOST YOUR VOTING POWER" banner: show always (remove isSignedIn gate), place it between mascot and the collapsible wallet section
   - The collapsible section: when `walletOpen && !isSignedIn` show sign-in buttons; when `walletOpen && isSignedIn` show full MyWalletPanel
   - When user signs in successfully, keep walletOpen = true so they see their wallet
