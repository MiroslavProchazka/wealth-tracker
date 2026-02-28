import { NextResponse } from "next/server";
import { getSlug, apiGet, FakturoidSubject } from "@/lib/fakturoid";

// GET /api/fakturoid/subjects?query=<search term>
// Returns up to 20 matching subjects (clients) from the Fakturoid account.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";

  try {
    const slug = await getSlug();
    const qs = query ? `?query=${encodeURIComponent(query)}` : "";
    const subjects = await apiGet<FakturoidSubject[]>(
      `/api/v3/accounts/${slug}/subjects.json${qs}`
    );
    return NextResponse.json({ subjects: subjects.slice(0, 20) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("není nastaven") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
