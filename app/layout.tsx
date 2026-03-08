import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import EvoluNoSSR from "@/components/EvoluNoSSR";
import SwRegister from "@/components/SwRegister";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

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
    <html lang="cs" suppressHydrationWarning>
      <body style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        <I18nProvider>
          {/* Sidebar has no Evolu dependency — keep it outside the client-only
              EvoluNoSSR wrapper so it renders immediately on first paint. */}
          <Sidebar />
          <EvoluNoSSR>
            <main
              className="main-content"
              style={{
                flex: 1,
                padding: "2rem 2.5rem",
                maxWidth: "1400px",
                overflowX: "hidden",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                <LanguageSwitcher />
              </div>
              {children}
            </main>
          </EvoluNoSSR>
          <SwRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
