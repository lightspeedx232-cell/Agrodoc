import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";

const features = [
  { title: "AI Crop Doctor",   desc: "Capture or upload a leaf photo with your webcam and get a disease diagnosis with treatment advice.", icon: "🌿", to: "/crop-doctor/scanner", bg: "bg-green-100" },
  { title: "Plot-level Weather", desc: "Real weather for your farm's exact location — current, hourly, and 7-day forecasts with spray guidance.", icon: "🌦️", to: "/weather", bg: "bg-blue-100" },
  { title: "Farm & Plot Mapping", desc: "Register your farms, draw plot boundaries on satellite imagery, and record crops, soil, and irrigation.", icon: "🗺️", to: "/farms", bg: "bg-amber-100" },
  { title: "Government Schemes", desc: "A directory of central and state schemes with eligibility, benefits, and official application links.", icon: "🏛️", to: "/schemes", bg: "bg-indigo-100" },
  { title: "Mandi Prices",      desc: "Crop prices from official market data with mandi names, dates, units, and source information.", icon: "📈", to: "/mandi", bg: "bg-emerald-100" },
  { title: "Farmers' Trade",    desc: "List your produce, connect with buyers, send offers — safely and directly.", icon: "🛒", to: "/marketplace", bg: "bg-orange-100" },
];

const trustStats = [
  { value: "7", label: "Day forecasts" },
  { value: "3", label: "Languages" },
  { value: "100%", label: "Real data" },
  { value: "0", label: "Fake results" },
];

export default function Landing() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-16 text-white md:py-24 shadow-xl shadow-brand-700/20">
        {/* Decorative blurred circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
            Your AI Farming Assistant
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">
            AgroDoc
          </h1>
          <p className="mt-3 text-lg text-brand-50 md:text-2xl">{t("landing.tagline")}</p>
          <p className="mx-auto mt-4 max-w-xl text-brand-100/90">
            A complete, free web app for Indian farmers — AI crop disease
            diagnosis, weather, satellite mapping, government schemes, mandi
            prices, and a farmers' marketplace, right in your browser.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={user ? "/dashboard" : "/register"}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-lg shadow-brand-900/20 transition hover:bg-brand-50 hover:scale-105 active:scale-100"
            >
              {t("landing.cta")}
            </Link>
            <Link
              to="/crop-doctor/scanner"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 hover:scale-105 active:scale-100"
            >
              📷 Try the Leaf Scanner
            </Link>
          </div>
        </div>
      </section>

      {/* Trust stats strip */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {trustStats.map((s) => (
          <div key={s.label} className="card-hover p-5 text-center">
            <div className="text-3xl font-extrabold text-brand-700">{s.value}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Webcam feature highlight */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="card-hover p-6">
          <div className="icon-badge bg-green-100">📷</div>
          <h2 className="mt-4 text-xl font-bold text-brand-800">{t("landing.scanTitle")}</h2>
          <p className="mt-2 text-sm text-brand-700">{t("landing.scanDesc")}</p>
          <ol className="mt-4 space-y-2 text-sm text-brand-700">
            {[
              "Open the scanner and click Start Camera.",
              "Allow camera permission when your browser asks.",
              "Point at the affected leaf and click Capture Leaf.",
              "Click Analyze Image to send it to the AI Crop Doctor.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="card-hover flex flex-col justify-center p-6">
          <div className="icon-badge bg-blue-100">✅</div>
          <h2 className="mt-4 text-xl font-bold text-brand-800">Built for real use</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-brand-700">
            {[
              "Works on desktop and mobile browsers (PWA installable).",
              "Real weather data — never fabricated.",
              "Honest AI: says \"unavailable\" when no model is configured.",
              "Private image storage with secure authentication.",
              "Anti-scam checks on stores, schemes, and the marketplace.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features grid */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-bold text-brand-800">
          Everything in one place
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link key={f.title} to={f.to} className="card-hover group p-6">
              <div className={`icon-badge ${f.bg} group-hover:scale-110 transition-transform`}>{f.icon}</div>
              <h3 className="mt-4 font-semibold text-brand-800">{f.title}</h3>
              <p className="mt-1 text-sm text-brand-600">{f.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
