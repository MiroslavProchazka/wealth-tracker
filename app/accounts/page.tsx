"use client";
import { useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";

const EMPTY = { name: "", bank: "", balance: "", currency: "CZK", iban: "", notes: "" };

export default function AccountsPage() {
  const evolu = useEvolu();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const query = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("bankAccount").selectAll()
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
      name: form.name.trim(),
      bank: form.bank.trim(),
      balance: parseFloat(form.balance as string),
      currency: form.currency,
      iban: form.iban.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      evolu.update("bankAccount", { id: editingId as never, ...fields } as never);
      setSaving(false);
      setForm({ ...EMPTY }); setEditingId(null); setShowModal(false);
    } else {
      const result = evolu.insert("bankAccount", { ...fields, deleted: Evolu.sqliteFalse } as never);
      setSaving(false);
      if (result.ok) { setForm({ ...EMPTY }); setShowModal(false); }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStartEdit(item: any) {
    setForm({
      name: item.name as string,
      bank: item.bank as string,
      balance: String(item.balance as number),
      currency: item.currency as string,
      iban: (item.iban as string) ?? "",
      notes: (item.notes as string) ?? "",
    });
    setEditingId(item.id as string);
    setShowModal(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this account?")) return;
    evolu.update("bankAccount", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  const byCurrency = items.reduce<Record<string, number>>((acc, item) => {
    const ccy = item.currency as string;
    acc[ccy] = (acc[ccy] ?? 0) + (item.balance as number);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Bank Accounts</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>Current accounts, Revolut, Wise — regular balances</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Account</button>
      </div>

      {Object.keys(byCurrency).length > 0 && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {Object.entries(byCurrency).map(([ccy, amount]) => (
            <div key={ccy} className="card" style={{ flex: "0 0 auto", borderLeft: "3px solid var(--accent)" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total {ccy}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "0.25rem" }}>{formatCurrency(amount, ccy)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <p style={{ padding: "2rem", color: "var(--muted)", textAlign: "center" }}>No accounts yet. Add your Raiffeisenbank, ČSOB, Revolut, etc.</p>
        ) : (
          <table>
            <thead><tr><th>Account</th><th>Bank</th><th>Balance</th><th>IBAN</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id as string}>
                  <td style={{ fontWeight: 600 }}>{item.name as string}</td>
                  <td style={{ color: "var(--muted)" }}>{item.bank as string}</td>
                  <td style={{ fontWeight: 700, color: (item.balance as number) >= 0 ? "var(--green)" : "var(--red)" }}>{formatCurrency(item.balance as number, item.currency as string)}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>{(item.iban as string) ?? "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{(item.notes as string) ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="btn-ghost" onClick={() => handleStartEdit(item)} style={{ fontSize: "0.8rem" }}>✏️</button>
                      <button className="btn-danger" onClick={() => handleDelete(item.id as string)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title={editingId ? "Upravit bankovní účet" : "Add Bank Account"} onClose={() => { setShowModal(false); setForm({ ...EMPTY }); setEditingId(null); }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FormField label="Account Name *" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Revolut EUR" required />
            <FormField label="Bank / Provider *" name="bank" value={form.bank} onChange={handleChange} placeholder="e.g. Revolut" required />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
              <FormField label="Balance *" name="balance" type="number" value={form.balance} onChange={handleChange} placeholder="0" step="0.01" required />
              <FormField label="Currency" name="currency" value={form.currency} onChange={handleChange} options={[{ value: "CZK", label: "CZK" }, { value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }, { value: "GBP", label: "GBP" }, { value: "CHF", label: "CHF" }]} />
            </div>
            <FormField label="IBAN (optional)" name="iban" value={form.iban} onChange={handleChange} placeholder="CZ65 0800 0000 0012 3456 7890" />
            <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder="Any notes…" />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setForm({ ...EMPTY }); setEditingId(null); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Uložit změny" : "Add Account"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
