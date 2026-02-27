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
      <body style={{ display: "flex", minHeight: "100vh" }}>
        <EvoluClientProvider>
          <Sidebar />
          <main style={{ flex: 1, padding: "2rem", maxWidth: "1400px" }}>
            {children}
          </main>
        </EvoluClientProvider>
      </body>
    </html>
  );
}
