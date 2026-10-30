import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { api } from "../lib/api";
import { Alert, PageHeader } from "../components/ui";

export default function Settings() {
  const { user, logout } = useAuth();
  const { t, setLang, lang } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    phone: user?.phone ?? "",
    state: user?.state ?? "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api.patch("/users/me", form);
      setMsg("Profile updated successfully.");
    } catch {
      setError("Could not update profile.");
    }
  };

  const exportData = async () => {
    try {
      const resp = await api.get("/users/me/export");
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agrodoc-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export data.");
    }
  };

  const deleteAccount = async () => {
    if (!confirm("This permanently deletes your account and all data. This cannot be undone. Continue?"))
      return;
    try {
      await api.delete("/users/me");
      logout();
      navigate("/");
    } catch {
      setError("Could not delete account.");
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, language, and data." />

      {msg && <Alert variant="success">{msg}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="card space-y-3 p-6">
          <h2 className="font-bold text-brand-800">Profile</h2>
          <div>
            <label className="label" htmlFor="n">{t("common.fullName")}</label>
            <input id="n" className="input" value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="p">{t("common.phone")}</label>
            <input id="p" className="input" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="s">{t("common.state")}</label>
            <input id="s" className="input" value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="l">{t("common.language")}</label>
            <select id="l" className="input" value={lang}
              onChange={(e) => setLang(e.target.value as never)}>
              <option value="en">English</option>
              <option value="ml">മലയാളം</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <button className="btn-primary" type="submit">Save changes</button>
        </form>

        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-bold text-brand-800">Your data</h2>
            <p className="mt-1 text-sm text-brand-600">
              Download all the data AgroDoc holds about you, or permanently delete
              your account.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={exportData}>
                ⬇ Export my data
              </button>
              <button className="btn-danger" onClick={deleteAccount}>
                🗑 Delete account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
