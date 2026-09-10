import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BriefingResponse,
  AlertsResponse,
  BiomassEmissionsResponse,
  HotspotsResponse,
  FLStatusResponse,
  MeteorologyResponse,
  MobileReleaseResponse,
  PlumeResponse,
  StationsResponse,
  SurfaceGridResponse,
  fetchAlerts,
  fetchAqiSurface,
  fetchBiomassEmissions,
  fetchForecastPlume,
  fetchFederatedStatus,
  fetchHotspots,
  fetchLatestBriefing,
  fetchLatestMobileRelease,
  fetchMeteorology,
  fetchStations,
  formatDataSource,
  formatFederatedDataset,
  formatFederatedImplementation,
  getAqiCategoryAndColor,
} from '../api/client';

export const LandingPage: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activeTimeTab, setActiveTimeTab] = useState<'0' | '24' | '48' | '72'>('0');
  const [mobileAlertModal, setMobileAlertModal] = useState(false);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [mobileRelease, setMobileRelease] = useState<MobileReleaseResponse | null | undefined>(undefined);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [stations, setStations] = useState<StationsResponse | null>(null);
  const [surface, setSurface] = useState<SurfaceGridResponse | null>(null);
  const [meteorology, setMeteorology] = useState<MeteorologyResponse | null>(null);
  const [biomass, setBiomass] = useState<BiomassEmissionsResponse | null>(null);
  const [forecast, setForecast] = useState<PlumeResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [federated, setFederated] = useState<FLStatusResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    document.title = 'PRANA Air — Atmospheric Intelligence & Early Warning System';
    fetchLatestBriefing().then(setBriefing).catch(() => setBriefing(null));
    fetchLatestMobileRelease().then(setMobileRelease).catch(() => setMobileRelease(null));
    fetchHotspots(24, 'nominal').then(setHotspotsData => setHotspots(setHotspotsData)).catch(() => setHotspots(null));
    fetchStations('pm25').then(setStations).catch(() => setStations(null));
    fetchAqiSurface(0.5).then(setSurface).catch(() => setSurface(null));
    fetchMeteorology().then(setMeteorology).catch(() => setMeteorology(null));
    fetchBiomassEmissions(7).then(setBiomass).catch(() => setBiomass(null));
    fetchForecastPlume().then(setForecast).catch(() => setForecast(null));
    fetchAlerts(undefined, 20).then(setAlerts).catch(() => setAlerts(null));
    fetchFederatedStatus().then(setFederated).catch(() => setFederated(null));
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!briefing?.audio_url) return;
    const audio = new Audio(briefing.audio_url);
    audio.playbackRate = 1.5;
    audioRef.current = audio;
    const updateProgress = () => {
      setAudioProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const stopPlayback = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', stopPlayback);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', stopPlayback);
      audioRef.current = null;
    };
  }, [briefing?.audio_url]);

  const handleAudioToggle = async () => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.paused) {
        try {
          await audio.play();
          setIsPlaying(true);
          return;
        } catch {
          // Fall through to browser speech for the live briefing script.
        }
      } else {
        audio.pause();
        setIsPlaying(false);
        return;
      }
    }

    const script = briefing?.script;
    if (!script || !('speechSynthesis' in window)) return;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.rate = 1.5;
      utterance.onboundary = (event) => {
        setAudioProgress(Math.min(100, (event.charIndex / script.length) * 100));
      };
      utterance.onend = () => {
        setAudioProgress(100);
        setIsPlaying(false);
      };
      utterance.onerror = () => setIsPlaying(false);
      speechRef.current = utterance;
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleOpenMobileRelease = async () => {
    setMobileAlertModal(true);
    if (mobileRelease === undefined) {
      try {
        setMobileRelease(await fetchLatestMobileRelease());
      } catch {
        setMobileRelease(null);
      }
    }
  };

  const closestSurface = (longitude: number, latitude: number) => surface?.features.reduce((closest, feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const [closestLon, closestLat] = closest.geometry.coordinates;
    return Math.hypot(lon - longitude, lat - latitude) < Math.hypot(closestLon - longitude, closestLat - latitude)
      ? feature : closest;
  }, surface.features[0]);
  const delhiSurface = closestSurface(77.2, 28.6);
  const transitSurface = closestSurface(76.99, 29.69);
  const delhiAqi = delhiSurface?.properties.aqi_index;
  const delhiPm25 = delhiSurface?.properties.pm25_estimate;
  const delhiCategory = delhiAqi == null ? null : getAqiCategoryAndColor(delhiAqi).category;
  const totalFrp = biomass?.regions.reduce((sum, region) => sum + region.frp_sum_mw, 0);
  const punjabMeteo = meteorology?.regions.punjab;
  const delhiMeteo = meteorology?.regions.delhi;
  const forecastHorizon = forecast?.features.length
    ? Math.max(...forecast.features.map((feature) => feature.properties.horizon_hours))
    : null;
  const dp = federated?.privacy?.dp_sgd;
  const originStation = stations?.value.find((s) => /sangrur|tarn taran|ludhiana|patiala|bathinda|amritsar/i.test(s.name)) || stations?.value[0];
  const transitStation = stations?.value.find((s) => /panipat|karnal|kurukshetra|sonipat/i.test(s.name));
  const sinkStation = stations?.value.find((s) => /anand vihar|delhi|ito|rk puram|mandir marg/i.test(s.name));

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
              <span className="font-label-md text-label-md uppercase tracking-wider">Client Fit Metrics Withheld</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-surface-vanilla text-ink-black shadow-[2px_2px_0px_#18181B] rotate-1">
              <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
              <span className="font-label-md text-label-md">{delhiCategory ? `${delhiCategory} Delhi AQI Conditions` : 'AQI unavailable'}</span>
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
            Tracking <strong className="text-ink-black font-semibold">{hotspots?.count ?? 'live'}</strong> current fire detections
            from Punjab &amp; Haryana to the Delhi receptor basin with 72-hour Gaussian plume physics and
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
              onClick={handleOpenMobileRelease}
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
                  <span className="font-label-md text-label-md text-ink-muted">{briefing?.audio_status ?? 'Checking briefing service'}</span>
                </div>
                <div className="font-title-sm text-title-sm text-ink-black font-semibold">
                  {briefing?.script || 'No current atmospheric briefing is available.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-space-sm w-full md:w-auto justify-end">
              <button
                aria-label="Play brief"
                onClick={handleAudioToggle}
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
                  <span>{Math.round(audioProgress)}%</span>
                  <span>{briefing?.audio_url ? 'Audio' : briefing?.script ? (isPlaying ? 'Narrating Brief...' : 'Browser Narration') : 'Unavailable'}</span>
                </div>
              </div>
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-5 px-1">
                  <span className="w-1 bg-coral-watermelon-vivid rounded-full animate-audio-bar-1"></span>
                  <span className="w-1 bg-coral-watermelon-vivid rounded-full animate-audio-bar-2"></span>
                  <span className="w-1 bg-coral-watermelon-vivid rounded-full animate-audio-bar-3"></span>
                  <span className="w-1 bg-coral-watermelon-vivid rounded-full animate-audio-bar-4"></span>
                </div>
              )}
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
                  <div className="font-telemetry-val text-telemetry-val text-terracotta-deep">{hotspots?.count ?? 'N/A'}</div>
                  <div className="font-label-md text-label-md text-ink-muted">Active Stubble Fires (VIIRS)</div>
                </div>
              </div>
              {/* Metric 2 */}
              <div className="flex items-center justify-between lg:justify-start gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <span className="text-xl">📡</span>
                <div>
                  <div className="font-telemetry-val text-telemetry-val text-cobalt-deep">{stations?.['@iot.count'] ?? 'N/A'}</div>
                  <div className="font-label-md text-label-md text-ink-muted">CAAQMS Stations Online</div>
                </div>
              </div>
              {/* Metric 3 */}
              <div className="flex items-center justify-between lg:justify-start gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <span className="text-xl">🌫️</span>
                <div>
                  <div className="flex items-center gap-space-2xs">
                    <span className="font-telemetry-val text-telemetry-val text-aqi-hazardous">{delhiPm25 == null ? 'N/A' : delhiPm25.toFixed(1)}</span>
                    <span className="font-telemetry-unit text-telemetry-unit text-ink-muted">µg/m³ PM2.5</span>
                  </div>
                  <div className="font-label-md text-label-md font-bold text-aqi-hazardous">
                    {delhiAqi == null ? 'AQI unavailable (Delhi NCR)' : `AQI ${delhiAqi} ${delhiCategory} (Delhi NCR)`}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-space-sm py-1 font-label-md text-label-md text-ink-muted hidden 2xl:block">
              {surface ? `Updated ${new Date(surface.computed_at).toLocaleTimeString()} • ${formatDataSource(surface.source)}` : 'Backend surface unavailable'}
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
                <span className="font-label-md text-label-md text-ink-muted">Spatial Advection • T+{activeTimeTab}h</span>
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
                  {delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m` : 'N/A'} <span className="font-body-sm text-body-sm font-normal text-terracotta-deep">(Live Boundary Layer)</span>
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
                  Origin: {originStation ? originStation.name : 'Sangrur / Tarn Taran'}
                </div>
                <div className="pt-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm text-ink-black font-bold">01. Biomass Ignition</span>
                    <span className="text-2xl">🔥</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-space-2xs">
                    {hotspots ? `${hotspots.count} current detections from ${formatDataSource(hotspots.source)}.` : 'Waiting for the current thermal hotspot feed.'}
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs border-t border-dashed border-outline-variant flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">Thermal Radiative Power:</span>
                  <span className="font-bold text-terracotta-deep">{totalFrp == null ? 'N/A' : `${totalFrp.toFixed(1)} MW`}</span>
                </div>
              </div>

              {/* Connecting Arc Vector SVG */}
              <div className="hidden lg:flex flex-col items-center justify-center w-24">
                <svg className="w-24 h-16 text-cobalt-deep" fill="none" viewBox="0 0 100 60">
                  <path className="animate-dash-flow" d="M 0 30 Q 50 -10 100 30" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="3" />
                  <circle cx="50" cy="10" fill="#FF5376" r="4" />
                  <polygon fill="currentColor" points="95,25 100,30 93,35" />
                </svg>
                <span className="font-label-md text-label-md text-cobalt-deep font-bold -mt-2">{punjabMeteo ? `${punjabMeteo.wind_speed_ms.toFixed(2)}m/s from ${punjabMeteo.wind.direction_from_deg.toFixed(0)}°` : 'Wind unavailable'}</span>
              </div>

              {/* Step 2: Transit & Chemical Aging */}
              <div className="flex-1 rounded-xl bg-surface-vanilla p-space-md shadow-[3px_3px_0px_#18181B] flex flex-col justify-between relative">
                <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-md bg-cobalt-deep text-on-primary font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                  Transit: {transitStation ? transitStation.name : 'Karnal / Panipat'}
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
                  <span className="font-bold text-cobalt-deep">{transitSurface ? `${transitSurface.properties.pm25_estimate.toFixed(1)} µg/m³ PM2.5` : 'Unavailable'}</span>
                </div>
              </div>

              {/* Connecting Arc Vector SVG */}
              <div className="hidden lg:flex flex-col items-center justify-center w-24">
                <svg className="w-24 h-16 text-coral-watermelon-vivid" fill="none" viewBox="0 0 100 60">
                  <path className="animate-dash-flow" d="M 0 30 Q 50 60 100 30" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="3" />
                  <circle cx="50" cy="45" fill="#18181B" r="4" />
                  <polygon fill="currentColor" points="95,25 100,30 93,35" />
                </svg>
                <span className="font-label-md text-label-md text-coral-watermelon-vivid font-bold -mt-2">Receptor Zone</span>
              </div>

              {/* Step 3: Terminal Inversion Trap */}
              <div className="flex-1 rounded-xl bg-surface-vanilla p-space-md shadow-[3px_3px_0px_#18181B] flex flex-col justify-between relative">
                <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-md bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                  Sink: {sinkStation ? sinkStation.name : 'Anand Vihar / IGI Trap'}
                </div>
                <div className="pt-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-title-sm text-ink-black font-bold">03. Delhi Receptor Conditions</span>
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-space-2xs">
                    The backend reports a {delhiMeteo ? `${delhiMeteo.mixing_layer_height_m_agl.toFixed(0)}m` : 'currently unavailable'} boundary layer. Inversion depth requires a vertical temperature profile.
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs border-t border-dashed border-outline-variant flex justify-between font-label-md text-label-md">
                  <span className="text-ink-muted">Inversion Severity:</span>
                  <span className="font-bold text-aqi-hazardous">{meteorology?.inversion.status === 'not_measured' ? 'Not measured' : meteorology?.inversion.status ?? 'Unavailable'}</span>
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
                    Live AQI Surface
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-ink-black mb-space-xs">FUSE</h3>
                <div className="font-title-sm text-title-sm text-cobalt-deep font-bold mb-space-sm">
                  {surface ? `${surface.resolution_deg}° Backend Surface` : 'Surface feed unavailable'}
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  {surface
                    ? `${formatDataSource(surface.source)}. The current response contains ${surface.features.length} model points and ${stations?.['@iot.count'] ?? 0} ground-station observations.`
                    : 'Waiting for the backend AQI surface response.'}
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Resolution:</span>
                <span className="font-bold text-ink-black">{surface ? `${surface.resolution_deg}° grid` : 'Unavailable'}</span>
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
                  {forecastHorizon == null ? 'No Active Plume Forecast' : `${forecastHorizon}h Gaussian Plume Forecast`}
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  {forecast
                    ? `${formatDataSource(forecast.source)}. The backend currently returns ${forecast.features.length} computed plume envelope${forecast.features.length === 1 ? '' : 's'} from live fire and meteorology inputs.`
                    : 'Waiting for the backend plume response.'}
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Forecast Horizon:</span>
                <span className="font-bold text-ink-black">{forecastHorizon == null ? 'No current envelope' : `${forecastHorizon} hours`}</span>
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
                    Backend FL Protocol
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-ink-black mb-space-xs">FEDERATE</h3>
                <div className="font-title-sm text-title-sm text-forest-jade font-bold mb-space-sm">
                  {formatFederatedImplementation(federated?.implementation)}
                </div>
                <p className="font-body-md text-body-md text-ink-muted leading-relaxed">
                  {federated
                    ? `The current backend run uses a ${formatFederatedDataset(federated.dataset).toLowerCase()}. It is a local protocol demonstration and does not represent live participating agencies.`
                    : 'Waiting for the federated backend status.'}
                </p>
              </div>
              <div className="mt-space-lg pt-space-sm border-t border-outline-variant flex items-center justify-between font-label-md text-label-md">
                <span className="text-ink-muted">Configured Privacy:</span>
                <span className="font-bold text-ink-black">{dp?.enabled ? `Differential privacy ε=${dp.epsilon_spent ?? dp.target_epsilon ?? 'N/A'}` : 'Federated run unavailable'}</span>
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
                Live Airshed Snapshot: {surface ? new Date(surface.computed_at).toLocaleDateString() : 'Unavailable'}
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-ink-black">
              Current Punjab-to-Delhi Corridor Conditions
            </h2>
            <p className="font-body-lg text-body-lg text-ink-muted">
              Open-Meteo reports {punjabMeteo ? `${punjabMeteo.wind_speed_ms.toFixed(2)} m/s winds from ${punjabMeteo.wind.direction_from_deg.toFixed(0)}° over Punjab` : 'wind data is unavailable'}.
              NASA FIRMS currently reports {hotspots?.count ?? 'N/A'} matching fire detections, while the CAMS surface provides {surface?.features.length ?? 'N/A'} current model grid points.
            </p>

            {/* Mini-stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm mt-space-sm">
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <div className="font-label-md text-label-md text-ink-muted">Plume Envelopes</div>
                <div className="font-telemetry-val text-telemetry-val text-cobalt-deep mt-1">{forecast?.features.length ?? 'N/A'}</div>
                <div className="font-label-md text-label-md text-forest-jade font-semibold">current backend forecast</div>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B]">
                <div className="font-label-md text-label-md text-ink-muted">Surface Grid</div>
                <div className="font-telemetry-val text-telemetry-val text-terracotta-deep mt-1">{surface?.features.length ?? 'N/A'}</div>
                <div className="font-label-md text-label-md text-ink-muted">current model points</div>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B] col-span-2 sm:col-span-1">
                <div className="font-label-md text-label-md text-ink-muted">Backend Incidents</div>
                <div className="font-telemetry-val text-telemetry-val text-ink-black mt-1">{alerts?.count ?? 'N/A'}</div>
                <div className="font-label-md text-label-md text-secondary font-semibold">currently recorded</div>
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
                    {delhiCategory?.toUpperCase() ?? 'DATA PENDING'}
                  </div>
                </div>

                <div className="font-headline-sm text-headline-sm text-ink-black mt-space-2xs">
                  Daily Breath Forecast
                </div>
                <p className="font-body-sm text-body-sm text-ink-muted mb-space-sm">
                  Delhi NCR model grid • Review current local public-health advisories before outdoor activity.
                </p>

                {/* Dual-Unit Telemetry Chip inside Device */}
                <div className="w-full flex items-center justify-between p-space-xs rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-ink-black">
                  <div className="flex items-center gap-space-2xs pl-space-sm">
                    <span className="font-telemetry-val text-body-lg font-bold">{delhiPm25 == null ? 'N/A' : delhiPm25.toFixed(1)}</span>
                    <span className="font-telemetry-unit text-label-md text-ink-muted">µg/m³</span>
                  </div>
                  <div className="w-px h-6 bg-outline-variant"></div>
                  <div className="flex items-center gap-space-2xs pr-space-sm">
                    <span className="w-2 h-2 rounded-full bg-aqi-hazardous"></span>
                    <span className="font-label-md text-label-md font-extrabold text-aqi-hazardous">{delhiAqi == null ? 'AQI unavailable' : `AQI ${delhiAqi}`}</span>
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
                  onClick={handleAudioToggle}
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
              {mobileRelease
                ? 'The signed field-client release is available from the configured artifact service.'
                : 'No signed mobile build or mobile artifact host is configured in the backend.'}
            </p>
            <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 font-mono text-xs text-ink-black mb-4 flex items-center justify-between">
              <span>{mobileRelease ? 'Signed mobile release' : 'Android APK / iOS TestFlight'}</span>
              <span className="px-2 py-0.5 rounded bg-forest-jade/20 text-forest-jade font-bold">{mobileRelease ? `Build ${mobileRelease.version}` : 'Not configured'}</span>
            </div>
            <button
              onClick={() => {
                if (mobileRelease) window.location.assign(mobileRelease.download_url);
                else setMobileAlertModal(false);
              }}
              className="w-full py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8]"
            >
              {mobileRelease ? 'Download Signed Release' : 'Close Notification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
