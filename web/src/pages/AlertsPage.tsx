import React, { useState } from 'react';
import { mockIncidents } from '../data/mockData';
import { IncidentAlert } from '../types';

export const AlertsPage: React.FC = () => {
  const [selectedIncident, setSelectedIncident] = useState<IncidentAlert>(mockIncidents[0]);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'pa'>('en');
  const [dispatchedTickets, setDispatchedTickets] = useState<string[]>([]);

  const handleDispatch = (ticketId: string) => {
    if (!dispatchedTickets.includes(ticketId)) {
      setDispatchedTickets([...dispatchedTickets, ticketId]);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-gutter-mobile lg:px-gutter-desktop py-unit-lg space-y-unit-lg animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-unit-sm pb-unit-sm border-b border-border-subtle">
        <div className="space-y-unit-2xs">
          <div className="flex items-center gap-unit-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Statutory Incident Command Feed</span>
            <span className="text-outline-variant">•</span>
            <span>SPCB Regulatory Matrix</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-editorial font-bold">
            Regulatory Enforcement & Incident Command
          </h1>
        </div>

        <div className="flex items-center gap-unit-xs bg-surface-container p-1 rounded-full text-xs font-bold">
          <span className="text-on-surface-variant px-2">Vernacular Advisory:</span>
          {(['en', 'hi', 'pa'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`px-3 py-1 rounded-full transition-all uppercase ${
                selectedLanguage === lang
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ਪੰਜਾਬੀ'}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left 5 Cols: Incident Tickets Feed */}
        <div className="lg:col-span-5 space-y-unit-md">
          <div className="bg-surface-container-lowest p-unit-md rounded-xl border border-border-subtle shadow-sm space-y-unit-sm">
            <div className="flex items-center justify-between pb-unit-2xs border-b border-border-subtle">
              <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                Active Incident Queue
              </h3>
              <span className="text-xs font-mono text-on-surface-variant">{mockIncidents.length} Tickets</span>
            </div>

            <div className="space-y-unit-sm">
              {mockIncidents.map((incident) => {
                const isDispatched = dispatchedTickets.includes(incident.id);
                return (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident)}
                    className={`p-unit-md rounded-xl border cursor-pointer transition-all space-y-2 ${
                      selectedIncident.id === incident.id
                        ? 'bg-surface-container border-primary shadow-sm'
                        : 'bg-surface-container-low border-border-subtle/70 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-secondary block">{incident.ticket_number}</span>
                        <h4 className="font-bold text-sm text-primary">{incident.district}, {incident.state}</h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-secondary-fixed text-on-secondary-fixed">
                        {isDispatched ? 'DISPATCHED' : incident.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
                      <span>Thermal FRP: <b className="text-secondary">{incident.frp_mw} MW</b></span>
                      <span>Confidence: {incident.confidence}%</span>
                    </div>

                    <div className="pt-1 flex items-center gap-2 text-[11px] text-on-surface-variant/80">
                      <span className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span> VIIRS
                      </span>
                      <span className="flex items-center gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${incident.modis_verified ? 'bg-accent-emerald' : 'bg-outline-variant'}`}></span> MODIS
                      </span>
                      <span className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span> INSAT-3DR
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Legal Drafter & Multi-Satellite Evidence */}
        <div className="lg:col-span-7 space-y-unit-lg">
          {/* Statutory Legal Notice Drafter */}
          <div className="bg-surface-container-lowest p-unit-lg rounded-xl border border-border-subtle shadow-sm space-y-unit-md">
            <div className="flex items-start justify-between pb-unit-xs border-b border-border-subtle">
              <div>
                <span className="font-label-sm text-label-sm uppercase text-secondary font-bold">
                  Statutory Drafter • {selectedIncident.legal_notice_draft.statutory_act}
                </span>
                <h3 className="font-headline-sm text-headline-sm text-primary font-editorial font-bold">
                  {selectedIncident.legal_notice_draft.section} Show-Cause Legal Notice
                </h3>
              </div>
              <button
                onClick={() => handleDispatch(selectedIncident.id)}
                className={`px-unit-md py-unit-xs rounded-full font-label-md text-label-md text-xs font-bold transition-all shadow active:scale-95 ${
                  dispatchedTickets.includes(selectedIncident.id)
                    ? 'bg-accent-emerald text-white'
                    : 'bg-primary text-on-primary hover:scale-[0.98]'
                }`}
              >
                {dispatchedTickets.includes(selectedIncident.id) ? '✓ Flying Squad Dispatched' : 'Dispatch Flying Squad'}
              </button>
            </div>

            {/* Official Notice Paper Box */}
            <div className="p-unit-md rounded-lg bg-[#fdfcf9] border border-border-subtle/80 space-y-unit-sm text-xs font-mono leading-relaxed text-on-surface">
              <div className="text-on-surface-variant">
                <div><b>TICKET:</b> {selectedIncident.ticket_number}</div>
                <div><b>ADDRESSED TO:</b> {selectedIncident.legal_notice_draft.addressed_to}</div>
                <div><b>COORDINATES:</b> {selectedIncident.coordinates[0]}°N, {selectedIncident.coordinates[1]}°E</div>
              </div>

              <div className="pt-2 border-t border-border-subtle/50 text-justify text-on-surface">
                <p className="font-sans text-xs leading-normal">
                  {selectedIncident.legal_notice_draft.body}
                </p>
              </div>

              <div className="pt-2 border-t border-border-subtle/50 flex justify-between text-[11px] text-on-surface-variant font-sans">
                <span>Issued by: PRANA Autonomous Regulatory Protocol</span>
                <span>Signature: SHA-256 Verified</span>
              </div>
            </div>

            {/* Trilingual Public Advisory Box */}
            <div className="p-unit-sm rounded-lg bg-surface-container-low border border-border-subtle/60 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span>Public SMS / WhatsApp Advisory</span>
                <span className="font-mono text-secondary uppercase text-[10px]">
                  {selectedLanguage === 'en' ? 'English (EN)' : selectedLanguage === 'hi' ? 'हिन्दी (HI)' : 'ਪੰਜਾਬੀ (PA)'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {selectedIncident.vernacular_advisory[selectedLanguage]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
