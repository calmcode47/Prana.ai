import React, { useEffect, useRef, useState } from 'react';
import { uploadCitizenSkyPhoto, CitizenPhotoResponse } from '../api/client';

export const CitizenScannerPage: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<'clear' | 'haze' | 'smog'>('smog');
  const [latitude, setLatitude] = useState<string>('28.6472');
  const [longitude, setLongitude] = useState<string>('77.3160');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result state
  const [result, setResult] = useState<CitizenPhotoResponse | null>(null);

  const presets = {
    clear: {
      name: 'Sangrur Rural Harvest Outskirts',
      desc: 'High sky patch visibility, minimal light extinction',
      lat: '30.2450',
      lon: '75.8420',
      color: '#92D050',
      previewGradient: 'from-[#60A5FA] via-[#93C5FD] to-[#E0F2FE]',
    },
    haze: {
      name: 'Panipat NH-44 Highway Transit Belt',
      desc: 'Diffuse boundary layer, moderate particulate scattering',
      lat: '29.3909',
      lon: '76.9635',
      color: '#FF0000',
      previewGradient: 'from-[#FDBA74] via-[#FDE68A] to-[#FEF3C7]',
    },
    smog: {
      name: 'Anand Vihar ISBT Receptor Basin',
      desc: 'Heavy nocturnal subsidence inversion trap, severe scattering',
      lat: '28.6472',
      lon: '77.3160',
      color: '#8F3F97',
      previewGradient: 'from-[#9CA3AF] via-[#D1D5DB] to-[#F3F4F6]',
    },
  };

  const handleSelectPreset = (key: 'clear' | 'haze' | 'smog') => {
    setSelectedPreset(key);
    const p = presets[key];
    setLatitude(p.lat);
    setLongitude(p.lon);
    setResult(null);
  };

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleRunScan = async () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await uploadCitizenSkyPhoto(selectedFile, parseFloat(latitude), parseFloat(longitude));
      setResult(res);
      setReportSubmitted(true);
      setTimeout(() => setReportSubmitted(false), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File exceeds 5MB size limit (SEC-003 constraint). Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    setResult(null);
  };

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="w-full px-gutter-desktop pt-6 pb-20 relative">
        {/* Top Editorial Header Badge Deck */}
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-6">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-vanilla shadow-[2px_2px_0px_#18181B] text-label-md font-label-md text-ink-black border border-ink-black/20">
              <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
              DARK CHANNEL PRIOR (DCP) ESTIMATOR // REQ-009
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-vanilla text-label-md font-label-md text-ink-muted shadow-[1px_1px_0px_#18181B]">
              <span>Privacy Guard:</span>
              <span className="text-cobalt-deep font-bold">SEC-003 EXIF Stripped &amp; Hash-Only Storage</span>
            </span>
          </div>

          <div className="inline-flex items-center gap-2">
            <span className="text-label-md font-bold text-ink-muted uppercase">Monte-Carlo Perturbation:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md border border-ink-black shadow-[1px_1px_0px_#18181B] font-bold">
              σ = 0.02 Noise Sampled
            </span>
          </div>
        </div>

        {/* Main Headline Section */}
        <div className="relative mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-label-md text-label-md uppercase tracking-wider text-cobalt-deep font-bold mb-1">
              <span>Citizen Science Protocol</span>
              <span>•</span>
              <span>FastAPI Endpoint: POST /api/v1/citizen/photo</span>
            </div>
            <h1 className="font-display-lg text-display-lg font-bold text-ink-black tracking-tight leading-tight">
              Optical Sky Haze Scanner &amp; <br className="hidden sm:inline" />
              <span className="italic font-normal font-headline-lg text-cobalt-deep underline decoration-coral-watermelon-vivid decoration-wavy decoration-2">
                Ground PM2.5 Ingestion Engine
              </span>
            </h1>
            <p className="font-body-md text-body-md text-ink-muted mt-1 max-w-3xl">
              Decomposes RGB sky imagery using He et al.&apos;s Dark Channel Prior to estimate optical thickness (&tau;), removes all EXIF and metadata before body parsing, and converts optical extinction into calibrated CPCB PM2.5 sub-index metrics.
            </p>
          </div>

          {/* Quirky Starburst Badge */}
          <div className="select-none self-start md:self-end">
            <div className="w-28 h-28 rounded-full bg-ink-black text-canvas-cream flex flex-col items-center justify-center p-2 text-center shadow-[4px_4px_0px_#FF5376] transform rotate-3 hover:rotate-0 transition-transform">
              <span className="material-symbols-outlined text-[24px] text-coral-watermelon-vivid">photo_camera</span>
              <span className="font-label-md text-[11px] uppercase tracking-wider font-extrabold mt-0.5">
                DCP Optical<br />Depth &tau;
              </span>
              <span className="text-[9px] text-forest-jade font-mono mt-0.5">224x224 RGB</span>
            </div>
          </div>
        </div>

        {/* Main Scanner Workbench: 70/30 Edge-to-Edge Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 7-COLS: Sky Photo Dropzone & Coordinate Controls */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            {/* Image Dropzone & Preview Card */}
            <div className="bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-ink-black/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-coral-watermelon-vivid"></span>
                  <span className="font-headline-sm text-headline-sm font-bold text-ink-black">
                    Sky Photo Decomposition Canvas
                  </span>
                </div>
                <span className="font-label-md text-label-md bg-canvas-cream px-2.5 py-1 rounded-full text-ink-black border border-ink-black/30 shadow-[1px_1px_0px_#18181B]">
                  Max 5MB • JPEG / PNG Only
                </span>
              </div>

              {/* Sample Sky Preset Selector */}
              <div>
                <div className="font-label-md text-label-md text-ink-muted uppercase font-bold mb-2">
                  Select Atmospheric Calibration Preset or Upload Custom Sky Frame:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['clear', 'haze', 'smog'] as const).map((key) => {
                    const isSelected = selectedPreset === key;
                    const p = presets[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectPreset(key)}
                        className={`p-3 rounded-xl text-left transition-all border-2 cursor-pointer ${
                          isSelected
                            ? 'bg-canvas-cream border-ink-black shadow-[3px_3px_0px_#1D4ED8]'
                            : 'bg-surface-vanilla-strong/60 border-ink-black/20 hover:border-ink-black'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-label-md text-label-md font-bold uppercase text-ink-black">
                            {key}
                          </span>
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          ></span>
                        </div>
                        <div className="text-xs font-semibold text-ink-black truncate">{p.name.split(' ')[0]}</div>
                        <div className="text-[11px] text-ink-muted mt-0.5">Location preset</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Sky Preview Frame */}
              <div
                className={`w-full h-64 rounded-xl bg-gradient-to-b ${presets[selectedPreset].previewGradient} p-4 flex flex-col justify-between border-2 border-ink-black shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)] relative overflow-hidden`}
                style={previewUrl ? { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {/* Simulated Haze Particle Grain Effect */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:12px_12px]"></div>

                {/* Laser Scanner Sweep Beam during Dark Channel Decomposition */}
                {isAnalyzing && (
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-coral-watermelon-vivid to-transparent shadow-[0_0_12px_#FF5376] pointer-events-none z-20 animate-scanner-sweep"></div>
                )}

                <div className="relative z-10 flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-ink-black/80 text-canvas-cream font-mono text-xs font-bold backdrop-blur-md">
                    224 × 224 px Tensor Input
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-surface-vanilla text-ink-black font-label-md text-label-md font-bold shadow-[2px_2px_0px_#18181B] border border-ink-black">
                    {selectedFile ? 'Uploaded Sky Frame' : 'Photo Required'}
                  </span>
                </div>

                <div className="relative z-10 bg-ink-black/80 backdrop-blur-md p-3 rounded-lg text-canvas-cream flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-primary-fixed-dim">Sample Region</div>
                    <div className="text-sm font-semibold">{selectedFile?.name ?? presets[selectedPreset].name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-coral-watermelon-vivid font-bold">
                      {presets[selectedPreset].desc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Native File Upload Input & Drag-Drop Trigger */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-md py-2.5 rounded-full bg-surface-vanilla-strong hover:bg-canvas-cream border-2 border-ink-black shadow-[2px_2px_0px_#18181B] font-label-lg text-label-lg text-ink-black cursor-pointer transition-transform hover:-translate-y-0.5">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>Choose Local Sky Photo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="text-xs text-ink-muted text-center sm:text-right">
                  Strictly validates magic bytes (<code className="font-mono text-ink-black font-bold">FF D8 FF</code> / <code className="font-mono text-ink-black font-bold">89 PNG</code>)
                </div>
              </div>

              {/* Geographic Coordinates Input Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-2 border-t border-ink-black/10">
                <div>
                  <label className="block font-label-md text-label-md text-ink-black font-bold mb-1">
                    Observation Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-canvas-cream rounded-lg text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-ink-black font-bold mb-1">
                    Observation Longitude (°E)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-canvas-cream rounded-lg text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Execution Action Button */}
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleRunScan}
                className="w-full inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-full bg-cobalt-deep text-on-primary font-label-lg text-label-lg shadow-[3px_3px_0px_#18181B] hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer font-bold disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[20px] ${isAnalyzing ? 'animate-spin' : ''}`}>
                  {isAnalyzing ? 'refresh' : 'lens_blur'}
                </span>
                <span>{isAnalyzing ? 'Executing Dark Channel Decomposition...' : selectedFile ? 'Trigger DCP Atmospheric Haze Inference' : 'Choose a Sky Photo to Analyze'}</span>
              </button>
            </div>
          </div>

          {/* RIGHT 5-COLS: Live Telemetry Inference & CPCB Breakpoint Readouts */}
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            {/* Primary Telemetry Card: Estimated PM2.5 & CPCB Category */}
            <div className="bg-surface-vanilla rounded-2xl p-space-lg shadow-[4px_4px_0px_#18181B] border-2 border-ink-black flex flex-col gap-space-md relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-black/10 pb-3">
                <span className="font-label-md text-label-md text-cobalt-deep uppercase tracking-wider font-extrabold">
                  GROUND RECEPTOR ESTIMATION
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-canvas-cream text-ink-black border border-ink-black/20 font-bold">
                  Latency: {result ? `${result.processing_time_ms}ms` : 'Awaiting photo'}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-2">
                <div>
                  <div className="font-telemetry-val text-[48px] leading-none font-extrabold text-ink-black tracking-tight">
                    {result?.pm25_estimate ?? 'N/A'}
                  </div>
                  <div className="font-telemetry-unit text-telemetry-unit text-ink-muted uppercase font-bold mt-1">
                    PM2.5 Mass Concentration (µg/m³)
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white font-label-lg text-label-lg font-bold shadow-[2px_2px_0px_#18181B]"
                    style={{ backgroundColor: result?.aqi_color ?? '#52525B' }}
                  >
                    <span>AQI {result?.aqi_index ?? 'N/A'}</span>
                  </div>
                  <div className="font-label-md text-label-md text-ink-black font-bold mt-1 uppercase">
                    {result ? `${result.aqi_category} Tier` : 'Awaiting Analysis'}
                  </div>
                </div>
              </div>

              {/* Uncertainty Confidence Meter */}
              <div className="p-3 rounded-xl bg-canvas-cream border border-ink-black/20 space-y-1.5">
                <div className="flex items-center justify-between font-label-md text-label-md">
                  <span className="text-ink-muted uppercase font-bold">Monte-Carlo Confidence:</span>
                  <span className="font-bold uppercase text-forest-jade">
                    {result ? `${result.confidence.toUpperCase()} CONFIDENCE` : 'AWAITING ANALYSIS'}
                  </span>
                </div>
                <div className="w-full bg-surface-vanilla rounded-full h-2 overflow-hidden border border-ink-black/20">
                  <div
                    className="h-full bg-forest-jade rounded-full"
                    style={{ width: result ? (result.confidence === 'high' ? '92%' : result.confidence === 'medium' ? '68%' : '40%') : '0%' }}
                  ></div>
                </div>
              </div>

              {/* Optical Coefficients Ledger */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-vanilla-strong border border-ink-black/10">
                  <div className="text-ink-muted font-label-md text-[10px] uppercase font-bold">Patch Min Window</div>
                  <div className="font-mono text-ink-black font-bold text-sm mt-0.5">&Omega;(x) = 7×7 px</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-vanilla-strong border border-ink-black/10">
                  <div className="text-ink-muted font-label-md text-[10px] uppercase font-bold">Transmission Weight</div>
                  <div className="font-mono text-ink-black font-bold text-sm mt-0.5">&omega; = 0.95 Factor</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-vanilla-strong border border-ink-black/10">
                  <div className="text-ink-muted font-label-md text-[10px] uppercase font-bold">Atmospheric Light A</div>
                  <div className="font-mono text-ink-black font-bold text-sm mt-0.5">Top 0.1% Dark Pixels</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-vanilla-strong border border-ink-black/10">
                  <div className="text-ink-muted font-label-md text-[10px] uppercase font-bold">Model Engine</div>
                  <div className="font-mono text-ink-black font-bold text-sm mt-0.5">FastAPI DCP Core</div>
                </div>
              </div>

              {reportSubmitted && (
                <div className="p-3 rounded-lg bg-forest-jade text-white font-label-md text-label-md font-bold flex items-center gap-2 shadow-[2px_2px_0px_#18181B] animate-pulse">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Observation digested. SHA-256 telemetry token committed to database.</span>
                </div>
              )}
            </div>

            {/* Privacy & EXIF Stripping Notice Card */}
            <div className="bg-surface-vanilla rounded-2xl p-space-md shadow-[3px_3px_0px_#18181B] border border-ink-black flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-ink-black text-canvas-cream flex-shrink-0 flex items-center justify-center shadow-[1px_1px_0px_#18181B]">
                <span className="material-symbols-outlined text-[20px] text-coral-watermelon-vivid">security</span>
              </div>
              <div className="text-xs text-ink-muted leading-relaxed">
                <span className="font-bold text-ink-black block mb-0.5 uppercase tracking-wide">
                  SEC-003 Zero-Retention Ingestion Guarantee:
                </span>
                All uploaded imagery is decoded in-memory, stripped of EXIF tags, device serial numbers, and camera metadata via Pillow. Only optical turbidity coefficients and an anonymous SHA-256 hash are recorded. Original photos are destroyed upon inference completion.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Scientific Specification Ribbon */}
        <div className="mt-space-2xl p-space-lg rounded-2xl bg-surface-vanilla shadow-[4px_4px_0px_#18181B] border-2 border-ink-black">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-12 h-12 rounded-xl bg-cobalt-deep text-on-primary flex items-center justify-center shadow-[2px_2px_0px_#18181B] flex-shrink-0">
                <span className="material-symbols-outlined text-[28px]">biotech</span>
              </div>
              <div>
                <div className="font-headline-sm text-headline-sm font-bold text-ink-black">
                  Calibrated Atmospheric Scattering Regression Formula
                </div>
                <p className="font-body-sm text-body-sm text-ink-muted mt-0.5">
                  PM2.5 (µg/m³) = 20.0 + 125.0 &middot; &tau;<sub>mean</sub> + 18.0 &middot; &tau;<sub>max</sub> &minus; 12.0 &middot; Contrast<sub>lum</sub>. Capped to CPCB statutory display ceiling of 500.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-canvas-cream text-ink-black font-mono text-xs font-bold border border-ink-black shadow-[1px_1px_0px_#18181B]">
                DEC-010 Compliant
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
