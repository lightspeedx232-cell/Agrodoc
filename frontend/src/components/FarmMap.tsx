/**
 * FarmMap — interactive satellite map for AgroDoc plot management.
 *
 * Three drawing modes for user-friendly boundary creation:
 *  1. Freehand — click points to draw any shape
 *  2. Rectangle — click two corners for a rectangular plot
 *  3. Dimensions — enter length × width in metres, click centre → rectangle
 *
 * Edit mode — drag vertices to adjust an existing boundary.
 * Area shown live in acres / cents / hectares.
 * GPS with accuracy display + "not a legal survey" disclaimer.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
  MapContainer, TileLayer, Polygon, CircleMarker, Marker, Popup,
  LayersControl, useMap, useMapEvents,
} from "react-leaflet";
import type { LatLng, LatLngTuple, Marker as LMarker } from "leaflet";
import L from "leaflet";
import area from "@turf/area";
import { polygon as turfPolygon } from "@turf/helpers";
import type { Farm, Plot } from "../lib/types";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Types ──────────────────────────────────────────────────────────────────
export interface MapPlot {
  id: number; farmId: number; name: string; crop: string | null;
  coordinates: LatLngTuple[]; color: string; areaAcres: number | null;
}
export interface DrawnBoundary {
  geojson: string; coordinates: LatLngTuple[];
  areaAcres: number; areaCents: number; areaHa: number;
}
type DrawMode = "freehand" | "rectangle" | "dimensions";

interface Props {
  farms?: Farm[];
  onBoundarySaved?: (plotId: number, farmId: number, boundary: DrawnBoundary) => Promise<void>;
  onPlotSelect?: (plotId: number | null) => void;
  editPlotId?: number | null;
  centerLat?: number; centerLon?: number;
  heightClass?: string;
  onPlotWeatherClick?: (plot: Plot, farm: Farm) => void;
}

export interface FarmMapHandle {
  startDraw: (plotId: number, farmId: number) => void;
  cancelDraw: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = ["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#ef4444","#84cc16"];
const TILES = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Earthstar Geographics",
    maxZoom: 19,
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function calcArea(coords: LatLngTuple[]): { acres: number; cents: number; ha: number } | null {
  if (coords.length < 3) return null;
  try {
    const ring = [...coords.map(([lat, lng]) => [lng, lat]), [coords[0][1], coords[0][0]]];
    const m2 = area(turfPolygon([ring]));
    const acres = m2 / 4046.856;
    return { acres: +acres.toFixed(3), cents: +(acres * 100).toFixed(1), ha: +(m2 / 10000).toFixed(4) };
  } catch { return null; }
}

function coordsToGeoJSON(coords: LatLngTuple[]): string {
  const ring = [...coords.map(([lat, lng]) => [lng, lat]), [coords[0][1], coords[0][0]]];
  return JSON.stringify({ type: "Polygon", coordinates: [ring] });
}

/** Convert metres to lat/lng offsets at a given latitude. */
function metresToLatLng(lat: number, lengthM: number, widthM: number) {
  const latDeg = lengthM / 111320;
  const lngDeg = widthM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { latDeg, lngDeg };
}

export function plotToCoordinates(plot: Plot): LatLngTuple[] | null {
  if (plot.boundary_geojson) {
    try {
      const gj = JSON.parse(plot.boundary_geojson);
      const ring: number[][] =
        gj.type === "Polygon" ? gj.coordinates[0]
        : gj.type === "Feature" ? gj.geometry?.coordinates?.[0] : null;
      if (ring && ring.length >= 3)
        return ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as LatLngTuple);
    } catch { /* */ }
  }
  if (plot.latitude != null && plot.longitude != null) {
    const d = 0.0003;
    const { latitude: lat, longitude: lng } = plot;
    return [[lat-d,lng-d],[lat-d,lng+d],[lat+d,lng+d],[lat+d,lng-d]];
  }
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function FlyTo({ lat, lon, zoom = 15 }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lon], zoom, { duration: 1.2 }); }, [lat, lon, zoom, map]);
  return null;
}

function FitBounds({ plots }: { plots: MapPlot[] }) {
  const map = useMap();
  useEffect(() => {
    if (!plots.length) return;
    const all = plots.flatMap(p => p.coordinates);
    if (all.length < 1) return;
    try { map.fitBounds(all, { padding: [40, 40], maxZoom: 16 }); } catch { /* */ }
  }, [plots.length, map]);
  return null;
}

function DrawHandler({ active, onMapClick }: { active: boolean; onMapClick: (l: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = active ? "crosshair" : "";
    return () => { map.getContainer().style.cursor = ""; };
  }, [active, map]);
  useMapEvents({ click(e) { if (active) onMapClick(e.latlng); } });
  return null;
}

function GPSButton({ onLocated }: { onLocated: (lat: number, lng: number, acc: number) => void }) {
  const map = useMap();
  const [status, setStatus] = useState<"idle"|"locating"|"done"|"error">("idle");
  const locate = useCallback(() => {
    setStatus("locating");
    map.once("locationfound", (e: { latlng: LatLng; accuracy: number }) => {
      setStatus("done");
      onLocated(e.latlng.lat, e.latlng.lng, e.accuracy);
      map.flyTo(e.latlng, 16, { duration: 1 });
    });
    map.once("locationerror", () => setStatus("error"));
    map.locate({ enableHighAccuracy: true });
  }, [map, onLocated]);
  return (
    <button
      title="Go to my GPS location"
      onClick={locate}
      className={`absolute right-2 top-2 z-[1000] flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow transition
        ${status==="locating"?"border-amber-300 bg-amber-50 text-amber-700":
          status==="error"?"border-red-300 bg-red-50 text-red-700":
          "border-brand-200 bg-white text-brand-700 hover:bg-brand-50 dark:border-brand-700/50 dark:bg-[#1c2620] dark:text-brand-200"}`}
    >
      {status==="locating"?"⏳":"📍"} {status==="locating"?"Locating…":status==="error"?"GPS failed":"My location"}
    </button>
  );
}

function VertexMarker({ position, index, onDrag, onDelete }: {
  position: LatLng | LatLngTuple; index: number;
  onDrag: (i: number, l: LatLng) => void; onDelete: (i: number) => void;
}) {
  const latlng: LatLng = Array.isArray(position) ? L.latLng(position[0], position[1]) : position;
  const icon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:#fff;border:2px solid #22c55e;border-radius:50%;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14,14], iconAnchor: [7,7],
  });
  return (
    <Marker position={latlng} icon={icon} draggable
      eventHandlers={{ dragend(e) { onDrag(index, (e.target as LMarker).getLatLng()); } }}>
      <Popup>
        <button className="text-red-600 text-xs font-semibold hover:underline"
          onClick={() => onDelete(index)}>Remove point {index+1}</button>
      </Popup>
    </Marker>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const FarmMap = forwardRef<FarmMapHandle, Props>(function FarmMap({
  farms = [], onBoundarySaved, onPlotSelect, editPlotId = null,
  centerLat, centerLon, heightClass = "h-[500px]", onPlotWeatherClick,
}, ref) {
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [drawingPlotId, setDrawingPlotId] = useState<number | null>(editPlotId);
  const [drawingFarmId, setDrawingFarmId] = useState<number | null>(null);
  const [drawPoints, setDrawPoints] = useState<LatLng[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("freehand");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPoints, setEditPoints] = useState<LatLng[]>([]);
  const [gpsPos, setGpsPos] = useState<{lat:number;lng:number;accuracy:number}|null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Dimension mode inputs
  const [dimLength, setDimLength] = useState("50");
  const [dimWidth, setDimWidth] = useState("50");

  const plots: MapPlot[] = farms.flatMap((farm) =>
    farm.plots.map((p, i): MapPlot | null => {
      const coords = plotToCoordinates(p);
      if (!coords) return null;
      return { id: p.id, farmId: farm.id, name: `${farm.name} › ${p.name}`, crop: p.crop,
        coordinates: coords, color: COLORS[(farm.id*3+i)%COLORS.length], areaAcres: p.area_acres };
    }).filter(Boolean) as MapPlot[]
  );

  const firstWithCoords = farms.flatMap(f => f.plots).find(p => p.latitude != null);
  const defaultLat = centerLat ?? firstWithCoords?.latitude ?? 20.5937;
  const defaultLon = centerLon ?? firstWithCoords?.longitude ?? 78.9629;
  const defaultZoom = (firstWithCoords || centerLat) ? 14 : 5;

  const startDraw = useCallback((plotId: number, farmId: number) => {
    const existingPlot = farms.flatMap(f => f.plots).find(p => p.id === plotId);
    const existing = existingPlot ? plotToCoordinates(existingPlot) : null;
    if (existing && existing.length >= 3) {
      setEditPoints(existing.map(([lat,lng]) => L.latLng(lat,lng)));
      setIsEditing(true); setIsDrawing(false);
    } else {
      setDrawPoints([]); setIsDrawing(true); setIsEditing(false); setDrawMode("freehand");
    }
    setDrawingPlotId(plotId); setDrawingFarmId(farmId); setSaveError("");
  }, [farms]);

  const cancelDraw = useCallback(() => {
    setIsDrawing(false); setIsEditing(false); setDrawPoints([]); setEditPoints([]);
    setDrawingPlotId(null); setDrawingFarmId(null); setSaveError("");
  }, []);

  useImperativeHandle(ref, () => ({ startDraw, cancelDraw }), [startDraw, cancelDraw]);

  const handlePlotClick = useCallback((plotId: number) => {
    setSelectedPlotId(prev => {
      const next = prev === plotId ? null : plotId;
      onPlotSelect?.(next);
      return next;
    });
  }, [onPlotSelect]);

  const handleMapClick = useCallback((latlng: LatLng) => {
    if (!isDrawing) return;
    if (drawMode === "freehand") {
      setDrawPoints(prev => [...prev, latlng]);
    } else if (drawMode === "rectangle") {
      if (drawPoints.length === 0) {
        setDrawPoints([latlng]);
      } else if (drawPoints.length === 1) {
        // Second corner → build rectangle
        const [c1] = drawPoints;
        setDrawPoints([
          c1,
          L.latLng(c1.lat, latlng.lng),
          latlng,
          L.latLng(latlng.lat, c1.lng),
        ]);
      }
    } else if (drawMode === "dimensions") {
      // Click = centre → build rectangle from entered length × width
      const lenM = Number(dimLength); const widM = Number(dimWidth);
      if (!lenM || !widM || lenM <= 0 || widM <= 0) return;
      const { latDeg, lngDeg } = metresToLatLng(latlng.lat, lenM, widM);
      setDrawPoints([
        L.latLng(latlng.lat - latDeg/2, latlng.lng - lngDeg/2),
        L.latLng(latlng.lat - latDeg/2, latlng.lng + lngDeg/2),
        L.latLng(latlng.lat + latDeg/2, latlng.lng + lngDeg/2),
        L.latLng(latlng.lat + latDeg/2, latlng.lng - lngDeg/2),
      ]);
    }
  }, [isDrawing, drawMode, drawPoints, dimLength, dimWidth]);

  const activeCoords: LatLngTuple[] = isDrawing
    ? drawPoints.map(p => [p.lat, p.lng])
    : isEditing ? editPoints.map(p => [p.lat, p.lng]) : [];
  const areaPreview = activeCoords.length >= 3 ? calcArea(activeCoords) : null;

  const saveBoundary = useCallback(async () => {
    const coords = activeCoords;
    if (coords.length < 3 || !drawingPlotId || !drawingFarmId) return;
    const ai = calcArea(coords);
    if (!ai) { setSaveError("Could not calculate area."); return; }
    setSaving(true); setSaveError("");
    try {
      await onBoundarySaved?.(drawingPlotId, drawingFarmId, {
        geojson: coordsToGeoJSON(coords), coordinates: coords,
        areaAcres: ai.acres, areaCents: ai.cents, areaHa: ai.ha,
      });
      cancelDraw();
    } catch { setSaveError("Could not save boundary."); }
    finally { setSaving(false); }
  }, [activeCoords, drawingPlotId, drawingFarmId, onBoundarySaved, cancelDraw]);

  const handleVertexDrag = useCallback((i: number, latlng: LatLng) => {
    setEditPoints(prev => prev.map((p, idx) => idx === i ? latlng : p));
  }, []);
  const handleVertexDelete = useCallback((i: number) => {
    setEditPoints(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  return (
    <div className={`relative ${heightClass} w-full overflow-hidden rounded-xl border border-brand-100 shadow-sm dark:border-brand-800/40`}>
      <MapContainer center={[defaultLat, defaultLon]} zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }} className="z-0" zoomControl={true}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="🛰️ Satellite">
            <TileLayer url={TILES.satellite.url} attribution={TILES.satellite.attribution} maxZoom={TILES.satellite.maxZoom} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🗺️ Street">
            <TileLayer url={TILES.street.url} attribution={TILES.street.attribution} maxZoom={TILES.street.maxZoom} />
          </LayersControl.BaseLayer>
        </LayersControl>

        {plots.length > 0 && !centerLat && <FitBounds plots={plots} />}
        {centerLat != null && centerLon != null && <FlyTo lat={centerLat} lon={centerLon} />}

        {/* Saved plot polygons */}
        {plots.map(plot => (
          plot.id !== drawingPlotId && (
            <Polygon key={plot.id} positions={plot.coordinates}
              pathOptions={{ color: plot.color, fillColor: plot.color,
                fillOpacity: selectedPlotId === plot.id ? 0.5 : 0.25,
                weight: selectedPlotId === plot.id ? 3 : 2 }}
              eventHandlers={{ click: () => handlePlotClick(plot.id) }}>
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-semibold text-brand-800">{plot.name}</p>
                  {plot.crop && <p className="text-brand-600">Crop: {plot.crop}</p>}
                  {plot.areaAcres != null && (
                    <p className="text-brand-500 text-xs">{plot.areaAcres} ac · {(plot.areaAcres*100).toFixed(1)} cents · {(plot.areaAcres*0.4047).toFixed(3)} ha</p>
                  )}
                  {onPlotWeatherClick && (() => {
                    const farm = farms.find(f => f.id === plot.farmId);
                    const p = farm?.plots.find(pp => pp.id === plot.id);
                    return farm && p ? (
                      <button className="mt-1 text-xs text-brand-600 underline"
                        onClick={() => onPlotWeatherClick(p, farm)}>🌦️ View weather</button>
                    ) : null;
                  })()}
                </div>
              </Popup>
            </Polygon>
          )
        ))}

        {/* Active draw polygon */}
        {isDrawing && drawPoints.length >= 2 && (
          <Polygon positions={drawPoints.map(p => [p.lat, p.lng] as LatLngTuple)}
            pathOptions={{ color: "#f59e0b", fillOpacity: 0.15, dashArray: "6 4", weight: 2 }} />
        )}
        {isDrawing && drawPoints.map((p, i) => (
          <CircleMarker key={i} center={[p.lat, p.lng]} radius={5}
            pathOptions={{ color: "#f59e0b", fillColor: "#fff", fillOpacity: 1, weight: 2 }}>
            <Popup>Point {i+1}</Popup>
          </CircleMarker>
        ))}

        {/* Active edit polygon + draggable vertices */}
        {isEditing && editPoints.length >= 3 && (
          <Polygon positions={editPoints.map(p => [p.lat, p.lng] as LatLngTuple)}
            pathOptions={{ color: "#f59e0b", fillOpacity: 0.2, dashArray: "4 3", weight: 2.5 }} />
        )}
        {isEditing && editPoints.map((p, i) => (
          <VertexMarker key={i} position={p} index={i} onDrag={handleVertexDrag} onDelete={handleVertexDelete} />
        ))}

        {/* GPS marker */}
        {gpsPos && (
          <>
            <CircleMarker center={[gpsPos.lat, gpsPos.lng]} radius={8}
              pathOptions={{ color: "#3b82f6", fillColor: "#93c5fd", fillOpacity: 0.6, weight: 2 }}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">GPS location</p>
                  <p className="text-brand-600">Accuracy: ±{Math.round(gpsPos.accuracy)} m</p>
                  <p className="text-amber-700 mt-1">⚠️ Consumer GPS is not a legal land survey.</p>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        <DrawHandler active={isDrawing} onMapClick={handleMapClick} />
        <GPSButton onLocated={(lat,lng,acc) => setGpsPos({lat,lng,accuracy:acc})} />
      </MapContainer>

      {/* Draw mode toolbar */}
      {isDrawing && (
        <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1.5 rounded-xl border border-brand-200 bg-white/95 p-2 shadow-lg dark:border-brand-700/50 dark:bg-[#1c2620]/95">
          <div className="flex gap-1">
            <button className={`rounded-lg px-2 py-1 text-xs font-semibold ${drawMode==="freehand"?"bg-brand-600 text-white":"bg-brand-50 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200"}`}
              onClick={() => { setDrawMode("freehand"); setDrawPoints([]); }}>✏️ Freehand</button>
            <button className={`rounded-lg px-2 py-1 text-xs font-semibold ${drawMode==="rectangle"?"bg-brand-600 text-white":"bg-brand-50 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200"}`}
              onClick={() => { setDrawMode("rectangle"); setDrawPoints([]); }}>▭ Rectangle</button>
            <button className={`rounded-lg px-2 py-1 text-xs font-semibold ${drawMode==="dimensions"?"bg-brand-600 text-white":"bg-brand-50 text-brand-700 dark:bg-brand-800/40 dark:text-brand-200"}`}
              onClick={() => { setDrawMode("dimensions"); setDrawPoints([]); }}>📐 By size</button>
          </div>
          {drawMode === "dimensions" && (
            <div className="flex items-center gap-1 text-xs">
              <input type="number" className="w-14 rounded border border-brand-200 px-1 py-0.5 dark:border-brand-700/50 dark:bg-[#141c17] dark:text-brand-100"
                value={dimLength} onChange={e => setDimLength(e.target.value)} placeholder="m" />
              <span className="text-brand-500">×</span>
              <input type="number" className="w-14 rounded border border-brand-200 px-1 py-0.5 dark:border-brand-700/50 dark:bg-[#141c17] dark:text-brand-100"
                value={dimWidth} onChange={e => setDimWidth(e.target.value)} placeholder="m" />
              <span className="text-brand-400">m → click map</span>
            </div>
          )}
          <p className="text-[10px] text-brand-500 dark:text-brand-400">
            {drawMode === "freehand" ? "Click points on map to draw" :
             drawMode === "rectangle" ? "Click 2 corners on map" :
             "Enter size, then click centre on map"}
          </p>
        </div>
      )}

      {/* Save/Cancel toolbar */}
      {(isDrawing || isEditing) && (
        <div className="absolute bottom-2 left-1/2 z-[1000] -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-white/95 px-4 py-2 shadow-lg dark:border-brand-700/50 dark:bg-[#1c2620]/95">
          {areaPreview ? (
            <span className="font-semibold text-brand-700 dark:text-brand-200 text-xs">
              📐 {areaPreview.acres} ac · {areaPreview.cents} cents · {areaPreview.ha} ha
            </span>
          ) : (
            <span className="text-brand-500 dark:text-brand-400 text-xs">
              {isDrawing ? `${drawPoints.length} pts` : "Drag vertices to edit"}
            </span>
          )}
          {isDrawing && (
            <button className="btn-secondary py-0.5 px-2 text-xs" disabled={drawPoints.length===0}
              onClick={() => setDrawPoints(prev => prev.slice(0,-1))}>↩ Undo</button>
          )}
          {isEditing && editPoints.length >= 3 && (
            <button className="btn-secondary py-0.5 px-2 text-xs"
              onClick={() => { setIsEditing(false); setIsDrawing(true); setDrawPoints([]); setDrawMode("freehand"); }}>🔄 Redraw</button>
          )}
          <button className="btn-primary py-0.5 px-3 text-xs"
            disabled={(isDrawing ? drawPoints.length < 3 : editPoints.length < 3) || saving}
            onClick={saveBoundary}>{saving ? "Saving…" : "✅ Save"}</button>
          <button className="btn-secondary py-0.5 px-2 text-xs text-red-600" onClick={cancelDraw}>✕ Cancel</button>
        </div>
      )}

      {saveError && (
        <div className="absolute bottom-16 left-2 right-2 z-[1000] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>
      )}
      {gpsPos && (
        <div className="absolute bottom-2 right-2 z-[1000] max-w-[180px] rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
          GPS ±{Math.round(gpsPos.accuracy)} m. Not a legal survey.
        </div>
      )}
    </div>
  );
});

export default FarmMap;
