import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createIncident } from '../api/client';

export const DashboardPage: React.FC = () => {
  const [trajectoryHours, setTrajectoryHours] = useState<number>(28);
  const [hotspotHoursBack, setHotspotHoursBack] = useState<number>(24);
  const [minConfidence, setMinConfidence] = useState<'low' | 'nominal' | 'high'>('nominal');
  const [layers, setLayers] = useState({
    pm25: true,
    viirs: true,
    plume: true,
    wind: false,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [squadDispatched, setSquadDispatched] = useState(false);
  const [showCauseIssued, setShowCauseIssued] = useState(false);

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setTrajectoryHours(36);
    }, 800);
  };

  const handleDispatchSquad = async () => {
    setSquadDispatched(true);
    await createIncident({
      severity: 'emergency',
      location_text: 'Sangrur Cluster #2026-09 Ground Zero',
      pollutant: 'PM2.5',
      measured_pm25: 420.5,
      satellite_source: 'FIRMS_VIIRS',
      authority: 'PPCB & Flying Squad Command',
    });
    setTimeout(() => setSquadDispatched(false), 2600);
  };

  const handleIssueShowCause = async () => {
    setShowCauseIssued(true);
    await createIncident({
      severity: 'warning',
      location_text: 'Sangrur-Patiala Transboundary Ignition Belt',
      pollutant: 'PM2.5',
      measured_pm25: 380.0,
      satellite_source: 'FIRMS_VIIRS',
      authority: 'District Magistrate Oversight',
    });
    setTimeout(() => setShowCauseIssued(false), 2600);
  };

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      {/* Live Incident War-Room Status Strip */}
      <section className="w-full px-gutter-desktop py-space-sm">
        <div className="w-full bg-surface-vanilla rounded-full py-space-xs px-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
          <div className="flex items-center flex-wrap gap-space-md font-label-lg text-label-lg">
            <span className="inline-flex items-center gap-1.5 text-terracotta-deep font-bold">
              <span className="material-symbols-outlined text-[18px]">local_fire_department</span>
              1,842 Fire Clusters Active
            </span>
            <span className="text-outline-variant font-normal">/</span>
            <span className="inline-flex items-center gap-1.5 text-cobalt-deep font-bold">
              <span className="material-symbols-outlined text-[18px]">air</span>
              NW Advection: 24.8 km/h
            </span>
            <span className="text-outline-variant font-normal">/</span>
            <span className="inline-flex items-center gap-1.5 text-ink-black font-semibold">
              <span className="material-symbols-outlined text-[18px]">vertical_align_bottom</span>
              Mixing Lid: 340m AGL
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="inline-flex items-center gap-2 px-space-sm py-1 rounded-full bg-coral-watermelon-vivid text-on-secondary text-label-md font-bold shadow-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              GRAP Stage IV Active
            </span>
            <span className="text-ink-muted text-label-md uppercase tracking-wider hidden sm:inline font-bold">
              Statutory Protocol 48h
            </span>
          </div>
        </div>
      </section>

      {/* Main 70/30 Operations Layout */}
      <section className="w-full px-gutter-desktop pb-space-2xl pt-space-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 70% CANVAS: Map, Corridors, Inspector & Belt Analytics */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Interactive Vector Corridor Visualizer Card */}
            <div className="w-full bg-surface-vanilla rounded-xl shadow-[4px_4px_0px_#18181B] border border-ink-black p-space-lg relative overflow-hidden flex flex-col gap-space-md">
              {/* Card Header & Starburst Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-surface-vanilla-strong text-ink-black text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                      Corridor Vector 04
                    </span>
                    <span className="text-ink-muted text-body-sm">VIIRS-HYSPLIT Ensemble</span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-ink-black mt-1">
                    Trans-Boundary Advection Plume Canvas
                  </h2>
                </div>
                {/* Quirky Starburst Badge */}
                <div className="relative self-start sm:self-auto">
                  <div className="bg-ink-black text-canvas-cream px-3 py-2 rounded-lg rotate-3 shadow-[3px_3px_0px_#FF5376] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-coral-watermelon-vivid text-[18px]">cyclone</span>
                    <span className="font-label-md text-label-md uppercase tracking-wider font-bold">Inflow Lag -36H</span>
                  </div>
                </div>
              </div>

              {/* Layer Toggle Bar */}
              <div className="flex items-center flex-wrap gap-space-xs relative z-10" id="layer-toggles">
                <button
                  onClick={() => toggleLayer('pm25')}
                  className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                    layers.pm25 ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black hover:bg-surface-vanilla-strong'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {layers.pm25 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  GPR PM2.5 Density
                </button>
                <button
                  onClick={() => toggleLayer('viirs')}
                  className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                    layers.viirs ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black hover:bg-surface-vanilla-strong'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {layers.viirs ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  Active VIIRS FRP
                </button>
                <button
                  onClick={() => toggleLayer('plume')}
                  className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                    layers.plume ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black hover:bg-surface-vanilla-strong'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {layers.plume ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  72h Plume Envelopes
                </button>
                <button
                  onClick={() => toggleLayer('wind')}
                  className={`px-space-sm py-1.5 rounded-full font-label-md text-label-md shadow-sm transition-all flex items-center gap-1 cursor-pointer ${
                    layers.wind ? 'bg-ink-black text-canvas-cream' : 'bg-canvas-cream text-ink-black hover:bg-surface-vanilla-strong'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {layers.wind ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  Synoptic Wind Field
                </button>

                {/* Backend NASA FIRMS Filter Controls (backend/routers/hotspots.py) */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="font-label-md text-label-md text-ink-muted uppercase">FIRMS:</span>
                  <select
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(e.target.value as any)}
                    className="px-2 py-1 text-xs font-bold bg-canvas-cream rounded-lg border border-ink-black shadow-[1px_1px_0px_#18181B] text-ink-black focus:outline-none"
                  >
                    <option value="low">Confidence: Low+</option>
                    <option value="nominal">Confidence: Nominal</option>
                    <option value="high">Confidence: High Only</option>
                  </select>
                  <select
                    value={hotspotHoursBack}
                    onChange={(e) => setHotspotHoursBack(Number(e.target.value))}
                    className="px-2 py-1 text-xs font-bold bg-canvas-cream rounded-lg border border-ink-black shadow-[1px_1px_0px_#18181B] text-ink-black focus:outline-none"
                  >
                    <option value="12">12h Lookback</option>
                    <option value="24">24h Lookback</option>
                    <option value="48">48h Lookback</option>
                    <option value="72">72h Lookback</option>
                  </select>
                </div>
              </div>

              {/* Vector Atmospheric Simulation Display */}
              <div className="w-full h-[460px] bg-canvas-cream rounded-xl relative overflow-hidden shadow-inner p-space-md flex flex-col justify-between border border-ink-black/20">
                {/* Atmospheric Streamlines & Plume Gradients */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none" preserveAspectRatio="none" viewBox="0 0 800 460">
                  <defs>
                    <linearGradient id="plumeGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.75" />
                      <stop offset="45%" stopColor="#FF5376" stopOpacity="0.6" />
                      <stop offset="85%" stopColor="#7C2D12" stopOpacity="0.9" />
                    </linearGradient>
                    <pattern height="20" id="dotPattern" patternUnits="userSpaceOnUse" width="20" x="0" y="0">
                      <circle cx="2" cy="2" fill="#E4E1E6" r="1.2" />
                    </pattern>
                  </defs>
                  <rect fill="url(#dotPattern)" height="460" width="800" />

                  {/* 72h Plume Inflow Ribbon */}
                  {layers.plume && (
                    <>
                      <path
                        className="blur-md"
                        d="M 110,95 Q 260,110 380,210 T 670,350"
                        fill="none"
                        opacity="0.45"
                        stroke="url(#plumeGradient)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="48"
                      />
                      <path
                        d="M 130,85 C 220,130 330,170 420,240 S 580,310 680,360"
                        fill="none"
                        opacity="0.8"
                        stroke="#EA580C"
                        strokeDasharray="6 4"
                        strokeWidth="3"
                      />
                      <path
                        d="M 90,110 C 200,160 310,210 400,270 S 550,330 650,380"
                        fill="none"
                        opacity="0.7"
                        stroke="#FF5376"
                        strokeDasharray="4 4"
                        strokeWidth="2"
                      />
                      <path
                        d="M 150,60 C 270,110 390,180 480,250 S 610,320 710,360"
                        fill="none"
                        opacity="0.6"
                        stroke="#1D4ED8"
                        strokeDasharray="8 6"
                        strokeWidth="1.5"
                      />
                    </>
                  )}

                  {/* Directional Wind Vanes */}
                  {layers.wind && (
                    <g opacity="0.7" stroke="#1D4ED8" strokeWidth="2">
                      <path d="M220,70 L260,95 M250,85 L260,95 L245,98" />
                      <path d="M340,140 L380,170 M370,158 L380,170 L365,172" />
                      <path d="M470,220 L510,255 M500,242 L510,255 L495,257" />
                      <path d="M570,290 L610,325 M600,312 L610,325 L595,327" />
                    </g>
                  )}
                </svg>

                {/* Map Nodes */}
                <div className="relative z-10 flex justify-between items-start">
                  {/* Origin Basin Node */}
                  <div className="bg-surface-vanilla p-space-sm rounded-lg shadow-[2px_2px_0px_#18181B] border border-ink-black max-w-[210px]">
                    <div className="flex items-center gap-1.5 text-terracotta-deep font-label-md text-label-md uppercase font-bold">
                      <span className="w-2 h-2 rounded-full bg-terracotta-deep animate-ping"></span>
                      Upwind Origin Basin
                    </div>
                    <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Punjab Malwa</div>
                    <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">1,240 MW Total FRP Recorded</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-vanilla-strong text-ink-black text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                      <span>842 Stubble Coordinates</span>
                    </div>
                  </div>

                  {/* Transit Corridor Milestone */}
                  <div className="bg-surface-vanilla p-space-sm rounded-lg shadow-[2px_2px_0px_#18181B] border border-ink-black max-w-[210px] self-center mt-12">
                    <div className="flex items-center gap-1.5 text-cobalt-deep font-label-md text-label-md uppercase font-bold">
                      <span className="material-symbols-outlined text-[16px]">navigation</span>
                      Transit Channel
                    </div>
                    <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Karnal-Panipat</div>
                    <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">PM2.5: 285 µg/m³ in plume</p>
                    <div className="mt-2 text-label-md font-bold text-coral-watermelon-vivid">
                      Estimated Transit: 14h Left
                    </div>
                  </div>

                  {/* Receptor Sink Node */}
                  <div className="bg-surface-vanilla p-space-sm rounded-lg shadow-[2px_2px_0px_#18181B] border border-ink-black max-w-[220px] self-end">
                    <div className="flex items-center gap-1.5 text-coral-watermelon-vivid font-label-md text-label-md uppercase font-bold">
                      <span className="w-2 h-2 rounded-full bg-coral-watermelon-vivid animate-pulse"></span>
                      Target Receptor Sink
                    </div>
                    <div className="font-headline-sm text-headline-sm text-ink-black mt-1">Delhi NCR Basin</div>
                    <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">AQI 387 Hazardous Level</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aqi-hazardous text-on-tertiary text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                      <span>Atmospheric Trap: 340m Lid</span>
                    </div>
                  </div>
                </div>

                {/* Trajectory Time Control Scrubber */}
                <div className="relative z-10 w-full bg-surface-vanilla-strong rounded-xl p-space-sm shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col gap-2">
                  <div className="flex items-center justify-between text-body-sm font-semibold">
                    <span className="text-ink-black font-label-md text-label-md uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-cobalt-deep">timeline</span>
                      HYSPLIT Forward Ensemble Scrubber
                    </span>
                    <span className="font-label-lg text-label-lg text-cobalt-deep font-bold">
                      T + {trajectoryHours.toFixed(1)} Hours Ahead
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-cobalt-deep"
                      id="trajectory-slider"
                      max={72}
                      min={0}
                      type="range"
                      value={trajectoryHours}
                      onChange={(e) => setTrajectoryHours(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="flex justify-between text-label-md text-ink-muted">
                    <span>T+0h (VIIRS Overpass)</span>
                    <span>T+24h (Haryana Transit)</span>
                    <span>T+48h (Basin Inversion)</span>
                    <span>T+72h (Washout Dispersal)</span>
                  </div>
                </div>
              </div>

              {/* Fire Cluster Inspector Drawer */}
              <div className="w-full bg-canvas-cream rounded-xl p-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
                <div className="flex items-start gap-space-md">
                  <div className="w-12 h-12 rounded-xl bg-terracotta-deep text-on-primary flex items-center justify-center shadow-[2px_2px_0px_#18181B] flex-shrink-0">
                    <span className="material-symbols-outlined text-[28px]">local_fire_department</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-title-md text-title-md text-ink-black font-bold">
                        Sangrur Cluster #2026-09
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-terracotta-deep font-label-md text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                        412 MW FRP
                      </span>
                    </div>
                    <p className="font-body-md text-body-md text-ink-muted mt-1">
                      Coordinated burning detected across 18 contiguous parcels. Estimated plume mass rate: 38.4 kg/s carbonaceous aerosol. ~28h direct inflow trajectory into the Delhi air basin.
                    </p>
                  </div>
                </div>

                {/* Action Triggers */}
                <div className="flex items-center gap-space-sm flex-shrink-0 w-full md:w-auto">
                  <button
                    onClick={handleSimulate}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-space-md py-2.5 rounded-full bg-cobalt-deep text-on-primary font-label-lg text-label-lg shadow-[3px_3px_0px_#18181B] hover:bg-primary transition-all cursor-pointer"
                    type="button"
                  >
                    <span>{isSimulating ? 'Simulating...' : 'Simulate Trajectory'}</span>
                    <span className={`material-symbols-outlined text-[16px] ${isSimulating ? 'animate-spin' : ''}`}>
                      {isSimulating ? 'refresh' : 'play_arrow'}
                    </span>
                  </button>
                  <Link
                    to="/spcb-incident-command"
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-space-md py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:bg-surface-variant hover:text-ink-black transition-all cursor-pointer"
                  >
                    <span>Legal Notice</span>
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                  </Link>
                </div>
              </div>

              {/* Regional Triad Summary Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-xs">
                {/* Tile 1: Malwa Belt Origin */}
                <div className="bg-canvas-cream rounded-xl p-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">Origin Source</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-terracotta-deep"></span>
                  </div>
                  <div className="my-2">
                    <div className="font-headline-sm text-headline-sm text-ink-black">Malwa Belt Origin</div>
                    <div className="font-telemetry-val text-telemetry-val text-terracotta-deep font-bold mt-1">
                      1,240 MW FRP
                    </div>
                  </div>
                  <span className="font-body-sm text-body-sm text-ink-muted">71% Regional Emission Share</span>
                </div>

                {/* Tile 2: Karnal Transit Corridor */}
                <div className="bg-canvas-cream rounded-xl p-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">Transport Vector</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-cobalt-deep"></span>
                  </div>
                  <div className="my-2">
                    <div className="font-headline-sm text-headline-sm text-ink-black">Karnal Corridor</div>
                    <div className="font-telemetry-val text-telemetry-val text-cobalt-deep font-bold mt-1">
                      285 µg/m³
                    </div>
                  </div>
                  <span className="font-body-sm text-body-sm text-ink-muted">Advection Flux: 18.2 tons/h</span>
                </div>

                {/* Tile 3: Delhi NCR Sink */}
                <div className="bg-canvas-cream rounded-xl p-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">Receptor Sink</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid"></span>
                  </div>
                  <div className="my-2">
                    <div className="font-headline-sm text-headline-sm text-ink-black">Delhi NCR Sink</div>
                    <div className="font-telemetry-val text-telemetry-val text-coral-watermelon-vivid font-bold mt-1">
                      AQI 387
                    </div>
                  </div>
                  <span className="font-body-sm text-body-sm text-ink-muted">Hazardous Health Alert Tier</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 30% SIDEBAR: AQI Card, Leaderboard, Lag Analytics & Statutory Powers */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* Big Bold Consolidated AQI Card in Cobalt Blue */}
            <div className="w-full bg-cobalt-deep text-on-primary rounded-xl p-space-lg shadow-[4px_4px_0px_#18181B] border border-ink-black relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-on-primary text-label-md font-bold uppercase tracking-wider">
                  Consolidated Basin Readout
                </span>
                <span className="w-3 h-3 rounded-full bg-coral-watermelon-vivid animate-ping"></span>
              </div>
              <div className="my-space-md">
                <div className="text-display-lg font-display-lg tracking-tight leading-none">AQI 387</div>
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-aqi-hazardous text-white font-label-lg text-label-lg tracking-wider uppercase font-bold shadow-[1px_1px_0px_#000]">
                  Hazardous Classification
                </div>
              </div>
              <div className="grid grid-cols-2 gap-space-sm pt-space-md border-t border-white/20">
                <div>
                  <div className="font-label-md text-label-md text-white/70 uppercase font-bold">Mass Concentration</div>
                  <div className="font-telemetry-val text-telemetry-val text-white mt-0.5 font-bold">
                    312.4 <span className="font-body-sm text-body-sm font-normal">µg/m³</span>
                  </div>
                </div>
                <div>
                  <div className="font-label-md text-label-md text-white/70 uppercase font-bold">Boundary Inversion</div>
                  <div className="font-telemetry-val text-telemetry-val text-white mt-0.5 font-bold">
                    340m <span className="font-body-sm text-body-sm font-normal">AGL</span>
                  </div>
                </div>
              </div>
              <div className="mt-space-md text-body-sm text-white/90 bg-white/10 rounded-lg p-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Respiratory alert issued. Mechanical ventilation required.</span>
              </div>
            </div>

            {/* Real-Time NCR Station Leaderboard */}
            <div className="w-full bg-surface-vanilla rounded-xl p-space-lg shadow-[4px_4px_0px_#18181B] border border-ink-black flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">
                    Monitoring Grid
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-ink-black">NCR Receptor Stations</h3>
                </div>
                <span className="font-label-md text-label-md text-cobalt-deep font-bold">14s Refresh</span>
              </div>
              <div className="flex flex-col gap-space-xs">
                {/* Station 1: Anand Vihar */}
                <div className="p-space-sm rounded-lg bg-canvas-cream flex items-center justify-between shadow-[2px_2px_0px_#18181B] border border-ink-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid"></span>
                    <div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold">Anand Vihar</div>
                      <div className="font-body-sm text-body-sm text-ink-muted">East Receptor Gateway</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-telemetry-val text-body-lg font-bold text-coral-watermelon-vivid">
                      412 µg/m³
                    </div>
                    <div className="font-label-md text-label-md text-ink-muted font-bold">AQI 452 Severe</div>
                  </div>
                </div>

                {/* Station 2: Jahangirpuri */}
                <div className="p-space-sm rounded-lg bg-canvas-cream flex items-center justify-between shadow-[2px_2px_0px_#18181B] border border-ink-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid"></span>
                    <div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold">Jahangirpuri</div>
                      <div className="font-body-sm text-body-sm text-ink-muted">North Trans-Inflow</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-telemetry-val text-body-lg font-bold text-coral-watermelon-vivid">
                      394 µg/m³
                    </div>
                    <div className="font-label-md text-label-md text-ink-muted font-bold">AQI 428 Severe</div>
                  </div>
                </div>

                {/* Station 3: Rohini */}
                <div className="p-space-sm rounded-lg bg-canvas-cream flex items-center justify-between shadow-[2px_2px_0px_#18181B] border border-ink-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-terracotta-deep"></span>
                    <div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold">Rohini</div>
                      <div className="font-body-sm text-body-sm text-ink-muted">North-West Arc</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-telemetry-val text-body-lg font-bold text-terracotta-deep">
                      382 µg/m³
                    </div>
                    <div className="font-label-md text-label-md text-ink-muted font-bold">AQI 405 Severe</div>
                  </div>
                </div>

                {/* Station 4: Noida Sec-62 */}
                <div className="p-space-sm rounded-lg bg-canvas-cream flex items-center justify-between shadow-[2px_2px_0px_#18181B] border border-ink-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-terracotta-deep"></span>
                    <div>
                      <div className="font-title-sm text-title-sm text-ink-black font-bold">Noida Sec-62</div>
                      <div className="font-body-sm text-body-sm text-ink-muted">South-East Exit Channel</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-telemetry-val text-body-lg font-bold text-terracotta-deep">
                      368 µg/m³
                    </div>
                    <div className="font-label-md text-label-md text-ink-muted font-bold">AQI 392 Very Poor</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Fire vs AQI Lag Chart */}
            <div className="w-full bg-surface-vanilla rounded-xl p-space-lg shadow-[4px_4px_0px_#18181B] border border-ink-black flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">
                    Empirical Correlation
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-ink-black">7-Day Fire Count vs AQI Lag</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-vanilla-strong text-ink-black font-label-md text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                  Δ 36h Offset
                </span>
              </div>
              {/* Dual Axis SVG Visualization */}
              <div className="w-full h-36 bg-canvas-cream rounded-lg p-2 relative flex flex-col justify-end border border-ink-black/20">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 320 120">
                  <line stroke="#E4E1E6" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="320" y1="30" y2="30" />
                  <line stroke="#E4E1E6" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="320" y1="60" y2="60" />
                  <line stroke="#E4E1E6" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="320" y1="90" y2="90" />

                  {/* Fire Count Bars (Terracotta) */}
                  <rect fill="#EA580C" height="30" opacity="0.8" rx="3" width="12" x="20" y="80" />
                  <rect fill="#EA580C" height="45" opacity="0.8" rx="3" width="12" x="65" y="65" />
                  <rect fill="#EA580C" height="70" opacity="0.8" rx="3" width="12" x="110" y="40" />
                  <rect fill="#EA580C" height="85" opacity="0.8" rx="3" width="12" x="155" y="25" />
                  <rect fill="#EA580C" height="75" opacity="0.8" rx="3" width="12" x="200" y="35" />
                  <rect fill="#EA580C" height="55" opacity="0.8" rx="3" width="12" x="245" y="55" />
                  <rect fill="#EA580C" height="40" opacity="0.8" rx="3" width="12" x="290" y="70" />

                  {/* AQI Trend Line (Cobalt Blue with 36h lag) */}
                  <path
                    d="M 26,95 Q 71,90 116,75 T 206,30 T 296,25"
                    fill="none"
                    stroke="#1D4ED8"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />

                  {/* Lag Connection Vector */}
                  <line stroke="#FF5376" strokeDasharray="3 3" strokeWidth="2" x1="161" x2="206" y1="25" y2="30" />
                  <circle cx="161" cy="25" fill="#EA580C" r="3.5" />
                  <circle cx="206" cy="30" fill="#1D4ED8" r="3.5" />
                </svg>
                <div className="flex justify-between text-label-md text-ink-muted mt-1 px-1">
                  <span>Day -7</span>
                  <span>Day -5</span>
                  <span>Day -3 (Peak Fire)</span>
                  <span>Day -1 (Peak AQI)</span>
                  <span>Today</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-body-sm text-ink-muted">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-terracotta-deep"></span>
                  FRP Radiative Fire Count
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-cobalt-deep"></span>
                  Delhi Receptor AQI (36h lag)
                </span>
              </div>
            </div>

            {/* SPCB Statutory Triggers Module */}
            <div className="w-full bg-surface-vanilla rounded-xl p-space-lg shadow-[4px_4px_0px_#18181B] border border-ink-black flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-md text-label-md uppercase tracking-wider text-ink-muted font-bold">
                    Air Act 1981
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-ink-black">SPCB Statutory Triggers</h3>
                </div>
                <span className="material-symbols-outlined text-coral-watermelon-vivid text-2xl">security</span>
              </div>
              <p className="font-body-sm text-body-sm text-ink-muted">
                Legally admissible automated enforcement triggers authorized under Section 31A environmental protection covenants.
              </p>
              <div className="flex flex-col gap-space-sm">
                <button
                  onClick={handleDispatchSquad}
                  className="w-full py-3 px-space-md rounded-xl bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[2px_2px_0px_#1D4ED8] hover:bg-surface-variant hover:text-ink-black transition-all flex items-center justify-between cursor-pointer"
                  id="trigger-flying-squad"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-forest-jade text-[18px]">verified</span>
                    {squadDispatched ? (
                      <span className="text-forest-jade font-bold">Squad Unit #09 Dispatched</span>
                    ) : (
                      'Dispatch Flying Squad to Dirba'
                    )}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
                <button
                  onClick={handleIssueShowCause}
                  className="w-full py-3 px-space-md rounded-xl bg-coral-watermelon-vivid text-on-secondary font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:bg-secondary transition-all flex items-center justify-between cursor-pointer"
                  id="trigger-show-cause"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    {showCauseIssued ? (
                      <span className="text-on-secondary font-bold">Notice 31A Sealed &amp; Transmitted</span>
                    ) : (
                      'Issue Section 31A Show-Cause'
                    )}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
              <div className="p-2.5 bg-canvas-cream rounded-lg text-body-sm text-ink-muted flex items-center gap-2 font-label-md border border-ink-black/20">
                <span className="material-symbols-outlined text-[16px] text-cobalt-deep">verified_user</span>
                <span>Cryptographically sealed via State Pollution Board e-Pramaan</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
