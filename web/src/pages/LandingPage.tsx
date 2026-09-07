import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(40);
  const [activeTimeTab, setActiveTimeTab] = useState<'0' | '24' | '48' | '72'>('0');
  const [mobileAlertModal, setMobileAlertModal] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setAudioProgress((prev) => (prev >= 98 ? 0 : prev + 1));
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Top Decorative Organic Accent Glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="relative w-full px-gutter-mobile lg:px-gutter-desktop pt-space-xl lg:pt-space-2xl pb-space-3xl flex flex-col gap-space-3xl">
        {/* HERO SECTION */}
        <section className="relative w-full flex flex-col items-center text-center">
          {/* Starburst & Badges Floating Accent */}
          <div className="flex flex-wrap items-center justify-center gap-space-sm mb-space-md">
            {/* Playful Starburst Badge */}
            <div className="inline-flex items-center gap-space-2xs px-space-md py-1 rounded-full bg-coral-watermelon-vivid text-on-secondary shadow-[3px_3px_0px_#18181B] -rotate-2 transform hover:rotate-0 transition-transform">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span className="font-label-md text-label-md uppercase tracking-wider">72H Advance Warning</span>
              <span className="text-on-secondary/70">•</span>
              <span className="font-label-md text-label-md uppercase tracking-wider">Zero Raw Data Crosses Borders</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-surface-vanilla text-ink-black shadow-[2px_2px_0px_#18181B] rotate-1">
              <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
              <span className="font-label-md text-label-md">GRAP Stage-IV Sync Active</span>
            </div>
          </div>

          {/* Expressive Serif Editorial Headline */}
          <div className="relative max-w-4xl mx-auto">
            <span className="absolute -top-6 -left-6 lg:-top-8 lg:-left-10 text-cobalt-deep text-4xl select-none">✦</span>
            <span className="absolute -bottom-4 -right-4 lg:-bottom-6 lg:-right-8 text-coral-watermelon-vivid text-3xl select-none">✦</span>
            <h1 className="font-display-lg text-display-lg text-ink-black tracking-tight leading-tight">
              Real-Time Airshed Intelligence for the{' '}
              <span className="italic text-terracotta-deep underline decoration-wavy decoration-coral-watermelon-vivid/60 underline-offset-8">
                Northern Indian
              </span>{' '}
              Smog Corridor.
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mt-space-lg max-w-2xl mx-auto font-body-lg text-body-lg text-ink-muted leading-relaxed">
            Tracking <strong className="text-ink-black font-semibold">35M tonnes</strong> of seasonal agricultural
            residue burning from Punjab &amp; Haryana to the Delhi Inversion Trap with 72-hour Gaussian plume physics and
            privacy-preserving federated machine learning.
          </p>

          {/* Hero Call-To-Actions */}
          <div className="mt-space-xl flex flex-wrap items-center justify-center gap-space-md">
            <Link
              to="/operations-war-room"
              className="inline-flex items-center gap-space-sm px-space-xl py-space-md rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[4px_4px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              <span>Launch Operations War Room</span>
              <span className="font-bold">➔</span>
            </Link>
            <button
              onClick={() => setMobileAlertModal(true)}
              className="inline-flex items-center gap-space-xs px-space-lg py-space-md rounded-full bg-surface-vanilla text-ink-black font-label-lg text-label-lg shadow-[3px_3px_0px_#18181B] hover:bg-surface-vanilla-strong hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-cobalt-deep">smartphone</span>
              <span>Download Field Mobile App</span>
            </button>
          </div>

          {/* Floating Quirky Audio Dispatch Scrubber Widget */}
          <div className="mt-space-2xl w-full max-w-3xl rounded-xl bg-surface-vanilla p-space-md shadow-[4px_4px_0px_#18181B] flex flex-col md:flex-row items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md w-full md:w-auto">
              <div className="relative w-12 h-12 rounded-lg bg-cobalt-deep text-canvas-cream flex items-center justify-center shadow-[2px_2px_0px_#18181B] shrink-0">
                <span className="material-symbols-outlined text-2xl">podcasts</span>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-coral-watermelon-vivid"></span>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-md text-label-md text-secondary uppercase font-bold tracking-wider">
                    Atmospheric Audio Briefing
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-label-md text-label-md text-ink-muted">Ep. 42 (Today 06:00 IST)</span>
                </div>
                <div className="font-title-sm text-title-sm text-ink-black font-semibold">
                  Northwesterly Vector Inversion: The 185m Nocturnal Lid
                </div>
              </div>
            </div>

            <div className="flex items-center gap-space-sm w-full md:w-auto justify-end">
              <button
                aria-label="Play brief"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-ink-black text-canvas-cream flex items-center justify-center shadow-[2px_2px_0px_#18181B] hover:scale-105 transition-transform cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <div className="flex flex-col gap-1 w-36">
                <div className="w-full bg-outline-variant h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-coral-watermelon-vivid h-full rounded-full transition-all duration-150"
                    style={{ width: `${audioProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between font-label-md text-label-md text-ink-muted">
                  <span>{isPlaying ? '02:14' : '00:00'}</span>
                  <span>05:30</span>
                </div>
              </div>
              <span className="px-2 py-1 rounded bg-surface-vanilla-strong font-label-md text-label-md text-ink-black font-semibold">
                1.5x
              </span>
            </div>
          </div>
        </section>

        {/* LIVE CORRIDOR TELEMETRY RIBBON */}
        <section className="w-full">
          <div className="rounded-xl bg-surface-vanilla-strong p-space-sm shadow-[3px_3px_0px_#18181B] flex flex-col lg:flex-row items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-canvas-cream text-ink-black shadow-[1px_1px_0px_#18181B]">
              <span className="w-2 h-2 rounded-full bg-coral-watermelon-vivid animate-ping"></span>
              <span className="font-label-md text-label-md uppercase tracking-wider font-bold">
                Corridor Live Feeds
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm w-full lg:w-auto flex-1 lg:ml-space-md">
              {/* Metric 1 */}
              <div className="flex items-center justify-between lg:justify-start gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <span className="text-xl">🔥</span>
                <div>
                  <div className="font-telemetry-val text-telemetry-val text-terracotta-deep">247</div>
                  <div className="font-label-md text-label-md text-ink-muted">Active Stubble Fires (VIIRS)</div>
                </div>
              </div>
              {/* Metric 2 */}
              <div className="flex items-center justify-between lg:justify-start gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <span className="text-xl">📡</span>
                <div>
                  <div className="font-telemetry-val text-telemetry-val text-cobalt-deep">312</div>
                  <div className="font-label-md text-label-md text-ink-muted">CAAQMS Stations Online</div>
                </div>
              </div>
              {/* Metric 3 */}
              <div className="flex items-center justify-between lg:justify-start gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <span className="text-xl">🌫️</span>
                <div>
                  <div className="flex items-center gap-space-2xs">
                    <span className="font-telemetry-val text-telemetry-val text-aqi-hazardous">178.4</span>
                    <span className="font-telemetry-unit text-telemetry-unit text-ink-muted">µg/m³ PM2.5</span>
                  </div>
                  <div className="font-label-md text-label-md font-bold text-aqi-hazardous">
                    AQI 287 Hazardous (Delhi NCR)
                  </div>
                </div>
              </div>
            </div>
            <div className="px-space-sm py-1 font-label-md text-label-md text-ink-muted hidden 2xl:block">
              Synced 4s ago • Sentinel-5P + Ground BAM
            </div>
          </div>
        </section>

        {/* GRAPHIC TRANSIT CORRIDOR ADVECTION DIAGRAM */}
        <section className="w-full rounded-2xl bg-surface-vanilla p-space-lg lg:p-space-xl shadow-[4px_4px_0px_#18181B] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
            <div>
              <div className="flex items-center gap-space-xs mb-space-2xs">
                <span className="px-2 py-0.5 rounded-full bg-cobalt-deep text-on-primary font-label-md text-label-md uppercase font-bold">
                  Physics Pipeline
                </span>
                <span className="font-label-md text-label-md text-ink-muted">Spatial Advection • T+72h</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-ink-black">
                The Trans-Indo-Gangetic Air Corridor
              </h2>
            </div>
            {/* Metric callout pill */}
            <div className="inline-flex items-center gap-space-sm px-space-md py-space-xs rounded-xl bg-surface-vanilla-strong shadow-[2px_2px_0px_#18181B]">
              <span className="material-symbols-outlined text-coral-watermelon-vivid text-2xl">compress</span>
              <div>
                <div className="font-label-md text-label-md text-ink-muted">Boundary Mixing Height</div>
                <div className="font-telemetry-val text-title-md text-ink-black font-extrabold">
                  185m <span className="font-body-sm text-body-sm font-normal text-terracotta-deep">(Severe Inversion Trap)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Graphical Vector Arc Diagram */}
          <div className="relative w-full rounded-xl bg-canvas-cream p-space-md lg:p-space-lg shadow-[2px_2px_0px_#18181B] overflow-hidden">
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(#18181B 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            ></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-stretch justify-between gap-space-lg">
              {/* Step 1: Upwind Source (Punjab) */}
              <div className="flex-1 rounded-xl bg-surface-vanilla p-space-md shadow-[3px_3px_0px_#18181B] flex flex-col justify-between relative">
                <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-md bg-terracotta-deep text-on-tertiary font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                  Origin: Sangrur / Tarn Taran
                </div>
                <div className="pt-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm text-ink-black font-bold">01. Biomass Ignition</span>
                    <span className="text-2xl">🔥</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-space-2xs">
                    Rapid thermal emissive bursts detected by NASA VIIRS. High-energy stubble burn release at 350°C-500°C.
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs border-t border-dashed border-outline-variant flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">Thermal Radiative Power:</span>
                  <span className="font-bold text-terracotta-deep">1,420 MW</span>
                </div>
              </div>

              {/* Connecting Arc Vector SVG */}
              <div className="hidden lg:flex flex-col items-center justify-center w-24">
                <svg className="w-24 h-16 text-cobalt-deep" fill="none" viewBox="0 0 100 60">
                  <path d="M 0 30 Q 50 -10 100 30" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="3" />
                  <circle cx="50" cy="10" fill="#FF5376" r="4" />
                  <polygon fill="currentColor" points="95,25 100,30 93,35" />
                </svg>
                <span className="font-label-md text-label-md text-cobalt-deep font-bold -mt-2">NW Winds 4.2m/s</span>
              </div>

              {/* Step 2: Transit & Chemical Aging */}
              <div className="flex-1 rounded-xl bg-surface-vanilla p-space-md shadow-[3px_3px_0px_#18181B] flex flex-col justify-between relative">
                <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-md bg-cobalt-deep text-on-primary font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                  Transit: Karnal / Panipat
                </div>
                <div className="pt-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm text-ink-black font-bold">02. Secondary Aerosols</span>
                    <span className="text-2xl">💨</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-space-2xs">
                    Advection under clear skies. Gaseous VOCs and NO₂ oxidize into secondary organic aerosols (PM2.5).
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs border-t border-dashed border-outline-variant flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">Photochemical Aging:</span>
                  <span className="font-bold text-cobalt-deep">+42% fine mass</span>
                </div>
              </div>

              {/* Connecting Arc Vector SVG */}
              <div className="hidden lg:flex flex-col items-center justify-center w-24">
                <svg className="w-24 h-16 text-coral-watermelon-vivid" fill="none" viewBox="0 0 100 60">
                  <path d="M 0 30 Q 50 60 100 30" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="3" />
                  <circle cx="50" cy="45" fill="#18181B" r="4" />
                  <polygon fill="currentColor" points="95,25 100,30 93,35" />
                </svg>
                <span className="font-label-md text-label-md text-coral-watermelon-vivid font-bold -mt-2">Subsidence Zone</span>
              </div>

              {/* Step 3: Terminal Inversion Trap */}
              <div className="flex-1 rounded-xl bg-surface-vanilla p-space-md shadow-[3px_3px_0px_#18181B] flex flex-col justify-between relative">
                <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-md bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                  Sink: Anand Vihar / IGI Trap
                </div>
                <div className="pt-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm text-ink-black font-bold">03. Nocturnal Trapping</span>
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-space-2xs">
                    Mixing depth plummets to 185m after sunset. High topography &amp; heat island lock the plume at ground level.
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs border-t border-dashed border-outline-variant flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">Inversion Severity:</span>
                  <span className="font-bold text-aqi-hazardous">Severe (GRAP-IV)</span>
                </div>
              </div>
            </div>

            {/* Interactive Scrub Bar for Transit Timeline */}
            <div className="mt-space-lg pt-space-md border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-cobalt-deep text-lg">schedule</span>
                <span className="font-label-lg text-label-lg text-ink-black">Dispersion Timeline Scrub:</span>
              </div>
              <div className="flex items-center gap-space-xs">
                {(['0', '24', '48', '72'] as const).map((hour) => (
                  <button
                    key={hour}
                    onClick={() => setActiveTimeTab(hour)}
                    className={`px-space-sm py-1 rounded-full font-label-md text-label-md transition-all shadow-[1px_1px_0px_#18181B] cursor-pointer ${
                      activeTimeTab === hour
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-vanilla text-ink-black hover:bg-surface-vanilla-strong'
                    }`}
                  >
                    {hour === '0' ? 'T+0h (Now)' : hour === '72' ? 'T+72h Forecast' : `T+${hour}h`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3 CORE PILLARS IN RETRO TACTILE CARDS WITH NUMBERED PILLS */}
        <section className="w-full flex flex-col gap-space-lg">
          <div className="flex flex-col items-center text-center">
            <span className="px-space-md py-1 rounded-full bg-surface-vanilla font-label-md text-label-md text-ink-black uppercase shadow-[2px_2px_0px_#18181B]">
              Algorithmic Architecture
            </span>
            <h2 className="mt-space-xs font-headline-lg text-headline-lg text-ink-black">
              Three Layers of Atmospheric Defense
            </h2>
            <p className="font-body-md text-body-md text-ink-muted max-w-xl">
              Engineered for state pollution boards, municipal regulators, and airborne emergency response task forces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
            {/* Pillar 01: FUSE */}
            <div className="rounded-2xl bg-surface-vanilla p-space-lg shadow-[4px_4px_0px_#18181B] flex flex-col justify-between hover:-translate-y-1 hover:shadow-[6px_6px_0px_#18181B] transition-all">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="w-10 h-10 rounded-full bg-cobalt-deep text-on-primary font-telemetry-val text-headline-sm flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
                    01
                  </span>
                  <span className="px-space-sm py-1 rounded-full bg-canvas-cream text-cobalt-deep font-label-md text-label-md uppercase font-bold shadow-[1px_1px_0px_#18181B]">
                    GPR Downscaler
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-ink-black mb-space-xs">FUSE</h3>
                <div className="font-title-sm text-title-sm text-cobalt-deep font-bold mb-space-sm">
                  Continuous 0.1° Blended Surface
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  Gaussian Process Regression seamlessly fuses orbital Sentinel-5P Absorbing Aerosol Index (AAI) with
                  terrestrial CPCB BAM-1020 beta-attenuation gauges, eradicating rural monitor blackouts.
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Resolution:</span>
                <span className="font-bold text-ink-black">1.1km² Multi-Sensor Grid</span>
              </div>
            </div>

            {/* Pillar 02: PREDICT */}
            <div className="rounded-2xl bg-surface-vanilla p-space-lg shadow-[4px_4px_0px_#18181B] flex flex-col justify-between hover:-translate-y-1 hover:shadow-[6px_6px_0px_#18181B] transition-all">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="w-10 h-10 rounded-full bg-coral-watermelon-vivid text-on-secondary font-telemetry-val text-headline-sm flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
                    02
                  </span>
                  <span className="px-space-sm py-1 rounded-full bg-canvas-cream text-secondary font-label-md text-label-md uppercase font-bold shadow-[1px_1px_0px_#18181B]">
                    Eulerian-Lagrangian
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-ink-black mb-space-xs">PREDICT</h3>
                <div className="font-title-sm text-title-sm text-secondary font-bold mb-space-sm">
                  72h Gaussian Plume Physics
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  Dynamical advection models simulated against diurnal planetary boundary layer (PBL) compressions.
                  Predicts localized smoke wavefront arrival with sub-district precision down to block level.
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Forecast Horizon:</span>
                <span className="font-bold text-ink-black">72 Hours Forward Lead</span>
              </div>
            </div>

            {/* Pillar 03: FEDERATE */}
            <div className="rounded-2xl bg-surface-vanilla p-space-lg shadow-[4px_4px_0px_#18181B] flex flex-col justify-between hover:-translate-y-1 hover:shadow-[6px_6px_0px_#18181B] transition-all">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="w-10 h-10 rounded-full bg-forest-jade text-on-primary font-telemetry-val text-headline-sm flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
                    03
                  </span>
                  <span className="px-space-sm py-1 rounded-full bg-canvas-cream text-forest-jade font-label-md text-label-md uppercase font-bold shadow-[1px_1px_0px_#18181B]">
                    Flower FL Protocol
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-ink-black mb-space-xs">FEDERATE</h3>
                <div className="font-title-sm text-title-sm text-forest-jade font-bold mb-space-sm">
                  Zero Raw Data Exfiltration
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  Punjab, Haryana, and Delhi SPCB nodes execute decentralized on-premise LSTM weights optimization.
                  Model gradients synchronize over zero-trust secure aggregators without jurisdictional friction.
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Privacy Guarantees:</span>
                <span className="font-bold text-ink-black">Differential Privacy (ε=0.8)</span>
              </div>
            </div>
          </div>
        </section>

        {/* AIRSHED CASE STUDY & TACTILE CARD DECK */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center" id="war-room-preview">
          {/* Left Editorial Story Canvas (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-space-md">
            <div className="inline-flex items-center gap-space-xs">
              <span className="w-3 h-3 rounded-full bg-terracotta-deep"></span>
              <span className="font-label-md text-label-md uppercase tracking-wider font-bold text-ink-black">
                Airshed Case Study: 03 November 2024
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-ink-black">
              When the Winds Shifted 14° Clockwise: How PRANA Gave 38-Hour Notice
            </h2>
            <p className="font-body-lg text-body-lg text-ink-muted">
              Traditional meteorological models failed to catch the shallow thermal inversion collapse over the Yamuna
              floodplain. By federating telemetry from 48 rural farmer cooperative sensors with Sentinel-5P tropospheric
              NO₂, PRANA triggered automatic GRAP-IV enforcement flags.
            </p>

            {/* Mini-stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm mt-space-sm">
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <div className="font-label-md text-label-md text-ink-muted">Advance Alert Lead</div>
                <div className="font-telemetry-val text-telemetry-val text-cobalt-deep mt-1">38.4 hrs</div>
                <div className="font-label-md text-label-md text-forest-jade font-semibold">vs 6h baseline</div>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <div className="font-label-md text-label-md text-ink-muted">Prevented Influx</div>
                <div className="font-telemetry-val text-telemetry-val text-terracotta-deep mt-1">-28% PM</div>
                <div className="font-label-md text-label-md text-ink-muted">via targeted bans</div>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B] col-span-2 sm:col-span-1">
                <div className="font-label-md text-label-md text-ink-muted">SPCB Interventions</div>
                <div className="font-telemetry-val text-telemetry-val text-ink-black mt-1">1,820</div>
                <div className="font-label-md text-label-md text-secondary font-semibold">Sprinkler deployments</div>
              </div>
            </div>

            <div className="flex items-center gap-space-sm pt-space-sm">
              <Link
                to="/spcb-incident-command"
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-cobalt-deep text-on-primary font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
              >
                <span>Read Complete SPCB Incident Dossier</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </Link>
            </div>
          </div>

          {/* Right: Tactile Mockup Device (5 cols) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-[32px] bg-surface-vanilla p-space-md shadow-[6px_6px_0px_#18181B] relative border-2 border-ink-black">
              {/* Device Top Pill */}
              <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-outline-variant">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-ink-black"></span>
                  <span className="font-label-md text-label-md font-bold text-ink-black">PRANA Field Agent</span>
                </div>
                <span className="font-label-md text-label-md px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-bold">
                  LIVE
                </span>
              </div>

              {/* Phone Graphic Artwork Container */}
              <div className="rounded-2xl bg-canvas-cream p-space-md shadow-[2px_2px_0px_#18181B] flex flex-col items-center text-center">
                {/* Illustrated Graphic Motif */}
                <div className="w-28 h-28 rounded-full bg-secondary-fixed flex items-center justify-center relative my-space-xs shadow-[2px_2px_0px_#18181B]">
                  <span className="text-5xl select-none">🫁</span>
                  <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold rotate-6">
                    POOR
                  </div>
                </div>

                <div className="font-headline-sm text-headline-sm text-ink-black mt-space-2xs">
                  Daily Breath Forecast
                </div>
                <p className="font-body-sm text-body-sm text-ink-muted mb-space-sm">
                  Rohini Sector 16 • Outdoor exercise unadvised between 18:00 and 09:00.
                </p>

                {/* Dual-Unit Telemetry Chip inside Device */}
                <div className="w-full flex items-center justify-between p-space-xs rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-ink-black">
                  <div className="flex items-center gap-space-2xs pl-space-sm">
                    <span className="font-telemetry-val text-body-lg font-bold">142.8</span>
                    <span className="font-telemetry-unit text-label-md text-ink-muted">µg/m³</span>
                  </div>
                  <div className="w-px h-6 bg-outline-variant"></div>
                  <div className="flex items-center gap-space-2xs pr-space-sm">
                    <span className="w-2 h-2 rounded-full bg-aqi-hazardous"></span>
                    <span className="font-label-md text-label-md font-extrabold text-aqi-hazardous">AQI 294</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action in Mockup */}
              <div className="mt-space-md flex items-center justify-between gap-space-xs">
                <Link
                  to="/operations-war-room"
                  className="flex-1 text-center py-2 rounded-full bg-ink-black text-canvas-cream font-label-md text-label-md font-bold shadow-[2px_2px_0px_#1D4ED8]"
                >
                  Verify Stubble Alert
                </Link>
                <button
                  aria-label="Audio brief"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-full bg-surface-vanilla-strong text-ink-black shadow-[2px_2px_0px_#18181B]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">
                    {isPlaying ? 'volume_off' : 'volume_up'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER CALLOUT BANNER (Section 31A Air Act 1981) */}
        <section className="w-full">
          <div className="rounded-2xl bg-ink-black text-canvas-cream p-space-xl shadow-[6px_6px_0px_#EA580C] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-space-lg">
            {/* Abstract subtle starburst in corner */}
            <div className="pointer-events-none absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-terracotta-deep/20 blur-xl"></div>
            <div className="max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-space-2xs px-space-sm py-0.5 rounded-full bg-terracotta-deep text-on-tertiary font-label-md text-label-md font-bold uppercase tracking-wider mb-space-sm shadow-[1px_1px_0px_#FAF6EE]">
                Statutory Mandate
              </div>
              <h2 className="font-headline-lg text-headline-lg text-canvas-cream">
                Ready for SPCB Emergency Intervention?
              </h2>
              <p className="font-body-md text-body-md text-canvas-cream/80 mt-space-2xs">
                Authorized under <strong className="text-canvas-cream font-semibold">Section 31A of the Air (Prevention and Control of Pollution) Act, 1981</strong>. State Pollution Control Boards gain cryptographic access to inter-state dispersion evidence, aerial plume vectors, and automated notice generators.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-space-sm shrink-0 w-full md:w-auto relative z-10">
              <Link
                to="/spcb-incident-command"
                className="w-full sm:w-auto text-center px-space-xl py-space-md rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-lg text-label-lg shadow-[3px_3px_0px_#ffffff] hover:-translate-y-0.5 transition-transform font-bold"
              >
                Request Command Access
              </Link>
              <Link
                to="/federated-mesh"
                className="w-full sm:w-auto text-center px-space-lg py-space-md rounded-full bg-surface-vanilla/10 text-canvas-cream font-label-lg text-label-lg hover:bg-surface-vanilla/20 transition-colors"
              >
                Explore Federated Mesh
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile App Download Modal */}
      {mobileAlertModal && (
        <div className="fixed inset-0 z-50 bg-ink-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-vanilla rounded-3xl p-6 max-w-md w-full border-2 border-ink-black shadow-[6px_6px_0px_#18181B] relative">
            <button
              onClick={() => setMobileAlertModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-canvas-cream shadow-[1px_1px_0px_#18181B] text-ink-black"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-cobalt-deep text-[28px]">smartphone</span>
              <h3 className="font-headline-sm text-headline-sm font-bold text-ink-black">PRANA Field Mobile Client</h3>
            </div>
            <p className="font-body-md text-body-md text-ink-muted mb-4">
              Direct telemetry client with offline Bluetooth sync for field inspectors, district magistrates, and agrarian enforcement teams.
            </p>
            <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 font-mono text-xs text-ink-black mb-4 flex items-center justify-between">
              <span>Android APK / iOS TestFlight</span>
              <span className="px-2 py-0.5 rounded bg-forest-jade/20 text-forest-jade font-bold">Build 2026.09</span>
            </div>
            <button
              onClick={() => setMobileAlertModal(false)}
              className="w-full py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8]"
            >
              Close Notification
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
