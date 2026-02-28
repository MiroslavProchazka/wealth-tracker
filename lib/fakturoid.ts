/**
 * Server-side Fakturoid API v3 client.
 * Uses OAuth 2.0 Client Credentials flow.
 *
 * Required env vars:
 *   FAKTUROID_CLIENT_ID      – OAuth client ID
 *   FAKTUROID_CLIENT_SECRET  – OAuth client secret
 *   FAKTUROID_SLUG           – account slug (optional; auto-detected if omitted)
 *   FAKTUROID_USER_AGENT     – User-Agent header (optional; required by Fakturoid)
 */

const BASE = "https://app.fakturoid.cz";

// In-process caches — survive warm instances, reset on cold starts
let tokenCache: { token: string; expiresAt: number } | null = null;
let slugCache: string | null = null;

function userAgent(): string {
  return (
    process.env.FAKTUROID_USER_AGENT ?? "WealthTracker (admin@example.com)"
  );
}

function ensureCredentials() {
  const clientId = process.env.FAKTUROID_CLIENT_ID;
  const clientSecret = process.env.FAKTUROID_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error(
      "FAKTUROID_CLIENT_ID nebo FAKTUROID_CLIENT_SECRET není nastaven"
    );
  return { clientId, clientSecret };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000)
    return tokenCache.token;

  const { clientId, clientSecret } = ensureCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fakturoid auth HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

// ── Account slug ──────────────────────────────────────────────────────────────

export async function getSlug(): Promise<string> {
  if (process.env.FAKTUROID_SLUG) return process.env.FAKTUROID_SLUG;
  if (slugCache) return slugCache;

  const user = await apiGet<{ accounts: { slug: string; name: string }[] }>(
    "/api/v3/user.json"
  );
  const slug = user.accounts[0]?.slug;
  if (!slug) throw new Error("Žádný Fakturoid účet nenalezen");
  slugCache = slug;
  return slug;
}

// ── Low-level fetch helpers ───────────────────────────────────────────────────

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": userAgent(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await rawFetch(path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fakturoid GET ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown
): Promise<{ data: T; location: string | null }> {
  const res = await rawFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fakturoid POST ${path} → HTTP ${res.status}: ${text}`);
  }
  const data = (await res.json()) as T;
  return { data, location: res.headers.get("location") };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FakturoidSubject {
  id: number;
  name: string;
  email?: string;
  registration_no?: string; // IČ
  vat_no?: string; // DIČ
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}

export interface FakturoidInvoiceLine {
  name: string;
  quantity: string; // e.g. "1.0" or "40.5"
  unit_name?: string; // e.g. "h", "ks"
  unit_price: string; // e.g. "1100.00"
  vat_rate?: string; // e.g. "0", "12", "21"
}

export interface FakturoidInvoice {
  id: number;
  number: string; // e.g. "2026-001"
  currency: string;
  total: string;
  subject_id: number;
  subject_name?: string;
  html_url: string; // admin URL
  public_html_url?: string;
  issued_on: string; // "YYYY-MM-DD"
  due_on: string;
  status?: string;
  lines: FakturoidInvoiceLine[];
}

export interface CreateInvoicePayload {
  subject_id: number;
  issued_on?: string;
  taxable_fulfillment_due?: string;
  due?: number; // days until due
  currency?: string;
  note?: string;
  lines: FakturoidInvoiceLine[];
}
