import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import EvoluClientProvider from "@/components/EvoluClientProvider";

export const metadata: Metadata = {
  title: "Wealth Tracker",
  description: "Personal wealth & net worth tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        <EvoluClientProvider>
          <Sidebar />
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
      </body>
    </html>
  );
}
