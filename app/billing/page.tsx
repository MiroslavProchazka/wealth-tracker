"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ClockifyProject {
  id: string;
  name: string;
  totalHours: number;
  entryCount: number;
}

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
  const [projects, setProjects]     = useState<ClockifyProject[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fetchedAt, setFetchedAt]   = useState<string | null>(null);
  const [noApiKey, setNoApiKey]     = useState(false);

  // ── Evolu queries ───────────────────────────────────────────────────────────
  const ratesQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("clockifyProjectRate").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const invoicedQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("clockifyInvoicedPeriod").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const receivablesQ = useMemo(() => evolu.createQuery((db) =>
    db.selectFrom("receivable").selectAll()
      .where("isDeleted", "is not", Evolu.sqliteTrue)
      .where("deleted", "is not", Evolu.sqliteTrue)
      .orderBy("createdAt", "desc")
  ), [evolu]);

  const rates      = useQuery(ratesQ);
  const invoiced   = useQuery(invoicedQ);
  const receivables = useQuery(receivablesQ);

  // ── Rate map: clockifyProjectId → { rateId, hourlyRate, currency } ─────────
  const rateMap = useMemo(() => {
    const m: Record<string, { rateId: string; hourlyRate: number; currency: string }> = {};
    for (const r of rates) {
      m[r.clockifyProjectId as string] = {
        rateId:     r.id as string,
        hourlyRate: r.hourlyRate as number,
        currency:   r.currency as string,
      };
    }
    return m;
  }, [rates]);

  // ── Invoiced map: `projectId:yearMonth` → { invId, hours, amount, currency }
  // invId is stored so we can UPDATE the record instead of inserting a duplicate
  // when the user clicks "+ Znovu fakturovat".
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

  // ── Fetch Clockify data ─────────────────────────────────────────────────────
  const fetchClockify = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoApiKey(false);
    // Clear previous month's data immediately so stale projects can't be
    // accidentally invoiced against the wrong period.
    setProjects([]);
    setFetchedAt(null);
    try {
      const res  = await fetch(`/api/clockify?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) { setNoApiKey(true); }
        else { setError(data.error ?? "Chyba při načítání z Clockify"); }
        // projects / fetchedAt stay cleared
        return;
      }
      setProjects(data.projects ?? []);
      setFetchedAt(data.fetchedAt ?? null);
    } catch {
      setError("Nelze se připojit k Clockify API");
      // projects / fetchedAt stay cleared
    } finally {
      setLoading(false);
    }
  }, [month]);

  // Auto-fetch on mount + month change
  useEffect(() => { fetchClockify(); }, [fetchClockify]);

  // ── Rate editing (local inline state) ──────────────────────────────────────
  const [rateInputs, setRateInputs] = useState<Record<string, { rate: string; currency: string }>>({});

  function getRateInput(projectId: string) {
    if (rateInputs[projectId]) return rateInputs[projectId];
    const existing = rateMap[projectId];
    return { rate: existing ? String(existing.hourlyRate) : "", currency: existing?.currency ?? "CZK" };
  }

  function handleRateChange(projectId: string, field: "rate" | "currency", value: string) {
    setRateInputs((prev) => {
      // Use prev[projectId] (not getRateInput) to avoid reading stale state
      // inside the updater — getRateInput reads rateInputs from the outer closure.
      const current = prev[projectId] ?? (() => {
        const ex = rateMap[projectId];
        return { rate: ex ? String(ex.hourlyRate) : "", currency: ex?.currency ?? "CZK" };
      })();
      return { ...prev, [projectId]: { ...current, [field]: value } };
    });
  }

  function saveRate(projectId: string, name: string) {
    const inp = getRateInput(projectId);
    const rate = parseFloat(inp.rate);
    if (isNaN(rate) || rate < 0) return;
    const existing = rateMap[projectId];
    if (existing) {
      evolu.update("clockifyProjectRate", {
        id: existing.rateId as never,
        hourlyRate: rate,
        currency: inp.currency,
        name,
      } as never);
    } else {
      evolu.insert("clockifyProjectRate", {
        clockifyProjectId: projectId,
        name,
        hourlyRate: rate,
        currency: inp.currency,
        deleted: Evolu.sqliteFalse,
      } as never);
    }
    setRateInputs((prev) => { const n = { ...prev }; delete n[projectId]; return n; });
  }

  // ── Invoice creation modal ──────────────────────────────────────────────────
  const [invoiceModal, setInvoiceModal] = useState<{
    project: ClockifyProject;
    hours: number;
    amount: number;
    currency: string;
  } | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ description: "", dueDate: "" });
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  function openInvoiceModal(p: ClockifyProject) {
    const inp = getRateInput(p.id);
    const rate = parseFloat(inp.rate);
    const amount = isNaN(rate) ? 0 : Math.round(p.totalHours * rate * 100) / 100;
    setInvoiceModal({ project: p, hours: p.totalHours, amount, currency: inp.currency });
    const defaultDesc = `${p.name} — ${monthLabel(month)}`;
    setInvoiceForm({ description: defaultDesc, dueDate: "" });
    setInvoiceError(null);
  }

  function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceModal) return;

    // ── Client-side validation ───────────────────────────────────────────────
    const description = invoiceForm.description.trim();
    if (!description) {
      setInvoiceError("Popis faktury je povinný");
      return;
    }
    if (invoiceModal.amount <= 0) {
      setInvoiceError("Výsledná částka musí být větší než 0 — nastav prosím hodinovou sazbu");
      return;
    }
    setInvoiceError(null);

    const { project, hours, amount, currency } = invoiceModal;

    // 1. Insert receivable
    evolu.insert("receivable", {
      description,
      client: project.name,
      amount,
      currency,
      status: "INVOICED",
      dueDate: invoiceForm.dueDate || null,
      notes: `Clockify — ${formatHours(hours)} · ${monthLabel(month)}`,
      deleted: Evolu.sqliteFalse,
    } as never);

    // 2. Mark / update invoiced period.
    //    Update existing record if one already exists for this project+month to avoid
    //    duplicate rows ("+ Znovu fakturovat" path).
    const existingInv = invoicedMap[`${project.id}:${month}`];
    if (existingInv) {
      evolu.update("clockifyInvoicedPeriod", {
        id: existingInv.invId as never,
        hours,
        amount,
        currency,
      } as never);
    } else {
      evolu.insert("clockifyInvoicedPeriod", {
        clockifyProjectId: project.id,
        yearMonth: month,
        hours,
        amount,
        currency,
        deleted: Evolu.sqliteFalse,
      } as never);
    }

    // 3. Ensure rate is saved
    saveRate(project.id, project.name);

    setInvoiceModal(null);
  }

  // ── Receivables CRUD (manual) ───────────────────────────────────────────────
  function markPaid(id: string) {
    evolu.update("receivable", { id: id as never, status: "PAID" } as never);
  }
  function deleteReceivable(id: string) {
    if (!confirm("Smazat tuto pohledávku?")) return;
    evolu.update("receivable", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  // Group pending amounts by currency to avoid misleading cross-currency summation
  const pendingByCurrency = receivables
    .filter((r) => String(r.status) !== "PAID")
    .reduce<Record<string, number>>((acc, r) => {
      const cur = String(r.currency ?? "CZK");
      acc[cur] = (acc[cur] ?? 0) + (r.amount as number);
      return acc;
    }, {});

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Billing</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
            Clockify čas · fakturace · pohledávky
          </p>
        </div>
        <Link href="/receivables" style={{ fontSize: "0.8rem", color: "var(--muted)", textDecoration: "none", padding: "0.4rem 0.75rem", border: "1px solid var(--border)", borderRadius: "6px" }}>
          + Ruční pohledávka
        </Link>
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
              Přidej proměnnou <code style={{ background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>CLOCKIFY_API_KEY</code> do svého{" "}
              <code style={{ background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>.env.local</code> souboru nebo do Vercel environment variables.
              <br />
              API klíč najdeš v <strong>Clockify → Nastavení → Profile Settings → API</strong>.
            </div>
          </div>
        )}

        {/* Error */}
        {error && !noApiKey && (
          <div style={{ padding: "1rem", borderRadius: "8px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", color: "var(--red)", fontSize: "0.875rem" }}>
            ⚠ {error}
          </div>
        )}

        {/* Empty month */}
        {!loading && !error && !noApiKey && projects.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            Žádné záznamy v Clockify pro {monthLabel(month)}
          </div>
        )}

        {/* Project cards */}
        {projects.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {projects.map((p) => {
              const inp         = getRateInput(p.id);
              const rate        = parseFloat(inp.rate);
              const amount      = (!isNaN(rate) && rate > 0) ? Math.round(p.totalHours * rate * 100) / 100 : null;
              const invKey      = `${p.id}:${month}`;
              const alreadyInv  = invoicedMap[invKey];
              const isDirty     = !!rateInputs[p.id];

              return (
                <div key={p.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "1rem",
                  alignItems: "center",
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  background: alreadyInv ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${alreadyInv ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                }}>
                  {/* Left: project info + rate inputs */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "1rem" }}>{p.name}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)", padding: "0.15rem 0.5rem", borderRadius: "12px", background: "rgba(255,255,255,0.07)" }}>
                        {p.entryCount} záznamů
                      </span>
                      {alreadyInv && (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", padding: "0.15rem 0.5rem", borderRadius: "12px", background: "rgba(16,185,129,0.12)" }}>
                          ✓ Vyfakturováno
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      {/* Hours badge */}
                      <span style={{ fontSize: "1.15rem", fontWeight: 800, color: alreadyInv ? "var(--muted)" : "var(--text)" }}>
                        {formatHours(p.totalHours)}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>×</span>

                      {/* Rate input */}
                      <input
                        type="number"
                        value={inp.rate}
                        onChange={(e) => handleRateChange(p.id, "rate", e.target.value)}
                        placeholder="sazba"
                        min="0"
                        step="any"
                        style={{
                          width: "90px",
                          padding: "0.3rem 0.5rem",
                          borderRadius: "6px",
                          border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`,
                          background: "var(--surface-2)",
                          color: "var(--text)",
                          fontSize: "0.875rem",
                          textAlign: "right",
                        }}
                      />

                      {/* Currency select */}
                      <select
                        value={inp.currency}
                        onChange={(e) => handleRateChange(p.id, "currency", e.target.value)}
                        style={{
                          padding: "0.3rem 0.5rem",
                          borderRadius: "6px",
                          border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`,
                          background: "var(--surface-2)",
                          color: "var(--text)",
                          fontSize: "0.875rem",
                        }}
                      >
                        {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                      </select>

                      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>/h</span>

                      {/* Save rate button (only when dirty) */}
                      {isDirty && (
                        <button className="btn-ghost" onClick={() => saveRate(p.id, p.name)} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", color: "var(--accent)" }}>
                          Uložit sazbu
                        </button>
                      )}

                      {/* Computed amount */}
                      {amount !== null && amount > 0 && (
                        <>
                          <span style={{ color: "var(--muted)" }}>= </span>
                          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: alreadyInv ? "var(--muted)" : "var(--accent)" }}>
                            {formatCurrency(amount, inp.currency)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Already invoiced info */}
                    {alreadyInv && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                        Faktura: {formatHours(alreadyInv.hours)} → {formatCurrency(alreadyInv.amount, alreadyInv.currency)}
                      </div>
                    )}
                  </div>

                  {/* Right: action button */}
                  <div style={{ textAlign: "right" }}>
                    {!alreadyInv ? (
                      <button
                        className="btn-primary"
                        onClick={() => openInvoiceModal(p)}
                        disabled={!amount || amount <= 0}
                        style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                      >
                        Vytvořit fakturu →
                      </button>
                    ) : (
                      <button
                        className="btn-ghost"
                        onClick={() => openInvoiceModal(p)}
                        style={{ fontSize: "0.78rem", color: "var(--muted)" }}
                      >
                        + Znovu fakturovat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Manual receivables section ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Pohledávky</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {Object.entries(pendingByCurrency).map(([cur, total]) => (
            <span key={cur} style={{ fontSize: "0.85rem", color: "var(--yellow)", fontWeight: 700 }}>
              {formatCurrency(total, cur)} nevyřízeno
            </span>
          ))}
          <Link href="/receivables" style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", borderRadius: "6px", background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            + Přidat
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {receivables.length === 0 ? (
          <p style={{ padding: "2rem", color: "var(--muted)", textAlign: "center", fontSize: "0.875rem" }}>
            Zatím žádné pohledávky. Používej tlačítko &quot;Vytvořit fakturu&quot; výše nebo přidej ručně.
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
            {/* Summary */}
            <div style={{ padding: "1rem 1.2rem", borderRadius: "10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                Souhrn
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  {formatHours(invoiceModal.hours)} · {monthLabel(month)}
                </span>
                <span style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--accent)" }}>
                  {formatCurrency(invoiceModal.amount, invoiceModal.currency)}
                </span>
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
            <FormField
              label="Datum splatnosti"
              name="dueDate"
              type="date"
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
            />

            {invoiceError && (
              <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "var(--red)", fontSize: "0.85rem" }}>
                ⚠ {invoiceError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => setInvoiceModal(null)}>Zrušit</button>
              <button type="submit" className="btn-primary">Vytvořit pohledávku →</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
