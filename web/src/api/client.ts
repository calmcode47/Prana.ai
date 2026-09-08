/**
 * PRANA Air Quality Platform — Unified API & WebSocket Client
 * Conforms 100% to FastAPI backend routes, models, and CPCB AQI standards.
 * Uses backend responses as the single source of runtime data.
 */

// Official CPCB 24-hour PM2.5 Breakpoints matching backend/database.py (DEC-010)
export const PM25_BREAKPOINTS = [
  { cLo: 0.0, cHi: 30.0, iLo: 0, iHi: 50, category: 'Good', color: '#00C781' },
  { cLo: 31.0, cHi: 60.0, iLo: 51, iHi: 100, category: 'Satisfactory', color: '#92D050' },
  { cLo: 61.0, cHi: 90.0, iLo: 101, iHi: 200, category: 'Moderate', color: '#FFFF00' },
  { cLo: 91.0, cHi: 120.0, iLo: 201, iHi: 300, category: 'Poor', color: '#FF7800' },
  { cLo: 121.0, cHi: 250.0, iLo: 301, iHi: 400, category: 'Very Poor', color: '#FF0000' },
  { cLo: 251.0, cHi: 380.0, iLo: 401, iHi: 500, category: 'Severe', color: '#8F3F97' },
];

export function computeCpcbAqi(pm25: number): number {
  if (pm25 === null || pm25 === undefined || pm25 < 0 || isNaN(pm25)) return 0;
  if (!isFinite(pm25)) return 500;
  if (pm25 <= 30.0) return Math.round((50.0 / 30.0) * pm25);

  for (const b of PM25_BREAKPOINTS) {
    if (pm25 <= b.cHi) {
      return Math.max(b.iLo, Math.round(((b.iHi - b.iLo) / (b.cHi - b.cLo)) * (pm25 - b.cLo) + b.iLo));
    }
  }
  return 500;
}

export function getAqiCategoryAndColor(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: 'Good', color: '#00C781' };
  if (aqi <= 100) return { category: 'Satisfactory', color: '#92D050' };
  if (aqi <= 200) return { category: 'Moderate', color: '#FFFF00' };
  if (aqi <= 300) return { category: 'Poor', color: '#FF7800' };
  if (aqi <= 400) return { category: 'Very Poor', color: '#FF0000' };
  return { category: 'Severe', color: '#8F3F97' };
}

/** Convert backend provenance codes into concise, user-facing labels. */
export function formatDataSource(source?: string | null, fallback: string = 'Source pending'): string {
  if (!source) return fallback;

  if (source.startsWith('model_estimate;')) {
    return 'Model estimate using NASA FIRMS fires and live Open-Meteo weather';
  }
  if (source.startsWith('CAMS_MODEL_SURFACE;')) {
    return source.includes('ground_calibration=unavailable')
      ? 'Open-Meteo CAMS air-quality model (not ground-calibrated)'
      : 'Open-Meteo CAMS air-quality model';
  }

  const labels: Record<string, string> = {
    NASA_FIRMS_VIIRS_SNPP_NRT: 'NASA FIRMS VIIRS near-real-time',
    NASA_FIRMS_VIIRS_SNPP_NRT_STATIC_FALLBACK: 'NASA FIRMS historical demonstration data',
    OPEN_METEO_LIVE: 'Open-Meteo live weather',
    OPEN_METEO_CAMS_GLOBAL_LIVE: 'Open-Meteo CAMS live air-quality model',
    OPEN_METEO_CAMS_GLOBAL_DEMO_STATIC: 'Open-Meteo CAMS demonstration data',
    OPENAQ_LIVE: 'OpenAQ live station observation',
    DEMO_SYNTHETIC: 'Synthetic demonstration data',
  };
  if (labels[source]) return labels[source];

  return source
    .replace(/[;|]/g, ' • ')
    .replace(/[_=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

export function formatFederatedImplementation(implementation?: string | null): string {
  if (!implementation) return 'Federated training status pending';
  if (implementation === 'numpy_fedavg_with_optional_paillier_and_dp_sgd') {
    return 'Federated averaging with encrypted aggregation and differential privacy';
  }
  return formatDataSource(implementation, 'Federated training status pending');
}

export function formatFederatedDataset(dataset?: string | null): string {
  if (!dataset) return 'Training dataset pending';
  if (dataset === 'synthetic_corridor') return 'Synthetic corridor demonstration dataset';
  return formatDataSource(dataset, 'Training dataset pending');
}

export function formatFederatedMetric(metric?: string | null): string {
  if (!metric) return 'Prediction score pending';
  if (metric.includes('RMSE') && metric.includes('target_std')) return 'Normalized prediction score';
  return formatDataSource(metric, 'Prediction score pending');
}

export function formatBackendStatus(status?: string | null, fallback: string = 'Status pending'): string {
  if (!status) return fallback;
  const labels: Record<string, string> = {
    not_measured: 'Not measured',
    vectors_available: 'Wind vectors available',
    insufficient_data: 'More historical observations required',
    not_configured: 'Not configured',
    not_generated: 'Not generated',
  };
  return labels[status] ?? formatDataSource(status, fallback);
}

// Type definitions mirroring backend/models.py
export interface HotspotFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    frp: number | null;
    brightness: number | null;
    confidence: 'low' | 'nominal' | 'high';
    acq_datetime: string;
    sensor: string;
  };
}

export interface HotspotsResponse {
  type: 'FeatureCollection';
  fetched_at: string;
  source: string;
  count: number;
  features: HotspotFeature[];
}

export interface StationObservation {
  pm25_ugm3: number;
  aqi_index: number;
  phenomenonTime: string;
  resultQuality?: string;
  source: string;
  averaging_period: string;
}

export interface StationThing {
  '@iot.id': string;
  name: string;
  Locations: Array<{
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  }>;
  Datastreams: Array<{
    name: string;
    Observations: StationObservation[];
  }>;
}

export interface StationsResponse {
  '@iot.count': number;
  value: StationThing[];
}

export interface PlumeFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    cluster_id: string;
    horizon_hours: number;
    max_pm25_est: number;
    max_aqi_est: number;
    wind_speed_ms?: number;
    wind_dir_deg?: number;
    mixing_height_m?: number;
  };
}

export interface PlumeResponse {
  type: 'FeatureCollection';
  computed_at: string;
  features: PlumeFeature[];
  source: string;
}

export interface AnomalyItem {
  station_id: string;
  station_name?: string;
  parameter: string;
  day: string;
  hour_of_day: number;
  is_nighttime: boolean;
  anomaly_score: number;
  is_anomaly: boolean;
  source: string;
}

export interface AnomaliesResponse {
  count: number;
  items: AnomalyItem[];
}

export interface SatelliteEvidence {
  fire_count_50km?: number | null;
  nearest_fire_km?: number | null;
  tropomi_aai?: number | null;
}

export interface IncidentItem {
  incident_id: string;
  severity: 'emergency' | 'warning' | 'watch';
  location_text?: string;
  latitude?: number;
  longitude?: number;
  pollutant?: string;
  measured_pm25?: number;
  measured_aqi?: number;
  satellite_ts?: string;
  satellite_source?: string;
  authority?: string;
  created_at: string;
  satellite_evidence?: SatelliteEvidence | null;
}

export interface AlertsResponse {
  count: number;
  items: IncidentItem[];
}

export interface LatestAlertResponse {
  incident_id: string;
  severity: string;
  title: string;
  body: string;
  created_at: string;
}

export interface IncidentCreate {
  severity: 'emergency' | 'warning' | 'watch';
  location_text?: string;
  latitude?: number;
  longitude?: number;
  pollutant?: 'PM2.5';
  measured_pm25: number;
  satellite_source?: string;
  authority?: string;
}

export interface CitizenPhotoResponse {
  pm25_estimate: number;
  confidence: 'low' | 'medium' | 'high';
  aqi_category: string;
  aqi_index: number;
  aqi_color: string;
  processing_time_ms: number;
  source: string;
}

export interface FLRoundItem {
  round_number: number;
  punjab_accuracy: number;
  delhi_accuracy: number;
  global_accuracy: number;
  punjab_loss?: number | null;
  delhi_loss?: number | null;
  global_loss?: number | null;
  dp_epsilon_spent?: number | null;
}

export interface FLPrivacySummary {
  dp_sgd?: {
    enabled: boolean;
    target_epsilon?: number | null;
    epsilon_spent?: number | null;
    delta?: number | null;
    max_grad_norm?: number | null;
    noise_multiplier?: number | null;
    accounting?: string;
  };
  secure_aggregation?: {
    enabled: boolean;
    scheme?: string | null;
    key_bits?: number | null;
    scope?: string;
  };
}

export interface FLStatusResponse {
  run_id: string;
  total_rounds: number;
  status: string;
  rounds: FLRoundItem[];
  implementation: string;
  dataset: string;
  metric: string;
  privacy?: FLPrivacySummary | null;
}

export interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

export interface ReadyResponse {
  status: 'ready' | 'unavailable';
  db: string;
  demo_mode: boolean;
}

// AQI Surface Grid — GP Downscaler (backend/routers/aqi.py: GET /api/v1/aqi/surface)
export interface SurfacePointProperties {
  pm25_estimate: number;
  aqi_index: number;
  uncertainty_std?: number | null;
}

export interface SurfaceGridFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: SurfacePointProperties;
}

export interface SurfaceGridResponse {
  type: 'FeatureCollection';
  computed_at: string;
  resolution_deg: number;
  features: SurfaceGridFeature[];
  source: string;
}

// OGC SensorThings Corridor Nodes (backend/routers/sensorthings.py: GET /api/v1/sensorthings/Things)
export interface SensorThingsLocation {
  encodingType: string;
  location: { type: string; coordinates: [number, number] };
}

export interface SensorThingsItem {
  '@iot.id': string;
  name: string;
  description: string;
  properties?: Record<string, any>;
  Locations: SensorThingsLocation[];
}

export interface SensorThingsResponse {
  '@iot.count': number;
  value: SensorThingsItem[];
}

export interface MeteorologyRegion {
  latitude: number;
  longitude: number;
  observed_at: string;
  source: string;
  wind_speed_ms: number;
  wind: {
    eastward_ms: number;
    northward_ms: number;
    direction_from_deg: number;
    direction_toward_deg: number;
  };
  mixing_layer_height_m_agl: number;
  forecast_mixing_layer_min_m_agl: number | null;
  forecast_mixing_layer_max_m_agl: number | null;
}

export interface MeteorologyResponse {
  fetched_at: string;
  regions: Record<'punjab' | 'delhi', MeteorologyRegion>;
  streamlines: { status: string; integration_method: string };
  inversion: { status: string; reason: string };
}

export interface FireAqiLagResponse {
  period_days: number;
  status: 'computed' | 'insufficient_data';
  strongest_lag: { lag_hours: number; pearson_r: number; paired_hours: number } | null;
  correlations: Array<{ lag_hours: number; pearson_r: number; paired_hours: number }>;
  method: string;
  caution: string;
}

export interface BiomassRegion {
  region: string;
  hotspot_count: number;
  frp_sum_mw: number;
  frp_share_percent: number | null;
  estimated_aerosol_kg_s: number | null;
}

export interface BiomassEmissionsResponse {
  period_days: number;
  regions: BiomassRegion[];
  source: string;
  emissions_model: 'configured' | 'not_configured';
  coefficient_kg_s_per_mw: number | null;
  caution: string;
}

export interface BriefingResponse {
  status: 'empty' | 'script_ready';
  incident_id?: string;
  script: string | null;
  audio_url: string | null;
  audio_status: string;
  feed_url?: string;
}

export interface MobileReleaseResponse {
  version: string;
  download_url: string;
  sha256: string;
  status: string;
}

export interface LegalNotice {
  notice_id: string;
  incident_id: string;
  issuing_authority: string;
  authorized_officer?: string | null;
  legal_basis: string;
  title: string;
  body: string;
  status: string;
  document_sha256: string;
  created_at: string;
}

export interface LegalDispatch {
  dispatch_id: string;
  incident_id: string;
  notice_id?: string | null;
  recipient_kind: 'district_magistrate' | 'police' | 'flying_squad' | 'spcb';
  recipient_reference: string;
  status: string;
  external_reference?: string | null;
  requested_at: string;
  sent_at?: string | null;
  message_sent?: boolean;
  reason?: string;
}

export interface LegalRegistryResponse {
  notices: LegalNotice[];
  dispatches: LegalDispatch[];
  warrants: unknown[];
  legal_status: string;
}

export interface SignaturePackageResponse {
  notice_id: string;
  document_sha256: string;
  status: 'READY_FOR_PROVIDER' | 'PROVIDER_NOT_CONFIGURED';
  provider_call_performed: boolean;
  requirements: string[];
}

export interface CemsForensicsResponse {
  facility_id: string;
  period_hours: number;
  readings: Array<{
    facility_id: string;
    measured_at: string;
    stack_velocity_ms: number;
    scrubber_load_kw: number;
    source: string;
  }>;
  review_windows: Array<{
    measured_at: string;
    scrubber_load_ratio: number;
    stack_velocity_ratio: number;
    classification: string;
  }>;
  status: 'REVIEW_REQUIRED' | 'NO_PATTERN_DETECTED';
  method: string;
}

// API Config
const API_BASE = (typeof window !== 'undefined' && (window as any).PRANA_API_URL) || 'http://127.0.0.1:8000';
async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'omit', ...options });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const payload = await res.json();
      detail = payload.detail || detail;
    } catch {
      // The response has no JSON error body.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/health');
}

export async function fetchReady(): Promise<ReadyResponse> {
  return requestJson<ReadyResponse>('/ready');
}

export async function fetchHotspots(hoursBack: number = 24, minConfidence: string = 'nominal'): Promise<HotspotsResponse> {
  return requestJson<HotspotsResponse>(
    `/api/v1/hotspots?hours_back=${hoursBack}&min_confidence=${encodeURIComponent(minConfidence)}`
  );
}

export async function fetchStations(parameter: string = 'pm25', state?: string): Promise<StationsResponse> {
  const params = new URLSearchParams({ parameter });
  if (state) params.set('state', state);
  return requestJson<StationsResponse>(`/api/v1/aqi/stations?${params.toString()}`);
}

export async function fetchAnomalies(
  parameter: string = 'no2',
  nighttimeOnly: boolean = true,
  daysBack: number = 7
): Promise<AnomaliesResponse> {
  const params = new URLSearchParams({
    parameter,
    nighttime_only: String(nighttimeOnly),
    days_back: String(daysBack),
  });
  return requestJson<AnomaliesResponse>(`/api/v1/anomalies?${params.toString()}`);
}

export async function fetchAlerts(severity?: string, limit: number = 20): Promise<AlertsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (severity) params.set('severity', severity);
  return requestJson<AlertsResponse>(`/api/v1/alerts?${params.toString()}`);
}

export async function fetchLatestAlert(lang: 'en' | 'hi' | 'pa' = 'en'): Promise<LatestAlertResponse | null> {
  const res = await fetch(`${API_BASE}/api/v1/alerts/latest?lang=${lang}`, { credentials: 'omit' });
  if (res.status === 204) return null;
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as LatestAlertResponse;
}

export async function createIncident(data: IncidentCreate): Promise<IncidentItem> {
  return requestJson<IncidentItem>('/api/v1/alerts/incident', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Citizen Science Sky Photo Estimator (backend/routers/citizen.py & backend/ml/haze_estimator.py)
export async function uploadCitizenSkyPhoto(
  file: File | Blob,
  latitude?: number,
  longitude?: number
): Promise<CitizenPhotoResponse> {
  const formData = new FormData();
  formData.append('photo', file, 'sky_photo.jpg');
  if (latitude !== undefined && longitude !== undefined) {
    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
  }

  return requestJson<CitizenPhotoResponse>('/api/v1/citizen/photo', {
    method: 'POST',
    body: formData,
  });
}

// Federated Learning Simulation (backend/routers/federated.py & backend/ml/federated/server.py)
export async function fetchFederatedStatus(): Promise<FLStatusResponse> {
  return requestJson<FLStatusResponse>('/api/v1/federated/status');
}

export async function triggerFederatedRun(numRounds: number = 10): Promise<FLStatusResponse> {
  return requestJson<FLStatusResponse>(`/api/v1/federated/run?num_rounds=${numRounds}`, {
    method: 'POST',
  });
}

export async function fetchForecastPlume(clusterId?: string): Promise<PlumeResponse> {
  const params = new URLSearchParams();
  if (clusterId) params.set('cluster_id', clusterId);
  const query = params.toString();
  return requestJson<PlumeResponse>(`/api/v1/forecast/plume${query ? `?${query}` : ''}`);
}

export async function fetchAqiSurface(resolutionDeg: number = 0.5): Promise<SurfaceGridResponse> {
  return requestJson<SurfaceGridResponse>(`/api/v1/aqi/surface?resolution_deg=${resolutionDeg}`);
}

export async function fetchSensorThings(): Promise<SensorThingsResponse> {
  return requestJson<SensorThingsResponse>('/api/v1/sensorthings/Things');
}

export async function fetchMeteorology(): Promise<MeteorologyResponse> {
  return requestJson<MeteorologyResponse>('/api/v1/meteorology');
}

export async function fetchFireAqiLag(days: number = 7): Promise<FireAqiLagResponse> {
  return requestJson<FireAqiLagResponse>(`/api/v1/analytics/fire-aqi-lag?days=${days}`);
}

export async function fetchBiomassEmissions(days: number = 7): Promise<BiomassEmissionsResponse> {
  return requestJson<BiomassEmissionsResponse>(`/api/v1/analytics/biomass-emissions?days=${days}`);
}

export async function fetchLatestBriefing(): Promise<BriefingResponse> {
  return requestJson<BriefingResponse>('/api/v1/briefings/latest');
}

export async function fetchLatestMobileRelease(): Promise<MobileReleaseResponse | null> {
  const res = await fetch(`${API_BASE}/api/v1/mobile/releases/latest`, { credentials: 'omit' });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as MobileReleaseResponse;
}

export async function createLegalNotice(data: {
  incident_id: string;
  issuing_authority: string;
  authorized_officer?: string;
  requested_direction: string;
}): Promise<LegalNotice> {
  return requestJson<LegalNotice>('/api/v1/legal/notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchSignaturePackage(noticeId: string): Promise<SignaturePackageResponse> {
  return requestJson<SignaturePackageResponse>(
    `/api/v1/legal/notices/${encodeURIComponent(noticeId)}/signature-package`
  );
}

export async function queueLegalDispatch(data: {
  incident_id: string;
  notice_id?: string;
  recipient_kind: LegalDispatch['recipient_kind'];
  recipient_reference: string;
}): Promise<LegalDispatch> {
  return requestJson<LegalDispatch>('/api/v1/legal/dispatches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchLegalRegistry(): Promise<LegalRegistryResponse> {
  return requestJson<LegalRegistryResponse>('/api/v1/legal/registry');
}

export async function downloadLegalDossier(incidentId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/legal/dossiers/${encodeURIComponent(incidentId)}.zip`,
    { credentials: 'omit' }
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${incidentId}-dossier.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchCemsForensics(
  facilityId: string,
  hours: number = 24
): Promise<CemsForensicsResponse> {
  return requestJson<CemsForensicsResponse>(
    `/api/v1/industrial/cems/${encodeURIComponent(facilityId)}/forensics?hours=${hours}`
  );
}

// Real-Time WebSocket Streaming Connector (backend/routers/websocket.py: WS /ws/{city_id})
export function connectCorridorWebSocket(
  cityId: string = 'delhi',
  onMessage: (data: any) => void,
  onStatusChange?: (status: 'connecting' | 'open' | 'closed') => void
): () => void {
  const wsUrl = API_BASE.replace(/^http/, 'ws') + `/ws/${cityId.toLowerCase()}`;
  let ws: WebSocket | null = null;
  let heartbeatTimer: any = null;
  let isClosedManually = false;

  try {
    if (onStatusChange) onStatusChange('connecting');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (onStatusChange) onStatusChange('open');
      // Heartbeat ping every 25s
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (e) {
        // raw message
      }
    };

    ws.onclose = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (onStatusChange) onStatusChange('closed');
      if (!isClosedManually) {
        // Reconnect attempt after 5s
        setTimeout(() => {
          if (!isClosedManually) connectCorridorWebSocket(cityId, onMessage, onStatusChange);
        }, 5000);
      }
    };

    ws.onerror = () => {
      if (onStatusChange) onStatusChange('closed');
    };
  } catch (e) {
    if (onStatusChange) onStatusChange('closed');
  }

  return () => {
    isClosedManually = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (ws) ws.close();
  };
}
