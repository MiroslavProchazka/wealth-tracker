"use client";
import { useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency } from "@/lib/currencies";
import { useI18n } from "@/components/i18n/I18nProvider";

const emptyForm = { name: "", address: "", estimatedValue: "", currency: "CZK", hasMortgage: false, originalLoan: "", remainingLoan: "", monthlyPayment: "", interestRate: "", mortgageStart: "", mortgageEnd: "", tags: "", notes: "" };

export default function PropertyPage() {
  const evolu = useEvolu();
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const query = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("property").selectAll()
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("createdAt", "desc")
    ), [evolu]);
  const properties = useQuery(query);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fields = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      estimatedValue: parseFloat(form.estimatedValue),
      currency: form.currency,
      hasMortgage: form.hasMortgage ? Evolu.sqliteTrue : Evolu.sqliteFalse,
      originalLoan: form.hasMortgage && form.originalLoan ? parseFloat(form.originalLoan) : null,
      remainingLoan: form.hasMortgage && form.remainingLoan ? parseFloat(form.remainingLoan) : null,
      monthlyPayment: form.hasMortgage && form.monthlyPayment ? parseFloat(form.monthlyPayment) : null,
      interestRate: form.hasMortgage && form.interestRate ? parseFloat(form.interestRate) : null,
      mortgageStart: form.hasMortgage && form.mortgageStart ? form.mortgageStart : null,
      mortgageEnd: form.hasMortgage && form.mortgageEnd ? form.mortgageEnd : null,
      tags: form.tags.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      evolu.update("property", { id: editingId as never, ...fields } as never);
      setSaving(false);
      setForm(emptyForm); setEditingId(null); setShowModal(false);
    } else {
      const result = evolu.insert("property", { ...fields, deleted: Evolu.sqliteFalse } as never);
      setSaving(false);
      if (result.ok) { setForm(emptyForm); setShowModal(false); }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStartEdit(p: any) {
    setForm({
      name: p.name as string,
      address: (p.address as string) ?? "",
      estimatedValue: String(p.estimatedValue as number),
      currency: (p.currency as string) ?? "CZK",
      hasMortgage: p.hasMortgage === Evolu.sqliteTrue,
      originalLoan: p.originalLoan != null ? String(p.originalLoan as number) : "",
      remainingLoan: p.remainingLoan != null ? String(p.remainingLoan as number) : "",
      monthlyPayment: p.monthlyPayment != null ? String(p.monthlyPayment as number) : "",
      interestRate: p.interestRate != null ? String(p.interestRate as number) : "",
      mortgageStart: (p.mortgageStart as string) ?? "",
      mortgageEnd: (p.mortgageEnd as string) ?? "",
      tags: (p.tags as string) ?? "",
      notes: (p.notes as string) ?? "",
    });
    setEditingId(p.id as string);
    setShowModal(true);
  }

  function handleDelete(id: string) {
    if (!confirm(t("property.deleteConfirm"))) return;
    evolu.update("property", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  const totalValue = properties.reduce((s, p) => s + (p.estimatedValue as number), 0);
  const totalMortgageDebt = properties.reduce((s, p) => s + ((p.remainingLoan as number) ?? 0), 0);
  const totalEquity = totalValue - totalMortgageDebt;

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{t("property.title")}</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>{t("property.subtitle")}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ {t("property.add")}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #1a2e1e 100%)", borderColor: "rgba(139,92,246,0.3)" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>{t("property.totalPropertyValue")}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#8b5cf6" }}>{formatCurrency(totalValue, "CZK")}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>{t("property.count", { count: properties.length })}</div>
        </div>
        <div className="card" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #1e1a1a 100%)", borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>{t("property.totalMortgageDebt")}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--red)" }}>{formatCurrency(totalMortgageDebt, "CZK")}</div>
        </div>
        <div className="card" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #1e2a1e 100%)", borderColor: "rgba(16,185,129,0.3)" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>{t("property.totalEquity")}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--green)" }}>{formatCurrency(totalEquity, "CZK")}</div>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏠</div>
          <p style={{ margin: 0, fontWeight: 500 }}>{t("property.emptyTitle")}</p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>{t("property.emptySubtitle")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {properties.map((p) => {
            const hasMortgage = p.hasMortgage === Evolu.sqliteTrue;
            const origLoan = (p.originalLoan as number) ?? 0;
            const remLoan = (p.remainingLoan as number) ?? 0;
            const paid = origLoan - remLoan;
            const paidRatio = origLoan ? (paid / origLoan) * 100 : 0;
            const mortgageEndStr = p.mortgageEnd ? String(p.mortgageEnd) : null;
            const yearsLeft = mortgageEndStr ? Math.max(0, new Date(mortgageEndStr).getFullYear() - new Date().getFullYear()) : null;
            return (
              <div key={p.id as string} className="card" style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", display: "flex", gap: "0.5rem" }}>
                  <button className="btn-ghost" onClick={() => handleStartEdit(p)} style={{ fontSize: "0.8rem" }}>✏️ {t("common.edit")}</button>
                  <button className="btn-danger" onClick={() => handleDelete(p.id as string)}>{t("common.delete")}</button>
                </div>
                <div style={{ marginBottom: "1rem", paddingRight: "5rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{p.name as string}</h2>
                  {(p.address as string) && <div style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>{p.address as string}</div>}
                </div>
                <div style={{ marginBottom: hasMortgage ? "1.25rem" : "0" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>{t("property.estimatedValue")}</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#8b5cf6" }}>{formatCurrency(p.estimatedValue as number, p.currency as string)}</div>
                </div>
                {hasMortgage && (
                  <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "1.25rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>{t("property.mortgage")}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                      {remLoan > 0 && <div><div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>{t("property.remainingLoan")}</div><div style={{ fontWeight: 700, color: "var(--red)" }}>{formatCurrency(remLoan, p.currency as string)}</div></div>}
                      {(p.interestRate as number) && <div><div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>{t("property.interest")}</div><div style={{ fontWeight: 700, color: "var(--yellow)" }}>{(p.interestRate as number).toFixed(2)}%</div></div>}
                      {(p.monthlyPayment as number) && <div><div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>{t("property.monthlyPayment")}</div><div style={{ fontWeight: 700 }}>{formatCurrency(p.monthlyPayment as number, p.currency as string)}</div></div>}
                      {yearsLeft !== null && <div><div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.2rem" }}>{t("property.yearsLeft")}</div><div style={{ fontWeight: 700 }}>{yearsLeft}</div></div>}
                    </div>
                    {origLoan > 0 && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{t("property.paidProgress", { percent: paidRatio.toFixed(1) })}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{formatCurrency(paid, p.currency as string)} / {formatCurrency(origLoan, p.currency as string)}</span>
                        </div>
                        <div style={{ height: "8px", background: "var(--card-border)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, paidRatio)}%`, background: "var(--green)", borderRadius: "4px" }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.9rem", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--muted)" }}>{t("property.equity")}:</span>
                      <span style={{ fontWeight: 700, color: "var(--green)" }}>{formatCurrency((p.estimatedValue as number) - remLoan, p.currency as string)}</span>
                    </div>
                  </div>
                )}
                {(p.notes as string) && <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--muted)", borderTop: "1px solid var(--card-border)", paddingTop: "0.75rem" }}>{p.notes as string}</div>}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editingId ? t("property.edit") : t("property.add")} onClose={() => { setShowModal(false); setForm(emptyForm); setEditingId(null); }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FormField label={t("property.name")} name="name" value={form.name} onChange={handleChange} placeholder="Prague Flat" required />
            <FormField label={t("property.address")} name="address" value={form.address} onChange={handleChange} placeholder="Wenceslas Square 1, Prague" />
            <FormField label={t("property.estimatedValueCzk")} name="estimatedValue" type="number" value={form.estimatedValue} onChange={handleChange} placeholder="0.00" step="0.01" min="0" required />
            <div>
              <label><input type="checkbox" checked={form.hasMortgage} onChange={(e) => setForm((f) => ({ ...f, hasMortgage: e.target.checked }))} style={{ width: "auto", marginRight: "0.5rem" }} />{t("property.hasMortgage")}</label>
            </div>
            {form.hasMortgage && (
              <>
                <FormField label={t("property.originalLoan")} name="originalLoan" type="number" value={form.originalLoan} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                <FormField label={t("property.remainingLoanCzk")} name="remainingLoan" type="number" value={form.remainingLoan} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                <FormField label={t("property.monthlyPaymentCzk")} name="monthlyPayment" type="number" value={form.monthlyPayment} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                <FormField label={t("property.interestRate")} name="interestRate" type="number" value={form.interestRate} onChange={handleChange} placeholder="4.50" step="0.01" min="0" />
                <FormField label={t("property.mortgageStart")} name="mortgageStart" type="date" value={form.mortgageStart} onChange={handleChange} />
                <FormField label={t("property.mortgageEnd")} name="mortgageEnd" type="date" value={form.mortgageEnd} onChange={handleChange} />
              </>
            )}
            <FormField label={t("common.tags")} name="tags" value={form.tags} onChange={handleChange} placeholder="rental, prague, mortgage" />
            <FormField label={t("common.notes")} name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder={t("common.optional")} rows={3} />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => { setShowModal(false); setForm(emptyForm); setEditingId(null); }}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.saving") : editingId ? t("history.saveChanges") : t("property.add")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
