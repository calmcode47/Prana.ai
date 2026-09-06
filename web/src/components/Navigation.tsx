import React from 'react';
import { NavLink } from 'react-router-dom';

export const Navigation: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-border-subtle/50">
      <div className="h-16 w-full px-gutter-mobile lg:px-gutter-desktop flex items-center justify-between gap-unit-md max-w-7xl mx-auto">
        {/* Brand & Live WebSocket indicator */}
        <div className="flex items-center gap-unit-lg shrink-0">
          <NavLink to="/" className="flex items-center gap-unit-sm">
            <span className="font-headline-md text-headline-md text-primary tracking-tight font-bold">PRANA</span>
            <span className="font-label-sm text-label-sm bg-surface-container-highest text-on-surface-variant px-unit-xs py-unit-2xs rounded-full uppercase tracking-wider">
              Air-Net
            </span>
          </NavLink>
          <div className="hidden sm:flex items-center gap-unit-xs px-unit-sm py-unit-2xs rounded-full bg-surface-container-low text-on-surface-variant border border-border-subtle/40">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-semibold">
              WS: Live Airshed
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="hidden xl:flex items-center gap-unit-md">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            Corridor Map
          </NavLink>
          <NavLink
            to="/forecast"
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            72h Forecast
          </NavLink>
          <NavLink
            to="/federated"
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            Federated Hub
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            SPCB Alerts
          </NavLink>
          <NavLink
            to="/api-docs"
            className={({ isActive }) =>
              `font-label-md text-label-md transition-colors px-3 py-1.5 rounded-full ${
                isActive
                  ? 'text-primary font-bold bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            OGC API Docs
          </NavLink>
        </nav>

        {/* Right tools */}
        <div className="flex items-center gap-unit-sm shrink-0">
          <div className="hidden md:flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-full bg-surface-container text-on-surface">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">location_on</span>
            <span className="font-label-md text-label-md font-bold">Delhi NCR Basin</span>
          </div>
          <button
            onClick={() => {
              const element = document.createElement("a");
              const file = new Blob([JSON.stringify({ time: new Date().toISOString(), status: "verified", source: "PRANA Atmospheric Intelligence" }, null, 2)], {type: 'application/json'});
              element.href = URL.createObjectURL(file);
              element.download = "prana-telemetry-snapshot.json";
              document.body.appendChild(element);
              element.click();
            }}
            className="hidden sm:inline-flex items-center gap-unit-2xs px-unit-sm py-unit-xs rounded-full bg-surface-container-high text-on-surface hover:bg-surface-variant transition-colors font-label-md text-label-md shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
