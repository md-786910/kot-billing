import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LAYALI · Luxury Lounge POS & Kitchen KOT Engine',
  description: 'Enterprise multi-station KOT, Shisha live timers, private cabin bookings and 80mm thermal billing system for Layali Lounge.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0c10] text-[#f1f5f9] select-none">
        {children}
      </body>
    </html>
  );
}
