import React, { useState } from 'react';

export interface DataPoint {
  round: number;
  globalAcc?: number | null;
  delhiAcc?: number | null;
  punjabAcc?: number | null;
  loss?: number | null;
}

export interface ConvergenceChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  metricType?: 'accuracy' | 'loss';
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({
  data,
  title = 'Convergence Curve',
  height = 240,
  metricType = 'accuracy',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center border border-dashed border-outline-variant rounded-xl p-6 text-ink-muted text-sm"
        style={{ height }}
      >
        No round history data available for plotting.
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 40, left: 45 };
  const chartWidth = 600;
  const chartHeight = height;

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const minRound = Math.min(...data.map((d) => d.round));
  const maxRound = Math.max(...data.map((d) => d.round));
  const roundSpan = maxRound === minRound ? 1 : maxRound - minRound;

  const getX = (round: number) => padding.left + ((round - minRound) / roundSpan) * innerWidth;

  const yMin = metricType === 'accuracy' ? 0 : 0;
  const yMax =
    metricType === 'accuracy'
      ? 1.0
      : Math.max(
          ...data.map((d) => d.loss ?? 0.5),
          1.0
        ) * 1.1;

  const getY = (val: number | null | undefined) => {
    if (val == null) return innerHeight + padding.top;
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return padding.top + innerHeight - ((clamped - yMin) / (yMax - yMin)) * innerHeight;
  };

  const createPath = (key: 'globalAcc' | 'delhiAcc' | 'punjabAcc' | 'loss') => {
    const validPoints = data.filter((d) => d[key] != null);
    if (validPoints.length === 0) return '';
    return validPoints
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.round).toFixed(1)} ${getY(d[key]).toFixed(1)}`)
      .join(' ');
  };

  return (
    <div className="w-full bg-surface-vanilla border border-ink-black rounded-xl p-space-md shadow-[3px_3px_0px_#18181B] relative">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="font-title-sm text-sm font-bold text-ink-black">{title}</h4>
        <div className="flex items-center gap-3 text-xs font-semibold">
          {metricType === 'accuracy' ? (
            <>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                <span className="text-ink-black">Global Aggregator</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-terracotta-deep inline-block" />
                <span className="text-ink-black">Punjab Edge Node</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-forest-jade inline-block" />
                <span className="text-ink-black">Delhi Edge Node</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />
              <span className="text-ink-black">Cross-Entropy Loss</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          className="w-full h-auto min-w-[480px]"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const y = padding.top + innerHeight * (1 - frac);
            const val = yMin + frac * (yMax - yMin);
            return (
              <g key={frac}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerWidth}
                  y2={y}
                  stroke="#E4E1E6"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#737686"
                  fontFamily="Plus Jakarta Sans"
                >
                  {metricType === 'accuracy' ? `${Math.round(val * 100)}%` : val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {data.map((d, i) => {
            if (data.length > 10 && i % 2 !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={d.round}
                x={getX(d.round)}
                y={padding.top + innerHeight + 20}
                textAnchor="middle"
                fontSize="10"
                fill="#737686"
                fontFamily="Plus Jakarta Sans"
              >
                R{d.round}
              </text>
            );
          })}

          {/* Axis lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerHeight}
            stroke="#18181B"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={padding.left + innerWidth}
            y2={padding.top + innerHeight}
            stroke="#18181B"
            strokeWidth="1.5"
          />

          {/* Lines */}
          {metricType === 'accuracy' ? (
            <>
              {/* Punjab Line */}
              <path
                d={createPath('punjabAcc')}
                fill="none"
                stroke="#EA580C"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              {/* Delhi Line */}
              <path
                d={createPath('delhiAcc')}
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              {/* Global Line */}
              <path
                d={createPath('globalAcc')}
                fill="none"
                stroke="#004AC6"
                strokeWidth="3"
                className="animate-dash-flow"
              />
            </>
          ) : (
            <path
              d={createPath('loss')}
              fill="none"
              stroke="#AD2C4F"
              strokeWidth="3"
            />
          )}

          {/* Circles for Global points */}
          {data.map((d) => {
            const x = getX(d.round);
            const y = metricType === 'accuracy' ? getY(d.globalAcc) : getY(d.loss);
            const val = metricType === 'accuracy' ? d.globalAcc : d.loss;
            if (val == null) return null;
            const isHovered = hoveredPoint?.round === d.round;

            return (
              <g
                key={d.round}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4}
                  fill={metricType === 'accuracy' ? '#004AC6' : '#AD2C4F'}
                  stroke="#18181B"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div className="absolute top-2 right-4 bg-ink-black text-white p-2 rounded-md shadow-lg text-xs space-y-1 pointer-events-none z-10">
          <div className="font-bold border-b border-white/20 pb-0.5">Round {hoveredPoint.round}</div>
          {metricType === 'accuracy' ? (
            <>
              <div>Global: {hoveredPoint.globalAcc ? `${(hoveredPoint.globalAcc * 100).toFixed(1)}%` : '—'}</div>
              <div>Punjab: {hoveredPoint.punjabAcc ? `${(hoveredPoint.punjabAcc * 100).toFixed(1)}%` : '—'}</div>
              <div>Delhi: {hoveredPoint.delhiAcc ? `${(hoveredPoint.delhiAcc * 100).toFixed(1)}%` : '—'}</div>
            </>
          ) : (
            <div>Loss: {hoveredPoint.loss ? hoveredPoint.loss.toFixed(4) : '—'}</div>
          )}
        </div>
      )}
    </div>
  );
};
