import React, { useState } from 'react';
import { LeafletMap } from '../map/LeafletMap';
import {
  HotspotsResponse,
  PlumeResponse,
  StationsResponse,
  SurfaceGridResponse,
  MeteorologyResponse,
} from '../../api/client';
import { Button } from '../ui/Button';

export interface WarRoomMapPanelProps {
  hotspotsData: HotspotsResponse | null;
  stationsData: StationsResponse | null;
  surfaceData: SurfaceGridResponse | null;
  forecastData: PlumeResponse | null;
  meteorologyData: MeteorologyResponse | null;
  trajectoryHours: number;
  setTrajectoryHours: React.Dispatch<React.SetStateAction<number>>;
  isSimulating: boolean;
  onSimulate: () => void;
  layers: {
    pm25: boolean;
    viirs: boolean;
    plume: boolean;
    wind: boolean;
  };
  onToggleLayer: (layer: 'pm25' | 'viirs' | 'plume' | 'wind') => void;
  selectedStationId?: string;
  onSelectStation?: (id: string) => void;
}

export const WarRoomMapPanel: React.FC<WarRoomMapPanelProps> = ({
  hotspotsData,
  stationsData,
  surfaceData,
  forecastData,
  meteorologyData,
  trajectoryHours,
  setTrajectoryHours,
  isSimulating,
  onSimulate,
  layers,
  onToggleLayer,
  selectedStationId,
  onSelectStation,
}) => {
  const [mapMode, setMapMode] = useState<'leaflet' | 'schematic'>('leaflet');

  // Convert stations for Leaflet
  const mapStations = (stationsData?.value || []).map((s) => {
    const coords = s.Locations?.[0]?.location?.coordinates;
    const lat = coords ? coords[1] : 28.6;
    const lon = coords ? coords[0] : 77.2;
    const obs = s.Datastreams?.[0]?.Observations?.[0];
    return {
      id: s['@iot.id'] || s.name,
      name: s.name,
      lat,
      lon,
      pm25: obs?.pm25_ugm3 ?? null,
      aqi: obs?.aqi_index ?? null,
      source: obs?.source || 'Source unavailable',
    };
  });

  // Convert hotspots
  const mapHotspots = (hotspotsData?.features || []).map((f) => ({
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    frp: f.properties.frp ?? undefined,
    confidence: f.properties.confidence,
    acq_date: f.properties.acq_datetime,
  }));

  // Convert surface points
  const mapSurfacePoints = (surfaceData?.features || []).map((f) => ({
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    pm25: f.properties.pm25_estimate,
    aqi: f.properties.aqi_index,
  }));

  // Convert plume features
  const mapPlumes = (forecastData?.features || []).map((f) => ({
    clusterId: f.properties.cluster_id,
    horizonHours: f.properties.horizon_hours,
    coordinates: (f.geometry.coordinates[0] || []) as [number, number][],
    avgPm25: f.properties.max_pm25_est,
    label: `${f.properties.horizon_hours}h Horizon Plume`,
  }));

  const punjabMeteo = meteorologyData?.regions.punjab;
  const delhiMeteo = meteorologyData?.regions.delhi;

  return (
    <div className="w-full bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[4px_4px_0px_#18181B] p-space-md flex flex-col gap-4">
      {/* Panel Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-terracotta-deep animate-pulse" />
          <h3 className="font-title-sm text-base font-bold text-ink-black">
            Indo-Gangetic Airshed Trajectory Map
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-vanilla-strong font-mono font-bold text-ink-muted">
            + {trajectoryHours}h Dispersion
          </span>
        </div>

        {/* View Toggle & Layer Checkboxes */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center rounded-lg border border-ink-black overflow-hidden shadow-[1px_1px_0px_#18181B]">
            <button
              onClick={() => setMapMode('leaflet')}
              className={`px-2.5 py-1 font-bold ${
                mapMode === 'leaflet'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-vanilla text-ink-black hover:bg-surface-vanilla-strong'
              }`}
            >
              GIS Satellite
            </button>
            <button
              onClick={() => setMapMode('schematic')}
              className={`px-2.5 py-1 font-bold ${
                mapMode === 'schematic'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-vanilla text-ink-black hover:bg-surface-vanilla-strong'
              }`}
            >
              Corridor Vector
            </button>
          </div>

          <div className="flex items-center gap-2 bg-surface-vanilla-strong/60 px-2 py-1 rounded-md border border-outline-variant/50">
            <label className="flex items-center gap-1 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={layers.pm25}
                onChange={() => onToggleLayer('pm25')}
                className="accent-primary"
              />
              AQI
            </label>
            <label className="flex items-center gap-1 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={layers.viirs}
                onChange={() => onToggleLayer('viirs')}
                className="accent-coral-watermelon-vivid"
              />
              VIIRS
            </label>
            <label className="flex items-center gap-1 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={layers.plume}
                onChange={() => onToggleLayer('plume')}
                className="accent-terracotta-deep"
              />
              Plume
            </label>
          </div>

          <Button
            size="sm"
            variant="outline"
            isLoading={isSimulating}
            onClick={onSimulate}
          >
            {isSimulating ? 'Simulating...' : 'Run 72h Dispersion'}
          </Button>
        </div>
      </div>

      {/* Map Body */}
      {mapMode === 'leaflet' ? (
        <div className="relative">
          <LeafletMap
            height={460}
            stations={mapStations}
            hotspots={mapHotspots}
            surfacePoints={mapSurfacePoints}
            plumes={mapPlumes}
            showStations={layers.pm25}
            showHotspots={layers.viirs}
            showSurface={layers.pm25}
            showPlumes={layers.plume}
            selectedStationId={selectedStationId}
            onSelectStation={onSelectStation}
          />

          {/* Floating Atmospheric Quick Stats */}
          <div className="absolute top-3 right-3 z-[400] bg-surface-vanilla/95 backdrop-blur-sm border border-ink-black p-2.5 rounded-lg shadow-[2px_2px_0px_#18181B] text-xs space-y-1.5 max-w-[200px]">
            <div className="font-bold text-ink-black border-b border-outline-variant/40 pb-1">
              Corridor Telemetry
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Active Fires:</span>
              <span className="font-bold text-terracotta-deep">{hotspotsData?.count ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Punjab Wind:</span>
              <span className="font-bold text-cobalt-deep">
                {punjabMeteo ? `${punjabMeteo.wind_speed_ms.toFixed(1)} m/s` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Delhi Inversion:</span>
              <span className="font-bold text-coral-watermelon-vivid">
                {delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m AGL` : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Schematic Corridor View */
        <div className="relative w-full h-[460px] bg-canvas-cream border-2 border-ink-black rounded-xl overflow-hidden shadow-[3px_3px_0px_#18181B] p-4 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="px-2 py-1 bg-terracotta-deep text-white rounded">
              01. Punjab Source Basin
            </span>
            <span className="px-2 py-1 bg-cobalt-deep text-white rounded">
              02. Haryana NH-44 Transit Belt
            </span>
            <span className="px-2 py-1 bg-coral-watermelon-vivid text-white rounded">
              03. Delhi NCR Receptor Basin
            </span>
          </div>

          <svg className="w-full h-64 my-auto" viewBox="0 0 800 240" fill="none">
            {/* Advection flow arc */}
            <path
              d="M 50 180 Q 400 40 750 160"
              stroke="#EA580C"
              strokeWidth="4"
              strokeDasharray="8 6"
              className="animate-dash-flow"
            />
            {/* Streamlines */}
            <path
              d="M 50 160 Q 400 20 750 140"
              stroke="#1D4ED8"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="animate-dash-flow-fast"
            />
            {/* Origin Node */}
            <circle cx="50" cy="180" r="16" fill="#EA580C" stroke="#18181B" strokeWidth="2" />
            <text x="50" y="215" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#18181B">
              Sangrur
            </text>
            {/* Transit Node */}
            <circle cx="400" cy="90" r="14" fill="#1D4ED8" stroke="#18181B" strokeWidth="2" />
            <text x="400" y="125" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#18181B">
              Panipat
            </text>
            {/* Receptor Node */}
            <circle cx="750" cy="160" r="20" fill="#FF5376" stroke="#18181B" strokeWidth="2" />
            <text x="750" y="200" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#18181B">
              Anand Vihar
            </text>
          </svg>

          <div className="text-center text-xs text-ink-muted">
            Vector corridor demonstrates 72-hour north-westerly smoke advection into the nocturnal boundary layer.
          </div>
        </div>
      )}

      {/* Trajectory Scrubber Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-outline-variant/60">
        <span className="text-xs font-bold text-ink-black">Forward Trajectory Horizon:</span>
        <div className="flex items-center gap-2 flex-1 max-w-md w-full">
          <span className="text-xs font-mono font-bold text-ink-muted">0h</span>
          <input
            type="range"
            min="0"
            max="72"
            step="6"
            value={trajectoryHours}
            onChange={(e) => setTrajectoryHours(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-ink-muted">72h</span>
        </div>
        <div className="flex items-center gap-1">
          {[0, 24, 48, 72].map((h) => (
            <button
              key={h}
              onClick={() => setTrajectoryHours(h)}
              className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${
                trajectoryHours === h
                  ? 'bg-ink-black text-white border-ink-black'
                  : 'bg-surface-vanilla text-ink-black border-outline-variant hover:bg-surface-vanilla-strong'
              }`}
            >
              +{h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
