import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealTrack — Monthly Meal Cost Tracker",
  description:
    "Track daily lunch & dinner, preserve historical prices, calculate monthly cost and supplier balance. Dark Android-style app.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0e13",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0e13] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
