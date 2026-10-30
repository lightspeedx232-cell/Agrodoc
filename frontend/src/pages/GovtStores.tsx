import { govStores, type GovStore } from "../lib/content";
import { PageHeader } from "../components/ui";

export default function GovtStores() {
  return (
    <div>
      <PageHeader
        title="Government Agricultural Stores"
        subtitle="Official government and cooperative portals for agricultural inputs."
      />

      <div className="card mb-6 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>How to use this directory:</strong> Each entry below is a publicly
        known official or cooperative portal. Click "Visit Official Website" to
        open it directly — AgroDoc does not process orders itself. Always
        confirm you are on the official domain before entering any details.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {govStores.map((s) => (
          <StoreCard key={s.id} store={s} />
        ))}
      </div>

      <p className="mt-6 text-xs text-brand-500">
        AgroDoc only lists government / cooperative / government-supported
        organisations and authorised sellers. It never labels a private store
        as government-owned. Verification dates are shown on each card.
      </p>
    </div>
  );
}

function StoreCard({ store }: { store: GovStore }) {
  return (
    <div className="card flex flex-col p-6">
      <div className="flex items-start justify-between">
        <h3 className="font-bold text-brand-800">{store.name}</h3>
        {store.verified && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            ✓ Verified official
          </span>
        )}
      </div>
      <span className="mt-2 w-fit rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
        {store.type}
      </span>
      <p className="mt-2 text-sm text-brand-700">
        <strong>Products:</strong> {store.products.join(", ")}
      </p>
      <p className="text-sm text-brand-600">
        <strong>Region:</strong> {store.region}
      </p>
      <div className="mt-auto pt-4">
        <a
          href={store.portal.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full"
        >
          Visit Official Website
        </a>
        <p className="mt-2 text-center text-xs text-brand-400">
          Last verified: {store.last_verified} · {store.portal.label}
        </p>
      </div>
    </div>
  );
}
