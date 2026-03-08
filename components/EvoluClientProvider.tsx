"use client";

import { Suspense } from "react";
import { EvoluProvider, evolu } from "@/lib/evolu";
import { useI18n } from "@/components/i18n/I18nProvider";

function LoadingFallback() {
  const { t } = useI18n();

  return (
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
      {t("loading.app")}
    </div>
  );
}

export default function EvoluClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EvoluProvider value={evolu}>
      <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
    </EvoluProvider>
  );
}
