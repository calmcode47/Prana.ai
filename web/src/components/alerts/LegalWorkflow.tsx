import React from 'react';
import { AlertsResponse, LegalRegistryResponse } from '../../api/client';

interface LegalWorkflowProps {
  selectedIncident: string;
  onSelectIncident: (id: string) => void;
  alertsData: AlertsResponse | null;
  noticeText: string;
  setNoticeText: (val: string) => void;
  noticeGenerated: boolean;
  onGenerateNotice: () => void;
  sealedPramaan: boolean;
  signatureStatus: string;
  onSignPramaan: () => void;
  transmittedToDM: boolean;
  dispatchStatus: string;
  onTransmitDM: () => void;
  legalRegistry: LegalRegistryResponse | null;
}

export const LegalWorkflow: React.FC<LegalWorkflowProps> = ({
  selectedIncident,
  onSelectIncident,
  alertsData,
  noticeText,
  setNoticeText,
  noticeGenerated,
  onGenerateNotice,
  sealedPramaan,
  signatureStatus,
  onSignPramaan,
  transmittedToDM,
  dispatchStatus,
  onTransmitDM,
  legalRegistry,
}) => {
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

  return (
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
            {selectedIncident || 'None selected'}
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
            onChange={(e) => onSelectIncident(e.target.value)}
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

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onGenerateNotice}
            className="w-full py-2.5 rounded-full bg-surface-container-lowest border-2 border-ink-black text-ink-black font-label-lg text-label-lg shadow-[2px_2px_0px_#18181B] hover:bg-surface-vanilla transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
            type="button"
          >
            <span className={`material-symbols-outlined text-[16px] ${noticeGenerated ? 'animate-spin' : ''}`}>
              {noticeGenerated ? 'refresh' : 'edit_note'}
            </span>
            <span>{noticeGenerated ? 'Notice Regenerated!' : 'Re-Generate From Telemetry'}</span>
          </button>

          <button
            onClick={onSignPramaan}
            className="w-full py-2.5 rounded-full bg-ink-black text-canvas-cream font-label-lg text-label-lg shadow-[3px_3px_0px_#1D4ED8] hover:bg-cobalt-deep transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-forest-jade">verified</span>
            <span>
              {sealedPramaan
                ? 'Cryptographically Sealed via e-Pramaan'
                : signatureStatus === 'PROVIDER_NOT_CONFIGURED'
                  ? 'e-Pramaan Provider Not Configured'
                  : signatureStatus === 'READY_FOR_PROVIDER'
                    ? 'Ready for Authorized eSign'
                    : 'Check e-Pramaan Signing Readiness'}
            </span>
          </button>

          <button
            onClick={onTransmitDM}
            className="w-full py-3 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-lg text-label-lg shadow-[3px_3px_0px_#18181B] hover:bg-secondary transition-all flex items-center justify-center gap-2 cursor-pointer font-bold"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span>
              {transmittedToDM
                ? 'Transmitted to DM & Police Command!'
                : dispatchStatus === 'PENDING_CONFIGURATION'
                  ? 'DM Dispatch Pending Configuration'
                  : 'Queue District Magistrate Review'}
            </span>
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
  );
};
