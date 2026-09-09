import React from 'react';
import {
  AlertsResponse,
  FireAqiLagResponse,
  BiomassEmissionsResponse,
  formatDataSource,
} from '../../api/client';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AlertCircle, ShieldAlert, Send } from 'lucide-react';

export interface WarRoomAlertsSidebarProps {
  alertsData: AlertsResponse | null;
  lagData: FireAqiLagResponse | null;
  biomassData: BiomassEmissionsResponse | null;
  squadDispatched: boolean;
  onDispatchSquad: () => void;
  showCauseIssued: boolean;
  onIssueShowCause: () => void;
}

export const WarRoomAlertsSidebar: React.FC<WarRoomAlertsSidebarProps> = ({
  alertsData,
  lagData,
  biomassData,
  squadDispatched,
  onDispatchSquad,
  showCauseIssued,
  onIssueShowCause,
}) => {
  const totalBiomassFRP = biomassData?.regions.reduce((acc, r) => acc + r.frp_sum_mw, 0) ?? 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Statutory Rapid Actions Card */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-3">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
          <ShieldAlert className="w-5 h-5 text-terracotta-deep" />
          <h4 className="font-title-sm text-sm font-bold text-ink-black">
            Emergency Command Actions
          </h4>
        </div>

        <p className="text-xs text-ink-muted">
          Authorize immediate enforcement orders under Section 31A of the Air Act (1981) targeting identified plume sources.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant={squadDispatched ? 'secondary' : 'danger'}
            onClick={onDispatchSquad}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            {squadDispatched ? 'Squad Transmitted ✓' : 'Dispatch Flying Squad to Origin'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onIssueShowCause}
          >
            {showCauseIssued ? 'Statutory Notice Drafted ✓' : 'Draft Show-Cause Notice'}
          </Button>
        </div>
      </div>

      {/* Live Incidents Feed */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-3">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-coral-watermelon-vivid" />
            <h4 className="font-title-sm text-sm font-bold text-ink-black">Active Incidents</h4>
          </div>
          <span className="text-xs font-mono font-bold text-ink-muted">
            {alertsData?.count ?? alertsData?.items.length ?? 0} Recorded
          </span>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {alertsData?.items && alertsData.items.length > 0 ? (
            alertsData.items.slice(0, 5).map((item) => (
              <div
                key={item.incident_id}
                className="p-2.5 rounded-lg border border-ink-black bg-surface-vanilla-strong/40 text-xs space-y-1 shadow-[1px_1px_0px_#18181B]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-ink-black">{item.incident_id}</span>
                  <Badge
                    size="sm"
                    variant={
                      item.severity === 'emergency'
                        ? 'emergency'
                        : item.severity === 'warning'
                        ? 'warning'
                        : 'moderate'
                    }
                  >
                    {item.severity}
                  </Badge>
                </div>
                <div className="font-medium text-ink-black">{item.location_text}</div>
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>{item.pollutant}: {item.measured_pm25 ? `${item.measured_pm25.toFixed(1)} µg/m³` : 'N/A'}</span>
                  <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-ink-muted italic">
              No critical incidents triggered.
            </div>
          )}
        </div>
      </div>

      {/* Lag Correlation & FRP Summary */}
      <div className="bg-surface-vanilla rounded-xl border-2 border-ink-black shadow-[3px_3px_0px_#18181B] p-space-md space-y-2 text-xs">
        <div className="font-bold text-ink-black border-b border-outline-variant/60 pb-1 flex justify-between">
          <span>Atmospheric Analytics</span>
          <span className="text-ink-muted font-normal font-mono">7-Day Window</span>
        </div>

        <div className="flex justify-between py-1">
          <span className="text-ink-muted">Fire-to-Delhi Lag:</span>
          <span className="font-bold font-mono text-ink-black">
            {lagData?.strongest_lag
              ? `${lagData.strongest_lag.lag_hours}h (r=${lagData.strongest_lag.pearson_r.toFixed(2)})`
              : 'Calculating...'}
          </span>
        </div>

        <div className="flex justify-between py-1">
          <span className="text-ink-muted">Total Biomass FRP:</span>
          <span className="font-bold font-mono text-terracotta-deep">
            {totalBiomassFRP ? `${totalBiomassFRP.toFixed(1)} MW` : '—'}
          </span>
        </div>

        <div className="text-[10px] text-ink-muted pt-1 border-t border-outline-variant/40">
          Source: {formatDataSource(biomassData?.source)}
        </div>
      </div>
    </div>
  );
};
