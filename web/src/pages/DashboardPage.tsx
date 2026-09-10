import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  createIncident,
  createLegalNotice,
  queueLegalDispatch,
  fetchHotspots,
  fetchStations,
  fetchAlerts,
  fetchHealth,
  fetchReady,
  fetchAqiSurface,
  fetchBiomassEmissions,
  fetchFireAqiLag,
  fetchForecastPlume,
  fetchMeteorology,
  connectCorridorWebSocket,
  BiomassEmissionsResponse,
  FireAqiLagResponse,
  HotspotsResponse,
  MeteorologyResponse,
  PlumeResponse,
  StationsResponse,
  AlertsResponse,
  HealthResponse,
  ReadyResponse,
  SurfaceGridResponse,
  getAqiCategoryAndColor,
} from '../api/client';
import { WarRoomMapPanel } from '../components/dashboard/WarRoomMapPanel';
import { WarRoomAlertsSidebar } from '../components/dashboard/WarRoomAlertsSidebar';
import { WarRoomMeteoPanel } from '../components/dashboard/WarRoomMeteoPanel';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [trajectoryHours, setTrajectoryHours] = useState<number>(0);
  const [hotspotHoursBack] = useState<number>(24);
  const [minConfidence] = useState<'low' | 'nominal' | 'high'>('nominal');
  const [layers, setLayers] = useState({
    pm25: true,
    viirs: true,
    plume: true,
    wind: false,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [squadDispatched, setSquadDispatched] = useState(false);
  const [showCauseIssued, setShowCauseIssued] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30);

  // Live backend data state
  const [hotspotsData, setHotspotsData] = useState<HotspotsResponse | null>(null);
  const [stationsData, setStationsData] = useState<StationsResponse | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsResponse | null>(null);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [readyData, setReadyData] = useState<ReadyResponse | null>(null);
  const [meteorologyData, setMeteorologyData] = useState<MeteorologyResponse | null>(null);
  const [lagData, setLagData] = useState<FireAqiLagResponse | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [forecastData, setForecastData] = useState<PlumeResponse | null>(null);
  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('closed');

  const loadAllData = useCallback(async () => {
    setFetchError(null);
    try {
      const [
        hotspotsRes,
        stationsRes,
        alertsRes,
        healthRes,
        readyRes,
        meteoRes,
        lagRes,
        biomassRes,
        forecastRes,
        surfaceRes,
      ] = await Promise.allSettled([
        fetchHotspots(hotspotHoursBack, minConfidence),
        fetchStations('pm25'),
        fetchAlerts(undefined, 5),
        fetchHealth(),
        fetchReady(),
        fetchMeteorology(),
        fetchFireAqiLag(7),
        fetchBiomassEmissions(7),
        fetchForecastPlume(),
        fetchAqiSurface(0.5),
      ]);

      if (hotspotsRes.status === 'fulfilled') setHotspotsData(hotspotsRes.value);
      if (stationsRes.status === 'fulfilled') setStationsData(stationsRes.value);
      if (alertsRes.status === 'fulfilled') setAlertsData(alertsRes.value);
      if (healthRes.status === 'fulfilled') setHealthData(healthRes.value);
      if (readyRes.status === 'fulfilled') setReadyData(readyRes.value);
      if (meteoRes.status === 'fulfilled') setMeteorologyData(meteoRes.value);
      if (lagRes.status === 'fulfilled') setLagData(lagRes.value);
      if (biomassRes.status === 'fulfilled') setBiomassData(biomassRes.value);
      if (forecastRes.status === 'fulfilled') setForecastData(forecastRes.value);
      if (surfaceRes.status === 'fulfilled') setSurfaceData(surfaceRes.value);

      const failures = [
        hotspotsRes,
        stationsRes,
        alertsRes,
        healthRes,
        readyRes,
        meteoRes,
        lagRes,
        biomassRes,
        forecastRes,
        surfaceRes,
      ].filter((r) => r.status === 'rejected');

      if (failures.length > 5) {
        setFetchError('Multiple backend telemetry feeds failed to respond. Retrying automatically.');
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Backend connection error');
    } finally {
      setIsLoading(false);
      setSecondsUntilRefresh(30);
    }
  }, [hotspotHoursBack, minConfidence]);

  useEffect(() => {
    document.title = 'Operations War Room — PRANA Air Quality Platform';
    loadAllData();
  }, [loadAllData]);

  // Auto-refresh countdown & polling
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadAllData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, loadAllData]);

  // WebSocket real-time connection
  useEffect(() => {
    const disconnect = connectCorridorWebSocket('delhi', () => {}, setWsStatus);
    return () => {
      disconnect();
    };
  }, []);

  const toggleLayer = (layer: 'pm25' | 'viirs' | 'plume' | 'wind') => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const forecast = await fetchForecastPlume();
      setForecastData(forecast);
      const targetHours = Math.max(
        ...forecast.features.map((item) => item.properties.horizon_hours),
        0
      );
      if (targetHours === 0) {
        setTrajectoryHours(0);
        setIsSimulating(false);
        return;
      }
      let current = 0;
      setTrajectoryHours(0);
      const stepInterval = setInterval(() => {
        current += 6;
        if (current >= targetHours) {
          clearInterval(stepInterval);
          setTrajectoryHours(targetHours);
          setIsSimulating(false);
        } else {
          setTrajectoryHours(current);
        }
      }, 120);
    } catch {
      setIsSimulating(false);
      toastError('Forecast trajectory simulation request failed.');
    }
  };

  const delhiSurface = surfaceData?.features.reduce((closest, feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const [closestLon, closestLat] = closest.geometry.coordinates;
    return Math.hypot(lon - 77.2, lat - 28.6) < Math.hypot(closestLon - 77.2, closestLat - 28.6)
      ? feature
      : closest;
  }, surfaceData?.features[0]);

  const delhiAqi = delhiSurface?.properties.aqi_index;
  const delhiCategory = delhiAqi == null ? null : getAqiCategoryAndColor(delhiAqi).category;

  const handleDispatchSquad = async () => {
    if (!delhiSurface) return;
    try {
      const severity =
        delhiSurface.properties.aqi_index > 400
          ? 'emergency'
          : delhiSurface.properties.aqi_index > 300
          ? 'warning'
          : 'watch';
      const incident = await createIncident({
        severity,
        location_text: 'Delhi NCR model-surface review point',
        latitude: delhiSurface.geometry.coordinates[1],
        longitude: delhiSurface.geometry.coordinates[0],
        pollutant: 'PM2.5',
        measured_pm25: delhiSurface.properties.pm25_estimate,
        satellite_source: surfaceData?.source,
        authority: 'PPCB & Flying Squad Command',
      });
      const dispatch = await queueLegalDispatch({
        incident_id: incident.incident_id,
        recipient_kind: 'flying_squad',
        recipient_reference: 'PPCB Flying Squad Command, Dirba',
      });
      setSquadDispatched(true);
      success(
        dispatch.message_sent
          ? 'Configured connector reported the dispatch as sent.'
          : `Internal dispatch request recorded (${dispatch.status}); no external message was sent.`,
        dispatch.message_sent ? 'Dispatch Sent' : 'Request Recorded'
      );
      setTimeout(() => setSquadDispatched(false), 2600);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Dispatch failed');
    }
  };

  const handleIssueShowCause = async () => {
    if (!delhiSurface) return;
    try {
      const severity =
        delhiSurface.properties.aqi_index > 400
          ? 'emergency'
          : delhiSurface.properties.aqi_index > 300
          ? 'warning'
          : 'watch';
      const incident = await createIncident({
        severity,
        location_text: 'Delhi NCR model-surface review point',
        latitude: delhiSurface.geometry.coordinates[1],
        longitude: delhiSurface.geometry.coordinates[0],
        pollutant: 'PM2.5',
        measured_pm25: delhiSurface.properties.pm25_estimate,
        satellite_source: surfaceData?.source,
        authority: 'District Magistrate Oversight',
      });
      await createLegalNotice({
        incident_id: incident.incident_id,
        issuing_authority: 'District Magistrate Oversight',
        requested_direction:
          'Review the recorded transboundary ignition evidence and determine whether a show-cause direction is warranted.',
      });
      setShowCauseIssued(true);
      success('Show-cause notice registered in legal ledger.', 'Notice Drafted');
      setTimeout(() => setShowCauseIssued(false), 2600);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Notice drafting failed');
    }
  };

  return (
    <div className="w-full bg-canvas-cream min-h-screen relative overflow-x-hidden pt-20">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full bg-secondary-fixed/40 blur-2xl"></div>
      <div className="pointer-events-none absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl"></div>

      <div className="w-full px-gutter-desktop py-space-sm space-y-4">
        {/* Error State Banner */}
        {fetchError && (
          <div className="flex items-center justify-between p-3.5 bg-error/10 border-2 border-error rounded-xl shadow-[3px_3px_0px_#18181B] text-xs text-error font-bold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-error" />
              <span>{fetchError}</span>
            </div>
            <Button size="sm" variant="danger" onClick={loadAllData}>
              Retry Connection
            </Button>
          </div>
        )}

        {/* Live Incident War-Room Status Strip */}
        <section className="w-full">
          <div className="w-full bg-surface-vanilla rounded-xl py-2.5 px-space-md shadow-[3px_3px_0px_#18181B] border-2 border-ink-black flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
            <div className="flex items-center flex-wrap gap-space-md font-label-lg text-label-lg">
              <span className="inline-flex items-center gap-1.5 text-terracotta-deep font-bold">
                🔥 {hotspotsData ? `${hotspotsData.count.toLocaleString()} Fires Active` : 'Fire feed unavailable'}
              </span>
              <span className="text-outline-variant font-normal">/</span>
              <span className="inline-flex items-center gap-1.5 text-cobalt-deep font-bold">
                💨 Wind: {meteorologyData?.regions.punjab ? `${(meteorologyData.regions.punjab.wind_speed_ms * 3.6).toFixed(1)} km/h` : 'Meteo unavailable'}
              </span>
              <span className="text-outline-variant font-normal">/</span>
              <span className="inline-flex items-center gap-1.5 text-ink-black font-semibold">
                Boundary: {meteorologyData?.regions.delhi ? `${meteorologyData.regions.delhi.mixing_layer_height_m_agl.toFixed(0)}m AGL` : 'Unavailable'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-space-sm py-1 rounded-full bg-coral-watermelon-vivid text-on-secondary text-label-md font-bold shadow-[1px_1px_0px_#18181B]">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                {delhiAqi == null ? 'AQI unavailable' : `${delhiCategory} (${delhiAqi})`}
              </span>

              {/* Auto-Refresh Countdown & Manual Trigger */}
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <button
                  onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                    autoRefreshEnabled
                      ? 'bg-forest-jade/20 text-forest-jade border-forest-jade'
                      : 'bg-outline-variant/30 text-ink-muted border-outline-variant'
                  }`}
                  title="Toggle 30s auto-refresh"
                >
                  {autoRefreshEnabled ? `Auto ${secondsUntilRefresh}s` : 'Paused'}
                </button>
                <button
                  onClick={loadAllData}
                  disabled={isLoading}
                  className="p-1 rounded hover:bg-ink-black/10 transition-colors"
                  title="Refresh data now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-ink-black ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Loading Skeletons vs Real Panels */}
        {isLoading && !hotspotsData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton variant="card" height={460} />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton variant="card" height={120} />
                <Skeleton variant="card" height={120} />
                <Skeleton variant="card" height={120} />
              </div>
            </div>
            <div className="space-y-4">
              <CardSkeleton lines={4} />
              <CardSkeleton lines={3} />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Panel (2 Cols) */}
              <div className="lg:col-span-2">
                <WarRoomMapPanel
                  hotspotsData={hotspotsData}
                  stationsData={stationsData}
                  surfaceData={surfaceData}
                  forecastData={forecastData}
                  meteorologyData={meteorologyData}
                  trajectoryHours={trajectoryHours}
                  setTrajectoryHours={setTrajectoryHours}
                  isSimulating={isSimulating}
                  onSimulate={handleSimulate}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                />
              </div>

              {/* Alerts & Legal Actions Sidebar (1 Col) */}
              <div className="lg:col-span-1">
                <WarRoomAlertsSidebar
                  alertsData={alertsData}
                  lagData={lagData}
                  biomassData={biomassData}
                  squadDispatched={squadDispatched}
                  onDispatchSquad={handleDispatchSquad}
                  showCauseIssued={showCauseIssued}
                  onIssueShowCause={handleIssueShowCause}
                />
              </div>
            </div>

            {/* Meteorology & Boundary Layer Panel */}
            <WarRoomMeteoPanel
              meteorologyData={meteorologyData}
              healthData={healthData}
              readyData={readyData}
              wsStatus={wsStatus}
            />

            {/* Quick Links Navigation Strip */}
            <div className="p-4 rounded-xl border border-ink-black bg-surface-vanilla shadow-[2px_2px_0px_#18181B] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-ink-black uppercase tracking-wider">
                Cross-Platform Intelligence Navigation:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/72h-plume-forecast" className="px-2.5 py-1 rounded bg-surface-vanilla-strong font-bold hover:bg-primary hover:text-white transition-colors border border-ink-black">
                  72h Plume Forecast →
                </Link>
                <Link to="/air-corridor-map" className="px-2.5 py-1 rounded bg-surface-vanilla-strong font-bold hover:bg-primary hover:text-white transition-colors border border-ink-black">
                  Air Corridor Map →
                </Link>
                <Link to="/federated-mesh" className="px-2.5 py-1 rounded bg-surface-vanilla-strong font-bold hover:bg-primary hover:text-white transition-colors border border-ink-black">
                  Federated Mesh →
                </Link>
                <Link to="/spcb-incident-command" className="px-2.5 py-1 rounded bg-surface-vanilla-strong font-bold hover:bg-primary hover:text-white transition-colors border border-ink-black">
                  SPCB Incident Command →
                </Link>
                <Link to="/citizen-scanner" className="px-2.5 py-1 rounded bg-surface-vanilla-strong font-bold hover:bg-primary hover:text-white transition-colors border border-ink-black">
                  Citizen Sky Scanner →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
