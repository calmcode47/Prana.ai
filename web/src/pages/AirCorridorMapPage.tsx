import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
                  1,240 MW Total FRP Recorded
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
                  PM2.5: 285 µg/m³ • 14h Inflow
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
                  AQI 387 • 340m Inversion Lid
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
              VIIRS 375m I-band satellite detections record 1,420 MW thermal radiative power concentrated in Sangrur and Tarn Taran.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Emission Rate:</span>
              <span className="text-terracotta-deep">38.4 kg/s carbonaceous PM</span>
            </div>
          </div>

          <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-cobalt-deep font-bold uppercase">Transit Channel</span>
              <span className="w-3 h-3 rounded-full bg-cobalt-deep"></span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Karnal-Panipat Advection</h3>
            <p className="font-body-sm text-body-sm text-ink-muted mt-1 leading-relaxed">
              Clear nocturnal skies accelerate secondary particulate formation. Northwesterly advection winds transport the plume at 24.8 km/h.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Advection Velocity:</span>
              <span className="text-cobalt-deep">6.9 m/s NW vector</span>
            </div>
          </div>

          <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-md text-label-md text-coral-watermelon-vivid font-bold uppercase">Receptor Trap</span>
              <span className="w-3 h-3 rounded-full bg-coral-watermelon-vivid"></span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold">Delhi NCR Inversion Trap</h3>
            <p className="font-body-sm text-body-sm text-ink-muted mt-1 leading-relaxed">
              Shallow planetary boundary layer collapses to 185m AGL after sunset. Ridge topography prevents lateral plume dispersal.
            </p>
            <div className="mt-4 pt-3 border-t border-ink-black/10 flex justify-between font-label-md text-label-md font-bold">
              <span>Inversion Severity:</span>
              <span className="text-aqi-hazardous font-extrabold">GRAP-IV Emergency Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
