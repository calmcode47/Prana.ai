import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAqiSurface, fetchSensorThings, fetchHotspots, fetchMeteorology, fetchBiomassEmissions,
  BiomassEmissionsResponse, MeteorologyResponse, SurfaceGridResponse, SensorThingsResponse, HotspotsResponse,
  getAqiCategoryAndColor,
} from '../api/client';

export const AirCorridorMapPage: React.FC = () => {
  const [trajectoryHours, setTrajectoryHours] = useState<number>(28);
  const [selectedNode, setSelectedNode] = useState<'origin' | 'transit' | 'sink'>('sink');
  const [layers, setLayers] = useState({
    plume: true,
    streamlines: true,
    cpcbBams: true,
    viirsFRP: true,
  });

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [sensorThingsData, setSensorThingsData] = useState<SensorThingsResponse | null>(null);
  const [hotspotsData, setHotspotsData] = useState<HotspotsResponse | null>(null);
  const [meteorologyData, setMeteorologyData] = useState<MeteorologyResponse | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);

  useEffect(() => {
    fetchAqiSurface(0.5).then(setSurfaceData).catch(() => {});
    fetchSensorThings().then(setSensorThingsData).catch(() => {});
    fetchHotspots(24, 'nominal').then(setHotspotsData).catch(() => {});
    fetchMeteorology().then(setMeteorologyData).catch(() => {});
    fetchBiomassEmissions(7).then(setBiomassData).catch(() => {});
  }, []);

  const punjabMeteo = meteorologyData?.regions.punjab;
  const delhiMeteo = meteorologyData?.regions.delhi;
  const punjabBiomass = biomassData?.regions.find((item) => item.region === 'Punjab');
  const totalFrp = biomassData?.regions.reduce((sum, item) => sum + item.frp_sum_mw, 0);
  const delhiSurface = surfaceData?.features.reduce((closest, feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const [closestLon, closestLat] = closest.geometry.coordinates;
    return Math.hypot(lon - 77.2, lat - 28.6) < Math.hypot(closestLon - 77.2, closestLat - 28.6)
      ? feature : closest;
  }, surfaceData.features[0]);

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="w-full px-gutter-desktop pt-6 pb-20 relative">
        {/* Top Context Bar */}
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-6">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-label-md font-label-md text-ink-black border border-ink-black/20">
              <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
              NORTHERN RECEPTOR ADVECTION MESH
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-vanilla text-label-md font-label-md text-ink-muted shadow-[1px_1px_0px_#18181B]">
              <span>Inflow Corridor:</span>
              <span className="text-cobalt-deep font-bold">Punjab-Haryana-Delhi Vector</span>
            </span>
          </div>

          {/* Quick Route Switches */}
          <div className="flex items-center gap-space-sm">
            <Link
              to="/operations-war-room"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-vanilla hover:bg-surface-vanilla-strong shadow-[2px_2px_0px_#18181B] border border-ink-black text-label-lg font-label-lg text-ink-black transition-transform hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[16px]">dashboard</span>
              <span>Operations War Room</span>
            </Link>
            <Link
              to="/72h-plume-forecast"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-cobalt-deep text-on-primary shadow-[3px_3px_0px_#18181B] text-label-lg font-label-lg transition-transform hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[16px]">timeline</span>
              <span>72h Plume Explorer</span>
            </Link>
          </div>
        </div>

        {/* Page Title & Badges */}
        <div className="relative mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-label-md text-label-md uppercase tracking-wider text-cobalt-deep font-bold mb-1">
              <span>Geospatial Spatial Intelligence</span>
              <span>✦</span>
              <span>Transboundary Advection Vector</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-ink-black tracking-tight">
              Air Corridor Kinematic Trajectory Canvas
            </h1>
            <p className="font-body-md text-body-md text-ink-muted mt-1 max-w-2xl">
              High-resolution synoptic tracking across the 320km agricultural-urban plume transit funnel. Visualizing Gaussian plume dispersion and thermal subsidence traps.
            </p>
          </div>

          {/* Quirky Starburst Badge */}
          <div className="self-start md:self-auto rotate-[3deg] hover:rotate-0 transition-transform">
            <div className="relative bg-ink-black text-canvas-cream px-5 py-3 rounded-2xl shadow-[4px_4px_0px_#1D4ED8] flex items-center gap-3 border border-cobalt-deep">
              <span className="material-symbols-outlined text-coral-watermelon-vivid text-[22px]">radar</span>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md uppercase text-secondary-container font-bold">
                  Air Corridor 04
                </span>
                <span className="font-title-sm text-title-sm text-canvas-cream font-bold tracking-tight leading-none">
                  Active Inflow Influx
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Bleed Map Canvas */}
        <div className="w-full bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black mb-8 relative overflow-hidden flex flex-col gap-space-md">
          {/* Layer Bar & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm relative z-10 pb-space-sm border-b border-ink-black/10">
            <div className="flex items-center flex-wrap gap-space-xs">
              <button
                onClick={() => toggleLayer('plume')}
                className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                  layers.plume ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {layers.plume ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                72h Advection Ribbon
              </button>
              <button
                onClick={() => toggleLayer('streamlines')}
                className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                  layers.streamlines ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {layers.streamlines ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                NW Wind Streamlines
              </button>
              <button
                onClick={() => toggleLayer('viirsFRP')}
                className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                  layers.viirsFRP ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {layers.viirsFRP ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                VIIRS Active Fire FRP
              </button>
              <button
                onClick={() => toggleLayer('cpcbBams')}
                className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                  layers.cpcbBams ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {layers.cpcbBams ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                CAAQMS Stations Grid
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-aqi-hazardous text-canvas-cream font-label-md text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                Receptor: AQI 387
              </span>
            </div>
          </div>

          {/* Interactive Atmospheric Canvas */}
          <div className="w-full h-[520px] bg-canvas-cream rounded-xl relative overflow-hidden shadow-inner p-space-lg flex flex-col justify-between border border-ink-black/20 select-none">
            {/* Background Map Streamlines SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" preserveAspectRatio="none" viewBox="0 0 1000 520">
              <defs>
                <linearGradient id="corridorPlume" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#FF5376" stopOpacity="0.65" />
                  <stop offset="85%" stopColor="#7C2D12" stopOpacity="0.95" />
                </linearGradient>
                <pattern height="24" id="corridorGrid" patternUnits="userSpaceOnUse" width="24">
                  <circle cx="2" cy="2" fill="#E4E1E6" r="1.5" />
                </pattern>
              </defs>
              <rect fill="url(#corridorGrid)" height="520" width="1000" />

              {/* Plume Ribbon */}
              {layers.plume && (
                <>
                  <path
                    className="blur-md"
                    d="M 140,110 Q 380,140 520,260 T 840,410"
                    fill="none"
                    opacity="0.5"
                    stroke="url(#corridorPlume)"
                    strokeLinecap="round"
                    strokeWidth="56"
                  />
                  <path
                    d="M 160,100 C 280,150 420,200 540,290 S 740,370 860,420"
                    fill="none"
                    opacity="0.85"
                    stroke="#EA580C"
                    strokeDasharray="6 4"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 110,130 C 240,180 390,240 510,320 S 710,390 820,440"
                    fill="none"
                    opacity="0.75"
                    stroke="#FF5376"
                    strokeDasharray="5 5"
                    strokeWidth="2.5"
                  />
                </>
              )}

              {/* Wind Streamlines */}
              {layers.streamlines && (
                <g opacity="0.65" stroke="#1D4ED8" strokeWidth="2">
                  <path d="M260,80 L310,110 M295,98 L310,110 L293,114" />
                  <path d="M420,170 L470,205 M455,190 L470,205 L453,209" />
                  <path d="M580,270 L630,310 M615,295 L630,310 L613,314" />
                  <path d="M720,350 L770,390 M755,375 L770,390 L753,394" />
                </g>
              )}

              {/* Dynamic Animated Particle Head */}
              <circle
                cx={150 + (trajectoryHours / 72) * 690}
                cy={110 + (trajectoryHours / 72) * 300}
                fill="#1D4ED8"
                r="8"
                stroke="#FFFFFF"
                strokeWidth="3"
                className="shadow-md"
              />
            </svg>

            {/* Nodes on Map */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4">
              {/* Origin Basin */}
              <div
                onClick={() => setSelectedNode('origin')}
                className={`p-space-sm rounded-xl cursor-pointer transition-all max-w-[240px] shadow-[3px_3px_0px_#18181B] border-2 border-ink-black ${
                  selectedNode === 'origin' ? 'bg-surface-vanilla ring-2 ring-terracotta-deep' : 'bg-surface-vanilla/90'
                }`}
              >
                <div className="flex items-center gap-1.5 text-terracotta-deep font-label-md text-label-md uppercase font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-terracotta-deep animate-ping"></span>
                  01. Upwind Origin
                </div>
                <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Punjab Malwa Basin</div>
                <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">Sangrur, Barnala, Tarn Taran</p>
                <div className="mt-2 text-label-md font-bold text-terracotta-deep">
                  {totalFrp == null ? 'FRP unavailable' : `${totalFrp.toFixed(1)} MW Total FRP Recorded`}
                </div>
              </div>

              {/* Transit Channel */}
              <div
                onClick={() => setSelectedNode('transit')}
                className={`p-space-sm rounded-xl cursor-pointer transition-all max-w-[240px] self-center shadow-[3px_3px_0px_#18181B] border-2 border-ink-black ${
                  selectedNode === 'transit' ? 'bg-surface-vanilla ring-2 ring-cobalt-deep' : 'bg-surface-vanilla/90'
                }`}
              >
                <div className="flex items-center gap-1.5 text-cobalt-deep font-label-md text-label-md uppercase font-bold">
                  <span className="material-symbols-outlined text-[16px]">navigation</span>
                  02. Transit Corridor
                </div>
                <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Karnal-Panipat Corridor</div>
                <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">Secondary aerosol conversion</p>
                <div className="mt-2 text-label-md font-bold text-cobalt-deep">
                  Wind: {punjabMeteo ? `${punjabMeteo.wind_speed_ms.toFixed(1)} m/s at ${punjabMeteo.wind.direction_from_deg.toFixed(0)}°` : 'Unavailable'}
                </div>
              </div>

              {/* Receptor Sink */}
              <div
                onClick={() => setSelectedNode('sink')}
                className={`p-space-sm rounded-xl cursor-pointer transition-all max-w-[240px] self-end shadow-[3px_3px_0px_#18181B] border-2 border-ink-black ${
                  selectedNode === 'sink' ? 'bg-surface-vanilla ring-2 ring-coral-watermelon-vivid' : 'bg-surface-vanilla/90'
                }`}
              >
                <div className="flex items-center gap-1.5 text-coral-watermelon-vivid font-label-md text-label-md uppercase font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid animate-pulse"></span>
                  03. Terminal Inversion Trap
                </div>
                <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Delhi NCR Basin</div>
                <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">Anand Vihar, ITO, IGI Trap</p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aqi-hazardous text-on-tertiary text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                  AQI {delhiSurface?.properties.aqi_index ?? 'N/A'} • {delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m Mixing Layer` : 'Layer unavailable'}
                </div>
              </div>
            </div>

            {/* Bottom Scrubber Strip */}
            <div className="relative z-10 w-full bg-surface-vanilla-strong rounded-xl p-space-sm shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col gap-2">
              <div className="flex items-center justify-between text-body-sm font-semibold">
                <span className="text-ink-black font-label-md text-label-md uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-cobalt-deep">timeline</span>
                  Forward Trajectory Transit Scrubber
                </span>
                <span className="font-label-lg text-label-lg text-cobalt-deep font-bold">
                  T + {trajectoryHours.toFixed(1)} Hours Forward
                </span>
              </div>
              <input
                className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-cobalt-deep"
                max={72}
                min={0}
                type="range"
                value={trajectoryHours}
                onChange={(e) => setTrajectoryHours(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-label-md text-ink-muted font-bold">
                <span>T+0h Origin (Punjab)</span>
                <span>T+24h Transit (Haryana)</span>
                <span>T+48h Terminal Inversion (NCR)</span>
                <span>T+72h Dispersal Washout</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Corridor Node Detail Ledger */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-terracotta-deep font-bold uppercase">Source Zone</span>
              <span className="w-3 h-3 rounded-full bg-terracotta-deep"></span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Punjab Biomass Ignition</h3>
            <p className="font-body-sm text-body-sm text-ink-muted mt-1 leading-relaxed">
              VIIRS observations currently record {totalFrp == null ? 'no available' : `${totalFrp.toFixed(1)} MW of`} fire radiative power across the stored corridor feed.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Emission Rate:</span>
              <span className="text-terracotta-deep">{punjabBiomass?.estimated_aerosol_kg_s == null ? 'Coefficient not configured' : `${punjabBiomass.estimated_aerosol_kg_s.toFixed(2)} kg/s`}</span>
            </div>
          </div>

          <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-cobalt-deep font-bold uppercase">Transit Channel</span>
              <span className="w-3 h-3 rounded-full bg-cobalt-deep"></span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Karnal-Panipat Advection</h3>
            <p className="font-body-sm text-body-sm text-ink-muted mt-1 leading-relaxed">
              Open-Meteo supplies the current wind vector used by the backend forecast for the Punjab-to-NCR corridor.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Advection Velocity:</span>
              <span className="text-cobalt-deep">{punjabMeteo ? `${punjabMeteo.wind_speed_ms.toFixed(2)} m/s from ${punjabMeteo.wind.direction_from_deg.toFixed(0)}°` : 'Unavailable'}</span>
            </div>
          </div>

          <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-coral-watermelon-vivid font-bold uppercase">Receptor Trap</span>
              <span className="w-3 h-3 rounded-full bg-coral-watermelon-vivid"></span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Delhi NCR Inversion Trap</h3>
            <p className="font-body-sm text-body-sm text-ink-muted mt-1 leading-relaxed">
              The live boundary-layer height is available. A vertical temperature profile is still required to measure inversion depth.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Inversion Severity:</span>
              <span className="text-aqi-hazardous font-extrabold">{meteorologyData?.inversion.status === 'not_measured' ? 'Not measured' : meteorologyData?.inversion.status ?? 'Unavailable'}</span>
            </div>
          </div>
        </div>

        {/* AQI GP Surface Grid — backend/routers/aqi.py: GET /api/v1/aqi/surface */}
        <div className="mt-space-xl">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <div className="flex items-center gap-2 font-label-md text-label-md uppercase tracking-wider text-cobalt-deep font-bold mb-1">
                <span className="material-symbols-outlined text-[14px]">grain</span>
                AQI Surface &bull; {surfaceData?.source ?? 'Loading source'}
              </div>
              <h2 className="font-headline-sm text-headline-sm text-ink-black font-bold">AQI Surface Grid PM2.5 Field</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-surface-vanilla border border-ink-black shadow-[2px_2px_0px_#18181B] font-label-md text-label-md font-bold">
              {surfaceData ? `${surfaceData.features.length} Grid Points · ±${surfaceData.resolution_deg}°` : 'Loading...'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(surfaceData?.features ?? []).map((feature, idx) => {
              const p = feature.properties;
              const { category, color } = getAqiCategoryAndColor(p.aqi_index);
              const coords = feature.geometry.coordinates;
              return (
                <div
                  key={idx}
                  className="bg-surface-vanilla rounded-2xl p-space-md border-2 border-ink-black shadow-[3px_3px_0px_#18181B] flex flex-col gap-2 hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md text-ink-muted font-bold uppercase text-[10px]">
                      {coords[1].toFixed(1)}°N {coords[0].toFixed(1)}°E
                    </span>
                    <span className="w-3 h-3 rounded-full border border-ink-black/20" style={{ backgroundColor: color }}></span>
                  </div>
                  <div className="font-telemetry-val text-[22px] font-bold leading-none" style={{ color }}>
                    {p.pm25_estimate.toFixed(0)}
                    <span className="font-body-sm text-[10px] text-ink-muted font-normal ml-0.5">µg/m³</span>
                  </div>
                  <div className="font-label-md text-label-md font-bold" style={{ color }}>AQI {p.aqi_index}</div>
                  <div className="font-body-sm text-body-sm text-ink-muted">{category}</div>
                  {p.uncertainty_std != null && (
                    <div className="text-[10px] text-ink-muted font-mono">±{p.uncertainty_std.toFixed(1)} σ</div>
                  )}
                </div>
              );
            })}
          </div>
          {surfaceData && (
            <p className="mt-3 font-body-sm text-body-sm text-ink-muted">
              Source: {surfaceData.source} &bull; Computed: {new Date(surfaceData.computed_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* OGC SensorThings Corridor Nodes + Hotspot Summary — backend/routers/sensorthings.py */}
        <div className="mt-space-xl grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          {/* SensorThings Nodes */}
          <div className="bg-surface-vanilla rounded-2xl p-space-lg border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-space-md">
              <div>
                <div className="font-label-md text-label-md uppercase tracking-wider text-forest-jade font-bold mb-1">OGC SensorThings API</div>
                <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">PRANA Corridor Nodes</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-forest-jade/10 text-forest-jade font-label-md text-label-md font-bold">
                {sensorThingsData ? `${sensorThingsData['@iot.count']} Nodes` : '...'}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {(sensorThingsData?.value ?? []).map((node) => {
                const coords = node.Locations?.[0]?.location?.coordinates ?? [0, 0];
                const isPunjab = node.properties?.state === 'Punjab';
                return (
                  <div
                    key={node['@iot.id']}
                    className={`p-space-md rounded-xl border-2 shadow-[2px_2px_0px_#18181B] ${
                      isPunjab ? 'border-terracotta-deep/40 bg-terracotta-deep/5' : 'border-cobalt-deep/40 bg-cobalt-deep/5'
                    }`}
                  >
                    <div className={`flex items-center gap-2 font-label-md text-label-md font-bold uppercase mb-1 ${
                      isPunjab ? 'text-terracotta-deep' : 'text-cobalt-deep'
                    }`}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: isPunjab ? '#EA580C' : '#1D4ED8' }}></span>
                      {node.properties?.node_type?.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="font-headline-sm text-headline-sm text-ink-black font-bold">{node.name}</div>
                    <p className="font-body-sm text-body-sm text-ink-muted mt-1">{node.description}</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-ink-muted">
                      <span className="material-symbols-outlined text-[13px]">location_on</span>
                      {coords[1].toFixed(3)}°N, {coords[0].toFixed(3)}°E
                    </div>
                    <div className="mt-1 font-label-md text-label-md text-ink-muted">ID: {node['@iot.id']}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VIIRS Fire Hotspot Summary */}
          <div className="bg-surface-vanilla rounded-2xl p-space-lg border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-space-md">
              <div>
                <div className="font-label-md text-label-md uppercase tracking-wider text-terracotta-deep font-bold mb-1">NASA FIRMS &bull; VIIRS 375m</div>
                <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Active Fire Hotspots</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-terracotta-deep/10 text-terracotta-deep font-label-md text-label-md font-bold">
                {hotspotsData ? `${hotspotsData.count.toLocaleString()} Clusters` : '...'}
              </span>
            </div>
            {hotspotsData ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-canvas-cream rounded-xl p-3 border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                    <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Total Clusters</div>
                    <div className="font-telemetry-val text-[24px] font-bold text-terracotta-deep leading-none mt-1">{hotspotsData.count}</div>
                  </div>
                  <div className="bg-canvas-cream rounded-xl p-3 border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                    <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Source</div>
                    <div className="font-title-sm text-title-sm font-bold text-ink-black mt-1 text-[11px]">NASA FIRMS VIIRS SNPP NRT</div>
                  </div>
                  <div className="bg-canvas-cream rounded-xl p-3 border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                    <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Bbox</div>
                    <div className="font-mono text-[10px] font-bold text-cobalt-deep mt-1">Punjab Malwa Grid</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {hotspotsData.features.slice(0, 4).map((f, idx) => (
                    <div key={idx} className="p-2.5 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[1px_1px_0px_#18181B] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-terracotta-deep"></span>
                        <span className="font-label-md text-label-md text-ink-black font-bold">
                          {f.properties.sensor} &bull; {new Date(f.properties.acq_datetime).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-label-md text-label-md text-ink-muted">
                        {f.properties.frp != null && <span className="font-bold text-terracotta-deep">{f.properties.frp.toFixed(0)} MW FRP</span>}
                        <span>{f.properties.confidence}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-ink-muted font-body-sm">Loading VIIRS data...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
