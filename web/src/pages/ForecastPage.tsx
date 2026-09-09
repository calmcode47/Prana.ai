import React, { useState, useEffect } from 'react';
import {
  BiomassEmissionsResponse,
  FireAqiLagResponse,
  MeteorologyResponse,
  PlumeResponse,
  SurfaceGridResponse,
  createIncident,
  fetchAqiSurface,
  fetchBiomassEmissions,
  fetchFireAqiLag,
  fetchForecastPlume,
  fetchMeteorology,
  formatDataSource,
  getAqiCategoryAndColor,
  queueLegalDispatch,
} from '../api/client';
import { LeafletMap } from '../components/map/LeafletMap';

const formatWindDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
};

export const ForecastPage: React.FC = () => {
  const [selectedHorizon, setSelectedHorizon] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentHour, setCurrentHour] = useState<number>(0);
  const [mandateTriggered, setMandateTriggered] = useState<boolean>(false);
  const [geoJsonExported, setGeoJsonExported] = useState<boolean>(false);
  const [plumeData, setPlumeData] = useState<PlumeResponse | null>(null);
  const [lagData, setLagData] = useState<FireAqiLagResponse | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [meteorologyData, setMeteorologyData] = useState<MeteorologyResponse | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'vector'>('map');

  // Fetch real plume data from backend (GET /api/v1/forecast/plume)
  useEffect(() => {
    document.title = '72h Plume Forecast — PRANA Air Quality Platform';
    fetchForecastPlume().then(setPlumeData).catch(() => {});
    fetchFireAqiLag(7).then(setLagData).catch(() => {});
    fetchBiomassEmissions(7).then(setBiomassData).catch(() => {});
    fetchAqiSurface().then(setSurfaceData).catch(() => {});
    fetchMeteorology().then(setMeteorologyData).catch(() => {});
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentHour((prev) => (prev >= 72 ? 0 : prev + 1));
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const hour = Math.round(Math.max(0, Math.min(72, pos * 72)));
    setCurrentHour(hour);
  };

  const scrubberPercent = ((currentHour / 72) * 100).toFixed(1);
  const selectedPlume = plumeData?.features.reduce((closest, feature) =>
    Math.abs(feature.properties.horizon_hours - currentHour) < Math.abs(closest.properties.horizon_hours - currentHour)
      ? feature : closest
  , plumeData.features[0]);
  const strongestLag = lagData?.strongest_lag;
  const totalFrp = biomassData?.regions.reduce((sum, region) => sum + region.frp_sum_mw, 0) ?? null;
  const hotspotCount = biomassData?.regions.reduce((sum, region) => sum + region.hotspot_count, 0) ?? null;
  const closestSurface = (longitude: number, latitude: number) => surfaceData?.features.reduce((closest, feature) => {
    const [featureLongitude, featureLatitude] = feature.geometry.coordinates;
    const distance = ((featureLongitude - longitude) ** 2) + ((featureLatitude - latitude) ** 2);
    if (!closest) return feature;
    const [closestLongitude, closestLatitude] = closest.geometry.coordinates;
    const closestDistance = ((closestLongitude - longitude) ** 2) + ((closestLatitude - latitude) ** 2);
    return distance < closestDistance ? feature : closest;
  }, undefined as SurfaceGridResponse['features'][number] | undefined);
  const transitSurface = closestSurface(76.96, 29.39);
  const delhiSurface = closestSurface(77.21, 28.61);
  const delhiMeteo = meteorologyData?.regions.delhi;
  const receptorRows = [...(surfaceData?.features ?? [])]
    .sort((a, b) => b.properties.aqi_index - a.properties.aqi_index)
    .slice(0, 4)
    .map((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const { category } = getAqiCategoryAndColor(feature.properties.aqi_index);
      return {
        ward: `CAMS Grid ${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`,
        severity: `${category} • AQI ${feature.properties.aqi_index}`,
        arrival: selectedPlume ? `T+${selectedPlume.properties.horizon_hours}h` : 'No active plume',
        actions: [`PM2.5 ${feature.properties.pm25_estimate.toFixed(1)} µg/m³`],
        color: feature.properties.aqi_index > 300 ? 'bg-coral-watermelon-vivid' : feature.properties.aqi_index > 200 ? 'bg-terracotta-deep' : 'bg-cobalt-deep',
        barWidth: `${Math.min(100, feature.properties.aqi_index / 5)}%`,
        key: `${longitude}-${latitude}-${index}`,
      };
    });
  const correlationPoints = (lagData?.correlations ?? []).map((item) => ({
    cx: 40 + (item.lag_hours / 72) * 300,
    cy: 75 - item.pearson_r * 60,
    r: 4,
  }));
  const correlationPath = correlationPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.cx},${point.cy}`).join(' ');
  const plumeCoordinates = selectedPlume?.geometry.coordinates[0] ?? [];
  const plumeLongitudes = plumeCoordinates.map(([longitude]) => longitude);
  const plumeLatitudes = plumeCoordinates.map(([, latitude]) => latitude);
  const minPlumeLongitude = plumeLongitudes.length ? Math.min(...plumeLongitudes) : 0;
  const maxPlumeLongitude = plumeLongitudes.length ? Math.max(...plumeLongitudes) : 0;
  const minPlumeLatitude = plumeLatitudes.length ? Math.min(...plumeLatitudes) : 0;
  const maxPlumeLatitude = plumeLatitudes.length ? Math.max(...plumeLatitudes) : 0;
  const selectedPlumePath = plumeCoordinates.map(([longitude, latitude], index) => {
    const x = 120 + ((longitude - minPlumeLongitude) / Math.max(maxPlumeLongitude - minPlumeLongitude, 0.0001)) * 760;
    const y = 70 + ((maxPlumeLatitude - latitude) / Math.max(maxPlumeLatitude - minPlumeLatitude, 0.0001)) * 330;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + (plumeCoordinates.length ? ' Z' : '');

  const mapPlumes = (plumeData?.features || []).map((f) => ({
    clusterId: f.properties.cluster_id,
    horizonHours: f.properties.horizon_hours,
    coordinates: (f.geometry.coordinates[0] || []) as [number, number][],
    avgPm25: f.properties.max_pm25_est,
    label: `${f.properties.horizon_hours}h Forecast Plume Envelope`,
  }));

  const mapSurfacePoints = (surfaceData?.features || []).map((f) => ({
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    pm25: f.properties.pm25_estimate,
    aqi: f.properties.aqi_index,
  }));

  const handleGeoJsonExport = () => {
    if (!plumeData) return;
    const blob = new Blob([JSON.stringify(plumeData, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prana-plume-${new Date(plumeData.computed_at).toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setGeoJsonExported(true);
    setTimeout(() => setGeoJsonExported(false), 2400);
  };

  const handleMandateQueue = async () => {
    if (!selectedPlume) return;
    const severity = selectedPlume.properties.max_aqi_est > 400
      ? 'emergency'
      : selectedPlume.properties.max_aqi_est > 300 ? 'warning' : 'watch';
    const incident = await createIncident({
      severity,
      location_text: `Forecast plume ${selectedPlume.properties.cluster_id} at T+${selectedPlume.properties.horizon_hours}h`,
      pollutant: 'PM2.5',
      measured_pm25: selectedPlume.properties.max_pm25_est,
      satellite_source: plumeData?.source,
      authority: 'Inter-State Emergency Review',
    });
    await queueLegalDispatch({
      incident_id: incident.incident_id,
      recipient_kind: 'spcb',
      recipient_reference: 'Punjab, Haryana, and Delhi SPCB review queue',
    });
    setMandateTriggered(true);
    setTimeout(() => setMandateTriggered(false), 2600);
  };

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="w-full px-gutter-desktop pt-6 pb-20 relative">
        {/* Editorial Header Badge Deck */}
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-6">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-label-md font-label-md text-ink-black border border-ink-black/20">
              <span className="w-2 h-2 rounded-full bg-coral-watermelon-vivid"></span>
              {formatDataSource(plumeData?.source, 'Loading forecast model')}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-vanilla text-label-md font-label-md text-ink-muted shadow-[1px_1px_0px_#18181B]">
              <span>Boundary Layer Dynamic:</span>
              <span className="text-terracotta-deep font-bold">{delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m AGL` : 'Unavailable'}</span>
            </span>
          </div>

          {/* Quick Horizon Segmented Controls */}
          <div className="inline-flex p-1 rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] border border-ink-black/30 items-center gap-1" id="horizon-selector">
            {[
              { hour: 0, label: 'Now (T+0h)' },
              { hour: 24, label: '+24h Forecast' },
              { hour: 48, label: '+48h Forecast' },
              { hour: 72, label: '+72h Forecast' },
            ].map((item) => (
              <button
                key={item.hour}
                onClick={() => {
                  setSelectedHorizon(item.hour);
                  setCurrentHour(item.hour);
                }}
                className={`px-3.5 py-1.5 rounded-full text-label-md font-label-md transition-all cursor-pointer ${
                  selectedHorizon === item.hour
                    ? 'bg-ink-black text-canvas-cream shadow-[1px_1px_0px_#18181B] font-bold'
                    : 'text-ink-muted hover:text-ink-black'
                }`}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Action Cluster */}
          <div className="flex items-center gap-space-sm">
            <button
              onClick={handleGeoJsonExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-vanilla hover:bg-surface-vanilla-strong shadow-[2px_2px_0px_#18181B] border border-ink-black text-label-lg font-label-lg text-ink-black transition-transform hover:-translate-y-0.5 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">polyline</span>
              <span>{geoJsonExported ? 'GeoJSON Exported!' : 'Export GeoJSON Polygon Envelopes'}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
            <button
              onClick={handleMandateQueue}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-coral-watermelon-vivid hover:opacity-90 shadow-[3px_3px_0px_#18181B] text-label-lg font-label-lg text-on-secondary transition-transform hover:-translate-y-0.5 cursor-pointer font-bold"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>{mandateTriggered ? 'Inter-State Review Queued' : 'Queue Inter-State Emergency Review'}</span>
            </button>
          </div>
        </div>

        {/* Main Headline with Starburst Aesthetic Sticker */}
        <div className="relative mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-label-md text-label-md uppercase tracking-wider text-cobalt-deep font-bold mb-1">
              <span>Atmospheric Advection Suite</span>
              <span>✦</span>
              <span>Transboundary Agro-Fire Trajectory</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-ink-black tracking-tight">
              72-Hour Plume Dispersion Trajectory Explorer
            </h1>
            <p className="font-body-md text-body-md text-ink-muted mt-1 max-w-2xl">
              {plumeData?.features.length
                ? `Displaying ${plumeData.features.length} backend plume envelopes across the Punjab–Delhi corridor.`
                : 'No active plume envelopes are available from the current fire and meteorology feeds.'}
            </p>
          </div>

          {/* Starburst Sticker Badge */}
          <div className="self-start md:self-auto rotate-[-4deg] hover:rotate-0 transition-transform">
            <div className="relative bg-ink-black text-canvas-cream px-5 py-3 rounded-2xl shadow-[4px_4px_0px_#FF5376] flex items-center gap-3 border border-coral-watermelon-vivid">
              <div className="w-7 h-7 rounded-full bg-coral-watermelon-vivid flex items-center justify-center text-on-secondary font-bold text-[12px]">
                72h
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md uppercase text-secondary-container font-bold">
                  Dispersion Risk
                </span>
                <span className="font-title-sm text-title-sm text-canvas-cream font-bold tracking-tight leading-none">
                  {meteorologyData?.inversion.status === 'measured' ? 'Inversion Measured' : 'Inversion Not Measured'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 500px Hero Gaussian Plume Dispersion Canvas & Audio Scrubber Controller */}
        <div className="w-full bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black mb-8 relative overflow-hidden">
          {/* Top Canvas Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-ink-black/10">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-terracotta-deep animate-ping"></span>
              <span className="font-title-md text-title-md text-ink-black font-bold">
                Kinematic Trajectory Visualizer
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-vanilla-strong font-label-md text-label-md text-ink-muted shadow-[1px_1px_0px_#18181B]">
                {formatDataSource(plumeData?.source, 'Forecast source unavailable')}
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-ink-black overflow-hidden shadow-[1px_1px_0px_#18181B]">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 text-xs font-bold ${
                  viewMode === 'map'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-vanilla text-ink-black hover:bg-surface-vanilla-strong'
                }`}
              >
                GIS Map Overlay
              </button>
              <button
                onClick={() => setViewMode('vector')}
                className={`px-3 py-1 text-xs font-bold ${
                  viewMode === 'vector'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-vanilla text-ink-black hover:bg-surface-vanilla-strong'
                }`}
              >
                Kinematic Vector
              </button>
            </div>

            {/* Mixing Layer & Boundary Metric Dual-Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-full bg-canvas-cream px-3 py-1 shadow-[2px_2px_0px_#18181B] border border-ink-black text-label-md font-label-md">
                <span className="text-ink-muted mr-1.5">Mixing Layer Depth:</span>
                <span className="text-terracotta-deep font-bold">{selectedPlume?.properties.mixing_height_m == null ? 'No active plume' : `${selectedPlume.properties.mixing_height_m}m AGL`}</span>
                <span className="ml-1 text-ink-muted italic">(Backend forecast input)</span>
              </div>
              <div className="flex items-center rounded-full bg-canvas-cream px-3 py-1 shadow-[2px_2px_0px_#18181B] border border-ink-black text-label-md font-label-md">
                <span className="text-ink-muted mr-1.5">Wind Speed &amp; Vector:</span>
                <span className="text-cobalt-deep font-bold">{selectedPlume?.properties.wind_speed_ms == null ? 'No forecast wind' : `${selectedPlume.properties.wind_speed_ms.toFixed(1)} m/s${selectedPlume.properties.wind_dir_deg == null ? '' : ` (${selectedPlume.properties.wind_dir_deg}° ${formatWindDirection(selectedPlume.properties.wind_dir_deg)})`}`}</span>
              </div>
            </div>
          </div>

          {/* Interactive Plume Canvas Screen or GIS Map */}
          {viewMode === 'map' ? (
            <div className="relative w-full h-[460px] rounded-xl overflow-hidden shadow-[2px_2px_0px_#18181B] border border-ink-black">
              <LeafletMap
                height={460}
                plumes={mapPlumes}
                surfacePoints={mapSurfacePoints}
                showPlumes={true}
                showSurface={true}
                showStations={false}
                showHotspots={false}
              />
              <div className="absolute bottom-3 left-3 z-[400] bg-surface-vanilla/90 backdrop-blur-md p-2 rounded border border-ink-black text-xs font-bold">
                Plume Polygons: 24h (Orange), 48h (Pink), 72h (Hazardous Deep Red)
              </div>
            </div>
          ) : (
          <div className="relative w-full h-[460px] rounded-xl bg-canvas-cream overflow-hidden shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col justify-between p-6 select-none">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern height="40" id="grid-pattern" patternUnits="userSpaceOnUse" width="40">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#52525B" strokeDasharray="2,3" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect fill="url(#grid-pattern)" height="100%" width="100%" />
              </svg>
            </div>

            {/* Stylized Gaussian Plume Gradient Map Visualization */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <svg className="w-full h-full" fill="none" viewBox="0 0 1000 460" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient cx="180" cy="110" gradientUnits="userSpaceOnUse" id="sangrurOrigin" r="140">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#FF5376" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#FF5376" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient cx="800" cy="330" gradientUnits="userSpaceOnUse" id="basinAccumulation" r="220">
                    <stop offset="0%" stopColor="#7C2D12" stopOpacity="0.88" />
                    <stop offset="40%" stopColor="#EA580C" stopOpacity="0.7" />
                    <stop offset="80%" stopColor="#F97316" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                  </radialGradient>
                  <filter height="140%" id="plumeSoft" width="140%" x="-20%" y="-20%">
                    <feGaussianBlur result="blur" stdDeviation="12" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Dispersion Envelopes */}
                {selectedPlumePath && <>
                <path
                  className="animate-dash-flow"
                  d={selectedPlumePath}
                  fill="#F97316"
                  fillOpacity="0.22"
                  id="contour-outer"
                  stroke="#EA580C"
                  strokeDasharray="5,4"
                  strokeWidth="1.5"
                />
                <path
                  d={selectedPlumePath}
                  fill="#FF5376"
                  fillOpacity="0.45"
                  id="contour-severe"
                  stroke="#FF5376"
                  strokeWidth="2"
                />
                <ellipse cx="785" cy="345" fill="url(#basinAccumulation)" filter="url(#plumeSoft)" id="contour-trap" rx="140" ry="85" />
                <circle cx="180" cy="110" fill="url(#sangrurOrigin)" filter="url(#plumeSoft)" r="55" />
                </>}

                {/* Wind Streamlines */}
                <g opacity="0.65" stroke="#18181B" strokeLinecap="round" strokeWidth="2">
                  <path className="animate-dash-flow" d="M 190 100 Q 320 130 450 185 T 720 310" fill="none" strokeDasharray="6,6" />
                  <path className="animate-dash-flow-fast" d="M 220 135 Q 360 180 520 230 T 780 340" fill="none" strokeDasharray="4,8" />
                  <path className="animate-dash-flow" d="M 160 120 Q 300 160 480 220 T 740 370" fill="none" strokeDasharray="8,6" />
                  <polygon fill="#18181B" points="455,188 443,180 447,192" />
                  <polygon fill="#18181B" points="725,312 713,305 717,317" />
                </g>

                {/* Geographic Landmark Anchor Pins */}
                <g transform="translate(180, 110)">
                  <circle fill="#EA580C" r="9" stroke="#18181B" strokeWidth="2" />
                  <circle fill="#FAF6EE" r="3" />
                  <text fill="#18181B" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" x="14" y="4">
                    Punjab Source ({totalFrp == null ? 'FRP feed unavailable' : `FRP ${totalFrp.toFixed(1)}MW`})
                  </text>
                  <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="14" y="18">
                    Current Hotspots: {hotspotCount ?? 'Feed unavailable'}
                  </text>
                </g>

                <g transform="translate(470, 195)">
                  <circle fill="#F59E0B" r="7" stroke="#18181B" strokeWidth="2" />
                  <circle fill="#18181B" r="2.5" />
                  <text fill="#18181B" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" x="12" y="3">
                    Panipat / Karnal Flank
                  </text>
                  <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="12" y="16">
                    Transit Surface: {transitSurface ? `${transitSurface.properties.pm25_estimate.toFixed(1)} µg/m³` : 'Model point unavailable'}
                  </text>
                </g>

                <g transform="translate(780, 335)">
                  <circle fill="#7C2D12" r="11" stroke="#18181B" strokeWidth="2.5" />
                  <circle fill="#FF5376" r="4" />
                  <text fill="#7C2D12" fontFamily="Plus Jakarta Sans" fontSize="13" fontWeight="800" x="-120" y="-18">
                    DELHI RECEPTOR BASIN
                  </text>
                  <text fill="#18181B" fontFamily="Plus Jakarta Sans" fontSize="11" fontWeight="600" x="-120" y="-4">
                    Boundary Layer: {delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m` : 'Weather unavailable'} • Wind {delhiMeteo ? `${delhiMeteo.wind_speed_ms.toFixed(1)} m/s` : 'Weather unavailable'}
                  </text>
                </g>

                {/* Dynamic Trajectory Particle Indicator */}
                {selectedPlume && <g
                  className="transition-all duration-300 ease-out"
                  transform={`translate(${180 + (currentHour / 72) * 600}, ${110 + (currentHour / 72) * 225})`}
                >
                  <circle
                    className="animate-ping"
                    r="12"
                    fill="#1D4ED8"
                    opacity="0.35"
                  />
                  <circle
                    className="shadow-sm"
                    fill="#1D4ED8"
                    id="particle-head"
                    r="7"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                </g>}
              </svg>
            </div>

            {/* Top Left Mini Floating Card: Dispersion Model Parameters */}
            <div className="relative z-10 self-start bg-canvas-cream/90 backdrop-blur-md p-3 rounded-xl shadow-[2px_2px_0px_#18181B] border border-ink-black max-w-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-label-md text-label-md text-ink-black uppercase font-bold">
                  Gaussian Dispersion Dynamics
                </span>
                <span className="w-2 h-2 rounded-full bg-coral-watermelon-vivid"></span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-body-sm font-body-sm">
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Pasquill-Gifford Class</span>
                  <span className="font-bold text-ink-black">{selectedPlume ? `T+${selectedPlume.properties.horizon_hours}h envelope` : 'No active envelope'}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase font-bold">Vertical Eddy Diff.</span>
                  <span className="font-bold text-ink-black">{plumeData ? `${plumeData.features.length} backend envelope${plumeData.features.length === 1 ? '' : 's'}` : 'Unavailable'}</span>
                </div>
              </div>
            </div>

            {/* Plume Legend */}
            <div className="relative z-10 self-end bg-canvas-cream/95 p-3 rounded-xl shadow-[2px_2px_0px_#18181B] border border-ink-black flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-aqi-unhealthy"></span>
                <span className="font-label-md text-label-md text-ink-black font-semibold">Outer envelope</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-coral-watermelon-vivid"></span>
                <span className="font-label-md text-label-md text-ink-black font-semibold">Modeled envelope</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-aqi-hazardous"></span>
                <span className="font-label-md text-label-md text-ink-black font-semibold">Peak model zone</span>
              </div>
            </div>
          </div>
        )}

          {/* Time-Lapse Audio Scrubber & Trajectory Playback Strip */}
          <div className="mt-4 bg-canvas-cream rounded-xl p-4 shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Play / Pause & Skip Audio-Style Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentHour((prev) => Math.max(0, prev - 10))}
                className="w-9 h-9 rounded-full bg-surface-vanilla hover:bg-surface-vanilla-strong shadow-[1.5px_1.5px_0px_#18181B] border border-ink-black flex items-center justify-center text-ink-black transition-transform active:translate-y-0.5 cursor-pointer"
                type="button"
                aria-label="Step back 10 hours"
              >
                <span className="material-symbols-outlined text-[18px]">replay_10</span>
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-11 h-11 rounded-full bg-ink-black text-canvas-cream shadow-[2px_2px_0px_#1D4ED8] hover:bg-cobalt-deep flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                type="button"
                aria-label="Play / Pause simulation"
              >
                <span className="material-symbols-outlined text-[24px]">
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <button
                onClick={() => setCurrentHour((prev) => Math.min(72, prev + 10))}
                className="w-9 h-9 rounded-full bg-surface-vanilla hover:bg-surface-vanilla-strong shadow-[1.5px_1.5px_0px_#18181B] border border-ink-black flex items-center justify-center text-ink-black transition-transform active:translate-y-0.5 cursor-pointer"
                type="button"
                aria-label="Step forward 10 hours"
              >
                <span className="material-symbols-outlined text-[18px]">forward_10</span>
              </button>
              <div className="flex flex-col ml-2">
                <span className="font-headline-sm text-headline-sm text-ink-black leading-tight">Advection Stream</span>
                <span className="font-label-md text-label-md text-ink-muted font-bold">Sangrur-Panipat-Delhi Vector</span>
              </div>
            </div>

            {/* Scrubber Bar with Tactile Watermelon Handle */}
            <div className="flex-1 w-full max-w-xl flex items-center gap-3">
              <span className="font-telemetry-val text-body-sm font-bold text-ink-black min-w-[70px]">
                Hour {currentHour} / 72
              </span>
              <div
                className="relative w-full flex items-center py-2 cursor-pointer"
                onClick={handleScrubberClick}
              >
                {/* Background Track */}
                <div className="w-full h-2 rounded-full bg-surface-vanilla-strong overflow-hidden relative shadow-inner border border-ink-black/20">
                  {/* Active Progress Track */}
                  <div className="h-full bg-ink-black rounded-full" style={{ width: `${scrubberPercent}%` }}></div>
                </div>
                {/* Tactile Scrubber Thumb */}
                <div
                  className="absolute w-5 h-5 rounded-full bg-coral-watermelon-vivid shadow-[2px_2px_0px_#18181B] border border-ink-black -ml-2.5 transition-transform hover:scale-125"
                  style={{ left: `${scrubberPercent}%` }}
                >
                  <div className="w-1.5 h-1.5 bg-canvas-cream rounded-full absolute inset-0 m-auto"></div>
                </div>
              </div>
              <span className="font-label-md text-label-md text-ink-muted font-bold">T+72h Max</span>
            </div>

            {/* Metric Readout at Cursor */}
            <div className="flex items-center gap-2 pl-2">
              <div className="px-3 py-1.5 rounded-full bg-surface-vanilla text-right border border-ink-black/30 shadow-[1px_1px_0px_#18181B]">
                <span className="block text-[10px] font-bold text-ink-muted uppercase">Terminal Peak Plume</span>
                <span className="font-telemetry-val text-telemetry-val text-terracotta-deep font-black">{selectedPlume ? `${selectedPlume.properties.max_pm25_est.toFixed(1)} µg/m³` : delhiSurface ? `${delhiSurface.properties.pm25_estimate.toFixed(1)} µg/m³` : 'Model estimate unavailable'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Split Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Left Column (5 Cols): 30-Day Transit Correlation Scatter */}
          <div className="lg:col-span-5 bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <span className="font-label-md text-label-md uppercase text-cobalt-deep font-bold tracking-wider">
                    Atmospheric Regression
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-ink-black mt-0.5">
                    7-Day Transit Correlation &amp; Lag Scatter
                  </h2>
                </div>
                <span className="w-7 h-7 rounded-full bg-canvas-cream shadow-[1px_1px_0px_#18181B] border border-ink-black flex items-center justify-center text-ink-black">
                  <span className="material-symbols-outlined text-[16px]">show_chart</span>
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-ink-muted mb-4">
                {lagData?.method ?? 'Loading empirical fire and air-quality lag analysis.'}
              </p>

              {/* Core Statistical Badges */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-canvas-cream p-3 rounded-xl shadow-[2px_2px_0px_#18181B] border border-ink-black">
                  <span className="block font-label-md text-label-md text-ink-muted font-bold">Pearson r</span>
                  <span className="font-telemetry-val text-telemetry-val text-cobalt-deep">{strongestLag?.pearson_r.toFixed(3) ?? 'N/A'}</span>
                  <span className="block text-[10px] text-forest-jade font-bold">{lagData?.status === 'computed' ? 'Computed' : 'Insufficient data'}</span>
                </div>
                <div className="bg-canvas-cream p-3 rounded-xl shadow-[2px_2px_0px_#18181B] border border-ink-black">
                  <span className="block font-label-md text-label-md text-ink-muted font-bold">Transit Delay</span>
                  <span className="font-telemetry-val text-telemetry-val text-ink-black">{strongestLag ? `${strongestLag.lag_hours}h` : 'Insufficient history'}</span>
                  <span className="block text-[10px] text-ink-muted font-bold">Strongest measured lag</span>
                </div>
                <div className="bg-canvas-cream p-3 rounded-xl shadow-[2px_2px_0px_#18181B] border border-ink-black">
                  <span className="block font-label-md text-label-md text-ink-muted font-bold">Total FRP</span>
                  <span className="font-telemetry-val text-telemetry-val text-terracotta-deep">{totalFrp == null ? 'Feed unavailable' : totalFrp.toFixed(1)}</span>
                  <span className="block text-[10px] text-ink-muted font-bold">Megawatts Flux</span>
                </div>
              </div>

              {/* Scatter Plot Visualization */}
              <div className="w-full h-64 bg-canvas-cream rounded-xl p-3 shadow-[2px_2px_0px_#18181B] border border-ink-black relative flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-ink-muted px-1">
                  <span>Pearson correlation by candidate lag hour</span>
                  <span className="text-cobalt-deep font-bold">{strongestLag ? `R² = ${(strongestLag.pearson_r ** 2).toFixed(3)}` : 'R² requires paired historical observations'}</span>
                </div>
                <svg className="w-full h-44 overflow-visible" viewBox="0 0 360 160">
                  <line stroke="#EFE9DA" strokeWidth="1" x1="40" x2="340" y1="20" y2="20" />
                  <line stroke="#EFE9DA" strokeWidth="1" x1="40" x2="340" y1="55" y2="55" />
                  <line stroke="#EFE9DA" strokeWidth="1" x1="40" x2="340" y1="90" y2="90" />
                  <line stroke="#EFE9DA" strokeWidth="1" x1="40" x2="340" y1="125" y2="125" />
                  <line stroke="#18181B" strokeWidth="1.5" x1="40" x2="340" y1="140" y2="140" />
                  <line stroke="#18181B" strokeWidth="1.5" x1="40" x2="40" y1="10" y2="140" />

                  {/* Measured correlation series */}
                  {lagData?.status === 'computed' && correlationPath && (
                    <path d={correlationPath} fill="none" stroke="#1D4ED8" strokeDasharray="4 2" strokeWidth="2" />
                  )}

                  {/* Scatter Data Points */}
                  {correlationPoints.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.cx}
                      cy={pt.cy}
                      r={pt.r}
                      fill="#FF5376"
                      stroke="#18181B"
                      strokeWidth="1.5"
                    />
                  ))}
                </svg>
                <div className="flex justify-between text-[10px] text-ink-muted font-bold px-4">
                  <span>0h</span>
                  <span>24h</span>
                  <span>48h</span>
                  <span>72h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Downwind Municipal Ward Vulnerability Matrix */}
          <div className="lg:col-span-7 bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-ink-black/10">
                <div>
                  <span className="font-label-md text-label-md uppercase text-terracotta-deep font-bold tracking-wider">
                    Targeted Receptor Vulnerability
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-ink-black mt-0.5">
                    Downwind Municipal Ward Vulnerability Matrix
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-surface-vanilla-strong font-label-md text-label-md text-ink-black font-bold shadow-[1px_1px_0px_#18181B]">
                  {formatDataSource(surfaceData?.source, 'AQI surface unavailable')}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {receptorRows.map((item) => (
                  <div
                    key={item.key}
                    className="p-3.5 rounded-xl bg-canvas-cream border border-ink-black/20 shadow-[2px_2px_0px_#18181B] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-title-sm text-title-sm text-ink-black font-bold">{item.ward}</span>
                      <span className="text-label-md font-bold text-ink-muted">Inflow Arrival: {item.arrival}</span>
                    </div>
                    {/* Severity bar */}
                    <div className="w-full bg-surface-vanilla h-2 rounded-full overflow-hidden border border-ink-black/20">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: item.barWidth }}></div>
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-ink-muted font-semibold">{item.severity}</span>
                      <div className="flex items-center gap-1.5">
                        {item.actions.map((act, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-surface-vanilla text-ink-black text-[11px] font-bold border border-ink-black/30"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {surfaceData && receptorRows.length === 0 && (
                  <div className="p-3.5 rounded-xl bg-canvas-cream border border-ink-black/20 shadow-[2px_2px_0px_#18181B] text-body-sm text-ink-muted">
                    No live model surface points are available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gaussian Plume Model Output — backend/routers/forecast.py: GET /api/v1/forecast/plume */}
      <div className="w-full px-gutter-desktop pb-space-2xl">
        <div className="w-full bg-surface-vanilla rounded-2xl p-space-xl border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-lg">
            <div>
              <div className="flex items-center gap-2 font-label-md text-label-md uppercase tracking-wider text-cobalt-deep font-bold mb-1">
                <span className="material-symbols-outlined text-[16px]">air</span>
                <span>{formatDataSource(plumeData?.source, 'Loading forecast source')}</span>
                <span className="px-2 py-0.5 rounded-full bg-cobalt-deep/10 text-cobalt-deep text-label-md font-bold">
                  {plumeData ? `${plumeData.features.length} Horizon Envelopes` : 'Loading...'}
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-ink-black font-bold">
                Gaussian Plume Model Output
              </h2>
              <p className="font-body-sm text-body-sm text-ink-muted mt-1">
                Source: {formatDataSource(plumeData?.source, 'Forecast unavailable')} &bull; Computed: {plumeData ? new Date(plumeData.computed_at).toLocaleString() : 'Pending'}
              </p>
            </div>
            <div className="bg-ink-black text-canvas-cream px-4 py-2 rounded-xl rotate-2 shadow-[3px_3px_0px_#1D4ED8] flex items-center gap-2 flex-shrink-0">
              <span className="material-symbols-outlined text-cobalt-deep text-[18px]">track_changes</span>
              <span className="font-label-md text-label-md uppercase font-bold">72h Model Outlook</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {(plumeData?.features ?? []).map((feature, idx) => {
              const p = feature.properties;
              const horizonColors = ['text-cobalt-deep', 'text-terracotta-deep', 'text-coral-watermelon-vivid'];
              const bgColors = ['bg-cobalt-deep/10', 'bg-terracotta-deep/10', 'bg-coral-watermelon-vivid/10'];
              const borderColors = ['border-cobalt-deep/30', 'border-terracotta-deep/30', 'border-coral-watermelon-vivid/30'];
              const shadowColors = ['shadow-[3px_3px_0px_#1D4ED8]', 'shadow-[3px_3px_0px_#EA580C]', 'shadow-[3px_3px_0px_#FF5376]'];
              const color = horizonColors[idx % 3];
              const bg = bgColors[idx % 3];
              const border = borderColors[idx % 3];
              const shadow = shadowColors[idx % 3];
              return (
                <div
                  key={idx}
                  className={`p-space-md rounded-2xl border-2 ${border} ${bg} ${shadow} flex flex-col gap-3 hover:-translate-y-0.5 transition-transform`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-label-lg text-label-lg font-bold uppercase ${color}`}>
                      T+{p.horizon_hours}h Horizon
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                      {p.cluster_id}
                    </span>
                  </div>

                  {/* Primary Metric */}
                  <div className="bg-surface-vanilla rounded-xl p-3 border border-ink-black/10 shadow-[2px_2px_0px_#18181B]">
                    <div className="font-label-md text-label-md text-ink-muted uppercase font-bold">Peak PM2.5 Estimate</div>
                    <div className={`font-telemetry-val text-telemetry-val font-bold ${color} leading-none mt-1`}>
                      {p.max_pm25_est.toFixed(1)}
                      <span className="font-body-sm text-body-sm text-ink-muted font-normal ml-1">µg/m³</span>
                    </div>
                    <div className={`font-label-md text-label-md font-bold mt-1 ${color}`}>AQI {p.max_aqi_est}</div>
                  </div>

                  {/* Meteorological Parameters */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-vanilla rounded-xl p-2.5 border border-ink-black/10">
                      <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Wind Speed</div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold mt-0.5">
                        {p.wind_speed_ms != null ? `${p.wind_speed_ms.toFixed(1)} m/s` : 'Weather unavailable'}
                      </div>
                    </div>
                    <div className="bg-surface-vanilla rounded-xl p-2.5 border border-ink-black/10">
                      <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Wind Dir</div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold mt-0.5">
                        {p.wind_dir_deg != null ? (
                          <>{p.wind_dir_deg}&deg; <span className="font-body-sm text-ink-muted font-normal">
                            ({formatWindDirection(p.wind_dir_deg)})
                          </span></>
                        ) : 'Weather unavailable'}
                      </div>
                    </div>
                    <div className="bg-surface-vanilla rounded-xl p-2.5 border border-ink-black/10 col-span-2">
                      <div className="font-label-md text-label-md text-ink-muted uppercase font-bold text-[10px]">Mixing Height</div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold mt-0.5">
                        {p.mixing_height_m != null ? (
                          <>{p.mixing_height_m}m <span className="font-body-sm text-ink-muted font-normal">AGL inversion lid</span></>
                        ) : 'Mixing height unavailable'}
                      </div>
                      <div className="mt-1.5 w-full bg-surface-vanilla-strong h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bg.replace('/10', '')}`}
                          style={{ width: `${Math.min(100, ((p.mixing_height_m ?? 0) / 600) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
