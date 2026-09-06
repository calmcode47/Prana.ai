import React from 'react';
import { NavLink } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-surface-container-high border-t border-border-subtle pt-unit-2xl pb-unit-xl px-gutter-mobile lg:px-gutter-desktop mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-unit-xl text-on-surface-variant font-body-sm text-body-sm">
        {/* Col 1: Brand & Purpose */}
        <div className="space-y-unit-xs md:col-span-1">
          <div className="flex items-center gap-unit-xs">
            <span className="font-headline-md text-headline-sm text-primary font-bold">PRANA</span>
            <span className="font-label-sm text-label-sm bg-surface-container-highest px-unit-xs py-unit-2xs rounded-full uppercase">
              v1.0
            </span>
          </div>
          <p className="font-body-sm text-on-surface-variant leading-relaxed">
            Pollution Risk & Atmospheric Network Alert System for the Indo-Gangetic winter smog airshed corridor.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs text-on-surface-variant/70">
            <span>Standard: CPCB India</span>
            <span>•</span>
            <span>OGC SensorThings v1.1</span>
          </div>
        </div>

        {/* Col 2: Atmospheric Modules */}
        <div className="space-y-unit-2xs">
          <h4 className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Atmospheric ML</h4>
          <ul className="space-y-1.5">
            <li><NavLink to="/dashboard" className="hover:text-primary transition-colors">Gaussian Process 0.1° Downscaler</NavLink></li>
            <li><NavLink to="/forecast" className="hover:text-primary transition-colors">72h Gaussian-Plume Forecaster</NavLink></li>
            <li><NavLink to="/federated" className="hover:text-primary transition-colors">Flower Multi-State Federated Learning</NavLink></li>
            <li><NavLink to="/alerts" className="hover:text-primary transition-colors">IsolationForest Anomaly Detector</NavLink></li>
          </ul>
        </div>

        {/* Col 3: Data Ingestion Feeds */}
        <div className="space-y-unit-2xs">
          <h4 className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Satellite & Telemetry</h4>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
              <span>NASA FIRMS VIIRS (375m NRT)</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
              <span>Sentinel-5P TROPOMI AAI / NO2</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
              <span>CPCB & DPCC Ground Stations</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
              <span>Open-Meteo Planetary Boundary Layer</span>
            </li>
          </ul>
        </div>

        {/* Col 4: Platform & Regulatory */}
        <div className="space-y-unit-2xs">
          <h4 className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">Statutory & Open Standards</h4>
          <ul className="space-y-1.5">
            <li><NavLink to="/alerts" className="hover:text-primary transition-colors">SPCB Section 31A Legal Notices</NavLink></li>
            <li><NavLink to="/api-docs" className="hover:text-primary transition-colors">OGC SensorThings JSON-LD API</NavLink></li>
            <li><NavLink to="/federated" className="hover:text-primary transition-colors">Differential Privacy (ε = 1.2)</NavLink></li>
            <li><a href="#github" className="hover:text-primary transition-colors">GitHub Repository (MIT Open Source)</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-unit-xl pt-unit-md border-t border-border-subtle/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-variant">
        <span>© 2026 PRANA Atmospheric Intelligence Consortium. Warm Editorial Edition.</span>
        <span>Punjab-Haryana-Delhi Airshed Corridor Protocol</span>
      </div>
    </footer>
  );
};
