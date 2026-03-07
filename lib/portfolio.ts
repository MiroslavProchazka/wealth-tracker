export const ASSET_CLASSES = [
  "Property",
  "Savings",
  "Stocks",
  "Crypto",
  "Receivables",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export const DEFAULT_ALLOCATION_TARGETS: Record<AssetClass, number> = {
  Property: 35,
  Savings: 10,
  Stocks: 35,
  Crypto: 10,
  Receivables: 10,
};

export type SnapshotAutomationSettings = {
  dailyOnOpen: boolean;
};

export const DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS: SnapshotAutomationSettings = {
  dailyOnOpen: true,
};

export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export function stringifyTags(tags: string[]): string | null {
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized.join(", ") : null;
}

export function normalizeAssetClass(value: string): AssetClass | null {
  return ASSET_CLASSES.includes(value as AssetClass) ? (value as AssetClass) : null;
}
