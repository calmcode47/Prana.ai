import React, { useState } from 'react';
import { mockForecasts } from '../data/mockData';

export const ForecastPage: React.FC = () => {
  const [activeHorizon, setActiveHorizon] = useState<'Now' | '+24h' | '+48h' | '+72h'>('Now');
  const forecast = mockForecasts[activeHorizon];

  const handleExportGeoJSON = () => {
    const geojsonData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            horizon: activeHorizon,
            lead_hours: forecast.lead_hours,
            delhi_projected_aqi: forecast.delhi_projected_aqi,
            boundary_layer_m: forecast.boundary_layer_height_m,
            inversion_risk: forecast.inversion_risk
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [75.843, 30.245],
                [76.380, 30.340],
                [76.990, 29.685],
                [77.241, 28.628],
                [77.051, 28.776],
                [75.843, 30.245]
              ]
            ]
          }
        }
      ]
    };
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(geojsonData, null, 2)], {type: 'application/json'});
    element.href = URL.createObjectURL(file);
    element.download = `prana_plume_forecast_${activeHorizon}.geojson`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-mobile lg:px-gutter-desktop py-unit-lg space-y-unit-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-unit-sm pb-unit-sm border-b border-border-subtle">
        <div className="space-y-unit-2xs">
          <div className="flex items-center gap-unit-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Gaussian-Plume Dispersion Engine</span>
            <span className="text-outline-variant">•</span>
            <span>HYSPLIT Ensemble</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial font-bold">
            72-Hour Plume Trajectory Explorer
          </h1>
        </div>

        <button
          onClick={handleExportGeoJSON}
          className="inline-flex items-center gap-unit-xs px-unit-md py-unit-xs rounded-full bg-surface-container-high text-on-surface hover:bg-surface-variant font-label-md text-label-md transition-all shadow-sm active:scale-95 border border-border-subtle"
        >
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          <span>Export Plume GeoJSON ({activeHorizon})</span>
        </button>
      </div>

      {/* 4-Step Interactive Advection Horizon Selector */}
      <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
            Forward Advective Horizon
          </span>
          <span className="font-label-md text-label-md text-secondary font-bold font-mono">
            {activeHorizon === 'Now' ? 'Now • Initial Plume Front' : `${activeHorizon} Ingress Forecast`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-unit-xs bg-surface-container p-1 rounded-full">
          {(['Now', '+24h', '+48h', '+72h'] as const).map((horizon) => (
            <button
              key={horizon}
              onClick={() => setActiveHorizon(horizon)}
              className={`py-unit-xs px-unit-sm rounded-full text-center transition-all ${
                activeHorizon === horizon
                  ? 'bg-primary text-on-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="block font-label-md text-label-md">{horizon}</span>
              <span className="block text-[10px] opacity-75 font-mono">
                {horizon === 'Now' ? 'Origin' : horizon === '+24h' ? 'Transit' : horizon === '+48h' ? 'Border' : 'Basin Trap'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Hero Advective Card & Trajectory Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left 8 Cols: Trajectory Visualizer */}
        <div className="lg:col-span-8 space-y-unit-lg">
          <div className="relative rounded-xl overflow-hidden bg-surface-container-lowest border border-border-subtle shadow-sm p-unit-md">
            {/* Visualizer Header */}
            <div className="flex items-center justify-between pb-unit-sm mb-unit-xs border-b border-border-subtle">
              <div className="space-y-0.5">
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-bold">Simulated Dispersion Cone</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  {forecast.description}
                </h3>
              </div>
              <div className="text-right">
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant block">Delhi Basin AQI</span>
                <span className="font-display-lg text-display-lg-mobile font-editorial font-bold text-secondary leading-none">
                  {forecast.delhi_projected_aqi}
                </span>
              </div>
            </div>

            {/* Custom SVG Trajectory Cone */}
            <div className="relative h-80 w-full bg-[#f6f3ee] rounded-lg overflow-hidden border border-border-subtle/50">
              <svg className="w-full h-full" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="forecastPlumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#b61b00" stopOpacity="0.85" />
                    <stop offset="40%" stopColor="#db3417" stopOpacity="0.6" />
                    <stop offset="80%" stopColor="#ffb074" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#eec145" stopOpacity="0.15" />
                  </linearGradient>
                </defs>

                {/* Grid backdrop */}
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e2dd" strokeWidth="0.5" />
                </pattern>
                <rect width="600" height="320" fill="url(#grid)" />

                {/* State Labels */}
                <text x="50" y="45" fill="#747878" fontSize="11" fontFamily="Newsreader" fontStyle="italic">PUNJAB SOURCE</text>
                <text x="240" y="160" fill="#747878" fontSize="11" fontFamily="Newsreader" fontStyle="italic">HARYANA CORRIDOR</text>
                <text x="440" y="270" fill="#1c1c19" fontSize="12" fontWeight="bold" fontFamily="DM Sans">DELHI NCR BASIN</text>

                {/* Dynamic Plume Cone depending on activeHorizon */}
                {activeHorizon === 'Now' && (
                  <path
                    d="M 100,60 Q 140,80 170,110 Q 150,130 90,90 Z"
                    fill="url(#forecastPlumeGrad)"
                    className="animate-pulse-slow"
                  />
                )}
                {activeHorizon === '+24h' && (
                  <path
                    d="M 100,60 Q 200,120 280,180 Q 240,210 80,90 Z"
                    fill="url(#forecastPlumeGrad)"
                    className="animate-pulse-slow"
                  />
                )}
                {activeHorizon === '+48h' && (
                  <path
                    d="M 100,60 Q 260,150 440,260 Q 380,300 80,90 Z"
                    fill="url(#forecastPlumeGrad)"
                    className="animate-pulse-slow"
                  />
                )}
                {activeHorizon === '+72h' && (
                  <path
                    d="M 100,60 Q 280,160 520,280 Q 420,320 80,90 Z"
                    fill="url(#forecastPlumeGrad)"
                    className="animate-pulse-slow"
                  />
                )}

                {/* Flow Streamline */}
                <path
                  d="M 100,60 C 220,130 350,210 470,270"
                  fill="none"
                  stroke="#b61b00"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                  className="animate-flow-plume"
                />

                {/* Origin Hotspot */}
                <circle cx="100" cy="60" r="8" fill="#b61b00" stroke="#ffffff" strokeWidth="2" />
                <circle cx="100" cy="60" r="16" fill="#b61b00" fillOpacity="0.2" className="animate-ping" />

                {/* Receptor Target */}
                <circle cx="470" cy="270" r="10" fill="#1c1c19" stroke="#b61b00" strokeWidth="2" />
              </svg>

              {/* Overlay Atmospheric Conditions */}
              <div className="absolute bottom-3 left-3 right-3 bg-surface-container-lowest/90 backdrop-blur-md p-unit-xs rounded-lg border border-border-subtle flex flex-wrap items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-on-surface-variant">Wind Vector: </span>
                  <span className="font-bold text-primary">{forecast.wind_direction_deg}° @ {forecast.avg_wind_speed_kmh} km/h</span>
                </div>
                <div>
                  <span className="text-on-surface-variant">Mixing Height: </span>
                  <span className="font-bold text-secondary">{forecast.boundary_layer_height_m}m</span>
                </div>
                <div>
                  <span className="text-on-surface-variant">Inversion Risk: </span>
                  <span className="font-bold text-secondary uppercase">{forecast.inversion_risk}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Municipal Ward Impact Ranking */}
        <div className="lg:col-span-4 space-y-unit-lg">
          <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-center justify-between pb-unit-2xs border-b border-border-subtle">
              <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                Ward Vulnerability Matrix
              </h3>
              <span className="text-xs text-on-surface-variant font-mono">{activeHorizon} Horizon</span>
            </div>

            <div className="space-y-unit-sm">
              {forecast.impacted_wards.map((ward, idx) => (
                <div key={idx} className="p-unit-sm rounded-lg bg-surface-container-low border border-border-subtle/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-primary">{ward.ward}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-secondary-fixed text-on-secondary-fixed">
                      {ward.risk_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>Zone: {ward.delhi_zone}</span>
                    <span className="font-mono font-bold text-secondary">{ward.expected_pm25} µg/m³</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-on-surface-variant leading-relaxed border-t border-border-subtle/50">
              <span className="font-bold text-primary">Precautionary Directive:</span> Low nocturnal boundary layer height will trap heavy aerosols over Trans-Yamuna and North-West sectors.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
