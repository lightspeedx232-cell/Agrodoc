import { useEffect, useState } from "react";
import { expensesApi, type Expense, type ProfitSummary } from "../lib/api";
import { Alert, PageHeader, Spinner } from "../components/ui";

const KIND_LABELS = { expense: "💸 Expense", income: "💰 Income", harvest: "🌾 Harvest" };
const KIND_COLORS = {
  expense: "bg-red-50 border-red-200 text-red-800",
  income: "bg-green-50 border-green-200 text-green-800",
  harvest: "bg-amber-50 border-amber-200 text-amber-800",
};
const EXPENSE_CATS = ["seeds", "fertilizer", "pesticide", "labour", "irrigation", "machinery", "transport", "other"];
const INCOME_CATS = ["crop-sale", "subsidy", "other"];

export default function Expenses() {
  const [records, setRecords] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Expense, "id" | "owner_id">>({
    kind: "expense", category: "other", amount: 0, currency: "INR",
    note: "", date: new Date().toISOString().slice(0, 10), plot_id: null,
  });

  const load = () =>
    Promise.all([expensesApi.list(), expensesApi.summary()])
      .then(([r, s]) => { setRecords(r); setSummary(s); })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await expensesApi.create({ ...form, note: form.note || null });
    setShowForm(false);
    setForm({ kind: "expense", category: "other", amount: 0, currency: "INR", note: "", date: new Date().toISOString().slice(0, 10), plot_id: null });
    load();
  };

  const remove = async (id: number) => {
    await expensesApi.remove(id);
    setRecords(prev => prev.filter(r => r.id !== id));
    load();
  };

  if (loading) return <Spinner label="Loading records…" />;

  return (
    <div>
      <PageHeader title="Expenses & Income" subtitle="Track farm costs, income, and profitability." />

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total Income" value={summary.total_income} color="green" />
          <SummaryCard label="Total Expenses" value={summary.total_expense} color="red" />
          <SummaryCard
            label="Net Profit / Loss"
            value={summary.net}
            color={summary.net >= 0 ? "green" : "red"}
          />
        </div>
      )}

      <div className="mb-4">
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "+ Add record"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mb-6 p-6 space-y-3">
          <h2 className="font-bold text-brand-800">New record</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value as Expense["kind"], category: "other" }))}>
                <option value="expense">💸 Expense</option>
                <option value="income">💰 Income</option>
                <option value="harvest">🌾 Harvest</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {(form.kind === "expense" ? EXPENSE_CATS : INCOME_CATS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input required type="number" min={0} step="0.01" className="input"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Date</label>
              <input required type="date" className="input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Note (optional)</label>
              <input className="input" value={form.note ?? ""}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" type="submit">Save</button>
        </form>
      )}

      {records.length === 0 ? (
        <Alert variant="info">No records yet. Add your first expense or income above.</Alert>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="px-3 py-2 text-brand-600">{r.date}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${KIND_COLORS[r.kind]}`}>
                      {KIND_LABELS[r.kind]}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.kind === "expense" ? "text-red-700" : "text-green-700"}`}>
                    ₹{r.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-brand-600">{r.note ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button className="text-red-500 hover:text-red-700 text-xs" onClick={() => remove(r.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: "green" | "red" }) {
  return (
    <div className={`card p-5 border-l-4 ${color === "green" ? "border-green-500" : "border-red-500"}`}>
      <p className="text-xs text-brand-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color === "green" ? "text-green-700" : "text-red-700"}`}>
        ₹{Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
