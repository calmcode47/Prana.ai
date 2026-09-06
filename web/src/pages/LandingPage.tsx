import React from 'react';
import { NavLink } from 'react-router-dom';
import { TelemetryRibbon } from '../components/TelemetryRibbon';
import { mockStations } from '../data/mockData';

export const LandingPage: React.FC = () => {
  return (
    <div className="w-full flex flex-col">
      {/* Telemetry Ribbon */}
      <TelemetryRibbon />

      {/* Hero Section */}
      <section className="relative px-gutter-mobile lg:px-gutter-desktop pt-unit-xl pb-unit-2xl overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-unit-xl items-center">
          {/* Headline & Lead Content */}
          <div className="lg:col-span-7 flex flex-col items-start animate-fade-in">
            <div className="inline-flex items-center gap-unit-xs px-unit-sm py-unit-2xs rounded-full bg-surface-container-high text-on-surface mb-unit-md shadow-sm border border-border-subtle/60">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                Indo-Gangetic Airshed Corridor Protocol
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Winter Advection Cycle</span>
            </div>

            <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg text-primary tracking-tight mb-unit-md font-editorial">
              Real-Time Airshed Intelligence for the <span className="italic font-normal text-secondary">Northern Indian</span> Smog Corridor
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-unit-xl leading-relaxed">
              Tracking 35M tonnes of agricultural stubble plume advection from Punjab to Delhi NCR with 72-hour predictive dispersion modeling and privacy-preserving federated machine learning.
            </p>

            {/* CTA Cluster */}
            <div className="flex flex-wrap items-center gap-unit-sm w-full sm:w-auto">
              <NavLink
                to="/dashboard"
                className="w-full sm:w-auto px-unit-lg py-unit-sm rounded-full bg-primary text-on-primary font-label-lg text-label-lg shadow-xl hover:scale-[0.98] active:scale-95 transition-all flex items-center justify-center gap-unit-xs"
              >
                <span>Launch Operations Command Center</span>
                <span className="material-symbols-outlined text-[18px]">north_east</span>
              </NavLink>
              <NavLink
                to="/forecast"
                className="w-full sm:w-auto px-unit-lg py-unit-sm rounded-full bg-surface-container-lowest text-primary font-label-lg text-label-lg shadow-md hover:bg-surface-container transition-all flex items-center justify-center gap-unit-xs border border-border-subtle"
              >
                <span className="material-symbols-outlined text-[18px]">timeline</span>
                <span>Explore 72h Plume Forecast</span>
              </NavLink>
            </div>

            {/* Metric micro-strip */}
            <div className="mt-unit-xl pt-unit-md flex items-center gap-unit-lg border-t border-border-subtle/60 w-full">
              <div>
                <span className="font-headline-md text-headline-md text-primary block leading-none font-editorial font-bold">35.4M</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tonnes Biomass Monitored</span>
              </div>
              <div className="h-8 w-px bg-surface-container-highest"></div>
              <div>
                <span className="font-headline-md text-headline-md text-secondary block leading-none font-editorial font-bold">36h</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Transit Lag Lead Time</span>
              </div>
              <div className="h-8 w-px bg-surface-container-highest"></div>
              <div>
                <span className="font-headline-md text-headline-md text-primary block leading-none font-editorial font-bold">0.1°</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Spatial Resolution</span>
              </div>
            </div>
          </div>

          {/* Corridor Map Card & Live Trajectory Graphic */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-xl overflow-hidden shadow-xl bg-surface-container-lowest p-unit-xs border border-border-subtle">
              <div className="relative h-96 w-full rounded-lg overflow-hidden bg-surface-container">
                {/* Visual Motif */}
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(135deg, #f6f3ee 0%, #ebe8e3 50%, #f0ede9 100%)`
                  }}
                >
                  {/* Vector SVG Animation */}
                  <svg className="w-full h-full" viewBox="0 0 400 350">
                    <defs>
                      <linearGradient id="landingPlumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#b61b00" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#db3417" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#eec145" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>

                    {/* Regional Labels */}
                    <text x="40" y="40" fill="#747878" fontSize="11" fontFamily="Newsreader" fontStyle="italic">PUNJAB / HARYANA FIRES</text>
                    <text x="240" y="320" fill="#1c1c19" fontSize="12" fontWeight="bold" fontFamily="DM Sans">DELHI NCR BASIN</text>

                    {/* Punjab to Delhi Streamline */}
                    <path
                      d="M 60,70 Q 140,150 240,260 T 320,300"
                      fill="none"
                      stroke="url(#landingPlumeGrad)"
                      strokeWidth="5"
                      strokeDasharray="8,5"
                      className="animate-flow-plume"
                    />

                    {/* Thermal Anomaly Concentric Rings */}
                    <circle cx="60" cy="70" fill="#b61b00" fillOpacity="0.25" r="20" className="animate-pulse" />
                    <circle cx="60" cy="70" fill="#b61b00" r="8" />

                    <circle cx="90" cy="95" fill="#b61b00" fillOpacity="0.2" r="14" className="animate-pulse" />
                    <circle cx="90" cy="95" fill="#db3417" r="6" />

                    {/* Delhi Receptor */}
                    <circle cx="320" cy="300" fill="#b61b00" r="10" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="320" cy="300" fill="none" stroke="#b61b00" strokeWidth="1.5" strokeDasharray="3 3" r="22" className="animate-ping" />
                  </svg>
                </div>

                {/* Overlaid Live Stats Box */}
                <div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/90 backdrop-blur-md p-unit-sm rounded-lg shadow-md border border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-unit-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                    <div>
                      <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant block">Corridor Telemetry</span>
                      <span className="font-headline-sm text-headline-sm text-primary font-bold">247 Active Hotspots</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant block">Delhi Basin Mean</span>
                    <span className="font-headline-sm text-headline-sm text-secondary font-bold font-mono">387 AQI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 3 Core Pillars of Computational Atmospheric Intelligence */}
      <section className="bg-surface-container-low py-unit-2xl px-gutter-mobile lg:px-gutter-desktop border-y border-border-subtle">
        <div className="max-w-7xl mx-auto space-y-unit-xl">
          <div className="text-center max-w-2xl mx-auto space-y-unit-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
              Scientific Architecture
            </span>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial">
              Three Pillars of Hyperlocal Corridor Intelligence
            </h2>
            <p className="font-body-md text-on-surface-variant">
              Fusing spaceborne spectroscopy, advective fluid dynamics, and privacy-preserving decentralized AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
            {/* Pillar 1: GP Downscaler */}
            <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-sm border border-border-subtle flex flex-col justify-between space-y-unit-md hover:shadow-md transition-shadow">
              <div className="space-y-unit-xs">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">satellite_alt</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  Gaussian Process 0.1° Downscaler
                </h3>
                <p className="font-body-sm text-on-surface-variant leading-relaxed">
                  Fuses Sentinel-5P TROPOMI Absorbing Aerosol Index (AAI) with CPCB ground monitor PM2.5 readings using RBF + WhiteKernel regression onto a continuous 0.1-degree surface grid.
                </p>
              </div>
              <div className="pt-unit-sm border-t border-border-subtle/50 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                <span>Resolution: 10km grid</span>
                <span className="text-secondary font-bold">R² = 0.91</span>
              </div>
            </div>

            {/* Pillar 2: 72h Gaussian Plume Forecaster */}
            <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-sm border border-border-subtle flex flex-col justify-between space-y-unit-md hover:shadow-md transition-shadow">
              <div className="space-y-unit-xs">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[22px]">air</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  72-Hour Gaussian-Plume Forecaster
                </h3>
                <p className="font-body-sm text-on-surface-variant leading-relaxed">
                  Predicts downwind advection and dispersion polygons for t+24h, t+48h, and t+72h horizons based on VIIRS FRP clusters and Open-Meteo planetary boundary layer mixing heights.
                </p>
              </div>
              <div className="pt-unit-sm border-t border-border-subtle/50 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                <span>Lead Time: 72 hours</span>
                <span className="text-secondary font-bold">340m Inversion Cap</span>
              </div>
            </div>

            {/* Pillar 3: Flower Federated Learning */}
            <div className="bg-surface-container-lowest p-unit-lg rounded-xl shadow-sm border border-border-subtle flex flex-col justify-between space-y-unit-md hover:shadow-md transition-shadow">
              <div className="space-y-unit-xs">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-accent-blue">
                  <span className="material-symbols-outlined text-[22px]">hub</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  Privacy-Preserving Federated Learning
                </h3>
                <p className="font-body-sm text-on-surface-variant leading-relaxed">
                  Flower-driven FedAvg across Punjab agricultural emitter nodes and Delhi urban receptor nodes. Zero raw farm or patient records cross state borders—only weight tensors.
                </p>
              </div>
              <div className="pt-unit-sm border-t border-border-subtle/50 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                <span>Differential Privacy: ε=1.2</span>
                <span className="text-accent-emerald font-bold">+14.1% Accuracy Lift</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ground Station NCR Leaderboard Preview */}
      <section className="py-unit-2xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="max-w-7xl mx-auto space-y-unit-lg">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-unit-sm">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Live Ground Network</span>
              <h2 className="font-headline-lg text-headline-lg text-primary font-editorial font-bold">
                Airshed Station Leaderboard
              </h2>
            </div>
            <NavLink
              to="/dashboard"
              className="text-secondary font-label-md text-label-md hover:underline inline-flex items-center gap-1"
            >
              <span>View full corridor GIS map</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </NavLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-md">
            {mockStations.slice(0, 4).map((stn) => (
              <div key={stn.id} className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">{stn.city}</span>
                    <h4 className="font-headline-sm text-headline-sm text-primary font-bold">{stn.name.split(',')[0]}</h4>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{ backgroundColor: `${stn.category_color}18`, color: stn.category_color }}
                  >
                    {stn.category}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-border-subtle/50">
                  <div>
                    <span className="font-headline-md text-headline-md font-bold" style={{ color: stn.category_color }}>
                      {stn.aqi_index}
                    </span>
                    <span className="text-xs text-on-surface-variant uppercase ml-1">AQI</span>
                  </div>
                  <span className="font-mono text-xs text-on-surface-variant font-bold">
                    {stn.pm25_ugm3} µg/m³
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
