/**
 * Farmers' Trade / Marketplace page.
 *
 * Design:
 * - Farmers list produce with product details, quantity, price, location.
 * - Buyers browse, filter, and send enquiries or price offers.
 * - Contact details are NEVER shown publicly. Buyers request contact via the
 *   enquiry system; sellers choose how to be contacted.
 * - Report button on every listing for suspicious content.
 * - Never fabricates listings, buyers, reviews or transaction activity.
 */

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Alert, PageHeader, Spinner } from "../components/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface Listing {
  id: number; seller_id: number; seller_name: string;
  product_type: string; product_name: string; variety: string | null;
  quality_grade: string | null; description: string | null;
  quantity: number; unit: string;
  asking_price_per_unit: number | null; currency: string; price_negotiable: boolean;
  harvest_date: string | null; available_from: string | null; available_until: string | null;
  state: string | null; district: string | null; pickup_location: string | null;
  delivery_available: boolean; contact_preference: string;
  status: string; enquiry_count: number; report_count: number;
  created_at: string;
}

const PRODUCT_TYPES = ["vegetable","fruit","grain","pulse","spice","coconut","other"];
const UNITS = ["kg","quintal","tonne","piece","dozen","bunch","litre","bag","box","other"];
const CONTACT_PREFS = {
  phone_on_request: "📞 Phone (on request)",
  whatsapp_on_request: "💬 WhatsApp (on request)",
  email_on_request: "📧 Email (on request)",
  in_app: "🔔 In-app only",
};
const TYPE_EMOJI: Record<string,string> = {
  vegetable:"🥬",fruit:"🍎",grain:"🌾",pulse:"🫘",spice:"🌶️",coconut:"🥥",other:"📦"
};
const STATUS_COLORS: Record<string,string> = {
  active:"bg-green-100 text-green-800",
  paused:"bg-amber-100 text-amber-800",
  sold:"bg-brand-100 text-brand-700",
  deleted:"bg-red-100 text-red-700",
};

// ── API helpers ────────────────────────────────────────────────────────────

const marketApi = {
  browse: (params: Record<string,string>) =>
    api.get<Listing[]>("/marketplace/listings", { params }).then(r => r.data),
  mine: () => api.get<Listing[]>("/marketplace/listings/mine").then(r => r.data),
  create: (body: object) => api.post<Listing>("/marketplace/listings", body).then(r => r.data),
  update: (id: number, body: object) => api.put<Listing>(`/marketplace/listings/${id}`, body).then(r => r.data),
  setStatus: (id: number, s: string) => api.patch<Listing>(`/marketplace/listings/${id}/status`, null, { params: { new_status: s } }).then(r => r.data),
  delete: (id: number) => api.delete(`/marketplace/listings/${id}`),
  enquire: (listingId: number, body: object) => api.post(`/marketplace/listings/${listingId}/enquiries`, body),
  myEnquiries: (listingId: number) => api.get(`/marketplace/listings/${listingId}/enquiries`).then(r => r.data),
  report: (listingId: number, body: object) => api.post(`/marketplace/listings/${listingId}/report`, body),
};

// ── Main component ──────────────────────────────────────────────────────────

type Tab = "browse" | "myListings";

export default function Marketplace() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ product_type: "", state: "", search: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null);

  const loadBrowse = async () => {
    setLoading(true);
    const p: Record<string,string> = {};
    if (filters.product_type) p.product_type = filters.product_type;
    if (filters.state) p.state = filters.state;
    if (filters.search) p.search = filters.search;
    try { setListings(await marketApi.browse(p)); } catch { setListings([]); }
    finally { setLoading(false); }
  };

  const loadMine = async () => {
    try { setMyListings(await marketApi.mine()); } catch { setMyListings([]); }
  };

  useEffect(() => { loadBrowse(); }, []);
  useEffect(() => { if (tab === "myListings") loadMine(); }, [tab]);

  return (
    <div>
      <PageHeader title="Farmers' Trade" subtitle="Buy and sell agricultural produce directly between farmers and buyers." />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Safety reminder:</strong> Always verify the buyer or seller before arranging payment or transport.
        AgroDoc does not process payments — all transactions are between the parties directly.
        Use the "Report" button if a listing looks suspicious.
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-2">
        <button className={tab === "browse" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("browse")}>🛒 Browse</button>
        {user && <button className={tab === "myListings" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("myListings")}>📋 My Listings</button>}
        {user && <button className="btn-primary ml-auto" onClick={() => setShowCreate(s => !s)}>{showCreate ? "Cancel" : "+ New listing"}</button>}
      </div>

      {showCreate && <CreateListingForm onCreated={() => { setShowCreate(false); loadMine(); setTab("myListings"); }} />}

      {tab === "browse" && (
        <>
          <FilterBar filters={filters} onChange={setFilters} onSearch={loadBrowse} />
          {loading ? <Spinner label="Loading listings…" /> : (
            listings.length === 0
              ? <Alert variant="info">No listings found matching your filters. Be the first to list!</Alert>
              : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map(l => (
                    <ListingCard key={l.id} listing={l} me={user?.id} onSelect={setSelected} />
                  ))}
                </div>
          )}
        </>
      )}

      {tab === "myListings" && (
        myListings.length === 0
          ? <Alert variant="info">You have no listings. Click "+ New listing" to create one.</Alert>
          : <div className="grid gap-4 sm:grid-cols-2">
              {myListings.map(l => (
                <MyListingCard key={l.id} listing={l} onRefresh={loadMine} />
              ))}
            </div>
      )}

      {selected && <EnquiryModal listing={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Filter bar ──────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, onSearch }: {
  filters: { product_type: string; state: string; search: string };
  onChange: React.Dispatch<React.SetStateAction<typeof filters>>;
  onSearch: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <select className="input flex-1 min-w-[130px]" value={filters.product_type}
        onChange={e => onChange(f => ({ ...f, product_type: e.target.value }))}>
        <option value="">All categories</option>
        {PRODUCT_TYPES.map(t => <option key={t} value={t}>{TYPE_EMOJI[t]} {t}</option>)}
      </select>
      <input className="input flex-1 min-w-[130px]" placeholder="State (e.g. Kerala)"
        value={filters.state} onChange={e => onChange(f => ({ ...f, state: e.target.value }))} />
      <input className="input flex-1 min-w-[170px]" placeholder="Search (tomato, rice…)"
        value={filters.search} onChange={e => onChange(f => ({ ...f, search: e.target.value }))}
        onKeyDown={e => e.key === "Enter" && onSearch()} />
      <button className="btn-primary" onClick={onSearch}>🔍 Search</button>
    </div>
  );
}

// ── Listing card (browse view) ───────────────────────────────────────────────

function ListingCard({ listing: l, me, onSelect }: {
  listing: Listing; me: number | undefined;
  onSelect: (l: Listing) => void;
}) {
  const [reporting, setReporting] = useState(false);

  const doReport = async (reason: string) => {
    await marketApi.report(l.id, { reason, detail: "" });
    setReporting(false);
    alert("Thank you — your report has been submitted for review.");
  };

  return (
    <div className="card flex flex-col p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xl mr-1">{TYPE_EMOJI[l.product_type] ?? "📦"}</span>
          <span className="font-bold text-brand-800">{l.product_name}</span>
          {l.variety && <span className="text-brand-500 text-xs ml-1">({l.variety})</span>}
        </div>
        {l.quality_grade && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{l.quality_grade}</span>
        )}
      </div>
      <div className="text-sm text-brand-700">
        <span className="font-semibold">{l.quantity} {l.unit}</span>
        {l.asking_price_per_unit != null && (
          <span className="ml-2 font-semibold text-brand-900">
            ₹{l.asking_price_per_unit}/{l.unit}
            {l.price_negotiable && <span className="text-brand-400 font-normal"> (negotiable)</span>}
          </span>
        )}
        {l.asking_price_per_unit == null && <span className="ml-2 text-brand-400">Price on request</span>}
      </div>
      <div className="mt-1 text-xs text-brand-500 flex flex-wrap gap-x-2">
        {l.state && <span>📍 {[l.district, l.state].filter(Boolean).join(", ")}</span>}
        {l.harvest_date && <span>🌾 Harvest: {l.harvest_date}</span>}
        {l.delivery_available && <span>🚚 Delivery available</span>}
      </div>
      {l.description && <p className="mt-2 text-xs text-brand-600 line-clamp-2">{l.description}</p>}
      <div className="mt-2 text-xs text-brand-400">
        Seller: {l.seller_name} · {CONTACT_PREFS[l.contact_preference as keyof typeof CONTACT_PREFS] ?? l.contact_preference}
      </div>
      <div className="mt-auto pt-3 flex gap-2">
        {me && me !== l.seller_id && (
          <button className="btn-primary flex-1 py-1.5 text-xs" onClick={() => onSelect(l)}>
            📬 Enquire / Offer
          </button>
        )}
        {me && me !== l.seller_id && (
          <button className="btn-secondary py-1.5 px-2 text-xs text-red-500"
            title="Report this listing" onClick={() => setReporting(r => !r)}>
            ⚠️
          </button>
        )}
      </div>
      {reporting && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold text-red-700">Report reason:</p>
          {["fake_listing","wrong_price","scam_contact","other"].map(r => (
            <button key={r} className="block w-full text-left rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
              onClick={() => doReport(r)}>
              {r.replace(/_/g," ")}
            </button>
          ))}
          <button className="text-xs text-brand-400 underline" onClick={() => setReporting(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ── My listing card ──────────────────────────────────────────────────────────

function MyListingCard({ listing: l, onRefresh }: { listing: Listing; onRefresh: () => void }) {
  const toggle = async () => {
    await marketApi.setStatus(l.id, l.status === "active" ? "paused" : "active");
    onRefresh();
  };
  const markSold = async () => {
    await marketApi.setStatus(l.id, "sold");
    onRefresh();
  };
  const del = async () => {
    if (!confirm("Delete this listing?")) return;
    await marketApi.delete(l.id);
    onRefresh();
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-lg mr-1">{TYPE_EMOJI[l.product_type] ?? "📦"}</span>
          <span className="font-bold text-brand-800">{l.product_name}</span>
          {l.variety && <span className="text-brand-500 text-sm ml-1">({l.variety})</span>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[l.status] ?? ""}`}>
          {l.status}
        </span>
      </div>
      <p className="text-sm text-brand-700 mt-1">
        {l.quantity} {l.unit}
        {l.asking_price_per_unit != null && ` · ₹${l.asking_price_per_unit}/${l.unit}`}
      </p>
      <p className="text-xs text-brand-400 mt-1">📬 {l.enquiry_count} enquir{l.enquiry_count === 1 ? "y" : "ies"}</p>
      {l.report_count > 0 && (
        <p className="text-xs text-red-500 mt-0.5">⚠️ {l.report_count} report{l.report_count > 1 ? "s" : ""} received</p>
      )}
      {l.status !== "deleted" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {l.status !== "sold" && (
            <button className="btn-secondary py-1 text-xs" onClick={toggle}>
              {l.status === "active" ? "⏸ Pause" : "▶ Activate"}
            </button>
          )}
          {l.status === "active" && (
            <button className="btn-secondary py-1 text-xs" onClick={markSold}>✅ Mark sold</button>
          )}
          <button className="btn-danger py-1 text-xs" onClick={del}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Create listing form ────────────────────────────────────────────────────

function CreateListingForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    product_type: "vegetable", product_name: "", variety: "", quality_grade: "",
    description: "", quantity: "", unit: "kg", asking_price_per_unit: "",
    price_negotiable: true, harvest_date: "", state: "", district: "",
    pickup_location: "", delivery_available: false,
    contact_preference: "phone_on_request",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      await marketApi.create({
        ...form,
        quantity: Number(form.quantity),
        asking_price_per_unit: form.asking_price_per_unit ? Number(form.asking_price_per_unit) : null,
        variety: form.variety || null,
        quality_grade: form.quality_grade || null,
        description: form.description || null,
        harvest_date: form.harvest_date || null,
        state: form.state || null,
        district: form.district || null,
        pickup_location: form.pickup_location || null,
      });
      onCreated();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not create listing.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string | boolean | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="card mb-6 p-6 space-y-4">
      <h2 className="font-bold text-brand-800">New listing</h2>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.product_type} onChange={e => set("product_type", e.target.value)}>
            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{TYPE_EMOJI[t]} {t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Product name *</label>
          <input required className="input" value={form.product_name} onChange={e => set("product_name", e.target.value)} placeholder="e.g. Tomato, Paddy" />
        </div>
        <div>
          <label className="label">Variety</label>
          <input className="input" value={form.variety} onChange={e => set("variety", e.target.value)} placeholder="e.g. PKM-1, Jyothi" />
        </div>
        <div>
          <label className="label">Quality grade</label>
          <input className="input" value={form.quality_grade} onChange={e => set("quality_grade", e.target.value)} placeholder="e.g. Grade A, Export" />
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input required type="number" min={0.01} step="any" className="input" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
        </div>
        <div>
          <label className="label">Unit *</label>
          <select className="input" value={form.unit} onChange={e => set("unit", e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Price per unit (₹)</label>
          <input type="number" min={0} step="any" className="input" value={form.asking_price_per_unit} onChange={e => set("asking_price_per_unit", e.target.value)} placeholder="Leave blank for 'price on request'" />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input type="checkbox" id="neg" checked={form.price_negotiable} onChange={e => set("price_negotiable", e.target.checked)} />
          <label htmlFor="neg" className="text-sm text-brand-700">Price negotiable</label>
        </div>
        <div>
          <label className="label">Harvest date</label>
          <input type="date" className="input" value={form.harvest_date} onChange={e => set("harvest_date", e.target.value)} />
        </div>
        <div>
          <label className="label">State</label>
          <input className="input" value={form.state} onChange={e => set("state", e.target.value)} />
        </div>
        <div>
          <label className="label">District</label>
          <input className="input" value={form.district} onChange={e => set("district", e.target.value)} />
        </div>
        <div>
          <label className="label">Pickup location</label>
          <input className="input" value={form.pickup_location} onChange={e => set("pickup_location", e.target.value)} placeholder="Village / block name" />
        </div>
        <div>
          <label className="label">Contact preference</label>
          <select className="input" value={form.contact_preference} onChange={e => set("contact_preference", e.target.value)}>
            {Object.entries(CONTACT_PREFS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input type="checkbox" id="del" checked={form.delivery_available} onChange={e => set("delivery_available", e.target.checked)} />
          <label htmlFor="del" className="text-sm text-brand-700">Delivery available</label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Quality details, organic/chemical-free, packing, etc." />
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Publish listing"}
      </button>
    </form>
  );
}

// ── Enquiry modal ────────────────────────────────────────────────────────────

function EnquiryModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const [kind, setKind] = useState<"enquiry"|"offer">("enquiry");
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      await marketApi.enquire(listing.id, {
        kind, message,
        offered_price: price ? Number(price) : null,
        offered_quantity: qty ? Number(qty) : null,
      });
      setSent(true);
    } catch {
      setError("Could not send enquiry. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-brand-800">
            {kind === "enquiry" ? "📬 Send enquiry" : "💰 Make an offer"} — {listing.product_name}
          </h2>
          <button onClick={onClose} className="text-brand-400 hover:text-brand-700">✕</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-semibold text-brand-800">Your {kind} has been sent!</p>
            <p className="text-sm text-brand-600 mt-1">The seller will respond based on their contact preference: {CONTACT_PREFS[listing.contact_preference as keyof typeof CONTACT_PREFS] ?? listing.contact_preference}.</p>
            <button className="btn-primary mt-4" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-2">
              <button type="button" className={kind==="enquiry"?"btn-primary":"btn-secondary"} onClick={() => setKind("enquiry")}>📬 Enquiry</button>
              <button type="button" className={kind==="offer"?"btn-primary":"btn-secondary"} onClick={() => setKind("offer")}>💰 Offer</button>
            </div>
            <textarea required className="input" rows={4} value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={kind==="enquiry" ? "Ask about quality, availability, pickup details…" : "Describe your offer and requirements…"} />
            {kind === "offer" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Offered price (₹/{listing.unit})</label>
                  <input type="number" min={0} step="any" className="input" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div>
                  <label className="label">Quantity ({listing.unit})</label>
                  <input type="number" min={0.01} step="any" className="input" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
              </div>
            )}
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Send</button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
            <p className="text-xs text-brand-400">Your contact details are not shared with the seller until they respond with a contact method.</p>
          </form>
        )}
      </div>
    </div>
  );
}
