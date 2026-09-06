import React, { useState } from 'react';
import { CorridorMap } from '../components/Map/CorridorMap';
import { mockStations, mockHotspots } from '../data/mockData';
import { StationAQI } from '../types';

export const DashboardPage: React.FC = () => {
  const [selectedStation, setSelectedStation] = useState<StationAQI | null>(mockStations[0]);
  const [filterState, setFilterState] = useState<'All' | 'Delhi' | 'Punjab' | 'Haryana'>('All');

  const filteredStations = mockStations.filter(
    (stn) => filterState === 'All' || stn.state === filterState
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-mobile lg:px-gutter-desktop py-unit-lg space-y-unit-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-unit-sm pb-unit-sm border-b border-border-subtle">
        <div className="space-y-unit-2xs">
          <div className="flex items-center gap-unit-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Operations Command Center</span>
            <span className="text-outline-variant">•</span>
            <span>Punjab-Haryana-Delhi Corridor</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial font-bold">
            Airshed Multi-Layer GIS Cartography
          </h1>
        </div>

        <div className="flex items-center gap-unit-sm">
          <div className="flex bg-surface-container p-1 rounded-full text-xs font-bold">
            {(['All', 'Delhi', 'Punjab', 'Haryana'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterState(st)}
                className={`px-3 py-1 rounded-full transition-all ${
                  filterState === st ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 70/30 Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left 8 Cols: GIS Map Canvas & 7-Day Lag Chart */}
        <div className="lg:col-span-8 space-y-unit-lg">
          {/* Corridor GIS Map */}
          <div className="bg-surface-container-lowest p-unit-xs rounded-xl border border-border-subtle shadow-sm">
            <CorridorMap stations={filteredStations} hotspots={mockHotspots} />
          </div>

          {/* 7-Day Fire Count vs Downwind Delhi AQI Lag Analysis */}
          <div className="bg-surface-container-lowest p-unit-lg rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                  Empirical Lag Correlation (r = 0.89)
                </span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  7-Day Stubble Fire Spikes vs Downwind Delhi AQI Ingress
                </h3>
              </div>
              <span className="text-xs bg-surface-container-high px-2.5 py-1 rounded-full font-mono text-on-surface font-bold">
                Transit Lag: 36h Mean
              </span>
            </div>

            {/* Custom SVG Bar & Trend Chart */}
            <div className="h-44 w-full pt-2">
              <div className="grid grid-cols-7 gap-2 h-32 items-end">
                {[
                  { day: '31 Aug', fires: 85, aqi: 180 },
                  { day: '01 Sep', fires: 120, aqi: 210 },
                  { day: '02 Sep', fires: 175, aqi: 265 },
                  { day: '03 Sep', fires: 210, aqi: 320 },
                  { day: '04 Sep', fires: 310, aqi: 395 },
                  { day: '05 Sep', fires: 280, aqi: 415 },
                  { day: '06 Sep', fires: 247, aqi: 387 },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 h-24">
                      {/* Fire Count Bar */}
                      <div
                        className="w-3 bg-secondary/80 rounded-t group-hover:bg-secondary transition-all"
                        style={{ height: `${(item.fires / 350) * 100}%` }}
                        title={`Fires: ${item.fires}`}
                      />
                      {/* Delhi AQI Bar */}
                      <div
                        className="w-3 bg-primary/70 rounded-t group-hover:bg-primary transition-all"
                        style={{ height: `${(item.aqi / 500) * 100}%` }}
                        title={`Delhi AQI: ${item.aqi}`}
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono mt-2 font-bold">{item.day}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-unit-lg text-xs text-on-surface-variant mt-2 border-t border-border-subtle/50 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-secondary rounded-sm"></span>
                  <span>Punjab/Haryana VIIRS Fires</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-primary rounded-sm"></span>
                  <span>Delhi Downwind AQI (Ingress +36h)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Station Leaderboard & SPCB Action Trigger */}
        <div className="lg:col-span-4 space-y-unit-lg">
          {/* Station Leaderboard */}
          <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-sm">
            <div className="flex items-center justify-between pb-unit-2xs border-b border-border-subtle">
              <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                Station Telemetry
              </h3>
              <span className="text-xs text-on-surface-variant font-mono">{filteredStations.length} Active</span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredStations.map((stn) => (
                <div
                  key={stn.id}
                  onClick={() => setSelectedStation(stn)}
                  className={`p-unit-sm rounded-lg border cursor-pointer transition-all ${
                    selectedStation?.id === stn.id
                      ? 'bg-surface-container border-primary shadow-sm'
                      : 'bg-surface-container-low border-border-subtle/60 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-label-sm text-label-sm uppercase text-on-surface-variant block">{stn.city}</span>
                      <h4 className="font-bold text-sm text-primary">{stn.name}</h4>
                    </div>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase font-mono"
                      style={{ backgroundColor: `${stn.category_color}18`, color: stn.category_color }}
                    >
                      {stn.category}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2 pt-1.5 border-t border-border-subtle/40 text-xs">
                    <div>
                      <span className="font-bold text-base" style={{ color: stn.category_color }}>
                        {stn.aqi_index}
                      </span>
                      <span className="text-on-surface-variant ml-1 font-mono">AQI</span>
                    </div>
                    <span className="font-mono text-on-surface-variant font-bold">{stn.pm25_ugm3} µg/m³ PM2.5</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory SPCB Action Trigger Card */}
          <div className="bg-secondary-container text-on-secondary-container p-unit-md rounded-xl shadow-md space-y-unit-sm">
            <div className="flex items-center gap-unit-xs">
              <span className="material-symbols-outlined text-[20px]">gavel</span>
              <h4 className="font-headline-sm text-headline-sm font-bold font-editorial">
                Statutory Enforcement
              </h4>
            </div>
            <p className="font-body-sm text-xs leading-relaxed opacity-90">
              Corridor plume density exceeds CPCB Severe threshold (&gt;400 AQI). Automated Section 31A Show-Cause notices ready for dispatch.
            </p>
            <div className="pt-2">
              <a
                href="/alerts"
                className="w-full py-2 px-3 rounded-full bg-primary text-on-primary text-xs font-bold text-center block shadow hover:scale-[0.98] transition-all"
              >
                Review Incident Tickets & Legal Notices
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
