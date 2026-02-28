import { NextResponse } from "next/server";

const BASE = "https://api.clockify.me/api/v1";

function clockifyHeaders(): Record<string, string> {
  const key = process.env.CLOCKIFY_API_KEY;
  if (!key) throw new Error("CLOCKIFY_API_KEY není nastavený");
  return { "X-Api-Key": key, "Content-Type": "application/json" };
}

// Parse ISO 8601 duration "PT7H30M15S" → seconds
function parseDuration(duration: string | null | undefined): number {
  if (!duration) return 0;
  const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0") * 3600 +
    parseInt(m[2] ?? "0") * 60 +
    parseFloat(m[3] ?? "0")
  );
}

// Server-side workspace cache (avoids repeated /user calls)
let wsCache: { workspaceId: string; userId: string; fetchedAt: number } | null = null;

async function getWorkspace() {
  if (wsCache && Date.now() - wsCache.fetchedAt < 60 * 60 * 1000) return wsCache;
  const res = await fetch(`${BASE}/user`, { headers: clockifyHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Clockify /user selhal: HTTP ${res.status}`);
  const user = await res.json() as { id: string; defaultWorkspace: string };
  wsCache = { workspaceId: user.defaultWorkspace, userId: user.id, fetchedAt: Date.now() };
  return wsCache;
}

// GET /api/clockify?month=YYYY-MM
// Returns { projects: [{ id, name, totalHours, entryCount }], month, fetchedAt }
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawMonth = searchParams.get("month") ?? currentYearMonth();

  // Validate month format strictly to prevent parseInt(NaN) downstream
  const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!MONTH_RE.test(rawMonth)) {
    return NextResponse.json(
      { error: `Neplatný formát měsíce: "${rawMonth}" (očekáváno YYYY-MM)` },
      { status: 400 }
    );
  }
  const month = rawMonth;

  try {
    const { workspaceId, userId } = await getWorkspace();

    // Build date range for month (inclusive)
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mon  = parseInt(monthStr, 10);
    const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0)).toISOString();
    const end   = new Date(Date.UTC(year, mon, 0, 23, 59, 59)).toISOString();

    // Fetch projects list + time entries in parallel (no-store: month data must always be fresh)
    const [projRes, entriesRes] = await Promise.all([
      fetch(
        `${BASE}/workspaces/${workspaceId}/projects?page-size=200&archived=false`,
        { headers: clockifyHeaders(), cache: "no-store" }
      ),
      fetch(
        `${BASE}/workspaces/${workspaceId}/user/${userId}/time-entries` +
        `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&page-size=5000`,
        { headers: clockifyHeaders(), cache: "no-store" }
      ),
    ]);

    if (!projRes.ok) throw new Error(`Clockify /projects selhal: HTTP ${projRes.status}`);
    if (!entriesRes.ok) throw new Error(`Clockify /time-entries selhal: HTTP ${entriesRes.status}`);

    const projects = await projRes.json() as { id: string; name: string }[];
    const entries  = await entriesRes.json() as {
      id: string;
      projectId: string;
      timeInterval: { start: string; end: string; duration: string };
    }[];

    // Group by project
    const byProject: Record<string, { id: string; name: string; totalSeconds: number; entryCount: number }> = {};
    for (const p of projects) {
      byProject[p.id] = { id: p.id, name: p.name, totalSeconds: 0, entryCount: 0 };
    }
    for (const entry of entries) {
      if (!entry.projectId || !byProject[entry.projectId]) continue;
      byProject[entry.projectId].totalSeconds += parseDuration(entry.timeInterval?.duration);
      byProject[entry.projectId].entryCount++;
    }

    const result = Object.values(byProject)
      .filter(p => p.totalSeconds > 0)
      .map(p => ({
        id:         p.id,
        name:       p.name,
        totalHours: Math.round((p.totalSeconds / 3600) * 100) / 100,
        entryCount: p.entryCount,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    return NextResponse.json({ projects: result, month, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    const status  = message.includes("CLOCKIFY_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
