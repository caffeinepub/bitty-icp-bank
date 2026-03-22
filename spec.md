# BITTY ICP BANK

## Current State
New project. No existing application files.

## Requested Changes (Diff)

### Add
- Live balance queries for $ICP and $BITTYICP for wallet `ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe`
- BITTYICP token queried via ICRC-1 canister `qroj6-lyaaa-aaaam-qeqta-cai`
- ICP balance queried via ICP NNS ledger canister `ryjl3-tyaaa-aaaaa-aaaba-cai` using ICRC-1 interface
- Manual balance override: admin can manually set ICP and BITTYICP amounts (shown when live query is unavailable or overridden)
- Admin password login (password: `bittybittywhatwhat`) -- stored and checked server-side
- Announcements system: admin can create, edit, delete announcements; all visitors can read them
- Announcements include title, body text, and timestamp
- Public treasury dashboard visible to all, no login required
- Link to Bittyonicp.com on the page
- Background image: `/assets/uploads/IMG_5289-1.jpeg`

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Backend canister with:
   - Inter-canister calls to ICP ledger and BITTYICP canister to fetch live balances using ICRC-1 `icrc1_balance_of`
   - Stored manual balance overrides (ICP and BITTYICP amounts as Text/Float)
   - Admin authentication via password hash comparison
   - Announcements CRUD: stable storage of announcements array with id, title, body, timestamp
   - Public query for all announcements
   - Admin-only mutations for announcements and manual balances
2. Frontend:
   - Full-page background using the uploaded image
   - Treasury balance display (ICP + BITTYICP) with live fetch on load, fallback to manual if live fails
   - Refresh button for live balances
   - Announcements feed visible to all visitors
   - Admin login modal (password entry)
   - Admin panel: post/edit/delete announcements, set manual balance overrides
   - Link to Bittyonicp.com
