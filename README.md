SEMANGAT Streamlit Original UI Test v20

Changes from v17:
- Restored the two-choice login gateway as the first screen on every fresh app load.
- Removed all visible text that reveals the initial Admin password.
- Supabase REST synchronization from v17 is unchanged.
- No other UI or feature changes.

## v19
- Fixed mobile login screen being reset to the first login choice by the 1.5-second Supabase background polling/realtime refresh.
- Login Umum name selection and Login Admin password entry now remain open while background synchronization continues.
- Supabase PC/phone synchronization logic from v17/v18 is otherwise unchanged.

## v20
- Replaced the long product dropdown in Order with a searchable visual product picker.
- Product search matches name, saved code fields, group, wood, finishing, size, and internal ID.
- Multiple products can be selected and added to an Order at once; duplicates are skipped.
- The same searchable image picker is used for products that can be packed in DB Box.
- Produk Selesai now selects eligible products from the active Order through the same visual search window.
- Existing registered data, synchronization, prices, quantities, and output formats remain compatible.
