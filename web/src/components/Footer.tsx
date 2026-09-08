import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-surface-vanilla py-space-xl border-t border-ink-black/10">
      <div className="w-full px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-md font-body-sm text-body-sm text-ink-muted">
        <div className="flex items-center gap-space-xs">
          <span className="font-headline-sm text-headline-sm font-semibold text-ink-black">PRANA</span>
          <span>— Federated Atmospheric Early-Warning &amp; Plume Dispersion Consortium</span>
        </div>
        <div className="flex items-center gap-space-lg flex-wrap justify-center">
          <Link className="hover:text-ink-black transition-colors" to="/spcb-incident-command">
            Incident Protocol GRAP-IV
          </Link>
          <Link className="hover:text-ink-black transition-colors" to="/federated-mesh">
            Sensor Topology
          </Link>
          <Link className="hover:text-ink-black transition-colors" to="/air-corridor-map">
            Air Corridor Map
          </Link>
          <Link className="hover:text-ink-black transition-colors" to="/citizen-scanner">
            Citizen Sky Scanner
          </Link>
          <span className="text-label-md font-bold text-ink-black px-2 py-1 rounded bg-canvas-cream shadow-[1px_1px_0px_#18181B]">
            LOCAL BACKEND
          </span>
        </div>
      </div>
    </footer>
  );
};
