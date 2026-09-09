import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertsResponse,
  AnomalyItem,
  CemsForensicsResponse,
  HotspotsResponse,
  LatestAlertResponse,
  LegalNotice,
  LegalRegistryResponse,
  createLegalNotice,
  fetchAlerts,
  fetchAnomalies,
  fetchCemsForensics,
  fetchHotspots,
  fetchLatestAlert,
  fetchLegalRegistry,
  fetchSignaturePackage,
  queueLegalDispatch,
} from '../api/client';
import { BulletinBoard } from '../components/alerts/BulletinBoard';
import { IncidentList } from '../components/alerts/IncidentList';
import { AnomalyPanel } from '../components/alerts/AnomalyPanel';
import { CemsPanel } from '../components/alerts/CemsPanel';
import { LegalWorkflow } from '../components/alerts/LegalWorkflow';
import { useToast } from '../components/ui/Toast';

export const AlertsPage: React.FC = () => {
  const { success, error, info } = useToast();
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live alerts from backend (GET /api/v1/alerts)
  const [alertsData, setAlertsData] = useState<AlertsResponse | null>(null);
  const [noticeText, setNoticeText] = useState('Select a current backend incident to prepare a statutory notice.');

  useEffect(() => {
    document.title = 'PRANA — SPCB Legal Alerts & Enforcement';
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await fetchAlerts(undefined, 50);
      setAlertsData(data);
    } catch {
      // Keep previous data on network glitch
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial data fetch on mount - decoupled so filter changes do NOT re-query CEMS/FIRMS/Registry
  useEffect(() => {
    loadAlerts();
    fetchLegalRegistry().then(setLegalRegistry).catch(() => {});
    setCemsData(null);
    fetchHotspots(24).then(setHotspotsData).catch(() => {});

    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  // Bulletin fetch on language switch
  useEffect(() => {
    fetchLatestAlert(selectedLang).then(setBulletin).catch(() => setBulletin(null));
  }, [selectedLang]);

  // Anomaly parameters fetch
  useEffect(() => {
    fetchAnomalies(anomalyParam, nighttimeOnly, daysBack)
      .then((data) => setAnomaliesList(data.items))
      .catch(() => setAnomaliesList([]));
  }, [anomalyParam, nighttimeOnly, daysBack]);

  const refreshRegistry = () => fetchLegalRegistry().then(setLegalRegistry).catch(() => {});

  const createDraftFromSelection = async (): Promise<LegalNotice | null> => {
    const selectedAlert = alertsData?.items.find((item) => item.incident_id === selectedIncident);
    if (!selectedAlert) {
      setNoticeText('No current backend incident is selected. A notice cannot be created without measured incident telemetry.');
      error('Select an active incident before generating notice');
      return null;
    }
    try {
      const notice = await createLegalNotice({
        incident_id: selectedAlert.incident_id,
        issuing_authority: 'State Pollution Control Board Review Desk',
        requested_direction: noticeText,
      });
      setSelectedIncident(selectedAlert.incident_id);
      setCurrentNotice(notice);
      setNoticeText(notice.body);
      refreshRegistry();
      success(`Notice draft created for ${selectedAlert.incident_id}`);
      return notice;
    } catch {
      error('Failed to generate legal notice draft');
      return null;
    }
  };

  const handleGenerateNotice = async () => {
    const notice = await createDraftFromSelection();
    if (!notice) return;
    setNoticeGenerated(true);
    setTimeout(() => setNoticeGenerated(false), 2000);
  };

  const handleSignPramaan = async () => {
    const notice = currentNotice ?? (await createDraftFromSelection());
    if (!notice) return;
    try {
      const signature = await fetchSignaturePackage(notice.notice_id);
      setSignatureStatus(signature.status);
      setSealedPramaan(signature.provider_call_performed);
      info(`e-Pramaan Status: ${signature.status}`);
      setTimeout(() => {
        setSealedPramaan(false);
        setSignatureStatus('');
      }, 3000);
    } catch {
      error('e-Pramaan digital signature call failed');
    }
  };

  const handleTransmitDM = async () => {
    const notice = currentNotice ?? (await createDraftFromSelection());
    if (!notice) return;
    try {
      const dispatch = await queueLegalDispatch({
        incident_id: notice.incident_id,
        notice_id: notice.notice_id,
        recipient_kind: 'district_magistrate',
        recipient_reference: 'District Magistrate and Police Command review queue',
      });
      setDispatchStatus(dispatch.status);
      setTransmittedToDM(Boolean(dispatch.message_sent));
      refreshRegistry();
      success(`Legal dispatch queued for DM review (${dispatch.status})`);
      setTimeout(() => {
        setTransmittedToDM(false);
        setDispatchStatus('');
      }, 3000);
    } catch {
      error('Failed to queue legal dispatch');
    }
  };

  const handleLoadCemsDossier = async () => {
    try {
      const data = await fetchCemsForensics('CEMS-FLUE-MAN8', 24);
      setCemsData(data);
      setSelectedIncident('');
      setCurrentNotice(null);
      setNoticeText(
        data.status === 'REVIEW_REQUIRED'
          ? `CEMS FORENSIC REVIEW REQUIRED.\n\nFacility: ${data.facility_id}\nReview windows: ${data.review_windows.length}\nMethod: ${data.method}`
          : `CEMS FORENSIC RESULT.\n\nFacility: ${data.facility_id}\nReadings received: ${data.readings.length}\nNo bypass pattern was detected.\nMethod: ${data.method}`
      );
      info(`Loaded CEMS Forensics: ${data.facility_id}`);
    } catch {
      setCemsData(null);
      setSelectedIncident('');
      setCurrentNotice(null);
      setNoticeText('N/A — authenticated CEMS facility selection is not configured in this public client.');
      info('CEMS forensics requires elevated credentials.');
    }
  };

  const emergencyCount = alertsData?.items.filter((item) => item.severity === 'emergency').length ?? 0;
  const maxAnomalyScore = anomaliesList.length
    ? Math.max(...anomaliesList.map((item) => item.anomaly_score))
    : null;

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="relative w-full px-gutter-desktop py-6 space-y-8">
        {/* Top Context & Title Bar */}
        <section className="relative w-full bg-surface-vanilla rounded-3xl p-6 md:p-8 shadow-[4px_4px_0px_#18181B] border-2 border-ink-black overflow-hidden">
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
                <span className="font-headline-sm text-headline-sm text-ink-muted">
                  / {legalRegistry?.dispatches.length ?? 0} Recorded Dispatches
                </span>
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

          {/* Trilingual SPCB Emergency Bulletin Ribbon */}
          <BulletinBoard
            bulletin={bulletin}
            selectedLang={selectedLang}
            onSelectLang={setSelectedLang}
          />

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
          {/* LEFT COLUMN: Incidents, Anomalies, and CEMS (7 Cols) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <IncidentList
              alertsData={alertsData}
              hotspotsData={hotspotsData}
              selectedIncident={selectedIncident}
              onSelectIncident={(id) => {
                setSelectedIncident(id);
                setCurrentNotice(null);
                const item = alertsData?.items.find((it) => it.incident_id === id);
                if (item) {
                  setNoticeText(`Review incident ${item.incident_id} at ${item.location_text || 'unspecified location'} using the measured ${item.pollutant || 'PM2.5'} value ${item.measured_pm25 == null ? 'recorded by backend' : `${item.measured_pm25.toFixed(1)} µg/m³`}.`);
                }
              }}
              onLoadIntoDrafter={(item) => {
                setSelectedIncident(item.incident_id);
                setCurrentNotice(null);
                setNoticeText(`Review incident ${item.incident_id} at ${item.location_text || 'unspecified location'} using the measured ${item.pollutant || 'PM2.5'} value ${item.measured_pm25 == null ? 'recorded by backend' : `${item.measured_pm25.toFixed(1)} µg/m³`}.`);
              }}
              filter={filter}
              searchQuery={searchQuery}
              onRefresh={loadAlerts}
              isRefreshing={isRefreshing}
            />

            {/* Nighttime / IsolationForest Anomalies Panel */}
            {(filter === 'all' || filter === 'nighttime') && (
              <AnomalyPanel
                anomalyParam={anomalyParam}
                setAnomalyParam={setAnomalyParam}
                nighttimeOnly={nighttimeOnly}
                setNighttimeOnly={setNighttimeOnly}
                daysBack={daysBack}
                setDaysBack={setDaysBack}
                anomaliesList={anomaliesList}
                onSelectAnomaly={(anomaly) => {
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
              />
            )}

            {/* CEMS Industrial Forensic Review Panel */}
            {(filter === 'all' || filter === 'nighttime') && (
              <CemsPanel
                cemsData={cemsData}
                maxAnomalyScore={maxAnomalyScore}
                onLoadTamperDossier={handleLoadCemsDossier}
              />
            )}
          </section>

          {/* RIGHT COLUMN: Automated Legal Drafter & Forensic Dossier (5 Cols) */}
          <LegalWorkflow
            selectedIncident={selectedIncident}
            onSelectIncident={(id) => {
              setSelectedIncident(id);
              setCurrentNotice(null);
              const incident = alertsData?.items.find((item) => item.incident_id === id);
              setNoticeText(incident
                ? `Review incident ${incident.incident_id} at ${incident.location_text || 'unspecified location'} using the measured ${incident.pollutant || 'PM2.5'} value ${incident.measured_pm25 == null ? 'recorded by the backend' : `${incident.measured_pm25.toFixed(1)} µg/m³`}.`
                : 'Select a current backend incident to prepare a statutory notice.');
            }}
            alertsData={alertsData}
            noticeText={noticeText}
            setNoticeText={setNoticeText}
            noticeGenerated={noticeGenerated}
            onGenerateNotice={handleGenerateNotice}
            sealedPramaan={sealedPramaan}
            signatureStatus={signatureStatus}
            onSignPramaan={handleSignPramaan}
            transmittedToDM={transmittedToDM}
            dispatchStatus={dispatchStatus}
            onTransmitDM={handleTransmitDM}
            legalRegistry={legalRegistry}
          />
        </div>
      </div>
    </div>
  );
};
