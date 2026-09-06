import React from 'react';

interface TelemetryRibbonProps {
  aqi?: number;
  pm25?: number;
  fireCount?: number;
  windSpeed?: number;
  windDir?: string;
  leadHours?: number;
}

export const TelemetryRibbon: React.FC<TelemetryRibbonProps> = ({
  aqi = 387,
  pm25 = 312.4,
  fireCount = 247,
  windSpeed = 14.2,
  windDir = 'NW (312°)',
  leadHours = 36,
}) => {
  return (
    <div className="w-full bg-surface-container-low border-y border-border-subtle/60 py-unit-xs px-gutter-mobile lg:px-gutter-desktop">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-unit-md font-body-sm text-body-sm">
        {/* Dual-Unit CPCB Readout */}
        <div className="flex items-center gap-unit-md">
          <div className="flex items-center gap-unit-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Delhi Airshed:</span>
            <span className="font-headline-sm text-headline-sm font-bold text-secondary">{aqi} AQI</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-mono bg-surface-container-high px-1.5 py-0.5 rounded">
              {pm25} µg/m³ PM2.5
            </span>
          </div>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-border-strong/20 hidden sm:inline-block"></span>
          <div className="hidden sm:flex items-center gap-unit-2xs text-on-surface-variant">
            <span>CPCB Category:</span>
            <span className="font-bold text-secondary uppercase text-xs px-2 py-0.5 rounded-full bg-secondary-fixed/50">
              Severe
            </span>
          </div>
        </div>

        {/* Advection & Fire Telemetry */}
        <div className="flex items-center gap-unit-lg text-on-surface-variant">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-secondary">local_fire_department</span>
            <span>Active Corridor Fires:</span>
            <span className="font-bold text-primary font-mono">{fireCount}</span>
          </div>
          <div className="hidden md:flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-accent-blue">air</span>
            <span>Advection:</span>
            <span className="font-bold text-primary font-mono">{windDir} @ {windSpeed} km/h</span>
          </div>
          <div className="hidden lg:flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
            <span>Transit Lag:</span>
            <span className="font-bold text-secondary font-mono">{leadHours}h Ingress</span>
          </div>
        </div>
      </div>
    </div>
  );
};
