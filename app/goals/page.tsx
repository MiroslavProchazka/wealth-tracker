"use client";
import { useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";

const EMPTY = { name: "", targetAmount: "", currency: "CZK", deadline: "", notes: "" };
const GOAL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function GoalsPage() {
  const evolu = useEvolu();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const goalsQ = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("goal").selectAll()
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("createdAt", "asc")
    ), [evolu]);
  const snapshotQ = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("netWorthSnapshot").select(["netWorth"])
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("snapshotDate", "desc")
        .limit(1)
    ), [evolu]);

  const items = useQuery(goalsQ);
  const snapshots = useQuery(snapshotQ);
  const netWorth = snapshots.length > 0 ? (snapshots[0].netWorth as number) : 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = evolu.insert("goal", {
      name: form.name.trim(),
      targetAmount: parseFloat(form.targetAmount as string),
      currency: form.currency,
      deadline: form.deadline ? form.deadline : null,
      notes: form.notes.trim() || null,
      deleted: Evolu.sqliteFalse,
    } as never);
    setSaving(false);
    if (result.ok) { setForm({ ...EMPTY }); setShowModal(false); }
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    evolu.update("goal", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Financial Goals</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>Track your savings targets and milestones</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Goal</button>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
          <p style={{ color: "var(--muted)" }}>No goals yet. Set your first financial target!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {items.map((goal, idx) => {
            const color = GOAL_COLORS[idx % GOAL_COLORS.length];
            const target = goal.targetAmount as number;
            const progress = netWorth > 0 ? Math.min(100, (netWorth / target) * 100) : 0;
            const deadlineStr = goal.deadline ? String(goal.deadline) : null;
            // eslint-disable-next-line react-hooks/purity
            const daysLeft = deadlineStr ? Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const reached = netWorth >= target;
            return (
              <div key={goal.id as string} className="card" style={{ borderTop: `3px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{goal.name as string}</div>
                    {(goal.notes as string) && <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>{goal.notes as string}</div>}
                  </div>
                  <button className="btn-danger" onClick={() => handleDelete(goal.id as string)}>Delete</button>
                </div>
                <div style={{ marginTop: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Progress</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: reached ? "var(--green)" : color }}>{progress.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--card-border)", borderRadius: "4px" }}>
                    <div style={{ height: "100%", background: color, borderRadius: "4px", width: `${progress}%`, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{netWorth > 0 ? formatCurrency(netWorth, goal.currency as string) : "—"} current</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground)" }}>{formatCurrency(target, goal.currency as string)}</span>
                  </div>
                </div>
                {reached && <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "rgba(16,185,129,0.1)", borderRadius: "8px", textAlign: "center", color: "var(--green)", fontSize: "0.8rem", fontWeight: 600 }}>🎉 Goal Reached!</div>}
                {daysLeft !== null && !reached && <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: daysLeft < 30 ? "var(--red)" : "var(--muted)" }}>Deadline: {new Date(deadlineStr!).toLocaleDateString("cs-CZ")} ({daysLeft > 0 ? `${daysLeft} days left` : "Overdue"})</div>}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Financial Goal" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FormField label="Goal Name *" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Emergency Fund 6 months" required />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
              <FormField label="Target Amount *" name="targetAmount" type="number" value={form.targetAmount} onChange={handleChange} placeholder="1 000 000" step="1000" required />
              <FormField label="Currency" name="currency" value={form.currency} onChange={handleChange} options={[{ value: "CZK", label: "CZK" }, { value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }]} />
            </div>
            <FormField label="Deadline (optional)" name="deadline" type="date" value={form.deadline} onChange={handleChange} />
            <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder="Why this goal matters…" />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Goal"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
