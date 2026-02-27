"use client";

import { Suspense } from "react";
import { EvoluProvider, evolu } from "@/lib/evolu";

export default function EvoluClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EvoluProvider value={evolu}>
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            Loading…
          </div>
        }
      >
        {children}
      </Suspense>
    </EvoluProvider>
  );
}
