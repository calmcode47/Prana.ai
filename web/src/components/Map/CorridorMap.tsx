import React, { useState } from 'react';
import { StationAQI, FireHotspot } from '../../types';

interface CorridorMapProps {
  stations: StationAQI[];
  hotspots: FireHotspot[];
  selectedHorizon?: string;
  showPlume?: boolean;
  interactive?: boolean;
}

export const CorridorMap: React.FC<CorridorMapProps> = ({
  stations,
  hotspots,
  showPlume = true,
}) => {
  const [activeLayer, setActiveLayer] = useState<'all' | 'fires' | 'stations' | 'plume'>('all');
  const [selectedPin, setSelectedPin] = useState<{ type: 'station' | 'fire'; data: any } | null>(null);

  // Corridor Bounding Box: 73.5°E to 77.5°E (X), 28.5°N to 32.5°N (Y)
  // Converting to SVG 0..600 (X), 0..400 (Y)
  const mapCoordToSvg = (lat: number, lon: number) => {
    const minLon = 74.0;
    const maxLon = 77.8;
    const minLat = 28.2;
    const maxLat = 31.5;

    const x = ((lon - minLon) / (maxLon - minLon)) * 600;
    const y = 400 - ((lat - minLat) / (maxLat - minLat)) * 400;
    return { x, y };
  };

  return (
    <div className="relative w-full h-[460px] bg-[#f0ede9] rounded-xl overflow-hidden border border-border-subtle shadow-sm select-none">
      {/* Background Map Canvas Styling */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#444748 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      />

      {/* Layer Control Pills */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md p-1.5 rounded-full shadow-sm border border-border-subtle text-xs">
        <button
          onClick={() => setActiveLayer('all')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            activeLayer === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          All Layers
        </button>
        <button
          onClick={() => setActiveLayer('fires')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            activeLayer === 'fires' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          VIIRS Fires ({hotspots.length})
        </button>
        <button
          onClick={() => setActiveLayer('stations')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            activeLayer === 'stations' ? 'bg-accent-blue text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          CPCB Stations ({stations.length})
        </button>
        <button
          onClick={() => setActiveLayer('plume')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            activeLayer === 'plume' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          72h Plume Vectors
        </button>
      </div>

      {/* Corridor Region Badges */}
      <div className="absolute top-3 right-3 z-10 hidden sm:flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-full bg-surface-container-high text-xs font-mono font-bold text-on-surface border border-border-subtle/50">
          Corridor: Punjab → Delhi NCR (36h Lag)
        </div>
      </div>

      {/* SVG Canvas for Map Graphics */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="corridorPlumeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b61b00" stopOpacity="0.75" />
            <stop offset="40%" stopColor="#db3417" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#ffb074" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#eec145" stopOpacity="0.15" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* State Boundaries (Simplified Corridor Geography) */}
        {/* Punjab Region */}
        <path
          d="M 50,40 L 280,30 L 320,160 L 160,200 L 40,120 Z"
          fill="#f6f3ee"
          stroke="#dcdad5"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        <text x="140" y="80" fill="#747878" fontSize="11" fontFamily="Newsreader" fontStyle="italic">PUNJAB AIRSHED</text>

        {/* Haryana Transit Region */}
        <path
          d="M 160,200 L 320,160 L 440,240 L 340,340 L 220,300 Z"
          fill="#fbf9f5"
          stroke="#dcdad5"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        <text x="260" y="240" fill="#747878" fontSize="11" fontFamily="Newsreader" fontStyle="italic">HARYANA CORRIDOR</text>

        {/* Delhi NCR Basin */}
        <circle
          cx="450"
          cy="310"
          r="45"
          fill="#ebe8e3"
          stroke="#b61b00"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <text x="420" y="315" fill="#1c1c19" fontSize="12" fontWeight="bold" fontFamily="DM Sans">DELHI NCR</text>

        {/* Dispersion Plume Envelopes */}
        {(activeLayer === 'all' || activeLayer === 'plume') && showPlume && (
          <g>
            {/* 72h Plume dispersion polygon envelope */}
            <path
              d="M 120,70 Q 240,160 450,310 Q 510,360 420,350 Q 200,240 100,100 Z"
              fill="url(#corridorPlumeGradient)"
              filter="url(#glow)"
              className="animate-pulse-slow"
            />

            {/* Dynamic Streamlines */}
            <path
              d="M 120,70 C 210,130 330,220 450,310"
              fill="none"
              stroke="#b61b00"
              strokeWidth="2.5"
              strokeDasharray="8 4"
              className="animate-flow-plume"
            />
            <path
              d="M 140,85 C 230,150 350,235 460,320"
              fill="none"
              stroke="#db3417"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              className="animate-flow-plume"
            />

            {/* Ingress Front Marker */}
            <circle cx="450" cy="310" r="8" fill="#b61b00" fillOpacity="0.3" className="animate-ping" />
          </g>
        )}

        {/* VIIRS Fire Hotspots */}
        {(activeLayer === 'all' || activeLayer === 'fires') &&
          hotspots.map((fire) => {
            const { x, y } = mapCoordToSvg(fire.lat, fire.lon);
            const radius = Math.min(Math.max(fire.frp_mw / 40, 4), 12);
            return (
              <g
                key={fire.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => setSelectedPin({ type: 'fire', data: fire })}
              >
                <circle cx={x} cy={y} r={radius + 4} fill="#b61b00" fillOpacity="0.25" className="animate-pulse" />
                <circle cx={x} cy={y} r={radius} fill="#b61b00" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            );
          })}

        {/* CPCB Ground Stations */}
        {(activeLayer === 'all' || activeLayer === 'stations') &&
          stations.map((stn) => {
            const { x, y } = mapCoordToSvg(stn.lat, stn.lon);
            return (
              <g
                key={stn.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => setSelectedPin({ type: 'station', data: stn })}
              >
                <circle cx={x} cy={y} r="6" fill={stn.category_color} stroke="#ffffff" strokeWidth="2" />
                {stn.is_anomalous && (
                  <circle cx={x} cy={y} r="10" fill="none" stroke="#ba1a1a" strokeWidth="1.5" strokeDasharray="2 2" className="animate-spin" />
                )}
              </g>
            );
          })}
      </svg>

      {/* Pin Detail Popup */}
      {selectedPin && (
        <div className="absolute bottom-3 left-3 z-30 bg-surface-container-lowest p-3 rounded-lg shadow-lg border border-border-subtle text-xs max-w-xs animate-fade-in">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-border-subtle">
            <span className="font-bold text-primary">
              {selectedPin.type === 'station' ? selectedPin.data.name : `Fire Hotspot: ${selectedPin.data.district}`}
            </span>
            <button
              onClick={() => setSelectedPin(null)}
              className="text-on-surface-variant hover:text-primary font-bold px-1"
            >
              ✕
            </button>
          </div>
          {selectedPin.type === 'station' ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">CPCB AQI:</span>
                <span className="font-bold text-secondary">{selectedPin.data.aqi_index} ({selectedPin.data.category})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">PM2.5:</span>
                <span className="font-mono font-bold">{selectedPin.data.pm25_ugm3} µg/m³</span>
              </div>
              <div className="flex justify-between text-[11px] text-on-surface-variant">
                <span>Coordinates:</span>
                <span className="font-mono">{selectedPin.data.lat}°N, {selectedPin.data.lon}°E</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Thermal FRP:</span>
                <span className="font-bold text-secondary">{selectedPin.data.frp_mw} MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Brightness:</span>
                <span className="font-mono">{selectedPin.data.brightness_k} K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">State / Sensor:</span>
                <span>{selectedPin.data.state} (VIIRS 375m)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Legend (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-10 bg-surface-container-lowest/90 backdrop-blur-md p-2 rounded-lg shadow-sm border border-border-subtle text-[11px] flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
          <span>VIIRS Fire Cluster (FRP $\propto$ radius)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#b61b00]"></span>
          <span>Severe / Hazardous Station (&gt;400 AQI)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#db3417]"></span>
          <span>Very Poor Station (301-400 AQI)</span>
        </div>
      </div>
    </div>
  );
};
