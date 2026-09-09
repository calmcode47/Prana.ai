import React from 'react';
import {
  MeteorologyResponse,
  HealthResponse,
  ReadyResponse,
} from '../../api/client';
import { Wind, Activity, ArrowUpRight } from 'lucide-react';

export interface WarRoomMeteoPanelProps {
  meteorologyData: MeteorologyResponse | null;
  healthData: HealthResponse | null;
  readyData: ReadyResponse | null;
  wsStatus: 'connecting' | 'open' | 'closed';
}

export const WarRoomMeteoPanel: React.FC<WarRoomMeteoPanelProps> = ({
  meteorologyData,
  healthData,
  readyData,
  wsStatus,
}) => {
  const punjab = meteorologyData?.regions.punjab;
  const delhi = meteorologyData?.regions.delhi;

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Upwind Punjab Node */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-2">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Wind className="w-4 h-4 text-terracotta-deep" />
            <h4 className="font-title-sm text-sm font-bold text-ink-black">Punjab Upwind Sector</h4>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-terracotta-deep/15 text-terracotta-deep border border-terracotta-deep/30">
            Source
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <span className="text-ink-muted block text-[11px]">Wind Velocity</span>
            <span className="font-bold text-sm text-ink-black">
              {punjab ? `${punjab.wind_speed_ms.toFixed(1)} m/s` : '—'}
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Direction</span>
            <span className="font-bold text-sm text-ink-black flex items-center gap-1">
              {punjab ? `${punjab.wind.direction_from_deg.toFixed(0)}°` : '—'}
              <ArrowUpRight
                className="w-3.5 h-3.5 text-cobalt-deep"
                style={{
                  transform: punjab ? `rotate(${punjab.wind.direction_from_deg}deg)` : undefined,
                }}
              />
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Boundary Layer</span>
            <span className="font-bold text-sm text-ink-black">
              {punjab ? `${punjab.mixing_layer_height_m_agl.toFixed(0)}m` : '—'}
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Ventilation Index</span>
            <span className="font-bold text-sm text-forest-jade">
              {punjab
                ? `${Math.round(punjab.wind_speed_ms * punjab.mixing_layer_height_m_agl)} m²/s`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Downwind Delhi Inversion Node */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-2">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Wind className="w-4 h-4 text-coral-watermelon-vivid" />
            <h4 className="font-title-sm text-sm font-bold text-ink-black">Delhi Terminal Basin</h4>
          </div>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-coral-watermelon-vivid/15 text-coral-watermelon-vivid border border-coral-watermelon-vivid/30">
            Receptor
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <span className="text-ink-muted block text-[11px]">Surface Wind</span>
            <span className="font-bold text-sm text-ink-black">
              {delhi ? `${delhi.wind_speed_ms.toFixed(1)} m/s` : '—'}
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Direction</span>
            <span className="font-bold text-sm text-ink-black flex items-center gap-1">
              {delhi ? `${delhi.wind.direction_from_deg.toFixed(0)}°` : '—'}
              <ArrowUpRight
                className="w-3.5 h-3.5 text-coral-watermelon-vivid"
                style={{
                  transform: delhi ? `rotate(${delhi.wind.direction_from_deg}deg)` : undefined,
                }}
              />
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Subsidence Inversion</span>
            <span className="font-bold text-sm text-coral-watermelon-vivid">
              {delhi ? `${delhi.mixing_layer_height_m_agl.toFixed(0)}m AGL` : '—'}
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px]">Trap Coefficient</span>
            <span className="font-bold text-sm text-aqi-hazardous">
              {delhi && delhi.mixing_layer_height_m_agl < 600 ? 'Severe (Trapped)' : 'Moderate'}
            </span>
          </div>
        </div>
      </div>

      {/* Realtime Core Telemetry State */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-2">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-forest-jade" />
            <h4 className="font-title-sm text-sm font-bold text-ink-black">Platform Systems</h4>
          </div>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              wsStatus === 'open' ? 'bg-forest-jade animate-pulse' : 'bg-aqi-moderate'
            }`}
          />
        </div>

        <div className="space-y-1 text-xs pt-1">
          <div className="flex justify-between py-0.5">
            <span className="text-ink-muted">Backend Service:</span>
            <span className="font-bold text-forest-jade font-mono">
              {healthData?.status === 'ok' ? 'HEALTHY (FastAPI)' : 'CHECKING...'}
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-ink-muted">PostGIS / Store:</span>
            <span className="font-bold font-mono text-ink-black">
              {readyData?.db === 'connected' ? 'PostGIS Active' : 'Fallback Ready'}
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-ink-muted">WebSocket Stream:</span>
            <span
              className={`font-bold font-mono ${
                wsStatus === 'open' ? 'text-forest-jade' : 'text-aqi-moderate'
              }`}
            >
              /ws/delhi ({wsStatus.toUpperCase()})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
