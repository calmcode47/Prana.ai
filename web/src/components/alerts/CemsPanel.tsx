import React from 'react';
import { CemsForensicsResponse } from '../../api/client';

interface CemsPanelProps {
  cemsData: CemsForensicsResponse | null;
  maxAnomalyScore: number | null;
  onLoadTamperDossier: () => void;
}

export const CemsPanel: React.FC<CemsPanelProps> = ({
  cemsData,
  maxAnomalyScore,
  onLoadTamperDossier,
}) => {
  const cemsReadings = cemsData?.readings ?? [];

  const cemsPath = (field: 'stack_velocity_ms' | 'scrubber_load_kw') => {
    if (cemsReadings.length < 2) return '';
    const values = cemsReadings.map((reading) => reading[field]);
    const min = Math.min(...values);
    const span = Math.max(Math.max(...values) - min, 1);
    return values
      .map((value, index) => {
        const x = 40 + (index / (values.length - 1)) * 480;
        const y = 110 - ((value - min) / span) * 80;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const cemsStackPath = cemsPath('stack_velocity_ms');
  const cemsLoadPath = cemsPath('scrubber_load_kw');

  return (
    <article className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col gap-5 hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase tracking-wider shadow-[1px_1px_0px_#18181B]">
              Tamper Detection
            </span>
            <span className="font-label-md text-label-md text-ink-muted font-bold">
              {cemsData?.facility_id ?? 'CEMS feed pending'}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-body-sm text-body-sm text-ink-muted">Backend industrial telemetry</span>
          </div>
          <h2 className="font-title-md text-title-md text-ink-black font-sans font-bold flex items-center gap-2">
            {cemsData?.status === 'REVIEW_REQUIRED'
              ? 'CEMS Scrubber Pattern Requires Review'
              : 'CEMS Scrubber Forensic Review'}
            <span className="px-2 py-0.5 rounded-full bg-surface-container-highest font-label-md text-label-md text-ink-black font-bold">
              Max anomaly: {maxAnomalyScore == null ? 'None' : maxAnomalyScore.toFixed(2)}
            </span>
          </h2>
        </div>

        <div className="inline-flex items-center rounded-full bg-surface-container-lowest border-2 border-ink-black px-3 py-1 shadow-[2px_2px_0px_#18181B]">
          <span className="material-symbols-outlined text-[16px] text-terracotta-deep mr-1">bolt</span>
          <span className="font-label-lg text-label-lg text-ink-black">
            Review Windows: <strong className="text-coral-watermelon-vivid">{cemsData?.review_windows.length ?? 0}</strong>
          </span>
        </div>
      </div>

      {/* Technical Forensics Graphic & Inline SVG Chart */}
      <div className="rounded-2xl border border-ink-black bg-surface-container-lowest p-4 shadow-[2px_2px_0px_#18181B]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-title-sm text-title-sm text-ink-black font-bold">
              Stack Velocity vs. ID Fan Electrical Draw
            </span>
            <p className="font-body-sm text-body-sm text-ink-muted">
              {cemsData
                ? `${cemsData.readings.length} readings analyzed. ${cemsData.method}`
                : 'Loading backend CEMS forensics.'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-secondary-container text-on-secondary-container font-label-md text-label-md font-bold">
            {cemsData?.status ?? 'CHECKING TELEMETRY'}
          </span>
        </div>

        {/* Dual line SVG */}
        <div className="w-full bg-surface-vanilla rounded-xl p-3 border border-ink-black/20 relative">
          <svg className="w-full h-32 overflow-visible" fill="none" viewBox="0 0 540 140" xmlns="http://www.w3.org/2000/svg">
            <line stroke="#18181B" strokeDasharray="3 3" strokeOpacity="0.15" x1="40" x2="520" y1="20" y2="20" />
            <line stroke="#18181B" strokeDasharray="3 3" strokeOpacity="0.15" x1="40" x2="520" y1="60" y2="60" />
            <line stroke="#18181B" strokeDasharray="3 3" strokeOpacity="0.15" x1="40" x2="520" y1="100" y2="100" />
            {cemsData?.status === 'REVIEW_REQUIRED' && (
              <>
                <rect fill="#FF5376" fillOpacity="0.12" height="95" rx="4" width="160" x="220" y="15" />
                <text fill="#FF5376" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="700" x="230" y="32">
                  REVIEW WINDOW DETECTED
                </text>
              </>
            )}
            {/* Stack Flue Velocity Curve */}
            <path
              d={cemsStackPath}
              stroke="#1D4ED8"
              strokeLinecap="round"
              strokeWidth="3"
            />
            {/* Scrubber Pump Load */}
            <path
              d={cemsLoadPath}
              stroke="#EA580C"
              strokeDasharray="4 2"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
            <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="40" y="125">
              {cemsReadings[0] ? new Date(cemsReadings[0].measured_at).toLocaleTimeString() : 'No readings'}
            </text>
            <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="440" y="125">
              {cemsReadings.length ? new Date(cemsReadings[cemsReadings.length - 1].measured_at).toLocaleTimeString() : ''}
            </text>
          </svg>
          <div className="flex items-center justify-end gap-5 mt-1 font-label-md text-label-md">
            <span className="flex items-center gap-1.5 text-cobalt-deep font-bold">
              <span className="w-3 h-1 bg-cobalt-deep rounded-full"></span>
              Flue Velocity (m/s)
            </span>
            <span className="flex items-center gap-1.5 text-terracotta-deep font-bold">
              <span className="w-3 h-1 bg-terracotta-deep border-b border-dashed border-terracotta-deep"></span>
              Pump Load (kW)
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 font-body-sm text-body-sm text-ink-muted">
          <span className="material-symbols-outlined text-[18px] text-terracotta-deep">policy</span>
          <span>
            {cemsData?.status === 'REVIEW_REQUIRED'
              ? 'Backend pattern requires compliance review'
              : 'No bypass pattern detected in current readings'}
          </span>
        </div>
        <button
          onClick={onLoadTamperDossier}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
          type="button"
        >
          <span>Load Tamper Dossier ➔</span>
        </button>
      </div>
    </article>
  );
};
