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
   - Upon first load, the server automatically connects to MongoDB Atlas and auto-seeds all 11 tables, categories, menu items, settings, and staff credentials!

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
   - Tap the top-right **Settings / Offline** badge inside the mobile app to set your machine's Wi-Fi IP address (e.g., `http://192.168.1.15:3000`) so the phone talks directly to your Next.js backend!
   - Select a table, punch items, and hit **PUNCH KOT TO KITCHEN**. The order instantly pops up on the web Kitchen Display and Shisha master screens via real-time SSE!

---

## Stations & User Roles

| Station / Terminal | Screen / View | Description |
| :--- | :--- | :--- |
| **Floor Captain (Mobile)** | `mobile/src/screens/` | Table selection, category carousel, modifiers, instant KOT punch |
| **Kitchen Station (Web)** | KOT Queue (`Kitchen`) | Live food tickets (Burgers, Rice, Fries, Pasta), status advancement, audio chime |
| **Bar / Beverage (Web)** | KOT Queue (`Beverage`) | Live drinks queue (Mojitos, Sodas, Shakes) |
| **Shisha Master (Web/Mobile)** | Shisha Timers | Active coal timers, countdown alarms, +15m extensions |
| **Cashier Desk (Web)** | Cashier & Settlements | Split payments (Cash/UPI/Card/Khata), GST tax, 80mm ESC/POS thermal receipt |
| **Lounge Admin (Web)** | Lounge Settings | Menu prices, table layout, GST number, daily data backup |
