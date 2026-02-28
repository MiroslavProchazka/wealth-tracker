import { NextResponse } from "next/server";
import {
  getSlug,
  apiGet,
  apiPost,
  FakturoidInvoice,
  CreateInvoicePayload,
} from "@/lib/fakturoid";

// GET /api/fakturoid/invoices?page=1
// Returns the most recent invoices from the Fakturoid account.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Parse as integer to prevent query-parameter injection
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  try {
    const slug = await getSlug();
    const invoices = await apiGet<FakturoidInvoice[]>(
      `/api/v3/accounts/${slug}/invoices.json?page=${page}&proforma=false`
    );
    return NextResponse.json({ invoices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("není nastaven") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fakturoid/invoices
// Body: CreateInvoicePayload (subject_id, lines, currency, due, issued_on, note)
// Returns the created FakturoidInvoice (201).
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateInvoicePayload;

    if (!body.subject_id) {
      return NextResponse.json(
        { error: "subject_id je povinné" },
        { status: 400 }
      );
    }
    if (!body.lines?.length) {
      return NextResponse.json(
        { error: "Faktura musí mít alespoň jednu položku (lines)" },
        { status: 400 }
      );
    }

    const slug = await getSlug();
    const today = new Date().toISOString().slice(0, 10);
    const payload: CreateInvoicePayload = {
      issued_on: today,
      taxable_fulfillment_due: today,
      due: 14,
      ...body,
    };

    const { data: invoice } = await apiPost<FakturoidInvoice>(
      `/api/v3/accounts/${slug}/invoices.json`,
      payload
    );

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("není nastaven") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
