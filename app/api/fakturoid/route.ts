import { NextResponse } from "next/server";
import { getSlug } from "@/lib/fakturoid";

// GET /api/fakturoid — verify connection and return account slug
export async function GET() {
  try {
    const slug = await getSlug();
    return NextResponse.json({ connected: true, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("není nastaven") ? 503 : 502;
    return NextResponse.json({ connected: false, error: message }, { status });
  }
}
