import React, { useState, useEffect } from 'react';
import {
  triggerFederatedRun,
  fetchFederatedStatus,
  FLStatusResponse,
  formatFederatedDataset,
  formatFederatedImplementation,
  formatFederatedMetric,
} from '../api/client';

export const FederatedPage: React.FC = () => {
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [globalLoss, setGlobalLoss] = useState<number | null>(null);
  const [isRunningSim, setIsRunningSim] = useState<boolean>(false);

  const [flStatus, setFlStatus] = useState<FLStatusResponse | null>(null);

  const [simBtnText, setSimBtnText] = useState<string | null>(null);

  // Fetch FL status from backend on mount (GET /api/v1/federated/status)
  useEffect(() => {
    fetchFederatedStatus().then((status) => {
      setFlStatus(status);
      const latest = status.rounds[status.rounds.length - 1];
      setCurrentRound(latest?.round_number ?? 0);
      setGlobalLoss(latest?.global_loss ?? null);
    }).catch(() => {});
  }, []);

  const handleRunSimulation = async () => {
    if (isRunningSim) return;
    setIsRunningSim(true);
    setSimBtnText('Running backend training...');
    setCurrentRound(0);
    setGlobalLoss(null);

    try {
      const result = await triggerFederatedRun(10);
      setFlStatus(result);

      const total = result.rounds.length;
      if (total === 0) {
        setSimBtnText('No training rounds returned');
        setIsRunningSim(false);
        setTimeout(() => setSimBtnText(null), 3000);
        return;
      }
      let step = 0;
      const stepInterval = setInterval(() => {
        step += 1;
        if (step <= total) {
          const roundObj = result.rounds[step - 1];
          setCurrentRound(roundObj.round_number);
          setGlobalLoss(roundObj.global_loss ?? null);
          if (step < total) {
            setSimBtnText(`Displaying Backend Round ${roundObj.round_number}...`);
          } else {
            setSimBtnText(`Displaying Backend Round ${roundObj.round_number}...`);
          }
        } else {
          clearInterval(stepInterval);
          const latest = result.rounds[result.rounds.length - 1];
          setCurrentRound(latest.round_number);
          setGlobalLoss(latest.global_loss ?? null);
          setSimBtnText('Backend Run Complete ✦');
          setIsRunningSim(false);
          setTimeout(() => setSimBtnText(null), 3000);
        }
      }, 240);
    } catch {
      setIsRunningSim(false);
      setSimBtnText(null);
    }
  };

  const totalRounds = flStatus?.total_rounds ?? 0;
  const progressWidth = totalRounds > 0 ? Math.min(100, (currentRound / totalRounds) * 100) : 0;
  const dp = flStatus?.privacy?.dp_sgd;
  const secureAggregation = flStatus?.privacy?.secure_aggregation;
  const rounds = flStatus?.rounds ?? [];
  const latestRound = rounds[rounds.length - 1];
  const chartX = (index: number) => 60 + (index / Math.max(1, rounds.length - 1)) * 585;
  // Accuracy is a 0–1 score. Plot the complete range so sub-50% values remain
  // distinct instead of being collapsed onto a misleading 50% baseline.
  const chartY = (accuracy: number) => 195 - Math.max(0, Math.min(1, accuracy)) * 165;
  const chartPath = (field: 'punjab_accuracy' | 'delhi_accuracy' | 'global_accuracy') =>
    rounds.map((round, index) => `${index === 0 ? 'M' : 'L'}${chartX(index).toFixed(1)},${chartY(round[field]).toFixed(1)}`).join(' ');
  const globalAreaPath = rounds.length > 0
    ? `${chartPath('global_accuracy')} L${chartX(rounds.length - 1).toFixed(1)},195 L60,195 Z`
    : '';
  const latestGain = latestRound
    ? latestRound.global_accuracy - Math.max(latestRound.punjab_accuracy, latestRound.delhi_accuracy)
    : null;

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      {/* Top Editorial Header & Cryptographic Banner */}
      <section className="w-full px-gutter-desktop py-space-xl relative overflow-hidden">
        <div className="w-full flex flex-col gap-space-lg">
          {/* Meta Badge Ribbon with Neo-Brutalist Pills & Starburst */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md shadow-[2px_2px_0px_#18181B] border border-ink-black/20 font-bold">
                <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
                CLIENT FIT RESPONSES OMIT RAW RECORDS
              </span>
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md shadow-[2px_2px_0px_#18181B] border border-ink-black/20 font-bold">
                <span className="material-symbols-outlined text-[14px] text-cobalt-deep">lock_reset</span>
                {secureAggregation?.enabled
                  ? `${secureAggregation.scheme?.toUpperCase()} HOMOMORPHIC CRYPTOSYSTEM ${secureAggregation.key_bits}-BIT (SEC-006)`
                  : 'SECURE AGGREGATION AWAITING RUN'}
              </span>
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md shadow-[2px_2px_0px_#18181B] border border-ink-black/20 font-bold">
                <span className="text-terracotta-deep font-bold">DP-SGD</span>{' '}
                {dp?.enabled ? `ε=${dp.epsilon_spent ?? dp.target_epsilon} (δ=${dp.delta})` : 'AWAITING RUN'}
              </span>
            </div>

            {/* Editorial Stamp Sticker */}
            <div className="relative group cursor-pointer">
              <div className="rotate-3 px-space-md py-1.5 rounded-full bg-ink-black text-canvas-cream font-label-md text-label-md shadow-[3px_3px_0px_#FF5376] flex items-center gap-space-xs border border-coral-watermelon-vivid">
                <span className="text-coral-watermelon-vivid">★</span>
                <span className="tracking-wider uppercase font-bold">Privacy Protocol Simulation</span>
                <span className="text-coral-watermelon-vivid">★</span>
              </div>
            </div>
          </div>

          {/* Main Editorial Headline Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-end">
            <div className="lg:col-span-8 flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-md text-label-md tracking-widest uppercase text-ink-muted font-bold">
                  Backend Federated Protocol
                </span>
                <span className="w-12 h-0.5 bg-ink-black"></span>
                <span className="text-label-md font-label-md text-cobalt-deep font-bold">NORTHERN RECEPTOR MESH</span>
              </div>
              <h1 className="font-display-lg text-display-lg text-ink-black leading-tight tracking-tight">
                Privacy-Preserving Multi-State <br className="hidden sm:inline" />
                <span className="italic font-normal underline decoration-coral-watermelon-vivid decoration-wavy decoration-2">
                  Federated Intelligence
                </span>{' '}
                Simulation
              </h1>
              <p className="font-body-lg text-body-lg text-ink-muted max-w-2xl mt-1">
                Local federated-learning protocol demonstration across synthetic Punjab and Delhi training partitions. It tests aggregation and privacy controls without claiming a live inter-agency deployment.
              </p>
            </div>

            {/* Top Simulation Live Control Pod */}
            <div className="lg:col-span-4 flex flex-col justify-end">
              <div className="p-space-md rounded-2xl bg-surface-vanilla shadow-[4px_4px_0px_#18181B] border-2 border-ink-black flex flex-col gap-space-sm relative">
                <div className="flex items-center justify-between font-label-md text-label-md">
                  <span className="flex items-center gap-space-2xs text-ink-black font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-watermelon-vivid animate-ping"></span>
                    SIMULATION ORCHESTRATION
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-forest-jade/20 text-forest-jade font-bold">
                    {isRunningSim ? 'TRAINING IN PROGRESS' : (flStatus?.status ?? 'checking').toUpperCase()}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="font-headline-md text-headline-md text-ink-black font-bold" id="sim-round-display">
                      Round {currentRound} of {totalRounds} {totalRounds > 0 && currentRound === totalRounds && !isRunningSim ? '(Complete)' : ''}
                    </span>
                    <p className="font-label-md text-label-md text-ink-muted mt-0.5">
                      Synchronized FedAvg Ephemeral Pass
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-telemetry-val text-telemetry-val text-cobalt-deep font-extrabold" id="sim-loss-display">
                      {globalLoss == null ? '—' : globalLoss.toFixed(4)}
                    </span>
                    <p className="font-telemetry-unit text-telemetry-unit text-ink-muted uppercase font-bold">
                      Global MSE Loss
                    </p>
                  </div>
                </div>

                {/* Mini Visual Progress Scrub */}
                <div className="w-full bg-canvas-cream rounded-full h-3 p-0.5 overflow-hidden shadow-[inset_1px_1px_0px_#18181B] border border-ink-black/20">
                  <div
                    className="bg-coral-watermelon-vivid h-full rounded-full transition-all duration-300 ease-out"
                    id="sim-progress-bar"
                    style={{ width: `${progressWidth}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-body-sm text-body-sm text-ink-muted font-semibold">
                    Noise σ: {dp?.noise_multiplier?.toFixed(2) ?? '—'} | Clip C={dp?.max_grad_norm ?? '—'}
                  </span>
                  <button
                    onClick={handleRunSimulation}
                    disabled={isRunningSim}
                    className={`inline-flex items-center gap-space-xs px-space-md py-2 rounded-full text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-all cursor-pointer disabled:opacity-75 font-bold ${
                      simBtnText?.includes('Converged') ? 'bg-forest-jade' : 'bg-ink-black'
                    }`}
                    id="run-simulation-btn"
                    type="button"
                  >
                    <span>{simBtnText ?? (isRunningSim ? 'Executing Rounds...' : 'Run 10-Round Backend Simulation')}</span>
                    <span className={`material-symbols-outlined text-[16px] text-coral-watermelon-vivid ${isRunningSim ? 'animate-spin' : ''}`}>
                      {isRunningSim ? 'refresh' : 'play_arrow'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Multi-Node Network Architecture Canvas */}
      <section className="w-full px-gutter-desktop py-space-md">
        <div className="w-full">
          <div className="w-full bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black relative overflow-hidden">
            {/* Canvas Ribbon Header */}
            <div className="flex flex-wrap items-center justify-between gap-space-md pb-space-md mb-space-md border-b border-ink-black/10">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-[2px_2px_0px_#18181B] text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">hub</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-ink-black font-semibold">
                    Federated Ephemeral Topology &amp; Gradient Shuttles
                  </h2>
                  <p className="font-body-sm text-body-sm text-ink-muted">
                    {formatFederatedImplementation(flStatus?.implementation)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-space-xs">
                <div className="hidden sm:flex items-center gap-space-2xs px-space-sm py-1 rounded-full bg-canvas-cream font-label-md text-label-md text-ink-black shadow-[2px_2px_0px_#18181B] border border-ink-black/20">
                  <span className="text-terracotta-deep font-bold">{formatFederatedDataset(flStatus?.dataset)}</span>
                </div>
                <div className="px-space-sm py-1 rounded-full bg-forest-jade text-on-primary font-label-md text-label-md shadow-[2px_2px_0px_#18181B] font-bold">
                  {flStatus ? 'BACKEND SIMULATION READY' : 'BACKEND STATUS PENDING'}
                </div>
              </div>
            </div>

            {/* 3-Node Architecture Interactive Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center relative z-10 py-space-md">
              {/* Node 1: Punjab Agricultural Node */}
              <div className="lg:col-span-4 flex flex-col gap-space-sm p-space-md rounded-2xl bg-canvas-cream shadow-[4px_4px_0px_#18181B] border-2 border-ink-black transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-space-xs py-0.5 rounded-full bg-terracotta-deep text-on-primary font-label-md text-label-md uppercase font-bold">
                    Simulated Client A
                  </span>
                  <span className="font-label-md text-label-md text-ink-muted font-bold">Node ID: PB-STUBBLE-04</span>
                </div>
                <div className="flex items-center gap-space-sm my-space-2xs">
                  <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-ink-black shadow-[2px_2px_0px_#18181B] border border-ink-black">
                    <span className="material-symbols-outlined text-[26px]">agriculture</span>
                  </div>
                  <div>
                    <h3 className="font-title-sm text-title-sm text-ink-black font-bold">Punjab Agricultural Node</h3>
                    <p className="font-body-sm text-body-sm text-ink-muted">Synthetic Punjab training partition</p>
                  </div>
                </div>

                {/* Node Metrics */}
                <div className="grid grid-cols-2 gap-space-xs pt-space-xs">
                  <div className="p-space-xs rounded-lg bg-surface-vanilla border border-ink-black/20">
                    <span className="font-label-md text-label-md text-ink-muted block uppercase font-bold">Local Samples</span>
                    <span className="font-telemetry-val text-telemetry-val text-ink-black font-bold">Not exposed</span>
                    <span className="font-body-sm text-body-sm text-ink-muted block">Raw client records withheld</span>
                  </div>
                  <div className="p-space-xs rounded-lg bg-surface-vanilla border border-ink-black/20">
                    <span className="font-label-md text-label-md text-ink-muted block uppercase font-bold">Local Loss</span>
                    <span className="font-telemetry-val text-telemetry-val text-terracotta-deep font-bold">{latestRound?.punjab_loss?.toFixed(4) ?? '—'}</span>
                    <span className="font-body-sm text-body-sm text-forest-jade block font-semibold">Prediction score {latestRound ? `${(latestRound.punjab_accuracy * 100).toFixed(1)}%` : '—'}</span>
                  </div>
                </div>

                <div className="mt-space-xs p-space-xs rounded-lg bg-canvas-cream shadow-[inset_1px_1px_0px_#18181B] border border-ink-black/20 flex items-center justify-between font-label-md text-label-md">
                  <span className="text-ink-muted flex items-center gap-space-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-forest-jade"></span>
                    Backend round: {latestRound?.round_number ?? '—'}
                  </span>
                  <span className="text-cobalt-deep font-bold font-telemetry-unit">Metrics only</span>
                </div>
              </div>

              {/* Center Visual: Central Aggregator Node */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-space-md rounded-2xl bg-ink-black text-canvas-cream shadow-[4px_4px_0px_#1D4ED8] border-2 border-cobalt-deep relative group">
                <div className="absolute -top-3 -right-3 rotate-12 px-2.5 py-1 rounded-full bg-coral-watermelon-vivid text-ink-black font-label-md text-label-md font-extrabold shadow-[2px_2px_0px_#FAF6EE]">
                  FEDAVG MASTER RING
                </div>
                <div className="relative w-28 h-28 my-space-xs flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-canvas-cream/40 animate-spin" style={{ animationDuration: '18s' }}></div>
                  <div className="w-20 h-20 rounded-full bg-cobalt-deep text-on-primary flex flex-col items-center justify-center shadow-[3px_3px_0px_#FF5376] border border-canvas-cream/40">
                    <span className="material-symbols-outlined text-[32px]">sync</span>
                    <span className="font-label-md text-label-md uppercase font-bold tracking-tighter">LOCAL / DEMO</span>
                  </div>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-canvas-cream font-bold text-center">
                  Central Aggregator Node
                </h3>
                <p className="font-body-sm text-body-sm text-primary-fixed-dim text-center mt-1">
                  Homomorphic Cipher Aggregation Engine
                </p>

                <div className="w-full bg-surface-vanilla/10 rounded-lg p-space-xs mt-space-sm flex flex-col gap-1 text-center">
                  <div className="flex items-center justify-between text-body-sm font-body-sm px-1">
                    <span className="text-canvas-cream/70">Secure Aggregator Cycle</span>
                    <span className="font-bold text-coral-watermelon-vivid">{flStatus?.run_id || 'No run'}</span>
                  </div>
                  <div className="flex items-center justify-between text-body-sm font-body-sm px-1">
                    <span className="text-canvas-cream/70">Secure Aggregation</span>
                    <span className="text-forest-jade font-bold">{secureAggregation?.enabled ? 'Enabled' : 'Awaiting run'}</span>
                  </div>
                </div>
                <div className="mt-space-sm flex items-center gap-space-xs font-label-md text-label-md text-canvas-cream/80">
                  <span className="material-symbols-outlined text-[16px] text-forest-jade">shield_locked</span>
                  <span>Only measured round metrics are persisted</span>
                </div>
              </div>

              {/* Node 2: Delhi Receptor Node */}
              <div className="lg:col-span-4 flex flex-col gap-space-sm p-space-md rounded-2xl bg-canvas-cream shadow-[4px_4px_0px_#18181B] border-2 border-ink-black transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-space-xs py-0.5 rounded-full bg-cobalt-deep text-on-primary font-label-md text-label-md uppercase font-bold">
                    Simulated Client B
                  </span>
                  <span className="font-label-md text-label-md text-ink-muted font-bold">Node ID: DL-URBAN-09</span>
                </div>
                <div className="flex items-center gap-space-sm my-space-2xs">
                  <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-ink-black shadow-[2px_2px_0px_#18181B] border border-ink-black">
                    <span className="material-symbols-outlined text-[26px]">location_city</span>
                  </div>
                  <div>
                    <h3 className="font-title-sm text-title-sm text-ink-black font-bold">Delhi Receptor Node</h3>
                    <p className="font-body-sm text-body-sm text-ink-muted">Synthetic Delhi training partition</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-xs pt-space-xs">
                  <div className="p-space-xs rounded-lg bg-surface-vanilla border border-ink-black/20">
                    <span className="font-label-md text-label-md text-ink-muted block uppercase font-bold">Local Samples</span>
                    <span className="font-telemetry-val text-telemetry-val text-ink-black font-bold">Not exposed</span>
                    <span className="font-body-sm text-body-sm text-ink-muted block">Raw client records withheld</span>
                  </div>
                  <div className="p-space-xs rounded-lg bg-surface-vanilla border border-ink-black/20">
                    <span className="font-label-md text-label-md text-ink-muted block uppercase font-bold">Local Loss</span>
                    <span className="font-telemetry-val text-telemetry-val text-cobalt-deep font-bold">{latestRound?.delhi_loss?.toFixed(4) ?? '—'}</span>
                    <span className="font-body-sm text-body-sm text-forest-jade block font-semibold">Prediction score {latestRound ? `${(latestRound.delhi_accuracy * 100).toFixed(1)}%` : '—'}</span>
                  </div>
                </div>

                <div className="mt-space-xs p-space-xs rounded-lg bg-canvas-cream shadow-[inset_1px_1px_0px_#18181B] border border-ink-black/20 flex items-center justify-between font-label-md text-label-md">
                  <span className="text-ink-muted flex items-center gap-space-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-forest-jade"></span>
                    Backend round: {latestRound?.round_number ?? '—'}
                  </span>
                  <span className="text-cobalt-deep font-bold font-telemetry-unit">Metrics only</span>
                </div>
              </div>
            </div>

            {/* Connection Schematic Graphic Strip */}
            <div className="w-full mt-space-md pt-space-md flex flex-col md:flex-row items-center justify-between gap-space-sm font-label-md text-label-md text-ink-muted bg-surface-vanilla-strong/60 p-space-sm rounded-xl border border-ink-black/20">
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-terracotta-deep"></span>
                <span>Punjab Upstream (Agri Dispersion)</span>
                <span className="text-ink-black font-bold">➔ Paillier Encrypted Weights ➔</span>
              </div>
              <div className="flex items-center gap-space-xs font-bold text-ink-black">
                <span className="material-symbols-outlined text-[16px] text-cobalt-deep">verified_user</span>
                <span>Client fit calls return weights without local metrics</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="text-ink-black font-bold">➔ Downlink Broadcast (Global Model r{currentRound}) ➔</span>
                <span>Delhi Receptor Grid</span>
                <span className="w-2 h-2 rounded-full bg-cobalt-deep"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Split: Federated Model Accuracy Comparison & Privacy Controls */}
      <section className="w-full px-gutter-desktop py-space-lg">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Left 7-Cols: Federated Model Accuracy Comparison */}
          <div className="lg:col-span-7 flex flex-col gap-space-md p-space-lg rounded-2xl bg-surface-vanilla shadow-[4px_4px_0px_#18181B] border-2 border-ink-black">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-2 border-b border-ink-black/10">
              <div>
                <div className="flex items-center gap-space-2xs">
                  <span className="font-headline-sm text-headline-sm text-ink-black font-bold">
                    Federated Model Prediction Score
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary text-label-md font-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                    {formatFederatedMetric(flStatus?.metric)}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">
                  Normalized backend prediction scores across {totalRounds} completed federated round{totalRounds === 1 ? '' : 's'}
                </p>
              </div>
              {/* Custom Legend Badges */}
              <div className="flex flex-wrap items-center gap-space-xs">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas-cream shadow-[1px_1px_0px_#18181B] border border-ink-black/20 text-label-md font-label-md">
                  <span className="w-3 h-1.5 rounded-sm bg-coral-watermelon-vivid"></span>
                    <span className="font-bold text-ink-black">Global FL ({latestRound ? `${(latestRound.global_accuracy * 100).toFixed(1)}%` : '—'})</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas-cream shadow-[1px_1px_0px_#18181B] border border-ink-black/20 text-label-md font-label-md">
                  <span className="w-3 h-1.5 rounded-sm bg-cobalt-deep"></span>
                    <span className="text-ink-muted font-semibold">Delhi Silo ({latestRound ? `${(latestRound.delhi_accuracy * 100).toFixed(1)}%` : '—'})</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas-cream shadow-[1px_1px_0px_#18181B] border border-ink-black/20 text-label-md font-label-md">
                  <span className="w-3 h-1.5 rounded-sm bg-terracotta-deep"></span>
                    <span className="text-ink-muted font-semibold">Punjab Silo ({latestRound ? `${(latestRound.punjab_accuracy * 100).toFixed(1)}%` : '—'})</span>
                </div>
              </div>
            </div>

            {/* Inline SVG Visualization */}
            <div className="w-full bg-canvas-cream rounded-xl p-space-md shadow-[2px_2px_0px_#18181B] border border-ink-black/20 relative flex flex-col justify-end min-h-[320px]">
              {/* Floating Accolade */}
              <div className="absolute top-4 right-4 p-space-xs rounded-xl bg-surface-vanilla shadow-[2px_2px_0px_#18181B] border border-ink-black flex items-center gap-space-xs max-w-xs">
                  <span className={`material-symbols-outlined text-[20px] ${latestGain != null && latestGain < 0 ? 'text-terracotta-deep' : 'text-forest-jade'}`}>
                    {latestGain != null && latestGain < 0 ? 'trending_down' : 'trending_up'}
                  </span>
                <div>
                  <span className="font-label-md text-label-md font-bold text-ink-black block">{latestGain == null ? 'Awaiting backend run' : `${latestGain >= 0 ? '+' : ''}${(latestGain * 100).toFixed(1)} points vs best local`}</span>
                  <span className="font-body-sm text-body-sm text-ink-muted block text-xs">
                    {formatFederatedMetric(flStatus?.metric)}
                  </span>
                </div>
              </div>

              {/* Line Chart */}
              <svg className="w-full h-56 overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 240">
                <defs>
                  <linearGradient id="flGlow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#FF5376" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#FF5376" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line stroke="#E4E1E6" strokeDasharray="4 4" strokeWidth="1.5" x1="40" x2="680" y1="30" y2="30" />
                <text fill="#737686" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="end" x="32" y="34">100%</text>
                <line stroke="#E4E1E6" strokeDasharray="4 4" strokeWidth="1.5" x1="40" x2="680" y1="71.25" y2="71.25" />
                <text fill="#737686" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="end" x="32" y="75.25">75%</text>
                <line stroke="#E4E1E6" strokeDasharray="4 4" strokeWidth="1.5" x1="40" x2="680" y1="112.5" y2="112.5" />
                <text fill="#737686" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="end" x="32" y="116.5">50%</text>
                <line stroke="#E4E1E6" strokeDasharray="4 4" strokeWidth="1.5" x1="40" x2="680" y1="153.75" y2="153.75" />
                <text fill="#737686" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="end" x="32" y="157.75">25%</text>
                <line stroke="#18181B" strokeWidth="1.5" x1="40" x2="680" y1="195" y2="195" />
                <text fill="#737686" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="end" x="32" y="199">0%</text>

                {/* X Axis Labels */}
                {rounds.map((round, idx) => (
                  <text
                    key={round.round_number}
                    fill="#52525B"
                    fontFamily="Plus Jakarta Sans"
                    fontSize="11"
                    fontWeight="700"
                    x={chartX(idx)}
                    y="215"
                  >
                    R{round.round_number}
                  </text>
                ))}

                {/* Punjab Silo (Terracotta) */}
                <path
                  className="animate-dash-flow"
                  d={chartPath('punjab_accuracy')}
                  fill="none"
                  stroke="#EA580C"
                  strokeDasharray="5 3"
                  strokeWidth="2.5"
                />

                {/* Delhi Silo (Cobalt) */}
                <path
                  className="animate-dash-flow-reverse"
                  d={chartPath('delhi_accuracy')}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeDasharray="5 3"
                  strokeWidth="2.5"
                />

                {/* Global FL Area Fill & Line (Watermelon) */}
                <path
                  d={globalAreaPath}
                  fill="url(#flGlow)"
                />
                <path
                  d={chartPath('global_accuracy')}
                  fill="none"
                  stroke="#FF5376"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Dynamic Current Round Marker */}
                {latestRound && <g
                  className="transition-all duration-300 ease-out"
                  transform={`translate(${chartX(Math.max(0, rounds.findIndex((round) => round.round_number === currentRound)))}, ${chartY((rounds.find((round) => round.round_number === currentRound) ?? latestRound).global_accuracy)})`}
                >
                  <circle
                    className="animate-ping"
                    r="12"
                    fill="#FF5376"
                    opacity="0.35"
                  />
                  <circle
                    fill="#18181B"
                    r="6"
                    stroke="#FF5376"
                    strokeWidth="3"
                  />
                </g>}
              </svg>
            </div>
          </div>

          {/* Right 5-Cols: Configured Privacy Controls */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            <div className="p-space-lg rounded-2xl bg-surface-vanilla border-2 border-ink-black shadow-[4px_4px_0px_#18181B] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink-black/10">
                <div>
                  <span className="font-label-md text-label-md uppercase text-forest-jade font-bold">
                    Protocol Configuration
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-ink-black font-bold mt-0.5">
                    Configured Privacy Controls
                  </h3>
                </div>
                <span className="material-symbols-outlined text-forest-jade text-[24px]">verified_user</span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-body-sm font-bold text-ink-black">
                      01. Rényi Differential Privacy
                    </span>
                    <span className="px-2 py-0.5 rounded bg-forest-jade/20 text-forest-jade text-xs font-bold">
                      {dp?.enabled ? `ε=${dp.epsilon_spent ?? dp.target_epsilon} (δ=${dp.delta})` : 'Awaiting run'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-1">
                    Calibrated Gaussian noise reduces information exposure from individual training records. The displayed privacy budget applies to this completed local simulation.
                  </p>
                </div>

                <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-body-sm font-bold text-ink-black">
                      02. Paillier Homomorphic Encryption
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cobalt-deep/10 text-cobalt-deep text-xs font-bold">
                      {secureAggregation?.enabled ? `${secureAggregation.key_bits}-bit Keys` : 'Awaiting run'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-1">
                    This simulator encrypts client updates, adds the ciphertexts, and decrypts only the aggregate inside one backend process. A production deployment requires separate clients and an independent key holder.
                  </p>
                </div>

                <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-body-sm font-bold text-ink-black">
                      03. Non-IID Dirichlet Partitioning
                    </span>
                    <span className="px-2 py-0.5 rounded bg-terracotta-deep/10 text-terracotta-deep text-xs font-bold">
                      {formatFederatedDataset(flStatus?.dataset)}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-1">
                    The current run partitions a synthetic corridor dataset to exercise non-identically distributed client training. It is not live agency telemetry.
                  </p>
                </div>

                <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between">
                    <span className="font-title-sm text-body-sm font-bold text-ink-black">
                      04. Zero Client Metric Leakage (SEC-006)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-forest-jade/20 text-forest-jade text-xs font-bold font-mono">
                      {flStatus ? 'Client metrics withheld' : 'Awaiting run'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-ink-muted mt-1">
                    Client training responses return model weights without local metrics. This limits what the aggregation response exposes; it does not by itself prove that every reconstruction attack is impossible.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Backend FL Run Registry (GET /api/v1/federated/status) */}
            <div className="p-space-lg rounded-2xl bg-ink-black border-2 border-ink-black shadow-[4px_4px_0px_#1D4ED8] space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <span className="font-label-md text-label-md uppercase text-cobalt-deep font-bold">Backend Simulation State</span>
                  <h3 className="font-headline-sm text-headline-sm text-canvas-cream font-bold mt-0.5">FL Run Registry</h3>
                </div>
                <span className="material-symbols-outlined text-cobalt-deep text-[24px]">sync</span>
              </div>

              {flStatus ? (
                <div className="space-y-2">
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <span className="font-label-md text-label-md text-white/70 font-bold">Run ID</span>
                    <span className="font-mono text-[11px] text-cobalt-deep font-bold">{flStatus.run_id}</span>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <span className="font-label-md text-label-md text-white/70 font-bold">Total Rounds</span>
                    <span className="font-label-lg text-label-lg text-canvas-cream font-bold">{flStatus.total_rounds}</span>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <span className="font-label-md text-label-md text-white/70 font-bold">Status</span>
                    <span className={`px-2 py-0.5 rounded-full font-label-md text-label-md font-bold ${
                      flStatus.status === 'complete' ? 'bg-forest-jade/20 text-forest-jade' :
                      flStatus.status === 'running' ? 'bg-cobalt-deep/30 text-cobalt-deep' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {flStatus.status.toUpperCase()}
                    </span>
                  </div>
                  {flStatus.rounds.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="font-label-md text-label-md text-white/50 uppercase font-bold mb-2">Latest Rounds</div>
                      <div className="space-y-1">
                        {flStatus.rounds.slice(-3).reverse().map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] text-white/70 font-mono bg-white/5 rounded-lg px-2.5 py-1.5">
                            <span>Round {r.round_number}</span>
                            <span className="text-cobalt-deep font-bold">Punjab {(r.punjab_accuracy * 100).toFixed(1)}%</span>
                            <span className="text-forest-jade">Global {(r.global_accuracy * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <span className="w-3 h-3 rounded-full bg-cobalt-deep animate-ping"></span>
                  <span className="font-body-sm text-body-sm text-white/60">Querying backend status...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
