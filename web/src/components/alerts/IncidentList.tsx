import React, { useState } from 'react';
import {
  AlertsResponse,
  HotspotsResponse,
  IncidentItem,
  formatDataSource,
} from '../../api/client';

interface IncidentListProps {
  alertsData: AlertsResponse | null;
  hotspotsData: HotspotsResponse | null;
  selectedIncident: string;
  onSelectIncident: (incidentId: string) => void;
  onLoadIntoDrafter: (item: IncidentItem) => void;
  filter: 'all' | 'emergency' | 'nighttime' | 'stubble';
  searchQuery: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  alertsData,
  hotspotsData,
  selectedIncident,
  onSelectIncident,
  onLoadIntoDrafter,
  filter,
  searchQuery,
  onRefresh,
  isRefreshing,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const allItems = alertsData?.items ?? [];
  const filteredItems = allItems.filter((item) => {
    if (filter === 'emergency' && item.severity !== 'emergency') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const loc = (item.location_text || '').toLowerCase();
      const id = item.incident_id.toLowerCase();
      const pollutant = (item.pollutant || '').toLowerCase();
      return loc.includes(q) || id.includes(q) || pollutant.includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const primaryAlert =
    allItems.find((item) => item.incident_id === selectedIncident) ?? allItems[0];
  const primaryHotspot = hotspotsData?.features[0];
  const latestFeedTime = primaryAlert?.created_at ?? hotspotsData?.fetched_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-headline-sm text-headline-sm font-serif italic text-ink-black">
            Autonomous Telemetry Feed
          </span>
          <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-[10px] uppercase font-bold">
            Live Intercept
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-body-sm text-body-sm text-ink-muted">
            {latestFeedTime ? `Updated ${new Date(latestFeedTime).toLocaleTimeString()}` : 'Awaiting backend feed'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-7 h-7 rounded-full bg-surface-vanilla border border-ink-black flex items-center justify-center text-ink-black shadow-[1px_1px_0px_#18181B] hover:bg-surface-vanilla-strong transition-all cursor-pointer disabled:opacity-50"
            title="Refresh incident feed"
          >
            <span className={`material-symbols-outlined text-[15px] ${isRefreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Live SPCB Incident Registry with Pagination */}
      <div className="bg-ink-black rounded-2xl p-space-md border-2 border-ink-black shadow-[4px_4px_0px_#1D4ED8] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-label-md text-label-md uppercase text-cobalt-deep font-bold">
              Live Registry &bull; GET /api/v1/alerts
            </div>
            <div className="font-headline-sm text-headline-sm text-canvas-cream font-bold mt-0.5">
              {alertsData ? `${filteredItems.length} Active Incident${filteredItems.length !== 1 ? 's' : ''}` : 'Loading backend...'}
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-coral-watermelon-vivid/20 text-coral-watermelon-vivid font-label-md text-label-md font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-coral-watermelon-vivid animate-pulse"></span>
            Live
          </span>
        </div>

        {pagedItems.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {pagedItems.map((item: IncidentItem) => {
              const isSelected = item.incident_id === selectedIncident;
              return (
                <div
                  key={item.incident_id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white/20 border-coral-watermelon-vivid shadow-[inset_2px_0px_0px_#FF5376]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => onSelectIncident(item.incident_id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.severity === 'emergency'
                          ? 'bg-coral-watermelon-vivid'
                          : item.severity === 'warning'
                            ? 'bg-terracotta-deep'
                            : 'bg-cobalt-deep'
                      }`}
                    ></span>
                    <span className="font-mono text-[11px] text-cobalt-deep font-bold">
                      {item.incident_id}
                    </span>
                    <span className="font-body-sm text-[11px] text-white/70">
                      {item.location_text || 'NCR Airshed Node'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.measured_pm25 != null && (
                      <span className="font-label-md text-label-md text-white/90 font-bold">
                        {item.measured_pm25.toFixed(0)} µg/m³
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded font-label-md text-[10px] font-bold uppercase ${
                        item.severity === 'emergency'
                          ? 'bg-coral-watermelon-vivid/20 text-coral-watermelon-vivid'
                          : item.severity === 'warning'
                            ? 'bg-terracotta-deep/20 text-terracotta-deep'
                            : 'bg-cobalt-deep/20 text-cobalt-deep'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : alertsData ? (
          <div className="text-white/50 font-body-sm text-body-sm py-2">
            No incidents found for the active filter criteria.
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full bg-cobalt-deep animate-ping"></span>
            <span className="text-white/50 font-body-sm">Connecting to SPCB-MESH-RT...</span>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-white/70 font-label-md text-xs">
            <span>
              Page {currentPage} of {totalPages} ({filteredItems.length} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer font-bold"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setCurrentPage(pg)}
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold cursor-pointer ${
                    currentPage === pg ? 'bg-coral-watermelon-vivid text-on-secondary' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {pg}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Incident Breach Alert Card */}
      {(filter === 'all' || filter === 'emergency') && primaryAlert && (
        <article className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col gap-5 hover:-translate-y-0.5 transition-transform duration-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-aqi-hazardous text-canvas-cream font-label-md text-label-md font-bold uppercase tracking-wider shadow-[1px_1px_0px_#18181B]">
                  Breach Alert
                </span>
                <span className="font-label-md text-label-md text-ink-muted font-bold">
                  {primaryAlert.incident_id}
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-body-sm text-body-sm text-ink-muted">
                  {primaryAlert.location_text || 'NCR Sensor Node'}
                </span>
              </div>
              <h2 className="font-title-md text-title-md text-ink-black font-sans font-bold flex items-center gap-2">
                {primaryAlert.location_text || primaryAlert.incident_id} ({primaryAlert.severity.toUpperCase()})
                <span className="material-symbols-outlined text-coral-watermelon-vivid text-[20px]">warning</span>
              </h2>
            </div>

            {/* Dual-Unit Telemetry Chip */}
            <div className="inline-flex items-center rounded-full bg-surface-container-lowest border-2 border-ink-black px-3 py-1 shadow-[2px_2px_0px_#18181B] self-start">
              <span className="font-telemetry-val text-telemetry-val text-terracotta-deep pr-2 font-bold">
                {primaryAlert.measured_pm25?.toFixed(1) ?? '—'}
              </span>
              <span className="font-telemetry-unit text-telemetry-unit text-ink-muted pr-3 border-r border-ink-black/30 font-semibold">
                µg/m³ PM2.5
              </span>
              <span className="font-telemetry-val text-telemetry-val text-ink-black pl-3 flex items-center gap-1 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-aqi-hazardous"></span>
                {primaryAlert.measured_aqi ?? '—'} <span className="font-telemetry-unit text-telemetry-unit text-ink-muted font-normal">AQI</span>
              </span>
            </div>
          </div>

          {/* Thermal Satellite & Trajectory Convergence */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Thermal Satellite Thumbnail */}
            <div className="md:col-span-5 rounded-2xl border border-ink-black bg-surface-container-lowest p-3 flex flex-col justify-between relative overflow-hidden shadow-[2px_2px_0px_#18181B]">
              <div className="flex items-center justify-between text-ink-muted font-label-md text-label-md mb-2">
                <span className="flex items-center gap-1 font-bold text-ink-black">
                  <span className="material-symbols-outlined text-[14px] text-terracotta-deep">satellite_alt</span>
                  {primaryHotspot?.properties.sensor ?? 'Thermal Feed'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-surface-vanilla text-ink-black font-bold">
                  {formatDataSource(hotspotsData?.source, 'Thermal feed unavailable')}
                </span>
              </div>

              <div className="w-full h-32 rounded-xl bg-ink-black relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-terracotta-deep/80 via-coral-watermelon-vivid/40 to-transparent"></div>
                <div className="absolute w-24 h-24 rounded-full bg-aqi-unhealthy/70 blur-xl top-4 left-6"></div>
                <div className="absolute w-12 h-12 rounded-full bg-coral-watermelon-vivid blur-md top-8 left-10 animate-pulse"></div>
                <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center text-canvas-cream font-mono text-[11px] leading-tight">
                  <span className="bg-ink-black/80 px-2 py-0.5 rounded border border-canvas-cream/20 mb-1 font-sans font-bold text-coral-watermelon-vivid">
                    {primaryHotspot ? `${primaryHotspot.properties.sensor} hotspot` : 'No current hotspot'}
                  </span>
                  <span>
                    {primaryHotspot
                      ? `${primaryHotspot.geometry.coordinates[1].toFixed(3)}°N, ${primaryHotspot.geometry.coordinates[0].toFixed(3)}°E`
                      : 'Coordinates unavailable'}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2 text-[9px] text-canvas-cream/70 font-label-md">
                  {primaryHotspot ? new Date(primaryHotspot.properties.acq_datetime).toLocaleTimeString() : 'Awaiting FIRMS feed'}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between font-label-md text-label-md text-ink-muted">
                <span>
                  FRP Radiative:{' '}
                  <strong className="text-ink-black">
                    {primaryHotspot
                      ? primaryHotspot.properties.frp == null
                        ? 'Not reported'
                        : `${primaryHotspot.properties.frp.toFixed(1)} MW`
                      : 'No detection'}
                  </strong>
                </span>
                <span className="text-coral-watermelon-vivid font-bold">
                  Conf: {primaryHotspot?.properties.confidence ?? '—'}
                </span>
              </div>
            </div>

            {/* Trajectory Convergence Card */}
            <div className="md:col-span-7 rounded-2xl border border-ink-black bg-surface-container-lowest p-4 flex flex-col justify-between shadow-[2px_2px_0px_#18181B]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-title-sm text-title-sm text-ink-black font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-cobalt-deep">near_me</span>
                  Trajectory Convergence
                </span>
                <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-bold">
                  {formatDataSource(primaryAlert.satellite_source, 'Source unavailable')}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-ink-muted">
                {`Backend incident reports ${primaryAlert.satellite_evidence?.fire_count_50km ?? 0} fires within 50 km${
                  primaryAlert.satellite_evidence?.nearest_fire_km == null
                    ? ''
                    : `; nearest fire ${primaryAlert.satellite_evidence.nearest_fire_km.toFixed(1)} km away`
                }.`}
              </p>

              <div className="mt-3 space-y-2">
                <div className="flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">
                    Satellite: {formatDataSource(primaryAlert.satellite_source, 'Active sensor')}
                  </span>
                  <span className="text-ink-black font-bold">
                    PM2.5: {primaryAlert.measured_pm25 == null ? 'Pending' : `${primaryAlert.measured_pm25.toFixed(1)} µg/m³`}
                  </span>
                </div>
                <div className="w-full h-3 bg-surface-vanilla rounded-full border border-ink-black overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-aqi-moderate via-aqi-unhealthy to-coral-watermelon-vivid rounded-full"
                    style={{ width: `${Math.min(100, (primaryAlert.measured_pm25 ?? 0) / 5)}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-ink-black/10 flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-ink-black font-medium">
                  Statutory PM2.5 threshold variance:{' '}
                  <strong className="text-coral-watermelon-vivid font-bold">
                    {primaryAlert.measured_pm25 == null
                      ? '—'
                      : `${(((primaryAlert.measured_pm25 - 60) / 60) * 100).toFixed(0)}%`}
                  </strong>
                </span>
                <span className="font-label-md text-label-md text-ink-muted uppercase tracking-wider font-bold">
                  {primaryAlert.severity}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Action Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 font-body-sm text-body-sm text-ink-muted">
              <span className="material-symbols-outlined text-[18px] text-forest-jade">shield</span>
              <span>
                Backend incident recorded at {new Date(primaryAlert.created_at).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={() => onLoadIntoDrafter(primaryAlert)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer font-bold"
              type="button"
            >
              <span>Load Into Notice Drafter</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </article>
      )}

      {/* Stubble Fire Hotspot Cluster Article */}
      {(filter === 'all' || filter === 'stubble') && (
        <article className="bg-surface-vanilla rounded-3xl p-5 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-aqi-unhealthy text-canvas-cream font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                Thermal Cluster
              </span>
              <span className="font-body-sm text-body-sm text-ink-muted font-bold">
                {formatDataSource(hotspotsData?.source, 'FIRMS feed unavailable')}
              </span>
            </div>
            <h3 className="font-title-sm text-title-sm text-ink-black font-sans font-bold">
              {hotspotsData ? `${hotspotsData.count} Current Fire Hotspot${hotspotsData.count === 1 ? '' : 's'}` : 'Loading Current Fire Hotspots'}
            </h3>
            <p className="font-body-sm text-body-sm text-ink-muted">
              {primaryHotspot
                ? `${primaryHotspot.properties.sensor} detection at ${primaryHotspot.geometry.coordinates[1].toFixed(3)}°N, ${primaryHotspot.geometry.coordinates[0].toFixed(3)}°E; FRP ${
                    primaryHotspot.properties.frp == null ? 'unavailable' : `${primaryHotspot.properties.frp.toFixed(1)} MW`
                  }.`
                : 'No current hotspot is available for enforcement review.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-full bg-surface-container-lowest border border-ink-black font-label-lg text-label-lg text-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla transition-all cursor-pointer font-bold"
              type="button"
            >
              Geo-Tag Ward
            </button>
            <button
              onClick={() => {
                if (primaryHotspot) {
                  onSelectIncident('');
                }
              }}
              className="px-4 py-2 rounded-full bg-coral-watermelon-vivid text-canvas-cream font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:-translate-y-0.5 transition-all cursor-pointer font-bold"
              type="button"
            >
              Issue Notice ➔
            </button>
          </div>
        </article>
      )}
    </div>
  );
};
