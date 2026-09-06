import React, { useState } from 'react';
import { mockSensorThingsData } from '../data/mockData';

export const ApiDocsPage: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('sensorthings');
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'python' | 'js'>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  const endpoints: Record<string, { title: string; method: string; path: string; desc: string; response: any }> = {
    'sensorthings': {
      title: 'OGC SensorThings Things Entity',
      method: 'GET',
      path: '/api/v1/sensorthings/Things',
      desc: 'Retrieves the open geospatial SensorThings API v1.1 entity representing the fused Indo-Gangetic corridor grid.',
      response: mockSensorThingsData,
    },
    'hotspots': {
      title: 'NASA FIRMS VIIRS Hotspots',
      method: 'GET',
      path: '/api/v1/hotspots',
      desc: 'Returns near real-time thermal anomalies and Fire Radiative Power (MW) across Punjab and Haryana.',
      response: {
        total_hotspots: 247,
        bbox: [73.5, 28.5, 77.5, 32.5],
        sensor: "VIIRS_SNPP_NRT",
        hotspots: [
          { id: "VIIRS-001", lat: 30.312, lon: 75.792, frp_mw: 420.5, confidence: "high", district: "Sangrur" },
          { id: "VIIRS-002", lat: 30.285, lon: 75.845, frp_mw: 380.0, confidence: "high", district: "Sangrur" }
        ]
      },
    },
    'forecast': {
      title: '72h Plume Dispersion Polygons',
      method: 'GET',
      path: '/api/v1/forecast/plume',
      desc: 'Returns simulated Gaussian-plume downwind dispersion polygons for t+24h, t+48h, and t+72h.',
      response: {
        corridor: "Punjab-Delhi",
        mixing_height_m: 340,
        wind_direction_deg: 312,
        forecast_envelopes: [
          { horizon: "t+24h", risk: "Severe", projected_delhi_aqi: 415 },
          { horizon: "t+48h", risk: "Hazardous", projected_delhi_aqi: 458 },
          { horizon: "t+72h", risk: "Hazardous", projected_delhi_aqi: 488 }
        ]
      },
    }
  };

  const activeEp = endpoints[selectedEndpoint];

  const codeSnippets: Record<string, Record<string, string>> = {
    'sensorthings': {
      curl: `curl -X GET "https://api.prana.ai/v1/sensorthings/Things" \\\n  -H "Accept: application/ld+json"`,
      python: `import requests\n\nurl = "https://api.prana.ai/v1/sensorthings/Things"\nheaders = {"Accept": "application/ld+json"}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`,
      js: `fetch("https://api.prana.ai/v1/sensorthings/Things", {\n  headers: { "Accept": "application/ld+json" }\n})\n  .then(res => res.json())\n  .then(data => console.log(data));`
    },
    'hotspots': {
      curl: `curl -X GET "https://api.prana.ai/v1/hotspots?state=Punjab" \\\n  -H "Authorization: Bearer prana_demo_token"`,
      python: `import requests\n\nres = requests.get("https://api.prana.ai/v1/hotspots", params={"state": "Punjab"})\nprint(res.json())`,
      js: `const res = await fetch("https://api.prana.ai/v1/hotspots?state=Punjab");\nconst data = await res.json();`
    },
    'forecast': {
      curl: `curl -X GET "https://api.prana.ai/v1/forecast/plume?horizon=72h"`,
      python: `import requests\n\nres = requests.get("https://api.prana.ai/v1/forecast/plume", params={"horizon": "72h"})\nprint(res.json())`,
      js: `const res = await fetch("https://api.prana.ai/v1/forecast/plume?horizon=72h");\nconst data = await res.json();`
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[selectedEndpoint][activeCodeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-mobile lg:px-gutter-desktop py-unit-lg space-y-unit-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-unit-sm pb-unit-sm border-b border-border-subtle">
        <div className="space-y-unit-2xs">
          <div className="flex items-center gap-unit-xs text-primary font-label-sm text-label-sm uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-accent-emerald"></span>
            <span>Developer API Codex</span>
            <span className="text-outline-variant">•</span>
            <span>OGC SensorThings v1.1 Compliant</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial font-bold">
            Atmospheric Intelligence API Reference
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-surface-container px-3 py-1.5 rounded-full font-mono text-on-surface-variant font-bold border border-border-subtle">
            Base URL: https://api.prana.ai/v1
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left 4 Cols: Endpoint Selector */}
        <div className="lg:col-span-4 space-y-unit-sm">
          <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-sm">
            <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold pb-1 border-b border-border-subtle">
              Endpoints
            </h3>

            <div className="space-y-2">
              {Object.entries(endpoints).map(([key, ep]) => (
                <div
                  key={key}
                  onClick={() => setSelectedEndpoint(key)}
                  className={`p-unit-sm rounded-lg border cursor-pointer transition-all space-y-1 ${
                    selectedEndpoint === key
                      ? 'bg-surface-container border-primary shadow-sm'
                      : 'bg-surface-container-low border-border-subtle/60 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary text-on-primary">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary">{ep.path}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{ep.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Interactive Console & Response Viewer */}
        <div className="lg:col-span-8 space-y-unit-md">
          <div className="bg-surface-container-lowest p-unit-lg rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-primary text-on-primary">
                  {activeEp.method}
                </span>
                <h3 className="font-mono font-bold text-sm text-primary">{activeEp.path}</h3>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1.5 leading-relaxed">{activeEp.desc}</p>
            </div>

            {/* Code Snippet Box */}
            <div className="rounded-lg bg-[#1c1b1b] text-[#f3f0eb] p-unit-md font-mono text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex gap-2">
                  {(['curl', 'python', 'js'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-2.5 py-0.5 rounded text-xs uppercase ${
                        activeCodeTab === tab ? 'bg-white/20 text-white font-bold' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCopy}
                  className="text-xs text-white/80 hover:text-white flex items-center gap-1 font-sans"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <pre className="overflow-x-auto py-1 text-accent-emerald leading-relaxed">
                {codeSnippets[selectedEndpoint][activeCodeTab]}
              </pre>
            </div>

            {/* Response Payload Box */}
            <div className="space-y-1.5">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-bold">
                Example Response (200 OK • JSON-LD)
              </span>
              <pre className="p-unit-md rounded-lg bg-surface-container-low border border-border-subtle font-mono text-xs text-on-surface overflow-x-auto max-h-64">
                {JSON.stringify(activeEp.response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
