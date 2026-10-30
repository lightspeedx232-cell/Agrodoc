/**
 * Anti-Scam Report page — report scams and access official government portals.
 *
 * Users can:
 *  - Report a scam (fake portal, phishing, fraudulent listing, fake buyer) in-app
 *  - View direct links to official Indian government reporting portals
 *  - Generate a pre-filled email to send to authorities
 *  - See their previous reports
 */

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Alert, PageHeader } from "../components/ui";

// ── Types ──────────────────────────────────────────────────────────────────
interface GovPortal {
  name: string; url: string; desc: string; phone: string | null;
}
interface ScamReportOut {
  id: number; scam_type: string; title: string; description: string;
  suspected_source: string | null; reported_at_str: string | null;
  contact_info: string | null; financial_loss: string | null; status: string;
  created_at: string;
}

const SCAM_TYPES = [
  { v: "fake_govt_portal", label: "🏛️ Fake government portal", icon: "🏛️" },
  { v: "phishing_link",    label: "🔗 Phishing link",          icon: "🔗" },
  { v: "fake_listing",    label: "📦 Fake listing",            icon: "📦" },
  { v: "fake_buyer",       label: "👤 Fake buyer",             icon: "👤" },
  { v: "payment_fraud",    label: "💸 Payment fraud",          icon: "💸" },
  { v: "other",            label: "❓ Other",                  icon: "❓" },
];

export default function ScamReport() {
  const { user } = useAuth();
  const [portals, setPortals] = useState<GovPortal[]>([]);
  const [reports, setReports] = useState<ScamReportOut[]>([]);
  const [form, setForm] = useState({
    scam_type: "fake_govt_portal", title: "", description: "",
    suspected_source: "", reported_at_str: "", contact_info: "", financial_loss: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/scam-reports/portals").then(r => setPortals(r.data.portals)).catch(() => {});
    if (user) api.get("/scam-reports/mine").then(r => setReports(r.data)).catch(() => {});
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(""); setMsg("");
    try {
      await api.post("/scam-reports", {
        ...form,
        suspected_source: form.suspected_source || null,
        reported_at_str: form.reported_at_str || null,
        contact_info: form.contact_info || null,
        financial_loss: form.financial_loss || null,
      });
      setMsg("Report submitted. You can also report directly to the government portals below.");
      setForm({ scam_type: "fake_govt_portal", title: "", description: "", suspected_source: "", reported_at_str: "", contact_info: "", financial_loss: "" });
      if (user) api.get("/scam-reports/mine").then(r => setReports(r.data));
    } catch {
      setError("Could not submit report. Please try again.");
    } finally { setSaving(false); }
  };

  // Generate a pre-filled email to cybercrime authorities
  const reportViaEmail = () => {
    const subject = `[AgroDoc Scam Report] ${form.title || "Scam report"}`;
    const body = [
      "Scam Report via AgroDoc",
      "=========================",
      "",
      `Type: ${SCAM_TYPES.find(t => t.v === form.scam_type)?.label ?? form.scam_type}`,
      form.title && `Title: ${form.title}`,
      form.reported_at_str && `When it happened: ${form.reported_at_str}`,
      form.suspected_source && `Suspected source (URL/phone/name): ${form.suspected_source}`,
      form.financial_loss && `Financial loss: ${form.financial_loss}`,
      form.contact_info && `How they contacted me: ${form.contact_info}`,
      "",
      "Description:",
      form.description || "(describe what happened)",
      "",
      "— Reported via AgroDoc (https://localhost:5173)",
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div>
      <PageHeader
        title="Report a Scam"
        subtitle="Report fraud, fake portals, and scams — and connect directly to official government reporting channels."
      />

      {/* Safety banner */}
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
        <strong>⚠️ If you lost money:</strong> Call <strong>1930</strong> (National Cyber Crime Helpline) immediately
        and report at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="underline font-semibold">cybercrime.gov.in</a>.
        The faster you report, the better the chance of recovering funds.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Report form ── */}
        <div className="card p-6">
          <h2 className="font-bold text-brand-800 mb-4">📋 Report a scam</h2>
          {msg && <div className="mb-3"><Alert variant="success">{msg}</Alert></div>}
          {error && <div className="mb-3"><Alert variant="error">{error}</Alert></div>}
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Scam type *</label>
              <select className="input" value={form.scam_type}
                onChange={e => setForm(f => ({ ...f, scam_type: e.target.value }))}>
                {SCAM_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Title *</label>
              <input required className="input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Fake PM-KISAN registration website" />
            </div>
            <div>
              <label className="label">What happened *</label>
              <textarea required rows={4} className="input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the scam: how you were contacted, what they asked for, any links or phone numbers..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Suspected source (URL/phone)</label>
                <input className="input" value={form.suspected_source}
                  onChange={e => setForm(f => ({ ...f, suspected_source: e.target.value }))} />
              </div>
              <div>
                <label className="label">When it happened</label>
                <input type="date" className="input" value={form.reported_at_str}
                  onChange={e => setForm(f => ({ ...f, reported_at_str: e.target.value }))} />
              </div>
              <div>
                <label className="label">How they contacted you</label>
                <input className="input" value={form.contact_info}
                  onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))}
                  placeholder="Phone, WhatsApp, email..." />
              </div>
              <div>
                <label className="label">Financial loss</label>
                <input className="input" value={form.financial_loss}
                  onChange={e => setForm(f => ({ ...f, financial_loss: e.target.value }))}
                  placeholder="e.g. ₹5,000 or No loss" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Submitting…" : "Submit report"}
              </button>
              <button type="button" className="btn-secondary" onClick={reportViaEmail}>
                📧 Report via email
              </button>
            </div>
            <p className="text-xs text-brand-400">
              Your report is stored in your AgroDoc account. For official action, also report directly to the government portals below.
            </p>
          </form>
        </div>

        {/* ── Government portals ── */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-bold text-brand-800 mb-2">🏛️ Official reporting portals</h2>
            <p className="text-sm text-brand-600 mb-4">
              Click to open the official government portal and file your complaint directly.
            </p>
            <div className="space-y-3">
              {portals.map(p => (
                <a key={p.url} href={p.url} target="_blank" rel="noreferrer"
                  className="block rounded-xl border border-brand-100 p-3 transition hover:border-brand-300 hover:shadow-sm dark:border-brand-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-800 dark:text-brand-200">{p.name}</span>
                    <span className="text-brand-400 text-xs">→</span>
                  </div>
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{p.desc}</p>
                  {p.phone && (
                    <p className="mt-1 text-xs font-semibold text-brand-700 dark:text-brand-300">📞 {p.phone}</p>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Previous reports */}
          {user && reports.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-brand-800 mb-3">Your previous reports</h2>
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="rounded-lg border border-brand-100 p-3 text-sm dark:border-brand-800/40">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-brand-800 dark:text-brand-200">{r.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === "submitted" ? "bg-amber-100 text-amber-700" :
                        r.status === "forwarded" ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-brand-500 mt-0.5">
                      {SCAM_TYPES.find(t => t.v === r.scam_type)?.label ?? r.scam_type} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
