/**
 * Weather page — plot-specific weather with rainfall in mm.
 *
 * The user selects one of their plots (which has coordinates from the map), and
 * gets real Open-Meteo data for that exact location: current conditions,
 * hourly + 7-day forecast, rainfall in mm (not just probability), and
 * crop-specific irrigation / spray guidance.
 *
 * Never claims sensor measurements — data comes from Open-Meteo's gridded
 * forecast model for the plot's coordinates.
 */

import { useEffect, useState } from "react";
import { farmApi, weatherApi } from "../lib/api";
import type { Farm, WeatherResponse } from "../lib/types";
import { Alert, PageHeader, Spinner } from "../components/ui";

const WMO: Record<number, string> = {
  0: "☀️ Clear", 1: "🌤️ Mainly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
  45: "🌫️ Fog", 48: "🌫️ Rime fog",
  51: "🌦️ Light drizzle", 53: "🌦️ Drizzle", 55: "🌧️ Dense drizzle",
  61: "🌧️ Slight rain", 63: "🌧️ Moderate rain", 65: "🌧️ Heavy rain",
  71: "🌨️ Slight snow", 73: "🌨️ Snow", 75: "❄️ Heavy snow",
  80: "🌧️ Showers", 81: "🌧️ Moderate showers", 82: "⛈️ Violent showers",
  95: "⛈️ Thunderstorm", 96: "⛈️ Thunderstorm + hail",
};

export default function Weather() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // All plots with coordinates (selectable).
  const plotsWithCoords = farms
    .flatMap((f) => f.plots.filter((p) => p.latitude != null).map((p) => ({ ...p, farmName: f.name })));

  useEffect(() => {
    farmApi.list().then(setFarms).catch(() => {});
  }, []);

  const fetchByCoords = async (latVal: string, lonVal: string) => {
    if (!latVal || !lonVal) {
      setError("Select a plot or enter coordinates.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await weatherApi.byCoords(Number(latVal), Number(lonVal)));
    } catch {
      setError("Could not fetch weather. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const selectPlot = (plotId: number) => {
    setSelectedPlotId(plotId);
    const plot = plotsWithCoords.find((p) => p.id === plotId);
    if (plot && plot.latitude) {
      setLat(String(plot.latitude));
      setLon(String(plot.longitude));
      fetchByCoords(String(plot.latitude), String(plot.longitude));
    }
  };

  const useMyLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(4);
        const lo = pos.coords.longitude.toFixed(4);
        setLat(la);
        setLon(lo);
        setSelectedPlotId(null);
        fetchByCoords(la, lo);
      },
      () => setError("Location permission denied. Select a plot or enter coordinates manually."),
    );
  };

  // Total rainfall mm in next 7 days
  const totalRain7d = data?.daily.reduce((sum, d) => sum + (d.precipitation_sum_mm || 0), 0) ?? 0;
  const currentRain = data?.current?.precipitation_mm ?? 0;
  const selectedPlot = plotsWithCoords.find((p) => p.id === selectedPlotId);

  return (
    <div>
      <PageHeader
        title="Plot Weather"
        subtitle="Real weather for your farm plot's exact location — rainfall in mm, not just probability."
      />

      {/* Plot selector (primary) */}
      <div className="card mb-6 p-5">
        <label className="label" htmlFor="plot-select">Select a plot</label>
        <div className="flex flex-wrap gap-2">
          <select
            id="plot-select"
            className="input flex-1 min-w-[200px]"
            value={selectedPlotId ?? ""}
            onChange={(e) => e.target.value ? selectPlot(Number(e.target.value)) : setSelectedPlotId(null)}
          >
            <option value="">— Choose a plot —</option>
            {plotsWithCoords.map((p) => (
              <option key={p.id} value={p.id}>
                {p.farmName} › {p.name}{p.crop ? ` (${p.crop})` : ""}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={useMyLocation}>📍 My location</button>
        </div>

        {plotsWithCoords.length === 0 && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            ⚠️ You have no plots with coordinates yet. Go to <a href="/farms" className="underline font-semibold">My Farms</a> and draw a boundary or set a location for a plot first.
          </p>
        )}

        {/* Manual coords fallback */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-brand-500 hover:text-brand-700">
            Enter coordinates manually instead
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Latitude</label>
              <input className="input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 10.0" />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input className="input" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="e.g. 76.3" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full" onClick={() => fetchByCoords(lat, lon)}>Get weather</button>
            </div>
          </div>
        </details>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <Spinner label="Fetching weather for your plot…" />}

      {data && (
        <div className="space-y-4">
          {/* Source + location info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-500">
            <span>
              📍 {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
              {selectedPlot && ` · ${selectedPlot.farmName} › ${selectedPlot.name}`}
              {selectedPlot?.crop && ` · ${selectedPlot.crop}`}
            </span>
            <span>Source: {data.source} · Updated {new Date(data.fetched_at).toLocaleString()}</span>
          </div>

          {/* Current conditions + RAINFALL mm (prominent) */}
          {data.current && (
            <div className="card p-6">
              <h2 className="font-bold text-brand-800 mb-4">Current conditions</h2>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">
                    {data.current.weather_code !== null ? (WMO[data.current.weather_code]?.split(" ")[0] || "🌡️") : "🌡️"}
                  </span>
                  <div>
                    <div className="text-4xl font-extrabold text-brand-900">{Math.round(data.current.temperature_c)}°C</div>
                    <div className="text-sm text-brand-600">
                      {data.current.weather_code !== null ? WMO[data.current.weather_code] : "—"} · Feels {data.current.apparent_temperature_c != null ? `${Math.round(data.current.apparent_temperature_c)}°C` : "—"}
                    </div>
                  </div>
                </div>

                {/* Rainfall mm — the key metric the user asked for */}
                <div className="flex-1 min-w-[180px]">
                  <div className={`rounded-2xl p-4 ${currentRain > 0 ? "bg-blue-50 border border-blue-200" : "bg-brand-50 border border-brand-100"}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Rainfall now</div>
                    <div className="text-3xl font-bold text-blue-700">{currentRain.toFixed(1)} <span className="text-lg">mm</span></div>
                    <div className="text-xs text-brand-500 mt-0.5">
                      Rain probability: {data.current.precipitation_probability_pct ?? "—"}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Humidity" value={data.current.relative_humidity_pct != null ? `${data.current.relative_humidity_pct}%` : "—"} icon="💧" />
                <Stat label="Wind" value={data.current.wind_speed_kmh != null ? `${data.current.wind_speed_kmh} km/h` : "—"} icon="💨" />
                <Stat label="7-day rain" value={`${totalRain7d.toFixed(1)} mm`} icon="🌧️" />
                <Stat label="Day/Night" value={data.current.is_day ? "Daytime" : "Night"} icon={data.current.is_day ? "☀️" : "🌙"} />
              </div>
            </div>
          )}

          {/* Crop-specific advice */}
          {data.advice && data.advice.tips.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-brand-800 mb-3">
                🌱 Crop & Irrigation Guidance
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  data.advice.rain_risk === "high" ? "bg-red-100 text-red-700" :
                  data.advice.rain_risk === "moderate" ? "bg-amber-100 text-amber-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  Rain risk: {data.advice.rain_risk}
                </span>
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  data.advice.spray_suitable ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  Spray: {data.advice.spray_suitable ? "OK" : "Not recommended"}
                </span>
              </h2>
              <ul className="space-y-2 text-sm text-brand-700">
                {data.advice.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-brand-400">
                This guidance is based on Open-Meteo's gridded forecast for these coordinates, not from sensors on your plot. Always check ground conditions.
              </p>
            </div>
          )}

          {/* Hourly — with rainfall mm bars */}
          {data.hourly.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-brand-800 mb-3">Next 24 hours — temperature & rainfall</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {data.hourly.slice(0, 24).map((h, i) => {
                  const rain = h.precipitation_mm ?? 0;
                  return (
                    <div key={i} className="min-w-[4rem] rounded-lg border border-brand-100 p-2 text-center text-xs">
                      <div className="text-brand-500">{new Date(h.time).getHours()}h</div>
                      <div className="font-semibold text-brand-800">{Math.round(h.temperature_c ?? 0)}°</div>
                      {/* Rainfall mm with visual bar */}
                      <div className="mt-1 flex flex-col items-center">
                        <div className="text-blue-600 font-semibold">{rain > 0 ? `${rain.toFixed(1)}` : ""}</div>
                        <div className="mt-0.5 h-8 w-1.5 overflow-hidden rounded-full bg-brand-100">
                          <div className="w-full bg-blue-500 rounded-full" style={{ height: `${Math.min(100, rain * 25)}%`, marginTop: "auto" }} />
                        </div>
                        <div className="text-blue-400 text-[10px]">{h.precipitation_probability_pct ?? 0}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-brand-400">Blue bars = rainfall in mm. Numbers below = rain probability %.</p>
            </div>
          )}

          {/* 7-day forecast — with rainfall mm */}
          {data.daily.length > 0 && (
            <div className="card p-6">
              <h2 className="font-bold text-brand-800 mb-3">7-day forecast</h2>
              <div className="grid gap-2 sm:grid-cols-7">
                {data.daily.map((d) => {
                  const rain = d.precipitation_sum_mm ?? 0;
                  return (
                    <div key={d.date} className="rounded-xl border border-brand-100 p-3 text-center text-xs">
                      <div className="font-semibold text-brand-700">
                        {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="text-2xl my-1">
                        {d.weather_code !== null ? (WMO[d.weather_code]?.split(" ")[0] || "🌡️") : "🌡️"}
                      </div>
                      <div className="text-brand-800 font-semibold">{Math.round(d.temp_max_c ?? 0)}°<span className="text-brand-400 font-normal">/{Math.round(d.temp_min_c ?? 0)}°</span></div>
                      {/* Rainfall mm */}
                      <div className={`mt-1 rounded-lg px-1 py-0.5 ${rain > 0 ? "bg-blue-50 text-blue-700" : "text-brand-400"}`}>
                        🌧️ {rain > 0 ? `${rain.toFixed(1)}mm` : "0mm"}
                      </div>
                      <div className="text-blue-400 text-[10px] mt-0.5">{d.precipitation_probability_max_pct ?? 0}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl bg-brand-50 p-3 flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xs text-brand-500">{label}</div>
        <div className="font-semibold text-brand-800 text-sm">{value}</div>
      </div>
    </div>
  );
}
