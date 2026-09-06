import React, { useState } from 'react';
import { mockFLHistory } from '../data/mockData';

export const FederatedPage: React.FC = () => {
  const [currentRound, setCurrentRound] = useState<number>(8);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const activeState = mockFLHistory[currentRound - 1] || mockFLHistory[0];

  const handleRunSimulation = () => {
    setIsSimulating(true);
    let round = 1;
    setCurrentRound(1);
    const interval = setInterval(() => {
      round += 1;
      if (round > 10) {
        clearInterval(interval);
        setIsSimulating(false);
      } else {
        setCurrentRound(round);
      }
    }, 600);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-mobile lg:px-gutter-desktop py-unit-lg space-y-unit-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-unit-sm pb-unit-sm border-b border-border-subtle">
        <div className="space-y-unit-2xs">
          <div className="flex items-center gap-unit-xs text-accent-blue font-label-sm text-label-sm uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse"></span>
            <span>Decentralized Multi-State Mesh</span>
            <span className="text-outline-variant">•</span>
            <span>Flower FedAvg Protocol</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial font-bold">
            Privacy-Preserving Federated Simulation
          </h1>
        </div>

        <div className="flex items-center gap-unit-sm">
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="inline-flex items-center gap-unit-xs px-unit-lg py-unit-xs rounded-full bg-primary text-on-primary hover:scale-[0.98] active:scale-95 font-label-md text-label-md transition-all shadow-md disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSimulating ? 'sync' : 'play_arrow'}
            </span>
            <span>{isSimulating ? `Simulating Round ${currentRound}/10...` : 'Run 10-Round FedAvg'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left 8 Cols: Node Topology & Convergence Charts */}
        <div className="lg:col-span-8 space-y-unit-lg">
          {/* Multi-Node Network Visualizer */}
          <div className="bg-surface-container-lowest p-unit-lg rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-bold">Mesh Architecture</span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  Cross-Silo Zero-Knowledge Model Aggregation
                </h3>
              </div>
              <span className="text-xs bg-surface-container-high px-2.5 py-1 rounded-full font-mono text-on-surface font-bold">
                Round {currentRound} of 10
              </span>
            </div>

            {/* Custom SVG Node Topology Diagram */}
            <div className="h-56 w-full bg-[#f6f3ee] rounded-lg border border-border-subtle/60 flex items-center justify-center p-4 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 500 180">
                {/* Node Connection Lines */}
                <line x1="100" y1="90" x2="250" y2="90" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" className="animate-flow-plume" />
                <line x1="400" y1="90" x2="250" y2="90" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" className="animate-flow-plume" />

                {/* Punjab Agricultural Node */}
                <g className="cursor-pointer">
                  <circle cx="100" cy="90" r="32" fill="#ffffff" stroke="#b61b00" strokeWidth="2" />
                  <text x="100" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1c19">PUNJAB</text>
                  <text x="100" y="99" textAnchor="middle" fontSize="8" fill="#747878">Source Node</text>
                  <circle cx="100" cy="90" r="42" fill="none" stroke="#b61b00" strokeWidth="1" strokeDasharray="2 2" />
                </g>

                {/* Central Server Coordinator */}
                <g className="cursor-pointer">
                  <rect x="210" y="55" width="80" height="70" rx="10" fill="#1c1c19" />
                  <text x="250" y="85" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff">FEDAVG</text>
                  <text x="250" y="100" textAnchor="middle" fontSize="8" fill="#e5e2dd">Coordinator</text>
                </g>

                {/* Delhi Urban Receptor Node */}
                <g className="cursor-pointer">
                  <circle cx="400" cy="90" r="32" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                  <text x="400" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1c1c19">DELHI NCR</text>
                  <text x="400" y="99" textAnchor="middle" fontSize="8" fill="#747878">Receptor Node</text>
                  <circle cx="400" cy="90" r="42" fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 2" />
                </g>
              </svg>

              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-on-surface-variant bg-surface-container-lowest/80 px-2 py-1 rounded">
                <span>🔒 SEC-006: 0 Raw Records Transferred</span>
                <span>Tensors: {activeState.tensors_exchanged} exchanged</span>
              </div>
            </div>

            {/* Round Step Bar */}
            <div className="pt-2">
              <label className="flex items-center justify-between text-xs text-on-surface-variant font-bold mb-1.5">
                <span>Simulation Round Step</span>
                <span className="text-primary font-mono">Round {currentRound}</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={currentRound}
                onChange={(e) => setCurrentRound(Number(e.target.value))}
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>

          {/* Loss Convergence Chart & Accuracy Lift */}
          <div className="bg-surface-container-lowest p-unit-lg rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-accent-emerald font-bold">
                  Convergence Metric
                </span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  FedAvg Loss Reduction & Model Superiority
                </h3>
              </div>
              <div className="text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Collaborative Lift</span>
                <span className="font-headline-md text-headline-md font-bold text-accent-emerald font-mono leading-none">
                  +{activeState.accuracy_lift_pct}%
                </span>
              </div>
            </div>

            {/* Step-by-Step Progress Graph */}
            <div className="grid grid-cols-10 gap-1.5 h-28 items-end pt-4 border-b border-border-subtle/50 pb-2">
              {mockFLHistory.map((item) => (
                <div
                  key={item.round}
                  onClick={() => setCurrentRound(item.round)}
                  className={`flex flex-col items-center justify-end h-full cursor-pointer transition-all ${
                    item.round === currentRound ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      item.round <= currentRound ? 'bg-accent-blue' : 'bg-surface-container-highest'
                    }`}
                    style={{ height: `${(1 - item.global_loss) * 100}%` }}
                  />
                  <span className="text-[10px] font-mono mt-1 font-bold">R{item.round}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-unit-md text-xs font-mono pt-2">
              <div className="p-2 rounded bg-surface-container-low border border-border-subtle/50">
                <span className="text-on-surface-variant block">Global Loss:</span>
                <span className="font-bold text-primary text-sm">{activeState.global_loss}</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low border border-border-subtle/50">
                <span className="text-on-surface-variant block">RMSE Error:</span>
                <span className="font-bold text-primary text-sm">{activeState.global_rmse} µg/m³</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low border border-border-subtle/50">
                <span className="text-on-surface-variant block">Differential Privacy:</span>
                <span className="font-bold text-accent-emerald text-sm">ε = {activeState.privacy_epsilon}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Cryptographic & Privacy Verification Card */}
        <div className="lg:col-span-4 space-y-unit-lg">
          <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-center gap-2 pb-unit-2xs border-b border-border-subtle">
              <span className="material-symbols-outlined text-[20px] text-accent-emerald">verified_user</span>
              <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                Privacy Guarantees
              </h3>
            </div>

            <div className="space-y-unit-sm text-xs">
              <div className="p-unit-sm rounded-lg bg-surface-container-low border border-border-subtle/60 space-y-1">
                <div className="flex items-center justify-between font-bold text-primary">
                  <span>Differential Privacy</span>
                  <span className="text-accent-emerald font-mono">ACTIVE</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  Laplace perturbation noise injected into local weight gradients before serialization. Epsilon parameter bounded at $\varepsilon = 1.2$.
                </p>
              </div>

              <div className="p-unit-sm rounded-lg bg-surface-container-low border border-border-subtle/60 space-y-1">
                <div className="flex items-center justify-between font-bold text-primary">
                  <span>Zero Raw Data Leakage</span>
                  <span className="text-accent-emerald font-mono">VERIFIED</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  SEC-006 audit confirmed: Farm boundaries, local emissions, and individual sensor IDs remain on-premise. Only 128 float32 tensors leave the node.
                </p>
              </div>

              <div className="p-unit-sm rounded-lg bg-surface-container-low border border-border-subtle/60 space-y-1">
                <div className="flex items-center justify-between font-bold text-primary">
                  <span>Paillier Encryption</span>
                  <span className="text-accent-emerald font-mono">2048-BIT</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  Additive homomorphic encryption enables the central coordinator to compute weighted averages without ever decrypting state tensors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
