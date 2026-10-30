import { useState } from "react";
import { schemes, type Scheme } from "../lib/content";
import { PageHeader } from "../components/ui";

export default function Schemes() {
  const [filter, setFilter] = useState<"All" | "Central" | "Kerala">("All");
  const list = schemes.filter((s) => filter === "All" || s.level === filter);

  return (
    <div>
      <PageHeader
        title="Government Schemes"
        subtitle="Central and state agricultural schemes with official application links."
      />

      <div className="mb-4 flex gap-2">
        {(["All", "Central", "Kerala"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "btn-primary" : "btn-secondary"}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((s) => (
          <SchemeCard key={s.id} scheme={s} />
        ))}
      </div>

      <p className="mt-6 text-xs text-brand-500">
        AgroDoc lists only publicly known official portals. Always verify the
        link and the current scheme details on the official website before
        applying. Links were last checked on the date shown on each card.
      </p>
    </div>
  );
}

function SchemeCard({ scheme }: { scheme: Scheme }) {
  return (
    <div className="card flex flex-col p-6">
      <span className="w-fit rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
        {scheme.level} · {scheme.category}
      </span>
      <h3 className="mt-2 font-bold text-brand-800">{scheme.name}</h3>
      <p className="mt-1 text-sm text-brand-700">{scheme.benefit}</p>
      <p className="mt-2 text-xs text-brand-500">
        <strong>Eligibility:</strong> {scheme.eligibility}
      </p>
      <div className="mt-2 text-xs text-brand-600">
        <strong>Documents:</strong> {scheme.documents.join(", ")}
      </div>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-brand-600">
        {scheme.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <div className="mt-auto pt-4">
        <a
          href={scheme.portal.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full"
        >
          Apply on {scheme.portal.label}
        </a>
        <p className="mt-2 text-center text-xs text-brand-400">
          Last verified: {scheme.last_verified}
        </p>
      </div>
    </div>
  );
}
