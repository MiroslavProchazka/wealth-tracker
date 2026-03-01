import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SwRegister from "@/components/SwRegister";

// Load EvoluClientProvider only on the client — Evolu relies on browser-only
// APIs (SharedWorker, OPFS/IndexedDB, SQLite WASM) that don't exist in Node.js.
// Using ssr:false prevents the module from being evaluated during SSR, which
// would otherwise leave the Evolu instance in a broken state and cause
// React.use() inside useQuery to suspend indefinitely ("Loading…" forever).
const EvoluClientProvider = dynamic(
  () => import("@/components/EvoluClientProvider"),
  { ssr: false },
);

export const metadata: Metadata = {
  title: "Wealth Tracker",
  description: "Personal wealth & net worth tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wealth Tracker",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        {/* Sidebar has no Evolu dependency — keep it outside the client-only
            EvoluClientProvider so it renders immediately on first paint. */}
        <Sidebar />
        <EvoluClientProvider>
          <main style={{
            flex: 1,
            padding: "2rem 2.5rem",
            maxWidth: "1400px",
            overflowX: "hidden",
            minWidth: 0,
          }}>
            {children}
          </main>
        </EvoluClientProvider>
        <SwRegister />
      </body>
    </html>
  );
}
