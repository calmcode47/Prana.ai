import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import {
  connectCorridorWebSocket,
  downloadLegalDossier,
  fetchAlerts,
  fetchAqiSurface,
  fetchHotspots,
  fetchReady,
  fetchStations,
  formatDataSource,
} from '../api/client';

export const Header: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dossierStatus, setDossierStatus] = useState<'idle' | 'exporting' | 'done' | 'empty' | 'error'>('idle');
  const [dbStatus, setDbStatus] = useState<string>('Checking backend...');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [fireCount, setFireCount] = useState<number | null>(null);
  const [stationCount, setStationCount] = useState<number | null>(null);
  const [latestPm25, setLatestPm25] = useState<number | null>(null);
  const [latestAqi, setLatestAqi] = useState<number | null>(null);
  const [firmsSource, setFirmsSource] = useState('Checking feed');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('prana_theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('prana_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('prana_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  useEffect(() => {
    fetchReady()
      .then((res) => {
        setDbStatus(res.db === 'connected' ? 'PostGIS Connected'
          : res.db === 'local-persistent' ? 'Local Persistent Store'
          : res.db === 'in-memory' ? 'In-Memory Store'
          : `Storage: ${res.db || 'N/A'}`);
        setIsDemoMode(res.demo_mode);
      })
      .catch(() => {
        setDbStatus('Backend Unavailable');
      });
  }, []);

  useEffect(() => {
    fetchHotspots(24, 'nominal').then((data) => {
      setFireCount(data.count);
      setFirmsSource(data.source);
      setLastSync(data.fetched_at);
    }).catch(() => setFirmsSource('Feed unavailable'));

    Promise.all([fetchStations('pm25'), fetchAqiSurface(0.5)]).then(([data, surface]) => {
      setStationCount(data['@iot.count']);
      const observations = data.value.flatMap((station) =>
        station.Datastreams.flatMap((stream) => stream.Observations)
      );
      const latest = observations.sort((a, b) =>
        Date.parse(b.phenomenonTime) - Date.parse(a.phenomenonTime)
      )[0];
      const delhiSurface = surface.features.reduce((closest, feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const [closestLongitude, closestLatitude] = closest.geometry.coordinates;
        return Math.hypot(longitude - 77.2, latitude - 28.6) < Math.hypot(closestLongitude - 77.2, closestLatitude - 28.6)
          ? feature : closest;
      }, surface.features[0]);
      setLatestPm25(latest?.pm25_ugm3 ?? delhiSurface?.properties.pm25_estimate ?? null);
      setLatestAqi(latest?.aqi_index ?? delhiSurface?.properties.aqi_index ?? null);
    }).catch(() => setStationCount(null));

    return connectCorridorWebSocket('ncr', () => undefined, setWsStatus);
  }, []);

  const navLinks = [
    { label: 'Operations War Room', path: '/operations-war-room', aliases: ['/dashboard'] },
    { label: '72h Plume Forecast', path: '/72h-plume-forecast', aliases: ['/forecast'] },
    { label: 'Air Corridor Map', path: '/air-corridor-map', aliases: ['/map'] },
    { label: 'Federated Mesh', path: '/federated-mesh', aliases: ['/federated'] },
    { label: 'SPCB Incident Command', path: '/spcb-incident-command', aliases: ['/alerts'] },
    { label: 'Citizen Sky Scanner', path: '/citizen-scanner', aliases: ['/citizen'] },
  ];

  const isActive = (path: string, aliases: string[]) => {
    return location.pathname === path || aliases.includes(location.pathname);
  };

  const handleExportDossier = async () => {
    setDossierStatus('exporting');
    try {
      const alerts = await fetchAlerts(undefined, 1);
      const incident = alerts.items[0];
      if (!incident) {
        setDossierStatus('empty');
      } else {
        await downloadLegalDossier(incident.incident_id);
        setDossierStatus('done');
      }
    } catch {
      setDossierStatus('error');
    }
    setTimeout(() => setDossierStatus('idle'), 3000);
  };

  const dossierLabel = dossierStatus === 'exporting' ? 'Preparing Dossier ZIP...'
    : dossierStatus === 'done' ? 'Dossier Exported'
    : dossierStatus === 'empty' ? 'No Incident to Export'
    : dossierStatus === 'error' ? 'Dossier Export Failed'
    : 'Export SPCB Dossier';

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-canvas-cream/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top Status Strip */}
      <div className="bg-surface-vanilla-strong/90 px-gutter-desktop py-space-2xs hidden lg:flex items-center justify-between font-label-md text-label-md text-ink-muted">
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-2xs">
            <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
            <span className="text-ink-black font-semibold">AQ Station Synchrony:</span>{' '}
            {stationCount == null ? 'Station feed unavailable' : stationCount === 0 ? 'No live stations reporting' : `${stationCount} stations`}
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-cobalt-deep font-semibold">Backend Ready:</span> {dbStatus}
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-terracotta-deep font-semibold">NASA FIRMS</span> {formatDataSource(firmsSource, 'Checking feed')}
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-forest-jade font-semibold">WS /ws/ncr:</span> {wsStatus === 'open' ? 'Active Stream' : wsStatus === 'connecting' ? 'Connecting' : 'Unavailable'}
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="px-2 py-0.5 rounded-full bg-canvas-cream text-ink-black font-bold shadow-[1px_1px_0px_#18181B]">
            {isDemoMode ? 'PRANA LOCAL (DEMO MODE)' : 'PRANA LOCAL (DEMO DATA OFF)'}
          </span>
          <span className="text-ink-muted">{lastSync ? `Sync ${new Date(lastSync).toLocaleTimeString()}` : 'Sync pending'}</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="h-20 w-full px-gutter-desktop flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-lg">
          <Link to="/" className="flex items-center gap-space-xs cursor-pointer select-none">
            <span className="font-headline-md text-headline-md font-semibold text-ink-black tracking-tight italic">PRANA Air.</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-label-md font-bold rotate-12">✦</span>
          </Link>
          <div className="hidden xl:flex items-center rounded-full bg-surface-vanilla px-space-md py-1.5 shadow-[2px_2px_0px_#18181B]">
            <div className="flex items-center gap-space-xs font-label-md text-label-md">
              <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid animate-ping"></span>
              <span className="font-bold text-ink-black uppercase tracking-wider">Live Corridors</span>
              <span className="text-outline-variant">/</span>
              <span className="text-terracotta-deep font-bold">{fireCount == null ? 'Fire Feed Unavailable' : `${fireCount} Active Fires`}</span>
              <span className="text-outline-variant">/</span>
              <span className="px-2 py-0.5 rounded-full bg-aqi-hazardous text-on-tertiary font-bold">{latestAqi == null ? 'Delhi AQI pending' : `Delhi AQI ${latestAqi}`}</span>
              <span className="text-outline-variant">/</span>
              <span className="font-telemetry-val text-body-sm font-bold text-ink-black">{latestPm25 == null ? 'PM2.5 pending' : `PM2.5: ${latestPm25.toFixed(1)} µg/m³`}</span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-space-xs">
          {navLinks.map((link) => {
            const active = isActive(link.path, link.aliases);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={
                  active
                    ? 'px-space-sm py-2 rounded-full transition-all bg-primary text-on-primary font-bold shadow-[2px_2px_0px_#18181B]'
                    : 'px-space-sm py-2 rounded-full font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-vanilla hover:text-on-surface transition-all'
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions & Avatar */}
        <div className="flex items-center gap-space-sm">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full border border-ink-black bg-surface-vanilla text-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla-strong transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-cobalt-deep" />}
          </button>

          <button
            onClick={handleExportDossier}
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-transform"
            type="button"
          >
            <span>{dossierLabel}</span>
            <span className="material-symbols-outlined text-[16px]">
              {dossierStatus === 'done' ? 'check_circle' : 'arrow_forward'}
            </span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[1.5px_1.5px_0px_#18181B]">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-ink-black"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[22px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden w-full bg-surface-vanilla border-t border-ink-black/10 px-gutter-mobile py-4 flex flex-col gap-2">
          {navLinks.map((link) => {
            const active = isActive(link.path, link.aliases);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2.5 rounded-xl font-label-lg text-label-lg ${
                  active ? 'bg-primary text-on-primary font-bold shadow-[2px_2px_0px_#18181B]' : 'text-ink-black hover:bg-canvas-cream'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
