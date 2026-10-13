# Layali Restaurant & Lounge POS + KOT System

Production-grade, modular Restaurant POS, Multi-Station KOT Routing, Shisha Live Timers, Private Cabin Bookings, and Thermal Billing platform.

---

## Workspace Architecture

```
layali/
├── web/                        # Next.js 16 Fullstack App (Web POS, KDS, Cashier, Admin & MongoDB Atlas API)
│   ├── src/
│   │   ├── app/                # App Router pages & REST/SSE APIs (/api/v1/...)
│   │   ├── components/         # Modular Views (TopBar, NavTabs, POS, KDS, Shisha, Cashier, Bookings, ThermalReceipt)
│   │   ├── models/             # Mongoose models with high-speed compound indexes
│   │   ├── lib/                # MongoDB connection pooling & Realtime SSE Dispatcher
│   │   └── utils/              # Audio alert synthesis & Currency/Date formatters
│   ├── .env.example            # MongoDB Atlas URI configuration
│   └── package.json
│
├── mobile/                     # React Native (Expo) Waiter / Captain Mobile POS
│   ├── src/
│   │   ├── constants/          # Colors, theme, spacing
│   │   ├── types/              # Mobile TypeScript interfaces
│   │   ├── services/           # API client communicating with Next.js backend
│   │   ├── context/            # POSContext global state & actions
│   │   ├── components/         # Modular Components (Header, BottomNav, TableCard, MenuItemCard, StickyCartBar, KOTCard, ShishaCard, Modals)
│   │   └── screens/            # Modular Screens (TablesScreen, OrderScreen, KOTsScreen, ShishaScreen)
│   ├── App.tsx                 # Clean entry point wrapped in POSProvider
│   └── package.json
│
├── plan/
│   └── PROJECT_BLUEPRINT.md    # Master Architecture Blueprint & Domain Specifications
│
└── layali-kot-&-restaurant-pos/ # Original prototype reference
```

---

## Quick Start Guide

### 1. Web Application & Backend (Next.js 16 + MongoDB Atlas)

1. Navigate to the web application:
   ```bash
   cd web
   ```
2. Configure your MongoDB Atlas connection in `.env.local`:
   ```bash
   MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/layali_pos?retryWrites=true&w=majority&appName=LayaliPOS"
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Upon first load, the server connects to MongoDB and seeds the 11 tables, categories, menu items and settings.
   - The first visit shows **Set up Layali POS**: create the owner account (username, password and a staff PIN).

---

### 2. Waiter / Captain Mobile App (React Native / Expo)

1. Navigate to the mobile application:
   ```bash
   cd mobile
   ```
2. Start the Expo development server:
   ```bash
   npx expo start
   ```
3. Run on your physical phone (via Expo Go app) or on an Android/iOS emulator:
   - On the web, go to **Staff & Devices → Pair a device**, choose *Waiter phone*, and enter the server address (e.g. `http://192.168.1.15:3000`) and the 6-digit code in the app.
   - Staff tap their name and enter their PIN, then punch orders. KOTs appear on the kitchen and shisha screens in real time.

---

## Sign-in & Devices

| Who | How they sign in |
| :--- | :--- |
| Owner / managers | Username + password, from any browser |
| Staff on a paired terminal or phone | Tap their name + PIN (verified on the server; the session only works on that device) |
| Kitchen / bar / shisha displays | Paired once as a *Station display*; they show only their station's tickets and need no sign-in |

- Pair devices from **Staff & Devices** (one-time 6-digit code, valid 10 minutes), or use **Pair this browser** on the terminal itself. **Revoke** signs everyone out of that device immediately.
- Terminals lock after 5 minutes idle (15 minutes for a password session). **Lock** switches staff.
- Voids and discounts above 10% need a manager. Other staff can continue if a manager enters their PIN on the same screen. Every sign-in, void, discount and settlement is written to the audit log.
- Five wrong PINs or passwords lock that account for 5 minutes. An admin can unlock it from **Staff & Devices**.
- Cookies are `Secure` in production. If the restaurant server runs over plain HTTP on the local network, set `COOKIE_SECURE=false` in `.env.local`. Serving over HTTPS is preferred.

## Stations & User Roles

| Station / Terminal | Screen / View | Description |
| :--- | :--- | :--- |
| **Floor Captain (Mobile)** | `mobile/src/screens/` | Table selection, category carousel, modifiers, instant KOT punch |
| **Kitchen Station (Web)** | KOT Queue (`Kitchen`) | Live food tickets (Burgers, Rice, Fries, Pasta), status advancement, audio chime |
| **Bar / Beverage (Web)** | KOT Queue (`Beverage`) | Live drinks queue (Mojitos, Sodas, Shakes) |
| **Shisha Master (Web/Mobile)** | Shisha Timers | Active coal timers, countdown alarms, +15m extensions |
| **Cashier Desk (Web)** | Cashier & Settlements | Split payments (Cash/UPI/Card/Khata), GST tax, 80mm ESC/POS thermal receipt |
| **Lounge Admin (Web)** | Lounge Settings | Menu prices, table layout, GST number, daily data backup |
