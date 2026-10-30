import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { cropDoctorApi, farmApi } from "../lib/api";
import type { DiagnosisResponse, Farm } from "../lib/types";
import { PageHeader, Spinner, Alert } from "../components/ui";

const quickLinks = [
  { to: "/crop-doctor/scanner", label: "Scan a leaf",  icon: "🌿",  bg: "bg-green-100" },
  { to: "/farms",              label: "My farms",       icon: "🚜", bg: "bg-amber-100" },
  { to: "/marketplace",       label: "Trade",         icon: "🛒", bg: "bg-orange-100" },
  { to: "/weather",            label: "Weather",       icon: "🌦️", bg: "bg-blue-100" },
  { to: "/calendar",           label: "Crop calendar", icon: "📅", bg: "bg-indigo-100" },
  { to: "/schemes",            label: "Govt. schemes", icon: "🏛️", bg: "bg-purple-100" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DiagnosisResponse[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      cropDoctorApi.reports().catch(() => {
        setError("Could not load recent diagnoses.");
        return [];
      }),
      farmApi.list().catch(() => [] as Farm[]),
    ]).then(([r, f]) => {
      setReports(r as DiagnosisResponse[]);
      setFarms(f as Farm[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner label="Loading your dashboard…" />;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(" ")[0] || "farmer"} 👋`}
        subtitle="Here's an overview of your farm activity."
      />

      {error && <Alert variant="warning">{error}</Alert>}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="card-hover group flex flex-col items-center gap-2 p-4 text-center"
          >
            <span className={`icon-badge h-10 w-10 text-xl ${q.bg} group-hover:scale-110 transition-transform`}>{q.icon}</span>
            <span className="text-xs font-medium text-brand-700">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Farms summary */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-brand-800">Your farms</h2>
            <Link to="/farms" className="text-sm font-semibold text-brand-600 underline">
              Manage
            </Link>
          </div>
          {farms.length === 0 ? (
            <p className="mt-3 text-sm text-brand-600">
              You haven't added a farm yet.{" "}
              <Link to="/farms" className="font-semibold text-brand-700 underline">
                Add your first farm
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {farms.map((f) => (
                <li key={f.id} className="rounded-lg border border-brand-100 p-3">
                  <span className="font-semibold text-brand-800">{f.name}</span>
                  <span className="text-sm text-brand-500">
                    {" "}
                    · {f.plots.length} plot{f.plots.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent diagnoses */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-brand-800">Recent diagnoses</h2>
            <Link to="/crop-doctor/scanner" className="text-sm font-semibold text-brand-600 underline">
              New scan
            </Link>
          </div>
          {reports.length === 0 ? (
            <p className="mt-3 text-sm text-brand-600">
              No diagnoses yet. Use the{" "}
              <Link to="/crop-doctor/scanner" className="font-semibold text-brand-700 underline">
                Leaf Scanner
              </Link>{" "}
              to analyze a plant.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reports.slice(0, 5).map((r) => (
                <li key={r.image_id} className="rounded-lg border border-brand-100 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-brand-800">
                      {r.status === "ok" && r.outcome
                        ? r.outcome.suspected_condition
                        : r.status === "unavailable"
                          ? "AI unavailable"
                          : "Error"}
                    </span>
                    <span className="text-xs text-brand-500">
                      {new Date(r.analyzed_at).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
