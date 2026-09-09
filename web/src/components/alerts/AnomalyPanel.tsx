import React from 'react';
import { AnomalyItem } from '../../api/client';

interface AnomalyPanelProps {
  anomalyParam: 'no2' | 'so2';
  setAnomalyParam: (param: 'no2' | 'so2') => void;
  nighttimeOnly: boolean;
  setNighttimeOnly: (val: boolean) => void;
  daysBack: number;
  setDaysBack: (days: number) => void;
  anomaliesList: AnomalyItem[];
  onSelectAnomaly: (anomaly: AnomalyItem) => void;
}

export const AnomalyPanel: React.FC<AnomalyPanelProps> = ({
  anomalyParam,
  setAnomalyParam,
  nighttimeOnly,
  setNighttimeOnly,
  daysBack,
  setDaysBack,
  anomaliesList,
  onSelectAnomaly,
}) => {
  return (
    <div className="space-y-4">
      {/* Live Backend IsolationForest Anomaly Control Bar */}
      <div className="p-3 bg-surface-vanilla-strong rounded-2xl border border-ink-black/30 flex flex-wrap items-center justify-between gap-3 text-body-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-label-md text-label-md font-bold text-ink-black uppercase flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-terracotta-deep">science</span>
            Backend IsolationForest:
          </span>
          <div className="inline-flex rounded-full border border-ink-black p-0.5 bg-surface-container-lowest">
            <button
              type="button"
              onClick={() => setAnomalyParam('no2')}
              className={`px-3 py-0.5 rounded-full font-label-md text-label-md font-bold transition-all cursor-pointer ${
                anomalyParam === 'no2' ? 'bg-ink-black text-canvas-cream shadow-sm' : 'text-ink-muted hover:text-ink-black'
              }`}
            >
              NO₂ Gas
            </button>
            <button
              type="button"
              onClick={() => setAnomalyParam('so2')}
              className={`px-3 py-0.5 rounded-full font-label-md text-label-md font-bold transition-all cursor-pointer ${
                anomalyParam === 'so2' ? 'bg-ink-black text-canvas-cream shadow-sm' : 'text-ink-muted hover:text-ink-black'
              }`}
            >
              SO₂ Flue
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer font-label-md text-label-md font-semibold text-ink-black">
            <input
              type="checkbox"
              checked={nighttimeOnly}
              onChange={(e) => setNighttimeOnly(e.target.checked)}
              className="rounded border-ink-black text-primary focus:ring-primary h-3.5 w-3.5"
            />
            Nighttime Only (22:00-06:00)
          </label>

          <div className="flex items-center gap-1 font-label-md text-label-md text-ink-muted">
            <span>Window:</span>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="bg-surface-container-lowest border border-ink-black rounded-lg px-2 py-0.5 font-label-md text-label-md font-bold text-ink-black"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest border border-ink-black font-label-md text-label-md font-bold text-coral-watermelon-vivid">
          {anomaliesList.length} Active Anomaly Flag{anomaliesList.length === 1 ? '' : 's'}
        </span>
      </div>

      {anomaliesList.length > 0 ? (
        <div className="space-y-2">
          <div className="font-label-md text-label-md font-bold text-ink-muted uppercase">
            Live Anomaly Cluster Feed ({anomalyParam.toUpperCase()} • {daysBack}d Lookback)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {anomaliesList.slice(0, 6).map((anomaly, idx) => (
              <div
                key={idx}
                onClick={() => onSelectAnomaly(anomaly)}
                className="p-2.5 rounded-xl bg-surface-container-lowest border border-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-title-sm text-[13px] font-bold text-ink-black flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-coral-watermelon-vivid animate-pulse"></span>
                    {anomaly.station_name || anomaly.station_id}
                  </div>
                  <div className="font-body-sm text-[11px] text-ink-muted">
                    {anomaly.day} @ {String(anomaly.hour_of_day).padStart(2, '0')}:00 IST • {anomaly.parameter.toUpperCase()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-1.5 py-0.5 rounded bg-coral-watermelon-vivid/10 text-coral-watermelon-vivid font-mono text-[11px] font-bold">
                    Score: {anomaly.anomaly_score.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-ink-black/20 text-ink-muted font-body-sm text-sm">
          No statistical anomalies detected in the selected {daysBack}-day window.
        </div>
      )}
    </div>
  );
};
