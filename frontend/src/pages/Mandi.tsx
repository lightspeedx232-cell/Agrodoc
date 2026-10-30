import { useState } from "react";
import { mandiSources } from "../lib/content";
import { mandiApi, type MandiResponse } from "../lib/api";
import { Alert, PageHeader, Spinner } from "../components/ui";

export default function Mandi() {
  const [data, setData] = useState<MandiResponse | null>(null);
  const [commodity, setCommodity] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      setData(await mandiApi.prices(commodity || undefined));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Mandi Prices"
        subtitle="Official market price sources for agricultural produce."
      />

      <Alert variant="info">
        AgroDoc shows prices only from official government market-data sources
        and always displays the source, date, and unit. We never present old
        observations as "live" prices.
      </Alert>

      <div className="card mt-6 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="com">Commodity (optional)</label>
            <input
              id="com"
              className="input"
              placeholder="e.g. Paddy, Onion, Tomato"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={fetchPrices}>Fetch prices</button>
        </div>
        {loading && <Spinner label="Fetching mandi prices…" />}
      </div>

      {data && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-brand-500">
            Source: {data.source} · Fetched: {new Date(data.fetched_at).toLocaleString()}
          </div>
          {data.message && !data.configured && (
            <Alert variant="warning">{data.message}</Alert>
          )}
          {data.message && data.configured && data.records.length === 0 && (
            <Alert variant="warning">{data.message}</Alert>
          )}
          {data.records.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-brand-100 bg-brand-50 text-brand-700">
                  <tr>
                    <th className="px-3 py-2">Commodity</th>
                    <th className="px-3 py-2">Market</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r, i) => (
                    <tr key={i} className="border-b border-brand-50">
                      <td className="px-3 py-2 font-medium text-brand-800">{r.commodity}</td>
                      <td className="px-3 py-2">{r.market}</td>
                      <td className="px-3 py-2">{r.state || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{r.price}</td>
                      <td className="px-3 py-2">{r.unit}</td>
                      <td className="px-3 py-2">{r.arrival_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-bold text-brand-800">Official price portals</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {mandiSources.map((s) => (
          <div key={s.name} className="card flex flex-col p-6">
            <h3 className="font-bold text-brand-800">{s.name}</h3>
            <p className="mt-2 flex-1 text-sm text-brand-700">{s.description}</p>
            <a href={s.url} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
              View live prices
            </a>
            <p className="mt-2 text-center text-xs text-brand-400">
              Source: {new URL(s.url).hostname}
            </p>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6">
        <h3 className="font-bold text-brand-800">How prices are sourced</h3>
        <ul className="mt-3 space-y-2 text-sm text-brand-700">
          <li>
            <strong>AGMARKNET</strong> publishes daily wholesale prices for
            regulated mandis, reported in ₹ per quintal (or as stated), with the
            reporting date.
          </li>
          <li>
            <strong>eNAM</strong> shows live auction lots with commodity, market,
            price, and unit.
          </li>
          <li>
            When a <code>data.gov.in</code> API key and resource id are configured
            in the backend, AgroDoc fetches and tabulates prices above with full
            source dates and units. Until then, the official portals are the
            source of truth.
          </li>
        </ul>
      </div>
    </div>
  );
}
