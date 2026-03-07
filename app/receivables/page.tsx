"use client";
import { useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: "Pending",  cls: "badge badge-yellow" },
  INVOICED: { label: "Invoiced", cls: "badge badge-blue" },
  PAID:     { label: "Paid",     cls: "badge badge-green" },
  OVERDUE:  { label: "Overdue",  cls: "badge badge-red" },
};
const EMPTY_FORM = { description: "", client: "", amount: "", currency: "CZK", dueDate: "", status: "PENDING", tags: "", notes: "" };

export default function ReceivablesPage() {
  const evolu = useEvolu();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const query = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("receivable").selectAll()
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("createdAt", "desc")
    ), [evolu]);
  const items = useQuery(query);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fields = {
      description: form.description.trim(),
      client: form.client.trim() || null,
      amount: parseFloat(form.amount as string),
      currency: form.currency,
      status: form.status,
      dueDate: form.dueDate ? form.dueDate : null,
      tags: form.tags.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      evolu.update("receivable", { id: editingId as never, ...fields } as never);
      setSaving(false);
      setForm({ ...EMPTY_FORM }); setEditingId(null); setShowModal(false);
    } else {
      const result = evolu.insert("receivable", { ...fields, deleted: Evolu.sqliteFalse } as never);
      setSaving(false);
      if (result.ok) { setForm({ ...EMPTY_FORM }); setShowModal(false); }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStartEdit(item: any) {
    setForm({
      description: item.description as string,
      client: (item.client as string) ?? "",
      amount: String(item.amount as number),
      currency: item.currency as string,
      status: item.status as string,
      dueDate: (item.dueDate as string) ?? "",
      tags: (item.tags as string) ?? "",
      notes: (item.notes as string) ?? "",
    });
    setEditingId(item.id as string);
    setShowModal(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this receivable?")) return;
    evolu.update("receivable", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  function markPaid(id: string) {
    evolu.update("receivable", { id: id as never, status: "PAID" } as never);
  }

  const total = items.filter((i) => String(i.status) !== "PAID").reduce((s, i) => s + (i.amount as number), 0);
  const totalAll = items.reduce((s, i) => s + (i.amount as number), 0);
  const today = new Date();
  const agingBuckets = items.reduce(
    (acc, item) => {
      if (String(item.status) === "PAID") return acc;
      const amount = item.amount as number;
      const dueDateStr = item.dueDate ? String(item.dueDate) : null;
      if (!dueDateStr) {
        acc.current += amount;
        return acc;
      }
      const dueDate = new Date(dueDateStr);
      const ageDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (ageDays <= 0) acc.current += amount;
      else if (ageDays <= 30) acc.days1to30 += amount;
      else if (ageDays <= 60) acc.days31to60 += amount;
      else acc.days61plus += amount;
      return acc;
    },
    { current: 0, days1to30: 0, days31to60: 0, days61plus: 0 },
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Receivables</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>Un-invoiced work, outstanding invoices, money owed to you</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Outstanding", value: formatCurrency(total, "CZK"), color: "var(--yellow)" },
          { label: "Total (incl. paid)", value: formatCurrency(totalAll, "CZK"), color: "var(--muted)" },
          { label: "Items Outstanding", value: String(items.filter((i) => String(i.status) !== "PAID").length), color: "var(--accent)" },
          { label: "Overdue", value: String(items.filter((i) => String(i.status) === "OVERDUE").length), color: "var(--red)" },
        ].map((s) => (
          <div key={s.label} className="card">
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{s.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.9rem" }}>
          Aging Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.85rem" }}>
          {[
            { label: "Current", value: agingBuckets.current, color: "#10b981" },
            { label: "1-30 days overdue", value: agingBuckets.days1to30, color: "#f59e0b" },
            { label: "31-60 days overdue", value: agingBuckets.days31to60, color: "#f97316" },
            { label: "61+ days overdue", value: agingBuckets.days61plus, color: "#ef4444" },
          ].map((bucket) => (
            <div
              key={bucket.label}
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {bucket.label}
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: bucket.color }}>
                {formatCurrency(bucket.value, "CZK")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <p style={{ padding: "2rem", color: "var(--muted)", textAlign: "center" }}>No receivables yet. Track un-invoiced work or outstanding invoices.</p>
        ) : (
          <table>
            <thead><tr><th>Description</th><th>Client</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => {
                const statusStr = String(item.status);
                const dueDateStr = item.dueDate ? String(item.dueDate) : null;
                const overdue = statusStr !== "PAID" && dueDateStr && new Date(dueDateStr) < new Date();
                return (
                  <tr key={item.id as string}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.description as string}</div>
                      {(item.notes as string) && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{item.notes as string}</div>}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{(item.client as string) ?? "—"}</td>
                    <td style={{ fontWeight: 600, color: statusStr === "PAID" ? "var(--green)" : "var(--foreground)" }}>{formatCurrency(item.amount as number, item.currency as string)}</td>
                    <td style={{ color: overdue ? "var(--red)" : "var(--muted)", fontSize: "0.8rem" }}>
                      {dueDateStr ? new Date(dueDateStr).toLocaleDateString("cs-CZ") : "—"}
                      {overdue && <span style={{ marginLeft: "0.25rem" }}>⚠️</span>}
                    </td>
                    <td><span className={STATUS_BADGE[statusStr]?.cls ?? "badge badge-gray"}>{STATUS_BADGE[statusStr]?.label ?? statusStr}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {statusStr !== "PAID" && (
                          <button onClick={() => markPaid(item.id as string)} style={{ background: "rgba(16,185,129,0.15)", color: "var(--green)", border: "1px solid var(--green)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.7rem", fontWeight: 600 }}>Mark Paid</button>
                        )}
                        <button className="btn-ghost" onClick={() => handleStartEdit(item)} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>✏️ Upravit</button>
                        <button className="btn-danger" onClick={() => handleDelete(item.id as string)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editingId ? "Upravit pohledávku" : "Add Receivable"} onClose={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); setEditingId(null); }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FormField label="Description *" name="description" value={form.description} onChange={handleChange} placeholder="e.g. Website redesign — March" required />
            <FormField label="Client" name="client" value={form.client} onChange={handleChange} placeholder="e.g. Acme s.r.o." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Amount *" name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="0" step="0.01" required />
              <FormField label="Currency" name="currency" value={form.currency} onChange={handleChange} options={[{ value: "CZK", label: "CZK" }, { value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Due Date" name="dueDate" type="date" value={form.dueDate} onChange={handleChange} />
              <FormField label="Status" name="status" value={form.status} onChange={handleChange} options={[{ value: "PENDING", label: "Pending (un-invoiced)" }, { value: "INVOICED", label: "Invoiced" }, { value: "OVERDUE", label: "Overdue" }, { value: "PAID", label: "Paid" }]} />
            </div>
            <FormField label="Tags" name="tags" value={form.tags} onChange={handleChange} placeholder="client-a, monthly, overdue-risk" />
            <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder="Additional details…" />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); setEditingId(null); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Uložit změny" : "Add Receivable"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
