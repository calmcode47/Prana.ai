import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchReady } from '../api/client';

export const Header: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dossierExported, setDossierExported] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('PostGIS 3.6 Connected');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  useEffect(() => {
    fetchReady()
      .then((res) => {
        setDbStatus(res.db === 'connected' ? 'PostGIS 3.6 Connected' : 'In-Memory Store Fallback');
        setIsDemoMode(res.demo_mode);
      })
      .catch(() => {
        setDbStatus('In-Memory Store Fallback');
      });
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

  const handleExportDossier = () => {
    setDossierExported(true);
    setTimeout(() => {
      setDossierExported(false);
    }, 3000);
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-canvas-cream/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top Status Strip */}
      <div className="bg-surface-vanilla-strong/90 px-gutter-desktop py-space-2xs hidden lg:flex items-center justify-between font-label-md text-label-md text-ink-muted">
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-2xs">
            <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
            <span className="text-ink-black font-semibold">CPCB Synchrony:</span> 14s latency
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-cobalt-deep font-semibold">Backend Ready:</span> {dbStatus}
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-terracotta-deep font-semibold">NASA FIRMS</span> VIIRS I-Band Live Feed
          </span>
          <span className="text-outline-variant">|</span>
          <span className="flex items-center gap-space-2xs">
            <span className="text-forest-jade font-semibold">WS /ws/ncr:</span> Active 60s Stream
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="px-2 py-0.5 rounded-full bg-canvas-cream text-ink-black font-bold shadow-[1px_1px_0px_#18181B]">
            {isDemoMode ? 'IN-NCR GRID 09 (DEMO MODE)' : 'IN-NCR GRID 09 (PRODUCTION)'}
          </span>
          <span className="text-ink-muted">Sync T+0.04s UTC</span>
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
              <span className="text-terracotta-deep font-bold">247 Active Fires</span>
              <span className="text-outline-variant">/</span>
              <span className="px-2 py-0.5 rounded-full bg-aqi-hazardous text-on-tertiary font-bold">Delhi AQI 387 Hazardous</span>
              <span className="text-outline-variant">/</span>
              <span className="font-telemetry-val text-body-sm font-bold text-ink-black">PM2.5: 312.4 µg/m³</span>
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
          <button
            onClick={handleExportDossier}
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-transform"
            type="button"
          >
            <span>{dossierExported ? 'Sealing Dossier PDF...' : 'Export SPCB Dossier'}</span>
            <span className="material-symbols-outlined text-[16px]">
              {dossierExported ? 'check_circle' : 'arrow_forward'}
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
