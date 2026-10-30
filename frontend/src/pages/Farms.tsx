/**
 * Farms page — farm and plot management with integrated satellite map.
 *
 * What works:
 * - Create / delete farms.
 * - Add plots with location, crop, growth stage, soil type, irrigation.
 * - Draw or edit a plot boundary directly on the satellite map.
 * - Boundary auto-calculates area in acres, cents and hectares.
 * - Persist boundary to the backend via PATCH /api/farms/{id}/plots/{id}/boundary.
 * - Per-plot weather widget using the existing Open-Meteo integration.
 * - GPS disclaimer: consumer GPS accuracy, not a legal survey.
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { farmApi, weatherApi } from "../lib/api";
import type { Farm, WeatherResponse } from "../lib/types";
import type { FarmMapHandle, DrawnBoundary } from "../components/FarmMap";
import { Alert, PageHeader, Spinner } from "../components/ui";

const FarmMap = lazy(() => import("../components/FarmMap"));

const WMO: Record<number, string> = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",61:"🌧️",63:"🌧️",65:"⛈️",80:"🌧️",95:"⛈️",
};

export default function Farms() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"list" | "map">("map");
  const [farmForm, setFarmForm] = useState({ name: "", state: "", district: "", notes: "" });
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  // Which plot's weather to show (plot coords)
  const [plotWeather, setPlotWeather] = useState<{ farm: Farm; plotIdx: number; data: WeatherResponse | null; loading: boolean } | null>(null);

  const mapRef = useRef<FarmMapHandle>(null);

  const load = () =>
    farmApi.list()
      .then(setFarms)
      .catch(() => setError("Could not load farms."))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const createFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await farmApi.create(farmForm);
      setFarmForm({ name: "", state: "", district: "", notes: "" });
      setShowForm(false);
      load();
    } catch { setError("Could not create farm."); }
  };

  const handleBoundarySaved = async (plotId: number, farmId: number, boundary: DrawnBoundary) => {
    await farmApi.updateBoundary(farmId, plotId, { boundary_geojson: boundary.geojson });
    await load();
  };

  const handlePlotWeatherClick = async (farm: Farm, plotIdx: number) => {
    const plot = farm.plots[plotIdx];
    if (!plot.latitude || !plot.longitude) return;
    setPlotWeather({ farm, plotIdx, data: null, loading: true });
    try {
      const data = await weatherApi.byCoords(plot.latitude, plot.longitude);
      setPlotWeather({ farm, plotIdx, data, loading: false });
    } catch {
      setPlotWeather({ farm, plotIdx, data: null, loading: false });
    }
  };

  if (loading) return <Spinner label="Loading farms…" />;

  return (
    <div>
      <PageHeader title="My Farms" subtitle="Register farms, draw plot boundaries, and manage your crops." />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "+ Add farm"}
        </button>
        <div className="ml-auto flex gap-1">
          <button className={view === "list" ? "btn-primary" : "btn-secondary"} onClick={() => setView("list")}>📋 List</button>
          <button className={view === "map" ? "btn-primary" : "btn-secondary"} onClick={() => setView("map")}>🛰️ Map</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createFarm} className="card mb-6 p-6">
          <h2 className="mb-3 font-bold text-brand-800">New farm</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["name","state","district","notes"] as const).map(k => (
              <div key={k}>
                <label className="label capitalize">{k === "notes" ? "Notes" : k.charAt(0).toUpperCase() + k.slice(1)}</label>
                <input required={k === "name"} className="input"
                  value={farmForm[k]}
                  onChange={e => setFarmForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button className="btn-primary mt-4" type="submit">Save farm</button>
        </form>
      )}

      {/* Map view */}
      {view === "map" && (
        <Suspense fallback={<Spinner label="Loading map…" />}>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Map */}
            <div className="card overflow-hidden">
              <FarmMap
                ref={mapRef}
                farms={farms}
                heightClass="h-[540px]"
                onBoundarySaved={handleBoundarySaved}
                onPlotSelect={setSelectedPlotId}
                onPlotWeatherClick={(plot, farm) => {
                  const idx = farm.plots.findIndex(p => p.id === plot.id);
                  handlePlotWeatherClick(farm, idx);
                }}
              />
            </div>

            {/* Plot detail sidebar */}
            <div className="space-y-3">
              {selectedPlotId ? (() => {
                const allPlots = farms.flatMap(f => f.plots.map(p => ({ plot: p, farm: f })));
                const found = allPlots.find(x => x.plot.id === selectedPlotId);
                if (!found) return <Alert variant="info">Plot not found.</Alert>;
                const { plot, farm } = found;
                return (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-brand-800">{plot.name}</h3>
                        <p className="text-xs text-brand-500">{farm.name}</p>
                      </div>
                      <button className="text-brand-400 hover:text-brand-700" onClick={() => setSelectedPlotId(null)}>✕</button>
                    </div>
                    <div className="space-y-1 text-sm text-brand-700">
                      {plot.crop && <p>🌱 Crop: <span className="font-medium">{plot.crop}</span>{plot.variety ? ` (${plot.variety})` : ""}</p>}
                      {plot.growth_stage && <p>📈 Stage: {plot.growth_stage}</p>}
                      {plot.area_acres != null && (
                        <p>📐 Area: {plot.area_acres} ac · {(plot.area_acres*100).toFixed(0)} cents · {(plot.area_acres*0.4047).toFixed(3)} ha</p>
                      )}
                      {plot.latitude != null && <p>📍 {plot.latitude?.toFixed(4)}, {plot.longitude?.toFixed(4)}</p>}
                      {plot.soil_type && <p>🏔️ Soil: {plot.soil_type}</p>}
                      {plot.irrigation_type && <p>💧 Irrigation: {plot.irrigation_type}</p>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary py-1 px-3 text-xs"
                        onClick={() => mapRef.current?.startDraw(plot.id, farm.id)}>
                        {plot.boundary_geojson ? "✏️ Edit boundary" : "✏️ Draw boundary"}
                      </button>
                      {plot.latitude != null && (
                        <button className="btn-secondary py-1 px-3 text-xs"
                          onClick={() => handlePlotWeatherClick(farm, farm.plots.findIndex(p => p.id === plot.id))}>
                          🌦️ Weather
                        </button>
                      )}
                      <button className="btn-secondary py-1 px-2 text-xs text-red-600"
                        onClick={async () => {
                          if (!confirm(`Delete plot "${plot.name}"?`)) return;
                          await farmApi.removePlot(farm.id, plot.id);
                          setSelectedPlotId(null);
                          load();
                        }}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })() : (
                <div className="card p-4">
                  <p className="text-sm text-brand-600">
                    👆 Click a plot on the map to see details, weather, and boundary tools.
                  </p>
                  <p className="mt-2 text-xs text-brand-400">
                    Use 📍 GPS to find your location, then draw your plot boundary.
                    Choose Freehand, Rectangle, or enter exact dimensions.
                  </p>
                </div>
              )}

              {/* Quick plot list */}
              <div className="card p-3">
                <h4 className="text-xs font-semibold text-brand-500 uppercase mb-2">All plots</h4>
                {farms.flatMap(f => f.plots).length === 0 ? (
                  <p className="text-xs text-brand-400">No plots yet. Add a farm and plot first.</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {farms.flatMap(f => f.plots.map(p => ({ plot: p, farm: f }))).map(({ plot }) => (
                      <button key={plot.id}
                        className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${
                          selectedPlotId === plot.id ? "bg-brand-600 text-white" : "hover:bg-brand-50 dark:hover:bg-brand-800/40 text-brand-700 dark:text-brand-200"}`}
                        onClick={() => setSelectedPlotId(plot.id)}>
                        {plot.name} {plot.crop && `· ${plot.crop}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-brand-500 dark:text-brand-400">
            🛰️ Satellite imagery: Esri World Imagery · Consumer GPS accuracy is typically 3–15 m — this is not a legal land survey.
          </p>
        </Suspense>
      )}

      {/* Per-plot weather panel */}
      {plotWeather && (
        <PlotWeatherPanel
          farm={plotWeather.farm}
          plotIdx={plotWeather.plotIdx}
          data={plotWeather.data}
          loading={plotWeather.loading}
          onClose={() => setPlotWeather(null)}
        />
      )}

      {/* List view */}
      {view === "list" && farms.length === 0 && (
        <Alert variant="info">No farms yet. Click "+ Add farm" to get started.</Alert>
      )}

      {view === "list" && farms.map(farm => (
        <FarmCard
          key={farm.id}
          farm={farm}
          mapRef={mapRef}
          onChanged={load}
          onWeatherClick={handlePlotWeatherClick}
          onSwitchToMap={() => setView("map")}
        />
      ))}
    </div>
  );
}

// ── Per-plot weather panel ─────────────────────────────────────────────────

function PlotWeatherPanel({ farm, plotIdx, data, loading, onClose }: {
  farm: Farm; plotIdx: number;
  data: WeatherResponse | null; loading: boolean; onClose: () => void;
}) {
  const plot = farm.plots[plotIdx];
  const cur = data?.current;
  const WMO_FULL: Record<number, string> = {0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Light drizzle",61:"Slight rain",63:"Moderate rain",65:"Heavy rain",80:"Rain showers",95:"Thunderstorm"};

  return (
    <div className="card mb-4 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-brand-800">🌦️ Weather — {plot.name}</h3>
          <p className="text-xs text-brand-500">{farm.name} · {plot.latitude?.toFixed(4)}, {plot.longitude?.toFixed(4)}</p>
        </div>
        <button className="text-brand-400 hover:text-brand-700" onClick={onClose}>✕</button>
      </div>

      {loading && <Spinner label="Fetching weather…" />}

      {!loading && !data && (
        <Alert variant="warning">Could not fetch weather. Make sure this plot has a location set.</Alert>
      )}

      {!loading && data && cur && (
        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-4xl">{cur.weather_code != null ? (WMO[cur.weather_code] ?? "🌡️") : "🌡️"}</span>
            <div>
              <div className="text-2xl font-bold text-brand-900">{Math.round(cur.temperature_c)}°C</div>
              <div className="text-sm text-brand-600">{cur.weather_code != null ? (WMO_FULL[cur.weather_code] ?? "") : ""}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-brand-600 ml-4">
              <span>💧 {cur.relative_humidity_pct ?? "—"}% humidity</span>
              <span>🌧️ {cur.precipitation_probability_pct ?? "—"}% rain</span>
              <span>💨 {cur.wind_speed_kmh ?? "—"} km/h wind</span>
              <span>🌡️ Feels {cur.apparent_temperature_c != null ? Math.round(cur.apparent_temperature_c) : "—"}°C</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {data.hourly.slice(0, 12).map((h, i) => (
              <div key={i} className="min-w-[3rem] rounded border border-brand-100 bg-white p-1 text-center text-xs">
                <div className="text-brand-400">{new Date(h.time).getHours()}h</div>
                <div className="font-semibold">{Math.round(h.temperature_c ?? 0)}°</div>
                <div className="text-blue-500">{h.precipitation_probability_pct ?? 0}%</div>
              </div>
            ))}
          </div>
          {/* Irrigation guidance */}
          {cur.precipitation_probability_pct != null && (
            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${cur.precipitation_probability_pct > 60 ? "border-blue-200 bg-blue-50 text-blue-700" : cur.precipitation_probability_pct < 20 && cur.temperature_c > 30 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-brand-100 bg-brand-50 text-brand-700"}`}>
              {cur.precipitation_probability_pct > 60
                ? "🌧️ High rain chance — consider skipping irrigation today."
                : cur.precipitation_probability_pct < 20 && cur.temperature_c > 30
                ? "☀️ Hot and dry — irrigation may be needed, especially for shallow-rooted crops."
                : "Conditions look moderate. Monitor soil moisture."}
            </div>
          )}
          <p className="mt-1 text-xs text-brand-400">Source: {data.source} · {new Date(data.fetched_at).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

// ── Farm card with inline map ──────────────────────────────────────────────

function FarmCard({ farm, mapRef, onChanged, onWeatherClick, onSwitchToMap }: {
  farm: Farm;
  mapRef: React.RefObject<FarmMapHandle>;
  onChanged: () => void;
  onWeatherClick: (farm: Farm, plotIdx: number) => void;
  onSwitchToMap: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [plot, setPlot] = useState({
    name: "", crop: "", variety: "", growth_stage: "", planting_date: "",
    soil_type: "", irrigation_type: "", latitude: "", longitude: "", area_acres: "",
  });

  const addPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    await farmApi.addPlot(farm.id, {
      name: plot.name, crop: plot.crop || undefined, variety: plot.variety || undefined,
      growth_stage: plot.growth_stage || undefined, planting_date: plot.planting_date || undefined,
      soil_type: plot.soil_type || undefined, irrigation_type: plot.irrigation_type || undefined,
      latitude: plot.latitude ? Number(plot.latitude) : undefined,
      longitude: plot.longitude ? Number(plot.longitude) : undefined,
      area_acres: plot.area_acres ? Number(plot.area_acres) : undefined,
    });
    setPlot({ name:"",crop:"",variety:"",growth_stage:"",planting_date:"",soil_type:"",irrigation_type:"",latitude:"",longitude:"",area_acres:"" });
    setAdding(false);
    onChanged();
  };

  const handleDrawBoundary = (plotId: number) => {
    onSwitchToMap();
    // After switching to map, trigger the draw mode via the map ref.
    setTimeout(() => {
      mapRef.current?.startDraw(plotId, farm.id);
    }, 400);
  };

  return (
    <div className="card mb-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-brand-800 text-lg">{farm.name}</h3>
          <p className="text-sm text-brand-500">
            {[farm.state, farm.district].filter(Boolean).join(", ") || "No location set"} ·{" "}
            {farm.plots.length} plot{farm.plots.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-danger" onClick={async () => {
          if (!confirm(`Delete farm "${farm.name}"?`)) return;
          await farmApi.remove(farm.id); onChanged();
        }}>Delete</button>
      </div>

      {/* Plot list */}
      <div className="mt-4 space-y-2">
        {farm.plots.map((p, i) => (
          <div key={p.id} className="rounded-lg border border-brand-100 bg-brand-50/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-brand-800">{p.name}</span>
                {p.crop && <span className="text-brand-600"> · {p.crop}</span>}
                {p.variety && <span className="text-brand-500"> ({p.variety})</span>}
                {p.growth_stage && <span className="text-brand-400"> · {p.growth_stage}</span>}
                {p.area_acres && (
                  <span className="text-brand-500 text-xs ml-2">
                    {p.area_acres} ac · {(p.area_acres * 100).toFixed(0)} cts · {(p.area_acres * 0.4047).toFixed(3)} ha
                  </span>
                )}
                {p.latitude != null && (
                  <span className="text-brand-400 text-xs ml-2">📍{p.latitude.toFixed(4)},{p.longitude?.toFixed(4)}</span>
                )}
                {p.boundary_geojson && <span className="text-green-600 text-xs ml-1">🛰️ boundary</span>}
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button className="btn-secondary py-0.5 px-2 text-xs"
                  onClick={() => handleDrawBoundary(p.id)}>
                  {p.boundary_geojson ? "✏️ Edit" : "✏️ Draw"} boundary
                </button>
                {p.latitude != null && (
                  <button className="btn-secondary py-0.5 px-2 text-xs"
                    onClick={() => onWeatherClick(farm, i)}>
                    🌦️
                  </button>
                )}
                <button className="btn-secondary py-0.5 px-2 text-xs text-red-600"
                  onClick={async () => {
                    if (!confirm(`Delete plot "${p.name}"?`)) return;
                    await farmApi.removePlot(farm.id, p.id); onChanged();
                  }}>✕</button>
              </div>
            </div>
          </div>
        ))}

        {/* Add plot form */}
        <button className="btn-secondary py-1 text-sm" onClick={() => setAdding(a => !a)}>
          {adding ? "Cancel" : "+ Add plot"}
        </button>

        {adding && (
          <form onSubmit={addPlot} className="mt-2 rounded-xl border border-brand-100 bg-white p-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {k:"name",l:"Plot name",req:true,type:"text"},
                {k:"crop",l:"Crop",req:false,type:"text"},
                {k:"variety",l:"Variety",req:false,type:"text"},
                {k:"growth_stage",l:"Growth stage",req:false,type:"text"},
                {k:"planting_date",l:"Planting date",req:false,type:"date"},
                {k:"soil_type",l:"Soil type",req:false,type:"text"},
                {k:"irrigation_type",l:"Irrigation",req:false,type:"text"},
                {k:"latitude",l:"Latitude",req:false,type:"number"},
                {k:"longitude",l:"Longitude",req:false,type:"number"},
                {k:"area_acres",l:"Area (acres)",req:false,type:"number"},
              ].map(({k,l,req,type}) => (
                <div key={k}>
                  <label className="label text-xs">{l}</label>
                  <input className="input text-sm" required={req} type={type}
                    step={type==="number"?"any":undefined}
                    value={(plot as Record<string,string>)[k]}
                    onChange={e => setPlot(p => ({...p,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-500">
              💡 Leave latitude/longitude empty and use the "Draw boundary" button to set the plot location on the map instead.
            </p>
            <button className="btn-primary" type="submit">Save plot</button>
          </form>
        )}
      </div>
    </div>
  );
}
