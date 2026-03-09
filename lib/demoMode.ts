export const DEMO_MODE_STORAGE_KEY = "wealthTracker_demoModeEnabled";
export const ONBOARDING_CHOICE_STORAGE_KEY = "wealthTracker_onboardingChoice";
export const DEMO_MODE_HEADER = "x-wt-demo-mode";

export type OnboardingChoice = "demo" | "manual";

function safeStorageGet(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function isDemoModeEnabled(): boolean {
  return safeStorageGet(DEMO_MODE_STORAGE_KEY) === "1";
}

export function setDemoModeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function getOnboardingChoice(): OnboardingChoice | null {
  const value = safeStorageGet(ONBOARDING_CHOICE_STORAGE_KEY);
  if (value === "demo" || value === "manual") return value;
  return null;
}

export function setOnboardingChoice(choice: OnboardingChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_CHOICE_STORAGE_KEY, choice);
  } catch {
    // Ignore storage failures.
  }
}

export function isDemoModeRequest(req: Request): boolean {
  return req.headers.get(DEMO_MODE_HEADER) === "1";
}
