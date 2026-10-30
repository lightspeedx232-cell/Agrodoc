import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Alert } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    preferred_language: "en",
    state: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        preferred_language: form.preferred_language,
        state: form.state || undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-brand-800">{t("register.title")}</h1>
        <p className="mt-1 text-sm text-brand-600">
          Create a free account to manage your farms and use the AI Crop Doctor.
        </p>
        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="full_name" className="label">
              {t("common.fullName")}
            </label>
            <input
              id="full_name"
              required
              className="input"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="label">
              {t("common.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              {t("common.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <p className="mt-1 text-xs text-brand-500">At least 6 characters.</p>
          </div>
          <div>
            <label htmlFor="phone" className="label">
              {t("common.phone")}
            </label>
            <input
              id="phone"
              type="tel"
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="state" className="label">
                {t("common.state")}
              </label>
              <input
                id="state"
                className="input"
                placeholder="Kerala"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="lang" className="label">
                {t("common.language")}
              </label>
              <select
                id="lang"
                className="input"
                value={form.preferred_language}
                onChange={(e) => set("preferred_language", e.target.value)}
              >
                <option value="en">English</option>
                <option value="ml">മലയാളം</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Creating account…" : t("register.submit")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-brand-600">
          {t("register.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-brand-700 underline">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
