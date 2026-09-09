import React, { useState, useEffect } from 'react';
import {
  AlertsResponse,
  AnomalyItem,
  CemsForensicsResponse,
  HotspotsResponse,
  IncidentItem,
  LatestAlertResponse,
  LegalNotice,
  LegalRegistryResponse,
  createLegalNotice,
  fetchAlerts,
  fetchAnomalies,
  fetchHotspots,
  fetchLatestAlert,
  fetchLegalRegistry,
  fetchSignaturePackage,
  formatDataSource,
  queueLegalDispatch,
} from '../api/client';

export const AlertsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'emergency' | 'nighttime' | 'stubble'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState('');
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi' | 'pa'>('en');
  const [bulletin, setBulletin] = useState<LatestAlertResponse | null>(null);

  // Anomaly parameters matching backend/routers/anomalies.py
  const [anomalyParam, setAnomalyParam] = useState<'no2' | 'so2'>('no2');
  const [nighttimeOnly, setNighttimeOnly] = useState<boolean>(true);
  const [daysBack, setDaysBack] = useState<number>(7);
  const [anomaliesList, setAnomaliesList] = useState<AnomalyItem[]>([]);

  const [noticeGenerated, setNoticeGenerated] = useState(false);
  const [sealedPramaan, setSealedPramaan] = useState(false);
  const [transmittedToDM, setTransmittedToDM] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<string>('');
  const [dispatchStatus, setDispatchStatus] = useState<string>('');
  const [currentNotice, setCurrentNotice] = useState<LegalNotice | null>(null);
  const [legalRegistry, setLegalRegistry] = useState<LegalRegistryResponse | null>(null);
  const [cemsData, setCemsData] = useState<CemsForensicsResponse | null>(null);
  const [hotspotsData, setHotspotsData] = useState<HotspotsResponse | null>(null);

  // Live alerts from backend (GET /api/v1/alerts)
  const [alertsData, setAlertsData] = useState<AlertsResponse | null>(null);

  useEffect(() => {
    fetchAlerts(undefined, 10).then(setAlertsData).catch(() => {});
    fetchLegalRegistry().then(setLegalRegistry).catch(() => {});
    setCemsData(null);
    fetchHotspots(24).then(setHotspotsData).catch(() => {});
  }, [filter]);
  const [noticeText, setNoticeText] = useState('Select a current backend incident to prepare a statutory notice.');

  useEffect(() => {
    fetchLatestAlert(selectedLang).then(setBulletin).catch(() => setBulletin(null));
  }, [selectedLang]);

  useEffect(() => {
    fetchAnomalies(anomalyParam, nighttimeOnly, daysBack).then((data) => setAnomaliesList(data.items));
  }, [anomalyParam, nighttimeOnly, daysBack]);

  const refreshRegistry = () => fetchLegalRegistry().then(setLegalRegistry).catch(() => {});

  const createDraftFromSelection = async (): Promise<LegalNotice | null> => {
    const selectedAlert = alertsData?.items.find((item) => item.incident_id === selectedIncident);
    if (!selectedAlert) {
      setNoticeText('No current backend incident is selected. A notice cannot be created without measured incident telemetry.');
      return null;
    }
    const notice = await createLegalNotice({
      incident_id: selectedAlert.incident_id,
      issuing_authority: 'State Pollution Control Board Review Desk',
      requested_direction: noticeText,
    });
    setSelectedIncident(selectedAlert.incident_id);
    setCurrentNotice(notice);
    setNoticeText(notice.body);
    refreshRegistry();
    return notice;
  };

  const handleGenerateNotice = async () => {
    const notice = await createDraftFromSelection();
    if (!notice) return;
    setNoticeGenerated(true);
    setTimeout(() => setNoticeGenerated(false), 2000);
  };

  const handleSignPramaan = async () => {
    const notice = currentNotice ?? await createDraftFromSelection();
    if (!notice) return;
    const signature = await fetchSignaturePackage(notice.notice_id);
    setSignatureStatus(signature.status);
    setSealedPramaan(signature.provider_call_performed);
    setTimeout(() => {
      setSealedPramaan(false);
      setSignatureStatus('');
    }, 3000);
  };

  const handleTransmitDM = async () => {
    const notice = currentNotice ?? await createDraftFromSelection();
    if (!notice) return;
    const dispatch = await queueLegalDispatch({
      incident_id: notice.incident_id,
      notice_id: notice.notice_id,
      recipient_kind: 'district_magistrate',
      recipient_reference: 'District Magistrate and Police Command review queue',
    });
    setDispatchStatus(dispatch.status);
    setTransmittedToDM(Boolean(dispatch.message_sent));
    refreshRegistry();
    setTimeout(() => {
      setTransmittedToDM(false);
      setDispatchStatus('');
    }, 3000);
  };

  const registryItems = [
    ...(legalRegistry?.notices ?? []).map((notice) => ({
      id: notice.notice_id,
      title: notice.issuing_authority,
      detail: notice.legal_basis,
      status: notice.status,
      statusColor: 'bg-cobalt-deep text-on-primary',
    })),
    ...(legalRegistry?.dispatches ?? []).map((dispatch) => ({
      id: dispatch.dispatch_id,
      title: dispatch.recipient_reference,
      detail: `Incident ${dispatch.incident_id}`,
      status: dispatch.status,
      statusColor: 'bg-terracotta-deep text-on-primary',
    })),
  ].slice(0, 6);

  const handleLoadCemsDossier = async () => {
    setCemsData(null);
    setSelectedIncident('');
    setCurrentNotice(null);
    setNoticeText('N/A — authenticated CEMS facility selection is not configured in this public client.');
  };

  const cemsReadings = cemsData?.readings ?? [];
  const cemsPath = (field: 'stack_velocity_ms' | 'scrubber_load_kw') => {
    if (cemsReadings.length < 2) return '';
    const values = cemsReadings.map((reading) => reading[field]);
    const min = Math.min(...values);
    const span = Math.max(Math.max(...values) - min, 1);
    return values.map((value, index) => {
      const x = 40 + (index / (values.length - 1)) * 480;
      const y = 110 - ((value - min) / span) * 80;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };
  const cemsStackPath = cemsPath('stack_velocity_ms');
  const cemsLoadPath = cemsPath('scrubber_load_kw');
  const primaryAlert = alertsData?.items.find((item) => item.incident_id === selectedIncident) ?? alertsData?.items[0];
  const primaryHotspot = hotspotsData?.features[0];
  const emergencyCount = alertsData?.items.filter((item) => item.severity === 'emergency').length ?? 0;
  const latestFeedTime = primaryAlert?.created_at ?? hotspotsData?.fetched_at;
  const maxAnomalyScore = anomaliesList.length ? Math.max(...anomaliesList.map((item) => item.anomaly_score)) : null;

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="relative w-full px-gutter-desktop py-6 space-y-8">
        {/* Top Context & Title Bar */}
        <section className="relative w-full bg-surface-vanilla rounded-3xl p-6 md:p-8 shadow-[4px_4px_0px_#18181B] border-2 border-ink-black overflow-hidden">
          {/* Decorative starburst & organic playful accents */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-secondary-container opacity-20 pointer-events-none"></div>
          <div className="absolute right-32 -top-6 w-24 h-24 rounded-full bg-tertiary-fixed opacity-40 pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink-black text-canvas-cream font-label-md text-label-md uppercase tracking-wider shadow-[2px_2px_0px_#FF5376] font-bold">
                  <span className="material-symbols-outlined text-[14px] text-coral-watermelon-vivid">gavel</span>
                  Section 31A Oversight
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-vanilla-strong text-ink-black font-label-md text-label-md shadow-[2px_2px_0px_#18181B] border border-ink-black font-bold">
                  <span className="w-2 h-2 rounded-full bg-forest-jade animate-pulse"></span>
                  Backend Legal Registry
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-terracotta-deep/10 text-terracotta-deep font-label-md text-label-md font-bold">
                  {legalRegistry?.legal_status ?? 'Legal registry loading'}
                </span>
              </div>

              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="font-headline-lg text-headline-lg text-ink-black font-serif italic tracking-tight">
                  SPCB Incident Command &amp; Regulatory Enforcement
                </h1>
                <span className="font-headline-sm text-headline-sm text-ink-muted">/ {legalRegistry?.dispatches.length ?? 0} Recorded Dispatches</span>
              </div>

              <p className="font-body-md text-body-md text-ink-muted max-w-3xl">
                Autonomous forensic anomaly triage, automated statutory notices under the Air (Prevention and Control of Pollution) Act, 1981, and real-time enforcement dispatch registry for NCR airsheds.
              </p>
            </div>

            {/* Quirky Starburst Badge */}
            <div className="flex items-center gap-4 self-start lg:self-center">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 bg-ink-black text-canvas-cream rounded-full flex flex-col items-center justify-center p-2 text-center rotate-6 shadow-[3px_3px_0px_#1D4ED8] transition-transform group-hover:rotate-0 group-hover:scale-105 border-2 border-canvas-cream">
                  <span className="font-label-md text-label-md text-coral-watermelon-vivid uppercase font-extrabold leading-none">
                    AUTO
                  </span>
                  <span className="font-headline-sm text-[16px] leading-tight font-serif italic">Legal</span>
                  <span className="font-label-md text-[10px] text-canvas-cream tracking-tight">Enforcer</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-coral-watermelon-vivid rounded-full border border-ink-black animate-ping"></div>
              </div>
            </div>
          </div>

          {/* Trilingual SPCB Emergency Bulletin Ribbon (backend/routers/alerts.py: GET /api/v1/alerts/latest?lang=en|hi|pa) */}
          <div className="mt-6 p-4 rounded-2xl bg-surface-vanilla-strong border-2 border-ink-black shadow-[3px_3px_0px_#18181B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase animate-pulse">
                  Official Statutory Bulletin
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  ID: {bulletin?.incident_id || 'No current incident'}
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm font-bold text-ink-black">
                {bulletin?.title || 'NO CURRENT BACKEND BULLETIN'}
              </h4>
              <p className="font-body-sm text-body-sm text-ink-muted leading-relaxed">
                {bulletin?.body || 'The backend has no current alert bulletin for this language.'}
              </p>
            </div>

            {/* Language Switcher Pill */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-canvas-cream border border-ink-black shadow-[2px_2px_0px_#18181B] flex-shrink-0">
              {(['en', 'hi', 'pa'] as const).map((lang) => {
                const label = lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'ਪੰਜਾਬੀ';
                const isSelected = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={`px-3 py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-ink-black text-canvas-cream font-bold shadow-[1px_1px_0px_#18181B]'
                        : 'text-ink-muted hover:text-ink-black'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Segmented Pill Filter Bar */}
          <div className="mt-6 pt-5 border-t border-ink-black/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full font-label-lg text-label-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === 'all'
                    ? 'bg-ink-black text-canvas-cream shadow-[2px_2px_0px_#1D4ED8]'
                    : 'bg-surface-container-lowest text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla'
                }`}
                type="button"
              >
                <span>✦ All Incidents ({alertsData?.count ?? 0})</span>
              </button>
              <button
                onClick={() => setFilter('emergency')}
                className={`px-4 py-2 rounded-full font-label-lg text-label-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === 'emergency'
                    ? 'bg-ink-black text-canvas-cream shadow-[2px_2px_0px_#1D4ED8]'
                    : 'bg-surface-container-lowest text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla'
                }`}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-aqi-severe"></span>
                <span>Emergency Breaches ({emergencyCount})</span>
              </button>
              <button
                onClick={() => setFilter('nighttime')}
                className={`px-4 py-2 rounded-full font-label-lg text-label-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === 'nighttime'
                    ? 'bg-ink-black text-canvas-cream shadow-[2px_2px_0px_#1D4ED8]'
                    : 'bg-surface-container-lowest text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">bedtime</span>
                <span>Nighttime Anomalies ({anomaliesList.length})</span>
              </button>
              <button
                onClick={() => setFilter('stubble')}
                className={`px-4 py-2 rounded-full font-label-lg text-label-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === 'stubble'
                    ? 'bg-ink-black text-canvas-cream shadow-[2px_2px_0px_#1D4ED8]'
                    : 'bg-surface-container-lowest text-ink-black border border-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px] text-terracotta-deep">local_fire_department</span>
                <span>Stubble Hotspots ({hotspotsData?.count ?? 0})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  className="w-64 pl-8 pr-3 py-1.5 rounded-full bg-surface-container-lowest border border-ink-black font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-[2px_2px_0px_#18181B]"
                  placeholder="Search ward, stack ID, or CEMS..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-ink-muted">
                  search
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Split View Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Live Autonomous Incident Stream (7 Cols) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm font-serif italic text-ink-black">
                  Autonomous Telemetry Feed
                </span>
                <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-[10px] uppercase font-bold">
                  Live Intercept
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-ink-muted">{latestFeedTime ? `Updated ${new Date(latestFeedTime).toLocaleString()}` : 'Awaiting backend feed'}</span>
            </div>

            {/* Live SPCB Incident Registry (GET /api/v1/alerts) */}
            <div className="bg-ink-black rounded-2xl p-space-md border-2 border-ink-black shadow-[4px_4px_0px_#1D4ED8] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-label-md text-label-md uppercase text-cobalt-deep font-bold">Live Registry &bull; GET /api/v1/alerts</div>
                  <div className="font-headline-sm text-headline-sm text-canvas-cream font-bold mt-0.5">
                    {alertsData ? `${alertsData.count} Active Incident${alertsData.count !== 1 ? 's' : ''}` : 'Loading backend...'}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-coral-watermelon-vivid/20 text-coral-watermelon-vivid font-label-md text-label-md font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-coral-watermelon-vivid animate-pulse"></span>
                  Live
                </span>
              </div>
              {alertsData && alertsData.items.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {alertsData.items.map((item: IncidentItem) => (
                    <div
                      key={item.incident_id}
                      className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedIncident(item.incident_id);
                        setCurrentNotice(null);
                        setNoticeText(`Review incident ${item.incident_id} at ${item.location_text || 'unspecified location'} using the measured ${item.pollutant || 'PM2.5'} value ${item.measured_pm25 == null ? 'recorded by the backend' : `${item.measured_pm25.toFixed(1)} µg/m³`}.`);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.severity === 'emergency' ? 'bg-coral-watermelon-vivid' :
                          item.severity === 'warning' ? 'bg-terracotta-deep' :
                          'bg-cobalt-deep'
                        }`}></span>
                        <span className="font-mono text-[11px] text-cobalt-deep font-bold">{item.incident_id}</span>
                        <span className="font-body-sm text-[11px] text-white/60">{item.location_text}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.measured_pm25 != null && (
                          <span className="font-label-md text-label-md text-white/80 font-bold">{item.measured_pm25.toFixed(0)} µg/m³</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded font-label-md text-[10px] font-bold uppercase ${
                          item.severity === 'emergency' ? 'bg-coral-watermelon-vivid/20 text-coral-watermelon-vivid' :
                          item.severity === 'warning' ? 'bg-terracotta-deep/20 text-terracotta-deep' :
                          'bg-cobalt-deep/20 text-cobalt-deep'
                        }`}>{item.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : alertsData ? (
                <div className="text-white/50 font-body-sm text-body-sm py-2">No incidents in the current filter window.</div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <span className="w-2 h-2 rounded-full bg-cobalt-deep animate-ping"></span>
                  <span className="text-white/50 font-body-sm">Connecting to SPCB-MESH-RT...</span>
                </div>
              )}
            </div>

            {/* Incident 1: Anand Vihar Acute Airshed Spike */}
            {(filter === 'all' || filter === 'emergency') && (
              <article className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col gap-5 hover:-translate-y-0.5 transition-transform duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-aqi-hazardous text-canvas-cream font-label-md text-label-md font-bold uppercase tracking-wider shadow-[1px_1px_0px_#18181B]">
                        Breach Alert
                      </span>
                      <span className="font-label-md text-label-md text-ink-muted font-bold">{primaryAlert?.incident_id ?? 'No current incident'}</span>
                      <span className="text-outline-variant">•</span>
                      <span className="font-body-sm text-body-sm text-ink-muted">{primaryAlert?.location_text ?? 'Backend incident feed is empty'}</span>
                    </div>
                    <h2 className="font-title-md text-title-md text-ink-black font-sans font-bold flex items-center gap-2">
                      {primaryAlert ? `${primaryAlert.location_text || primaryAlert.incident_id} (${primaryAlert.severity.toUpperCase()})` : 'No Current Airshed Breach'}
                      <span className="material-symbols-outlined text-coral-watermelon-vivid text-[20px]">warning</span>
                    </h2>
                  </div>

                  {/* Dual-Unit Telemetry Chip */}
                  <div className="inline-flex items-center rounded-full bg-surface-container-lowest border-2 border-ink-black px-3 py-1 shadow-[2px_2px_0px_#18181B] self-start">
                    <span className="font-telemetry-val text-telemetry-val text-terracotta-deep pr-2 font-bold">{primaryAlert?.measured_pm25?.toFixed(1) ?? 'N/A'}</span>
                    <span className="font-telemetry-unit text-telemetry-unit text-ink-muted pr-3 border-r border-ink-black/30 font-semibold">
                      µg/m³ PM2.5
                    </span>
                    <span className="font-telemetry-val text-telemetry-val text-ink-black pl-3 flex items-center gap-1 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-aqi-hazardous"></span>
                      {primaryAlert?.measured_aqi ?? 'N/A'} <span className="font-telemetry-unit text-telemetry-unit text-ink-muted font-normal">AQI</span>
                    </span>
                  </div>
                </div>

                {/* Graphic Card Interior: Thermal Visualizer & Trajectory Convergence */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Thermal Satellite Thumbnail */}
                  <div className="md:col-span-5 rounded-2xl border border-ink-black bg-surface-container-lowest p-3 flex flex-col justify-between relative overflow-hidden shadow-[2px_2px_0px_#18181B]">
                    <div className="flex items-center justify-between text-ink-muted font-label-md text-label-md mb-2">
                      <span className="flex items-center gap-1 font-bold text-ink-black">
                        <span className="material-symbols-outlined text-[14px] text-terracotta-deep">satellite_alt</span>
                        {primaryHotspot?.properties.sensor ?? 'Thermal Feed'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-vanilla text-ink-black font-bold">{formatDataSource(hotspotsData?.source, 'Thermal feed unavailable')}</span>
                    </div>

                    <div className="w-full h-32 rounded-xl bg-ink-black relative overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-tr from-terracotta-deep/80 via-coral-watermelon-vivid/40 to-transparent"></div>
                      <div className="absolute w-24 h-24 rounded-full bg-aqi-unhealthy/70 blur-xl top-4 left-6"></div>
                      <div className="absolute w-12 h-12 rounded-full bg-coral-watermelon-vivid blur-md top-8 left-10 animate-pulse"></div>
                      <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center text-canvas-cream font-mono text-[11px] leading-tight">
                        <span className="bg-ink-black/80 px-2 py-0.5 rounded border border-canvas-cream/20 mb-1 font-sans font-bold text-coral-watermelon-vivid">
                          {primaryHotspot ? `${primaryHotspot.properties.sensor} hotspot` : 'No current hotspot'}
                        </span>
                        <span>{primaryHotspot ? `${primaryHotspot.geometry.coordinates[1].toFixed(3)}°N, ${primaryHotspot.geometry.coordinates[0].toFixed(3)}°E` : 'Coordinates unavailable'}</span>
                      </div>
                      <div className="absolute bottom-2 right-2 text-[9px] text-canvas-cream/70 font-label-md">
                        {primaryHotspot ? new Date(primaryHotspot.properties.acq_datetime).toLocaleString() : 'Awaiting FIRMS feed'}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between font-label-md text-label-md text-ink-muted">
                      <span>FRP Radiative: <strong className="text-ink-black">{primaryHotspot ? (primaryHotspot.properties.frp == null ? 'Not reported' : `${primaryHotspot.properties.frp.toFixed(1)} MW`) : 'No current detection'}</strong></span>
                      <span className="text-coral-watermelon-vivid font-bold">Confidence: {primaryHotspot?.properties.confidence ?? 'No current detection'}</span>
                    </div>
                  </div>

                  {/* Trajectory Convergence Card */}
                  <div className="md:col-span-7 rounded-2xl border border-ink-black bg-surface-container-lowest p-4 flex flex-col justify-between shadow-[2px_2px_0px_#18181B]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-title-sm text-title-sm text-ink-black font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-cobalt-deep">near_me</span>
                        Trajectory Convergence
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md font-bold">
                        {formatDataSource(alertsData?.items[0]?.satellite_source, 'Source unavailable')}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-ink-muted">
                      {primaryAlert
                        ? `Backend incident evidence reports ${primaryAlert.satellite_evidence?.fire_count_50km ?? 0} fires within 50 km${primaryAlert.satellite_evidence?.nearest_fire_km == null ? '' : `; nearest fire ${primaryAlert.satellite_evidence.nearest_fire_km.toFixed(1)} km away`}.`
                        : 'No current incident trajectory evidence is available.'}
                    </p>

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between font-label-md text-label-md">
                        <span className="text-ink-muted">Satellite: {formatDataSource(primaryAlert?.satellite_source, 'No active incident')}</span>
                        <span className="text-ink-black font-bold">PM2.5: {primaryAlert?.measured_pm25 == null ? 'No active incident' : `${primaryAlert.measured_pm25.toFixed(1)} µg/m³`}</span>
                      </div>
                      <div className="w-full h-3 bg-surface-vanilla rounded-full border border-ink-black overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-aqi-moderate via-aqi-unhealthy to-coral-watermelon-vivid rounded-full" style={{ width: `${Math.min(100, (primaryAlert?.measured_pm25 ?? 0) / 5)}%` }}></div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-ink-black/10 flex items-center justify-between">
                      <span className="font-body-sm text-body-sm text-ink-black font-medium">
                        Statutory PM2.5 threshold variance: <strong className="text-coral-watermelon-vivid font-bold">{primaryAlert?.measured_pm25 == null ? 'No active incident' : `${(((primaryAlert.measured_pm25 - 60) / 60) * 100).toFixed(0)}%`}</strong>
                      </span>
                      <span className="font-label-md text-label-md text-ink-muted uppercase tracking-wider font-bold">
                        {primaryAlert?.severity ?? 'No event'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Deck */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 font-body-sm text-body-sm text-ink-muted">
                    <span className="material-symbols-outlined text-[18px] text-forest-jade">shield</span>
                    <span>{primaryAlert ? `Backend incident recorded at ${new Date(primaryAlert.created_at).toLocaleString()}` : 'No incident evidence is currently recorded'}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (!primaryAlert) return;
                      setSelectedIncident(primaryAlert.incident_id);
                      setCurrentNotice(null);
                      setNoticeText(`Review incident ${primaryAlert.incident_id} at ${primaryAlert.location_text || 'unspecified location'} using its measured backend telemetry.`);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                    type="button"
                  >
                    <span>Load Into Notice Drafter</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </article>
            )}

            {/* Incident 2: Manesar Sector 8 Wet Scrubber Bypass */}
            {(filter === 'all' || filter === 'nighttime') && (
              <article className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col gap-5 hover:-translate-y-0.5 transition-transform duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase tracking-wider shadow-[1px_1px_0px_#18181B]">
                        Tamper Detection
                      </span>
                      <span className="font-label-md text-label-md text-ink-muted font-bold">{cemsData?.facility_id ?? 'CEMS feed pending'}</span>
                      <span className="text-outline-variant">•</span>
                      <span className="font-body-sm text-body-sm text-ink-muted">Backend industrial telemetry</span>
                    </div>
                    <h2 className="font-title-md text-title-md text-ink-black font-sans font-bold flex items-center gap-2">
                      {cemsData?.status === 'REVIEW_REQUIRED' ? 'CEMS Scrubber Pattern Requires Review' : 'CEMS Scrubber Forensic Review'}
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

                {anomaliesList.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-label-md text-label-md font-bold text-ink-muted uppercase">
                      Live Anomaly Cluster Feed ({anomalyParam.toUpperCase()} • {daysBack}d Lookback)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {anomaliesList.slice(0, 4).map((anomaly, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedIncident('');
                            setCurrentNotice(null);
                            setNoticeText(
                              `FORM 2: NOTICE UNDER SECTION 31A - INDUSTRIAL ANOMALY DETECTED.\n\n` +
                              `STATION: ${anomaly.station_name || anomaly.station_id}\n` +
                              `PARAMETER: ${anomaly.parameter.toUpperCase()} | ANOMALY SCORE: ${anomaly.anomaly_score.toFixed(3)}\n` +
                              `HOUR: ${String(anomaly.hour_of_day).padStart(2, '0')}:00 IST (${anomaly.is_nighttime ? 'Nighttime Window' : 'Daytime'})\n\n` +
                              `Telemetry exhibits statistical divergence (IsolationForest > 0.65). Immediate compliance audit ordered.`
                            );
                          }}
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
                )}

                {/* Technical Forensics Graphic & Inline SVG Chart */}
                <div className="rounded-2xl border border-ink-black bg-surface-container-lowest p-4 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-title-sm text-title-sm text-ink-black font-bold">
                        Stack Velocity vs. ID Fan Electrical Draw
                      </span>
                      <p className="font-body-sm text-body-sm text-ink-muted">
                        {cemsData ? `${cemsData.readings.length} readings analyzed. ${cemsData.method}` : 'Loading backend CEMS forensics.'}
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
                          <text fill="#FF5376" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="700" x="230" y="32">REVIEW WINDOW DETECTED</text>
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
                      <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="40" y="125">{cemsReadings[0] ? new Date(cemsReadings[0].measured_at).toLocaleTimeString() : 'No readings'}</text>
                      <text fill="#52525B" fontFamily="Plus Jakarta Sans" fontSize="10" x="440" y="125">{cemsReadings.length ? new Date(cemsReadings[cemsReadings.length - 1].measured_at).toLocaleTimeString() : ''}</text>
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
                    <span>{cemsData?.status === 'REVIEW_REQUIRED' ? 'Backend pattern requires compliance review' : 'No bypass pattern detected in current readings'}</span>
                  </div>
                  <button
                    onClick={handleLoadCemsDossier}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                    type="button"
                  >
                    <span>Load Tamper Dossier ➔</span>
                  </button>
                </div>
              </article>
            )}

            {/* Incident 3: Stubble Fire Hotspot Cluster */}
            {(filter === 'all' || filter === 'stubble') && (
              <article className="bg-surface-vanilla rounded-3xl p-5 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-aqi-unhealthy text-canvas-cream font-label-md text-label-md font-bold uppercase shadow-[1px_1px_0px_#18181B]">
                      Thermal Cluster
                    </span>
                    <span className="font-body-sm text-body-sm text-ink-muted font-bold">{formatDataSource(hotspotsData?.source, 'FIRMS feed unavailable')}</span>
                  </div>
                  <h3 className="font-title-sm text-title-sm text-ink-black font-sans font-bold">
                    {hotspotsData ? `${hotspotsData.count} Current Fire Hotspot${hotspotsData.count === 1 ? '' : 's'}` : 'Loading Current Fire Hotspots'}
                  </h3>
                  <p className="font-body-sm text-body-sm text-ink-muted">
                    {primaryHotspot
                      ? `${primaryHotspot.properties.sensor} detection at ${primaryHotspot.geometry.coordinates[1].toFixed(3)}°N, ${primaryHotspot.geometry.coordinates[0].toFixed(3)}°E; FRP ${primaryHotspot.properties.frp == null ? 'unavailable' : `${primaryHotspot.properties.frp.toFixed(1)} MW`}.`
                      : 'No current hotspot is available for enforcement review.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="px-4 py-2 rounded-full bg-surface-container-lowest border border-ink-black font-label-lg text-label-lg text-ink-black shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla transition-all cursor-pointer font-bold"
                    type="button"
                  >
                    Geo-Tag Ward
                  </button>
                  <button
                    onClick={() => setNoticeText(primaryHotspot
                      ? `A live hotspot was detected at ${primaryHotspot.geometry.coordinates[1].toFixed(5)}°N, ${primaryHotspot.geometry.coordinates[0].toFixed(5)}°E by ${primaryHotspot.properties.sensor}. Create a measured PM2.5 incident before issuing a statutory notice.`
                      : 'No current hotspot is available for a statutory notice.')}
                    className="px-4 py-2 rounded-full bg-coral-watermelon-vivid text-canvas-cream font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:-translate-y-0.5 transition-all cursor-pointer font-bold"
                    type="button"
                  >
                    Issue Notice ➔
                  </button>
                </div>
              </article>
            )}
          </section>

          {/* RIGHT COLUMN: Automated Legal Drafter & Forensic Dossier (5 Cols) */}
          <section className="lg:col-span-5 flex flex-col gap-6 sticky top-28">
            {/* Automated Legal Drafter Card */}
            <div className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[6px_6px_0px_#18181B] flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 font-headline-lg text-[110px] text-ink-black/5 select-none pointer-events-none font-serif font-black">
                §31A
              </div>
              <div className="flex items-center justify-between pb-3 border-b-2 border-ink-black">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">balance</span>
                  </div>
                  <div>
                    <h3 className="font-title-md text-title-md text-ink-black font-sans font-bold">
                      Automated Legal Drafter
                    </h3>
                    <span className="font-label-md text-label-md text-ink-muted uppercase font-bold">
                      Statutory Action Generator
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-vanilla-strong font-label-md text-label-md text-ink-black font-bold border border-ink-black/20">
                  {selectedIncident}
                </span>
              </div>

              {/* Context Selector */}
              <div>
                <label className="block font-label-md text-label-md text-ink-black font-bold uppercase mb-1">
                  Target Airshed Incident
                </label>
                <select
                  className="w-full px-3 py-2 text-sm bg-canvas-cream rounded-xl border border-ink-black font-semibold text-ink-black shadow-[2px_2px_0px_#18181B] focus:outline-none"
                  value={selectedIncident}
                  onChange={(e) => {
                    const incidentId = e.target.value;
                    setSelectedIncident(incidentId);
                    setCurrentNotice(null);
                    const incident = alertsData?.items.find((item) => item.incident_id === incidentId);
                    setNoticeText(incident
                      ? `Review incident ${incident.incident_id} at ${incident.location_text || 'unspecified location'} using the measured ${incident.pollutant || 'PM2.5'} value ${incident.measured_pm25 == null ? 'recorded by the backend' : `${incident.measured_pm25.toFixed(1)} µg/m³`}.`
                      : 'Select a current backend incident to prepare a statutory notice.');
                  }}
                >
                  <option value="">Select current backend incident</option>
                  {(alertsData?.items ?? []).map((item) => (
                    <option key={item.incident_id} value={item.incident_id}>
                      {item.incident_id} ({item.location_text || item.severity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea */}
              <div>
                <label className="block font-label-md text-label-md text-ink-black font-bold uppercase mb-1">
                  Statutory Notice Drafter (§31A Air Act 1981)
                </label>
                <textarea
                  className="w-full h-44 p-3 bg-canvas-cream rounded-xl border border-ink-black font-mono text-xs text-ink-black leading-relaxed shadow-[inset_1px_1px_0px_#18181B] focus:outline-none focus:ring-1 focus:ring-cobalt-deep"
                  value={noticeText}
                  onChange={(e) => setNoticeText(e.target.value)}
                />
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleGenerateNotice}
                  className="w-full py-2.5 rounded-full bg-surface-container-lowest border-2 border-ink-black text-ink-black font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
                  type="button"
                >
                  <span className={`material-symbols-outlined text-[16px] ${noticeGenerated ? 'animate-spin' : ''}`}>
                    {noticeGenerated ? 'refresh' : 'edit_note'}
                  </span>
                  <span>{noticeGenerated ? 'Notice Regenerated!' : 'Re-Generate From Telemetry'}</span>
                </button>

                <button
                  onClick={handleSignPramaan}
                  className="w-full py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:bg-cobalt-deep transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-forest-jade">verified</span>
                  <span>{sealedPramaan
                    ? 'Cryptographically Sealed via e-Pramaan'
                    : signatureStatus === 'PROVIDER_NOT_CONFIGURED'
                      ? 'e-Pramaan Provider Not Configured'
                      : signatureStatus === 'READY_FOR_PROVIDER'
                        ? 'Ready for Authorized eSign'
                        : 'Check e-Pramaan Signing Readiness'}</span>
                </button>

                <button
                  onClick={handleTransmitDM}
                  className="w-full py-3 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-lg text-label-lg shadow-[3px_3px_0px_#18181B] hover:bg-secondary transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>{transmittedToDM
                    ? 'Transmitted to DM & Police Command!'
                    : dispatchStatus === 'PENDING_CONFIGURATION'
                      ? 'DM Dispatch Pending Configuration'
                      : 'Queue District Magistrate Review'}</span>
                </button>
              </div>

              <div className="p-2.5 bg-canvas-cream rounded-xl border border-ink-black/20 text-body-sm text-ink-muted flex items-center gap-2 font-label-md">
                <span className="material-symbols-outlined text-[16px] text-cobalt-deep">security</span>
                <span>Backend records drafts, hashes, and dispatch requests for audit review</span>
              </div>
            </div>

            {/* State Pollution Enforcement Ledger */}
            <div className="bg-surface-vanilla rounded-3xl p-6 border-2 border-ink-black shadow-[4px_4px_0px_#18181B] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink-black/10">
                <h3 className="font-title-sm text-title-sm font-bold text-ink-black">
                  Enforcement Registry (Last 24 Hours)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-surface-vanilla-strong text-[11px] font-bold text-ink-black border border-ink-black/20">
                  {legalRegistry?.warrants.length ?? 0} Active Warrants
                </span>
              </div>

              <div className="space-y-3">
                {registryItems.map((item, i) => (
                  <div
                      key={item.id || i}
                    className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 shadow-[2px_2px_0px_#18181B] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-title-sm text-body-sm font-bold text-ink-black">{item.title}</div>
                      <div className="font-body-sm text-[11px] text-ink-muted">{item.detail}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-label-md text-[10px] font-bold ${item.statusColor}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
                {registryItems.length === 0 && (
                  <div className="p-3 bg-canvas-cream rounded-xl border border-ink-black/20 font-body-sm text-body-sm text-ink-muted">
                    No legal drafts or dispatch requests have been recorded.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
