# Layali Restaurant & Lounge POS

POS for Layali: orders are entered at the counter (web) or on a staff phone (app), and every KOT, bill and report prints on the counter's thermal printer. The phone app has the same features as the web.

---

## How the restaurant uses it

1. **Waiter** takes the order at the table and tells the counter.
2. **Counter or staff phone (cashier / manager)** punches the order → one **KOT slip per station** (Kitchen, Bar, Shisha) prints at the counter. The runner takes it to the station.
3. Extra rounds print new KOTs. A **void** prints a **CANCEL** slip so the kitchen stops preparing.
4. **Bill**: "Print bill" for the guest, then **Settle** (Cash / UPI / Card / Split / Khata) → the receipt prints with its GST invoice number and the table is freed.
5. **Cash drawer**: open the shift with a float, record cash drops, close the shift → the **Z-report** prints.
6. **Admin**: menu & prices, out-of-stock, staff & PINs, counter computers, lounge details printed on bills (name, address, GSTIN, GST rate).

| Role | Can do |
| :--- | :--- |
| Cashier | Punch orders, move/merge tables, settle bills, bookings, shisha timers, cash drawer. Voids and discounts over 10% need a manager's PIN. |
| Manager | Everything a cashier can, plus voids, any discount, out-of-stock, reports |
| Owner / Admin | Everything, plus staff, counter computers, menu prices and lounge settings |

---

## Workspace

```
kot-billing/
├── web/                          # Next.js 16 app: counter POS + admin + REST API (/api/v1) + MongoDB + print queue
│   └── src/
│       ├── app/                  # Page and API route handlers
│       ├── components/           # POS, billing, KOT log, shifts, bookings, admin, auth
│       ├── lib/print/            # 80 mm print templates (KOT, cancel, bill, Z-report) + printer
│       ├── lib/auth/             # Sessions, PIN/password, roles, audit
│       └── models/               # Mongoose models
├── mobile/                       # Expo app for staff phones: same features as the web (orders, bills, bookings, cash drawer, admin)
├── plan/PROJECT_BLUEPRINT.md
└── layali-kot-&-restaurant-pos/  # Original prototype (reference only)
```

---

## Setup

1. Configure MongoDB in `web/.env.local` (MongoDB 7 or newer, e.g. Atlas):
   ```bash
   MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/layali_pos"
   ```
   If the counter opens the app over plain `http://` on the local network, also set `COOKIE_SECURE=false`. HTTPS is preferred.
2. Run it:
   ```bash
   cd web
   npm install
   npm run build && npm start      # production
   ```
3. Open the app. The first visit shows **Set up Layali POS**: create the owner account (username, password, staff PIN). Tables, menu and settings are created automatically.
4. In **Lounge Admin**, enter the real lounge name, address, phone, **GSTIN** and GST rate. They are printed on every bill.
5. In **Staff & Devices**: add cashiers/managers, then **Pair this browser** on the counter computer (or create a pairing code for another counter computer).

### Printer (counter PC = print station)

All printing goes through one **print station**: the counter computer with the thermal printer. Phones and other counters never print themselves; the server queues each slip and the print station prints it (also while its screen is locked).

- In **Staff & Devices**, press **Use for printing** on the counter computer. The top bar on every device shows the printer state (ready / offline / failed) and the **Print queue** with Retry.

- Connect the 80 mm thermal printer and make it the **default printer**. In its driver set paper to 80 mm (receipt / roll) and margins to none.
- Start Chrome in kiosk printing mode so slips print straight away without a dialog:
  ```
  chrome --kiosk-printing http://<server-address>:3000
  ```
  (Windows: add `--kiosk-printing` to the Chrome shortcut's Target.)
- Each KOT station prints on its own cut. Reprint any KOT from the **KOT log** tab, and any bill from **Cashier & Settlements**.

---

### Staff phones (mobile app)

```bash
cd mobile && npm install && npx expo start      # development
```
In **Staff & Devices → Pair a device**, choose **Staff phone**, then enter the server address and the 6-digit code in the app. Staff sign in with their name + PIN. Everything printable from the phone (KOTs, bills, cancel slips, Z-report) prints at the print station.

## Sign-in & security

- Owner/managers sign in with username + password from any browser; staff tap their name + PIN on a paired counter computer.
- Terminals lock after 5 minutes idle; **Lock** switches staff. Five wrong PINs/passwords lock that account for 5 minutes (admin can unlock).
- Voids and discounts above 10% need a manager; every sign-in, void, discount, settlement and setting change is in the audit log.
- Bills get consecutive GST invoice numbers per financial year (e.g. `2026-27/0012`).
