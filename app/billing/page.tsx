"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";
import { buildTotalInvoicedMap } from "@/lib/clockifyBalance";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClockifyProject {
  id: string;
  name: string;
  totalHours: number;
  entryCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
}

function formatHours(h: number): string {
  const full = Math.floor(h);
  const mins = Math.round((h - full) * 60);
  return mins > 0 ? `${full} h ${mins} min` : `${full} h`;
}

const CURRENCIES = [
  { value: "CZK", label: "CZK" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
];

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Nevyfakturováno", color: "var(--yellow)" },
  INVOICED: { label: "Vyfakturováno",   color: "var(--accent)" },
  OVERDUE:  { label: "Po splatnosti",   color: "var(--red)" },
  PAID:     { label: "Zaplaceno",       color: "var(--green)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const evolu = useEvolu();
  const [month, setMonth] = useState(currentYearMonth);

  // ── Clockify state ──────────────────────────────────────────────────────────
  const [projects, setProjects]   = useState<ClockifyProject[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [noApiKey, setNoApiKey]   = useState(false);

  // ── Fakturoid state ─────────────────────────────────────────────────────────
  const [fakturoidReady, setFakturoidReady]               = useState(false);
  const [sendToFakturoid, setSendToFakturoid]             = useState(false);
  const [subjectSearch, setSubjectSearch]                 = useState("");
  const [subjectResults, setSubjectResults]               = useState<{ id: number; name: string; registration_no?: string }[]>([]);
  const [selectedSubject, setSelectedSubject]             = useState<{ id: number; name: string } | null>(null);
  const [fDue, setFDue]                                   = useState("14");
  const [fVatRate, setFVatRate]                           = useState("0");
  const [fakturoidError, setFakturoidError]               = useState<string | null>(null);
  const [fakturoidSubmitting, setFakturoidSubmitting]     = useState(false);

  // ── Evolu queries ───────────────────────────────────────────────────────────
  const ratesQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("clockifyProjectRate").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted",   "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const monthlyEarningsQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("clockifyMonthlyEarnings").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted",   "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const invoicedQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("clockifyInvoicedPeriod").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted",   "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const receivablesQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("receivable").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted",   "is not", Evolu.sqliteTrue)
      .orderBy("createdAt", "desc")
  ), [evolu]);

  const rates          = useQuery(ratesQ);
  const monthlyEarnings = useQuery(monthlyEarningsQ);
  const invoiced       = useQuery(invoicedQ);
  const receivables    = useQuery(receivablesQ);

  // ── Rate map: clockifyProjectId → { rateId, hourlyRate, currency, initialEarnings } ──
  const rateMap = useMemo(() => {
    const m: Record<string, {
      rateId: string;
      name: string;
      hourlyRate: number;
      currency: string;
      initialEarnings: number;
    }> = {};
    for (const r of rates) {
      m[r.clockifyProjectId as string] = {
        rateId:          r.id as string,
        name:            r.name as string,
        hourlyRate:      r.hourlyRate as number,
        currency:        r.currency as string,
        initialEarnings: (r.initialEarnings as number | null) ?? 0,
      };
    }
    return m;
  }, [rates]);

  // ── Monthly earnings map: "projectId:yearMonth" → { earningId, hours } ─────
  const monthlyEarningsMap = useMemo(() => {
    const m: Record<string, { earningId: string; hours: number }> = {};
    for (const e of monthlyEarnings) {
      const key = `${e.clockifyProjectId as string}:${e.yearMonth as string}`;
      m[key] = { earningId: e.id as string, hours: e.hours as number };
    }
    return m;
  }, [monthlyEarnings]);

  // ── Total hours earned per project (across all synced months) ───────────────
  const totalHoursByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of monthlyEarnings) {
      const pid = e.clockifyProjectId as string;
      m[pid] = (m[pid] ?? 0) + (e.hours as number);
    }
    return m;
  }, [monthlyEarnings]);

  // ── Total invoiced per project — keyed by projectId, per-currency sums ───────
  // See buildTotalInvoicedMap in lib/clockifyBalance.ts for the intentional
  // currency-mismatch handling (cross-currency invoices are skipped to keep
  // the balance conservative; mismatches are surfaced in the UI below).
  const totalInvoicedByProject = useMemo(() => buildTotalInvoicedMap(
    invoiced.map((inv) => ({
      clockifyProjectId: inv.clockifyProjectId as string,
      amount:            inv.amount as number,
      currency:          inv.currency as string,
    }))
  ), [invoiced]);

  // ── Invoiced period map: "projectId:yearMonth" → { invId, hours, amount, currency } ──
  const invoicedMap = useMemo(() => {
    const m: Record<string, { invId: string; hours: number; amount: number; currency: string }> = {};
    for (const inv of invoiced) {
      const key = `${inv.clockifyProjectId as string}:${inv.yearMonth as string}`;
      m[key] = {
        invId:    inv.id as string,
        hours:    inv.hours as number,
        amount:   inv.amount as number,
        currency: inv.currency as string,
      };
    }
    return m;
  }, [invoiced]);

  // Keep a ref to monthlyEarningsMap so fetchClockify doesn't go stale
  const monthlyEarningsMapRef = useRef(monthlyEarningsMap);
  useEffect(() => { monthlyEarningsMapRef.current = monthlyEarningsMap; }, [monthlyEarningsMap]);

  // ── Fetch Clockify + auto-save monthly earnings snapshots ───────────────────
  const fetchClockify = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoApiKey(false);
    setProjects([]);
    setFetchedAt(null);
    try {
      const res  = await fetch(`/api/clockify?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) setNoApiKey(true);
        else setError(data.error ?? "Chyba při načítání z Clockify");
        return;
      }
      const fetched: ClockifyProject[] = data.projects ?? [];
      setProjects(fetched);
      setFetchedAt(data.fetchedAt ?? null);

      // Auto-save monthly earnings snapshot for each project with hours
      const map = monthlyEarningsMapRef.current;
      for (const p of fetched) {
        const key = `${p.id}:${month}`;
        const existing = map[key];
        if (existing) {
          evolu.update("clockifyMonthlyEarnings", {
            id: existing.earningId as never,
            hours: p.totalHours,
          } as never);
        } else {
          evolu.insert("clockifyMonthlyEarnings", {
            clockifyProjectId: p.id,
            yearMonth: month,
            hours: p.totalHours,
            deleted: Evolu.sqliteFalse,
          } as never);
        }
      }
    } catch {
      setError("Nelze se připojit k Clockify API");
    } finally {
      setLoading(false);
    }
  }, [month, evolu]);

  useEffect(() => { fetchClockify(); }, [fetchClockify]);

  // Check Fakturoid connection on mount
  useEffect(() => {
    fetch("/api/fakturoid")
      .then((r) => r.json())
      .then((d) => { if (d.connected) setFakturoidReady(true); })
      .catch(() => {});
  }, []);

  // Debounced subject search (fires only while Fakturoid section is open)
  useEffect(() => {
    if (!sendToFakturoid || !fakturoidReady || !subjectSearch) {
      setSubjectResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/fakturoid/subjects?query=${encodeURIComponent(subjectSearch)}`)
        .then((r) => r.json())
        .then((d) => setSubjectResults(d.subjects ?? []))
        .catch(() => setSubjectResults([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [subjectSearch, sendToFakturoid, fakturoidReady]);

  // ── Rate editing (local inline state) ──────────────────────────────────────
  const [rateInputs, setRateInputs] = useState<
    Record<string, { rate: string; currency: string; initialEarnings: string }>
  >({});

  function getRateInput(projectId: string) {
    if (rateInputs[projectId]) return rateInputs[projectId];
    const ex = rateMap[projectId];
    return {
      rate:            ex ? String(ex.hourlyRate) : "",
      currency:        ex?.currency ?? "CZK",
      initialEarnings: ex ? String(ex.initialEarnings) : "0",
    };
  }

  function handleRateChange(
    projectId: string,
    field: "rate" | "currency" | "initialEarnings",
    value: string
  ) {
    setRateInputs((prev) => {
      const current = prev[projectId] ?? (() => {
        const ex = rateMap[projectId];
        return {
          rate:            ex ? String(ex.hourlyRate) : "",
          currency:        ex?.currency ?? "CZK",
          initialEarnings: ex ? String(ex.initialEarnings) : "0",
        };
      })();
      return { ...prev, [projectId]: { ...current, [field]: value } };
    });
  }

  function saveRate(projectId: string, name: string) {
    const inp  = getRateInput(projectId);
    const rate = parseFloat(inp.rate);
    const init = parseFloat(inp.initialEarnings);
    if (isNaN(rate) || rate < 0) return;
    const existing = rateMap[projectId];
    const initialEarnings = isNaN(init) || init < 0 ? 0 : init;
    if (existing) {
      evolu.update("clockifyProjectRate", {
        id: existing.rateId as never,
        hourlyRate: rate,
        currency: inp.currency,
        initialEarnings,
        name,
      } as never);
    } else {
      evolu.insert("clockifyProjectRate", {
        clockifyProjectId: projectId,
        name,
        hourlyRate: rate,
        currency: inp.currency,
        initialEarnings,
        deleted: Evolu.sqliteFalse,
      } as never);
    }
    setRateInputs((prev) => { const n = { ...prev }; delete n[projectId]; return n; });
  }

  // ── Invoice creation modal ──────────────────────────────────────────────────
  const [invoiceModal, setInvoiceModal] = useState<{
    project: ClockifyProject | { id: string; name: string };
    nevyfakturováno: number;
    currency: string;
  } | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ description: "", amount: "", dueDate: "" });
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  function openInvoiceModal(projectId: string, projectName: string) {
    const rateInfo = rateMap[projectId];
    const rate     = rateInfo?.hourlyRate ?? 0;
    const currency = rateInfo?.currency ?? "CZK";
    const totalHours    = totalHoursByProject[projectId] ?? 0;
    const totalEarned   = (rateInfo?.initialEarnings ?? 0) + totalHours * rate;
    const invoicedEntry = totalInvoicedByProject[projectId];
    // Only subtract invoiced amount when currencies match; otherwise keep full balance
    const totalInvoiced = (invoicedEntry && invoicedEntry.currency === currency)
      ? invoicedEntry.amount : 0;
    const nev = Math.max(0, totalEarned - totalInvoiced);

    setInvoiceModal({
      project: { id: projectId, name: projectName },
      nevyfakturováno: nev,
      currency,
    });
    setInvoiceForm({
      description: `${projectName} — ${monthLabel(month)}`,
      amount: nev > 0 ? String(Math.round(nev)) : "",
      dueDate: "",
    });
    setInvoiceError(null);
    // Reset Fakturoid section
    setSendToFakturoid(false);
    setSelectedSubject(null);
    setSubjectSearch("");
    setSubjectResults([]);
    setFakturoidError(null);
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceModal) return;

    const description = invoiceForm.description.trim();
    const amount      = parseFloat(invoiceForm.amount);
    if (!description) { setInvoiceError("Popis faktury je povinný"); return; }
    if (isNaN(amount) || amount <= 0) { setInvoiceError("Zadej platnou částku větší než 0"); return; }
    setInvoiceError(null);

    const { project, currency } = invoiceModal;
    const currentMonthHours = projects.find(p => p.id === project.id)?.totalHours ?? 0;

    // Optionally create invoice in Fakturoid first
    let fakturoidTag = "";
    if (sendToFakturoid && fakturoidReady) {
      if (!selectedSubject) { setInvoiceError("Vyber klienta z Fakturoidu"); return; }
      setFakturoidError(null);
      setFakturoidSubmitting(true);
      try {
        const r = await fetch("/api/fakturoid/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject_id: selectedSubject.id,
            issued_on: new Date().toISOString().slice(0, 10),
            due: parseInt(fDue, 10) || 14,
            currency,
            note: description,
            lines: [{
              name: description,
              quantity: "1.0",
              unit_name: "ks",
              unit_price: String(amount),
              vat_rate: fVatRate,
            }],
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          setFakturoidError(d.error ?? "Fakturoid: chyba při vytváření faktury");
          setFakturoidSubmitting(false);
          return;
        }
        fakturoidTag = d.number ? ` · Fakturoid ${d.number}` : "";
      } catch {
        setFakturoidError("Nelze se připojit k Fakturoidu");
        setFakturoidSubmitting(false);
        return;
      }
      setFakturoidSubmitting(false);
    }

    // 1. Insert receivable (pohledávka)
    evolu.insert("receivable", {
      description,
      client: project.name,
      amount,
      currency,
      status: "INVOICED",
      dueDate: invoiceForm.dueDate || null,
      notes: `Clockify · ${monthLabel(month)}${currentMonthHours > 0 ? ` · ${formatHours(currentMonthHours)}` : ""}${fakturoidTag}`,
      deleted: Evolu.sqliteFalse,
    } as never);

    // 2. Record invoiced period (update if exists to avoid duplicates)
    const invKey = `${project.id}:${month}`;
    const existingInv = invoicedMap[invKey];
    if (existingInv) {
      evolu.update("clockifyInvoicedPeriod", {
        id: existingInv.invId as never,
        hours: currentMonthHours,
        amount,
        currency,
      } as never);
    } else {
      evolu.insert("clockifyInvoicedPeriod", {
        clockifyProjectId: project.id,
        yearMonth: month,
        hours: currentMonthHours,
        amount,
        currency,
        deleted: Evolu.sqliteFalse,
      } as never);
    }

    // 3. Ensure rate is saved
    saveRate(project.id, project.name);

    setInvoiceModal(null);
  }

  // ── Receivables CRUD ────────────────────────────────────────────────────────
  function markPaid(id: string) {
    evolu.update("receivable", { id: id as never, status: "PAID" } as never);
  }
  function deleteReceivable(id: string) {
    if (!confirm("Smazat tuto pohledávku?")) return;
    evolu.update("receivable", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  // Outstanding receivables = INVOICED + OVERDUE (invoice sent, payment pending).
  // PENDING receivables are not yet invoiced — they're represented by "nevyfakturováno" above.
  const pendingByCurrency = receivables
    .filter((r) => ["INVOICED", "OVERDUE"].includes(String(r.status)))
    .reduce<Record<string, number>>((acc, r) => {
      const cur = String(r.currency ?? "CZK");
      acc[cur] = (acc[cur] ?? 0) + (r.amount as number);
      return acc;
    }, {});

  // ── All known projects (union of synced + stored) ───────────────────────────
  // We show projects even if current month has no hours, as long as they have
  // stored earnings or a configured rate.
  const allProjectIds = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach(p => ids.add(p.id));
    rates.forEach(r => ids.add(r.clockifyProjectId as string));
    return ids;
  }, [projects, rates]);

  // Build a displayable project list (merging live Clockify data with stored rates)
  const displayProjects = useMemo(() => {
    return Array.from(allProjectIds).map(id => {
      const live    = projects.find(p => p.id === id);
      const rateInfo = rateMap[id];
      const name    = live?.name ?? rateInfo?.name ?? id;
      const thisMonthHours = live?.totalHours ?? 0;
      const entryCount     = live?.entryCount ?? 0;

      const rate           = rateInfo?.hourlyRate ?? 0;
      const currency       = rateInfo?.currency ?? "CZK";
      const initialEarnings = rateInfo?.initialEarnings ?? 0;
      const totalHours      = totalHoursByProject[id] ?? 0;
      const totalEarned     = initialEarnings + totalHours * rate;
      const invoicedEntry   = totalInvoicedByProject[id];
      const totalInvoiced   = (invoicedEntry && invoicedEntry.currency === currency)
        ? invoicedEntry.amount : 0;
      const currencyMismatch = !!invoicedEntry && invoicedEntry.currency !== currency;
      const nevyfakturováno = Math.max(0, totalEarned - totalInvoiced);

      return { id, name, thisMonthHours, entryCount, rate, currency, initialEarnings, totalEarned, totalInvoiced, nevyfakturováno, hasRate: !!rateInfo, currencyMismatch };
    }).sort((a, b) => b.nevyfakturováno - a.nevyfakturováno);
  }, [allProjectIds, projects, rateMap, totalHoursByProject, totalInvoicedByProject]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Billing</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
            Clockify čas · nevyfakturováno · pohledávky
          </p>
        </div>
      </div>

      {/* ── Clockify section ── */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {/* Month nav + sync */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button className="btn-ghost" onClick={() => setMonth((m) => addMonths(m, -1))} style={{ padding: "0.35rem 0.65rem", fontSize: "0.9rem" }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: "1rem", minWidth: "160px", textAlign: "center" }}>{monthLabel(month)}</span>
          <button className="btn-ghost" onClick={() => setMonth((m) => addMonths(m, 1))} style={{ padding: "0.35rem 0.65rem", fontSize: "0.9rem" }}
            disabled={month >= currentYearMonth()}>›</button>
          <button className="btn-ghost" onClick={fetchClockify} disabled={loading}
            style={{ marginLeft: "auto", fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}>
            {loading ? "⏳ Načítám…" : "↻ Sync Clockify"}
          </button>
          {fetchedAt && !loading && (
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              {new Date(fetchedAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* No API key */}
        {noApiKey && (
          <div style={{ padding: "1.5rem", borderRadius: "10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "0.875rem" }}>
            <div style={{ fontWeight: 700, color: "var(--yellow)", marginBottom: "0.5rem" }}>⚠ Clockify API klíč není nastaven</div>
            <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              Přidej proměnnou <code style={{ background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>CLOCKIFY_API_KEY</code> do{" "}
              <code style={{ background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>.env.local</code> nebo do Vercel environment variables.
              API klíč najdeš v <strong>Clockify → Profile Settings → API</strong>.
            </div>
          </div>
        )}

        {/* Error */}
        {error && !noApiKey && (
          <div style={{ padding: "1rem", borderRadius: "8px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", color: "var(--red)", fontSize: "0.875rem" }}>
            ⚠ {error}
          </div>
        )}

        {/* Project cards */}
        {displayProjects.length === 0 && !loading && !error && !noApiKey && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            Žádné projekty. Klikni ↻ Sync Clockify pro načtení dat.
          </div>
        )}

        {displayProjects.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {displayProjects.map((p) => {
              const inp    = getRateInput(p.id);
              const isDirty = !!rateInputs[p.id];
              const thisMonthAmount = p.rate > 0 ? Math.round(p.thisMonthHours * p.rate * 100) / 100 : null;

              return (
                <div key={p.id} style={{
                  padding: "1.25rem 1.5rem",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid var(--border)",
                }}>
                  {/* ── Top row: name + nevyfakturováno badge ── */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{p.name}</span>
                      {p.thisMonthHours > 0 && (
                        <span style={{ marginLeft: "0.6rem", fontSize: "0.72rem", color: "var(--muted)", padding: "0.15rem 0.5rem", borderRadius: "12px", background: "rgba(255,255,255,0.07)" }}>
                          {p.entryCount} záznamů tento měsíc
                        </span>
                      )}
                    </div>

                    {/* Nevyfakturováno */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                        Nevyfakturováno
                      </div>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: p.nevyfakturováno > 0 ? "var(--accent)" : "var(--muted)" }}>
                        {p.rate > 0 ? formatCurrency(p.nevyfakturováno, p.currency) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* ── This month row ── */}
                  {p.thisMonthHours > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem", padding: "0.6rem 0.9rem", borderRadius: "8px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--accent-2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {monthLabel(month)}
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                        {formatHours(p.thisMonthHours)}
                      </span>
                      {p.rate > 0 && thisMonthAmount !== null && (
                        <>
                          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>×</span>
                          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{formatCurrency(p.rate, p.currency)}/h</span>
                          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>=</span>
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>{formatCurrency(thisMonthAmount, p.currency)}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Stats row ── */}
                  {p.hasRate && (
                    <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.9rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                      <span>Celkem vyděláno: <strong style={{ color: "var(--text)" }}>{formatCurrency(p.totalEarned, p.currency)}</strong></span>
                      <span>Vyfakturováno: <strong style={{ color: "var(--text)" }}>{formatCurrency(p.totalInvoiced, p.currency)}</strong></span>
                      {p.currencyMismatch && (
                        <span style={{ color: "var(--yellow)", fontSize: "0.72rem" }}>
                          ⚠ Měna faktur se liší od aktuální sazby — historické faktury nejsou zahrnuty v zůstatku
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Settings row: rate + initial earnings ── */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
                    {/* Hourly rate */}
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "0.25rem", fontWeight: 600 }}>Hodinová sazba</div>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <input
                          type="number"
                          value={inp.rate}
                          onChange={(e) => handleRateChange(p.id, "rate", e.target.value)}
                          placeholder="0"
                          min="0"
                          step="any"
                          style={{ width: "90px", padding: "0.3rem 0.5rem", borderRadius: "6px", border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem", textAlign: "right" }}
                        />
                        <select
                          value={inp.currency}
                          onChange={(e) => handleRateChange(p.id, "currency", e.target.value)}
                          style={{ padding: "0.3rem 0.5rem", borderRadius: "6px", border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem" }}
                        >
                          {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                        </select>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>/h</span>
                      </div>
                    </div>

                    {/* Initial (historical) uninvoiced balance */}
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "0.25rem", fontWeight: 600 }}>Počáteční nevyfakturováno</div>
                      <input
                        type="number"
                        value={inp.initialEarnings}
                        onChange={(e) => handleRateChange(p.id, "initialEarnings", e.target.value)}
                        placeholder="0"
                        min="0"
                        step="any"
                        title="Co jsi vydělal a ještě nevyfakturoval před začátkem sledování"
                        style={{ width: "120px", padding: "0.3rem 0.5rem", borderRadius: "6px", border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem", textAlign: "right" }}
                      />
                    </div>

                    {isDirty && (
                      <button className="btn-ghost" onClick={() => saveRate(p.id, p.name)} style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem", color: "var(--accent)", marginBottom: "1px" }}>
                        Uložit nastavení
                      </button>
                    )}

                    {/* Spacer + invoice button */}
                    <div style={{ marginLeft: "auto" }}>
                      <button
                        className="btn-primary"
                        onClick={() => openInvoiceModal(p.id, p.name)}
                        disabled={!p.hasRate || p.nevyfakturováno <= 0}
                        style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                      >
                        Vytvořit fakturu →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pohledávky section ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Pohledávky</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {Object.entries(pendingByCurrency).map(([cur, total]) => (
            <span key={cur} style={{ fontSize: "0.85rem", color: "var(--yellow)", fontWeight: 700 }}>
              {formatCurrency(total, cur)} čeká na úhradu
            </span>
          ))}
          <Link href="/receivables" style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", borderRadius: "6px", background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            + Přidat ručně
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {receivables.length === 0 ? (
          <p style={{ padding: "2rem", color: "var(--muted)", textAlign: "center", fontSize: "0.875rem" }}>
            Zatím žádné pohledávky. Využij tlačítko &quot;Vytvořit fakturu&quot; výše.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Popis</th>
                <th>Klient</th>
                <th style={{ textAlign: "right" }}>Částka</th>
                <th>Splatnost</th>
                <th>Stav</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receivables.map((r) => {
                const statusStr  = String(r.status);
                const badge      = STATUS_BADGE[statusStr];
                const dueDateStr = r.dueDate ? String(r.dueDate) : null;
                const overdue    = statusStr !== "PAID" && dueDateStr && new Date(dueDateStr) < new Date();
                return (
                  <tr key={r.id as string}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{r.description as string}</div>
                      {(r.notes as string) && (
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.1rem" }}>{r.notes as string}</div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{(r.client as string) ?? "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: statusStr === "PAID" ? "var(--green)" : "var(--text)" }}>
                      {formatCurrency(r.amount as number, r.currency as string)}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: overdue ? "var(--red)" : "var(--muted)" }}>
                      {dueDateStr ? new Date(dueDateStr).toLocaleDateString("cs-CZ") : "—"}
                      {overdue && " ⚠️"}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "12px", background: `${badge?.color ?? "var(--muted)"}1a`, color: badge?.color ?? "var(--muted)", border: `1px solid ${badge?.color ?? "var(--muted)"}40` }}>
                        {badge?.label ?? statusStr}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {statusStr !== "PAID" && (
                          <button
                            onClick={() => markPaid(r.id as string)}
                            style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "6px", padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600 }}
                          >
                            ✓ Zaplaceno
                          </button>
                        )}
                        <button className="btn-danger" onClick={() => deleteReceivable(r.id as string)} style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Invoice creation modal ── */}
      {invoiceModal && (
        <Modal
          title={`Faktura — ${invoiceModal.project.name}`}
          onClose={() => setInvoiceModal(null)}
        >
          <form onSubmit={handleCreateInvoice} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* Summary box */}
            <div style={{ padding: "1rem 1.2rem", borderRadius: "10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Nevyfakturovaný zůstatek
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)" }}>
                {formatCurrency(invoiceModal.nevyfakturováno, invoiceModal.currency)}
              </div>
            </div>

            <FormField
              label="Popis faktury *"
              name="description"
              value={invoiceForm.description}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={`${invoiceModal.project.name} — ${monthLabel(month)}`}
              required
            />

            {/* Amount — pre-filled, user can edit */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-2)" }}>
                Fakturovaná částka ({invoiceModal.currency}) *
              </label>
              <input
                type="number"
                name="amount"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                min="0.01"
                step="0.01"
                required
                placeholder="0"
                style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: "0.9rem" }}
              />
            </div>

            <FormField
              label="Datum splatnosti"
              name="dueDate"
              type="date"
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
            />

            {/* ── Fakturoid section (only when connected) ── */}
            {fakturoidReady && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={sendToFakturoid}
                    onChange={(e) => setSendToFakturoid(e.target.checked)}
                    style={{ width: "15px", height: "15px", accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Vytvořit fakturu v Fakturoidu</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>nepovinné</span>
                </label>

                {sendToFakturoid && (
                  <div style={{ marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                    {/* Subject (client) search */}
                    <div style={{ position: "relative" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-2)" }}>
                        Klient *
                      </label>
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => { setSubjectSearch(e.target.value); setSelectedSubject(null); }}
                        placeholder="Hledat jméno nebo IČ…"
                        autoComplete="off"
                        style={{
                          width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px",
                          border: `1px solid ${selectedSubject ? "var(--green)" : "var(--border)"}`,
                          background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem",
                        }}
                      />
                      {subjectResults.length > 0 && !selectedSubject && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                          background: "var(--surface-1)", border: "1px solid var(--border)",
                          borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                          marginTop: "3px", maxHeight: "200px", overflowY: "auto",
                        }}>
                          {subjectResults.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => { setSelectedSubject(s); setSubjectSearch(s.name); setSubjectResults([]); }}
                              style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "0.6rem 0.9rem", background: "transparent",
                                border: "none", borderBottom: "1px solid var(--border)",
                                color: "var(--text)", cursor: "pointer", fontSize: "0.875rem",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                              {s.registration_no && (
                                <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                                  IČ {s.registration_no}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedSubject && (
                        <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "var(--green)" }}>
                          ✓ {selectedSubject.name}
                        </div>
                      )}
                    </div>

                    {/* Splatnost + DPH */}
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-2)" }}>
                          Splatnost (dny)
                        </label>
                        <input
                          type="number"
                          value={fDue}
                          onChange={(e) => setFDue(e.target.value)}
                          min="1" max="365"
                          style={{ width: "80px", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem", textAlign: "right" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-2)" }}>
                          Sazba DPH
                        </label>
                        <select
                          value={fVatRate}
                          onChange={(e) => setFVatRate(e.target.value)}
                          style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: "0.875rem" }}
                        >
                          <option value="0">0 %</option>
                          <option value="12">12 %</option>
                          <option value="21">21 %</option>
                        </select>
                      </div>
                    </div>

                    {fakturoidError && (
                      <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "var(--red)", fontSize: "0.85rem" }}>
                        ⚠ {fakturoidError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {invoiceError && (
              <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "var(--red)", fontSize: "0.85rem" }}>
                ⚠ {invoiceError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => setInvoiceModal(null)}>Zrušit</button>
              <button type="submit" className="btn-primary" disabled={fakturoidSubmitting}>
                {fakturoidSubmitting ? "Odesílám…" : "Vytvořit pohledávku →"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
