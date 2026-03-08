"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type DashboardStatusTone =
  | "ok"
  | "warning"
  | "error"
  | "loading"
  | "neutral";

export interface DashboardStatusItem {
  label: string;
  value: string;
  tone?: DashboardStatusTone;
}

interface DashboardStatusContextValue {
  items: DashboardStatusItem[];
  setItems: React.Dispatch<React.SetStateAction<DashboardStatusItem[]>>;
}

const DashboardStatusContext = createContext<DashboardStatusContextValue>({
  items: [],
  setItems: () => undefined,
});

export function DashboardStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<DashboardStatusItem[]>([]);

  const value = useMemo(
    () => ({
      items,
      setItems,
    }),
    [items],
  );

  return (
    <DashboardStatusContext.Provider value={value}>
      {children}
    </DashboardStatusContext.Provider>
  );
}

export function useDashboardStatus() {
  return useContext(DashboardStatusContext);
}
