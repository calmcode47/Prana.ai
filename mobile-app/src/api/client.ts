/**
 * PRANA Mobile App — API Client
 * Connects directly to the FastAPI backend at http://<host>:8000
 * Dynamically resolves host IP from Expo Constants with offline fallbacks.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Colors } from '../theme/tokens';

// Resolve host IP dynamically for Expo Go, iOS Simulator, Android Emulator, and Web
function getApiBaseUrl(): string {
  // 1. Explicitly configured URL from environment variable takes highest priority
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (configuredUrl) return configuredUrl;

  // 2. Web browser: Always use localhost or window-injected URL directly
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && (window as any).PRANA_API_URL) {
      return (window as any).PRANA_API_URL;
    }
    return 'http://127.0.0.1:8000';
  }

  // 3. Inspect Expo hostUri (e.g. "192.168.1.7:8081" vs "xyz.ngrok-free.app" or "xxx.exp.direct")
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    const isTunnelHost =
      host.includes('exp.direct') ||
      host.includes('ngrok') ||
      host.includes('localtunnel') ||
      host.includes('trycloudflare');
    // Check if host is a numeric IPv4 address (e.g., 192.168.x.x, 10.x.x.x)
    const isIpv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);

    // Only append :8000 if it is a real local IP address and NOT a tunnel domain
    // (tunnel hosts only forward port 8081 for Metro, never backend port 8000)
    if (host && isIpv4 && !isTunnelHost && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }

  // 4. Platform-specific defaults for emulators, simulators, and tunnel fallbacks
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://127.0.0.1:8000';
}

export const API_BASE = getApiBaseUrl();

// Official CPCB 24-hour Breakpoints matching backend/database.py (DEC-010)
// AQI breakpoints — colors reference the shared theme tokens (single source of truth)
export const PM25_BREAKPOINTS = [
  { cLo: 0.0,   cHi: 30.0,  iLo: 0,   iHi: 50,  category: 'Good',        color: Colors.aqiGood },
  { cLo: 31.0,  cHi: 60.0,  iLo: 51,  iHi: 100, category: 'Satisfactory', color: Colors.aqiGood },
  { cLo: 61.0,  cHi: 90.0,  iLo: 101, iHi: 200, category: 'Moderate',     color: Colors.aqiModerate },
  { cLo: 91.0,  cHi: 120.0, iLo: 201, iHi: 300, category: 'Poor',         color: Colors.aqiUnhealthy },
  { cLo: 121.0, cHi: 250.0, iLo: 301, iHi: 400, category: 'Very Poor',    color: Colors.aqiSevere },
  { cLo: 251.0, cHi: 380.0, iLo: 401, iHi: 500, category: 'Severe',       color: Colors.aqiHazardous },
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
  if (aqi <= 50) return { category: 'Good', color: Colors.aqiGood };
  if (aqi <= 100) return { category: 'Satisfactory', color: Colors.aqiGood };
  if (aqi <= 200) return { category: 'Moderate', color: Colors.aqiModerate };
  if (aqi <= 300) return { category: 'Poor', color: Colors.aqiUnhealthy };
  if (aqi <= 400) return { category: 'Very Poor', color: Colors.aqiSevere };
  return { category: 'Severe', color: Colors.aqiHazardous };
}

// Interfaces mirroring backend/models.py
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
  source: string;
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
}

export interface MeteorologyResponse {
  fetched_at: string;
  regions: Record<'punjab' | 'delhi', MeteorologyRegion>;
  streamlines: { status: string };
  inversion: { status: string; reason: string };
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
  source: string;
  model_assumptions: string;
  features: PlumeFeature[];
}

export interface IncidentItem {
  incident_id: string;
  severity: 'watch' | 'warning' | 'emergency';
  title?: string;
  body?: string;
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
  aqi_index?: number;
  satellite_evidence?: {
    fire_count_50km?: number;
    nearest_fire_km?: number;
    hotspot_count_50km?: number;
    nearest_hotspot_km?: number;
    wind_from_nearest?: boolean;
    cams_aod?: number;
    viirs_frp?: number;
    tropomi_aai?: number | null;
    aerosol_optical_depth?: number | null;
  };
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

export interface FLRoundStatus {
  round_number: number;
  punjab_accuracy: number;
  delhi_accuracy: number;
  global_accuracy: number;
  punjab_loss: number;
  delhi_loss: number;
  global_loss: number;
  dp_epsilon_spent?: number;
}

export interface FLStatusResponse {
  run_id: string;
  total_rounds: number;
  status: string;
  rounds: FLRoundStatus[];
  implementation: string;
  dataset: string;
  metric: string;
  privacy?: {
    dp_sgd?: {
      enabled?: boolean;
      epsilon_spent?: number;
      delta?: number;
    };
    secure_aggregation?: {
      enabled?: boolean;
      scheme?: string;
      key_bits?: number;
    };
    epsilon?: number;
    delta?: number;
    mechanism?: string;
  };
}

export interface CitizenPhotoResponse {
  pm25_estimate: number;
  aqi_index: number;
  aqi_category: string;
  aqi_color: string;
  confidence: 'low' | 'medium' | 'high';
  processing_time_ms: number;
  // Note: backend does NOT return a `source` field; removed to match actual contract
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

export interface FireAqiLagResponse {
  period_days: number;
  status: 'computed' | 'insufficient_data';
  strongest_lag: { lag_hours: number; pearson_r: number; paired_hours: number } | null;
  correlations: Array<{ lag_hours: number; pearson_r: number; paired_hours: number }>;
  method: string;
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
}

export interface LegalRegistryResponse {
  notices: LegalNoticeResponse[];
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

export function formatDataSource(source?: string | null, fallback: string = 'Source pending'): string {
  if (!source) return fallback;
  const normalized = source.trim();
  if (normalized.startsWith('model_estimate;')) return 'Model estimate using NASA FIRMS and Open-Meteo';
  if (normalized.startsWith('CAMS_MODEL_SURFACE;')) return 'Open-Meteo CAMS air-quality model';
  const labels: Record<string, string> = {
    NASA_FIRMS_VIIRS_SNPP_NRT: 'NASA FIRMS VIIRS near-real-time',
    FIRMS: 'NASA FIRMS satellite evidence',
    OPENAQ_LIVE: 'OpenAQ live station observation',
    OPEN_METEO_LIVE: 'Open-Meteo live weather',
    DCP_HEURISTIC_ESTIMATE: 'Photo-based haze estimate',
    NOT_CONFIGURED: 'Not configured',
  };
  return labels[normalized] ?? normalized.replace(/[_;]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatFederatedImplementation(value?: string | null): string {
  if (!value) return 'Implementation details unavailable';
  return value === 'numpy_fedavg_with_optional_paillier_and_dp_sgd'
    ? 'NumPy FedAvg with configured privacy controls'
    : value.replace(/_/g, ' ');
}

export function formatFederatedDataset(value?: string | null): string {
  if (!value) return 'Dataset unavailable';
  return value === 'synthetic_corridor' ? 'Synthetic corridor training data' : value.replace(/_/g, ' ');
}

export function formatFederatedMetric(value?: string | null): string {
  if (!value) return 'Metric unavailable';
  if (value.startsWith('1 - 0.5 * RMSE')) return 'Normalized prediction score';
  return value.replace(/_/g, ' ');
}

export function formatBackendStatus(value?: string | null, fallback: string = 'Status unavailable'): string {
  if (!value) return fallback;
  const known: Record<string, string> = {
    not_measured: 'Not measured',
    NO_PATTERN_DETECTED: 'No pattern detected',
    REVIEW_REQUIRED: 'Review required',
    READY_FOR_PROVIDER: 'Ready for signature provider',
    PROVIDER_NOT_CONFIGURED: 'Signature provider not configured',
    script_ready: 'Script ready',
    empty: 'No current item',
  };
  return known[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

// HTTP Helper with timeout
async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const payload = await res.json();
        detail = payload.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// API Functions
export async function fetchHealth(): Promise<{ status: string; db: string }> {
  return requestJson<{ status: string; db: string }>('/health');
}

export async function fetchHotspots(hoursBack: number = 24, minConfidence: string = 'nominal'): Promise<HotspotsResponse> {
  return requestJson<HotspotsResponse>(`/api/v1/hotspots?hours_back=${hoursBack}&min_confidence=${encodeURIComponent(minConfidence)}`);
}

export async function fetchStations(parameter: string = 'pm25', state?: string): Promise<StationsResponse> {
  const query = state ? `?parameter=${parameter}&state=${encodeURIComponent(state)}` : `?parameter=${parameter}`;
  return requestJson<StationsResponse>(`/api/v1/aqi/stations${query}`);
}

export async function fetchMeteorology(): Promise<MeteorologyResponse> {
  return requestJson<MeteorologyResponse>('/api/v1/meteorology');
}

export async function fetchForecastPlume(): Promise<PlumeResponse> {
  return requestJson<PlumeResponse>('/api/v1/forecast/plume');
}

export async function fetchAlerts(severity?: string, limit: number = 10): Promise<AlertsResponse> {
  const query = severity ? `?severity=${severity}&limit=${limit}` : `?limit=${limit}`;
  return requestJson<AlertsResponse>(`/api/v1/alerts${query}`);
}

export async function fetchLatestAlert(lang: 'en' | 'hi' | 'pa' = 'en'): Promise<LatestAlertResponse | null> {
  return requestJson<LatestAlertResponse | null>(`/api/v1/alerts/latest?lang=${lang}`);
}

export interface CreateNoticePayload {
  incident_id: string;
  issuing_authority: string;
  authorized_officer?: string;
  requested_direction?: string;
}

export interface LegalNoticeResponse {
  notice_id: string;
  incident_id: string;
  issuing_authority: string;
  authorized_officer?: string;
  legal_basis: string;
  title: string;
  body: string;
  status: string;
  document_sha256: string;
  created_at: string;
}

export async function createLegalNotice(payload: CreateNoticePayload): Promise<LegalNoticeResponse> {
  return requestJson<LegalNoticeResponse>('/api/v1/legal/notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchFederatedStatus(): Promise<FLStatusResponse> {
  return requestJson<FLStatusResponse>('/api/v1/federated/status');
}

export async function triggerFederatedRun(rounds: number = 10): Promise<FLStatusResponse> {
  return requestJson<FLStatusResponse>(`/api/v1/federated/run?num_rounds=${rounds}`, {
    method: 'POST',
  });
}

export async function uploadCitizenSkyPhoto(formData: FormData): Promise<CitizenPhotoResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${API_BASE}/api/v1/citizen/photo`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const payload = await res.json();
        detail = payload.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return (await res.json()) as CitizenPhotoResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchBiomassEmissions(days: number = 7): Promise<BiomassEmissionsResponse> {
  return requestJson<BiomassEmissionsResponse>(`/api/v1/analytics/biomass-emissions?days=${days}`);
}

export async function fetchFireAqiLag(days: number = 7): Promise<FireAqiLagResponse> {
  return requestJson<FireAqiLagResponse>(`/api/v1/analytics/fire-aqi-lag?days=${days}`);
}

export async function fetchLatestBriefing(): Promise<BriefingResponse> {
  return requestJson<BriefingResponse>('/api/v1/briefings/latest');
}

export async function createIncident(data: IncidentCreate): Promise<IncidentItem> {
  return requestJson<IncidentItem>('/api/v1/alerts/incident', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function queueLegalDispatch(data: {
  incident_id: string;
  recipient_kind: 'district_magistrate' | 'police' | 'flying_squad' | 'spcb';
  recipient_reference: string;
  notice_id?: string;
}): Promise<LegalDispatch> {
  return requestJson<LegalDispatch>('/api/v1/legal/dispatches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchSignaturePackage(noticeId: string): Promise<SignaturePackageResponse> {
  return requestJson<SignaturePackageResponse>(`/api/v1/legal/notices/${encodeURIComponent(noticeId)}/signature-package`);
}

export async function fetchLegalRegistry(): Promise<LegalRegistryResponse> {
  return requestJson<LegalRegistryResponse>('/api/v1/legal/registry');
}

export async function fetchCemsForensics(facilityId: string = 'CEMS-FLUE-MAN8', hours: number = 24): Promise<CemsForensicsResponse> {
  return requestJson<CemsForensicsResponse>(`/api/v1/industrial/cems/${encodeURIComponent(facilityId)}/forensics?hours=${hours}`);
}

export async function fetchAnomalies(
  parameter: string = 'no2',
  nighttimeOnly: boolean = true,
  daysBack: number = 7
): Promise<AnomaliesResponse> {
  return requestJson<AnomaliesResponse>(`/api/v1/anomalies?parameter=${parameter}&nighttime_only=${nighttimeOnly}&days_back=${daysBack}`);
}

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

export async function fetchAqiSurface(resolutionDeg: number = 0.5): Promise<SurfaceGridResponse> {
  return requestJson<SurfaceGridResponse>(`/api/v1/aqi/surface?resolution_deg=${resolutionDeg}`);
}

export async function fetchSensorThings(): Promise<SensorThingsResponse> {
  return requestJson<SensorThingsResponse>('/api/v1/sensorthings/Things');
}

// ── Mobile release / update check ────────────────────────────────────────────
export interface MobileReleaseResponse {
  version: string;
  download_url: string;
  sha256: string;
  status: string;
}

/** Returns null (HTTP 204) when no release is configured on the backend. */
export async function fetchMobileRelease(): Promise<MobileReleaseResponse | null> {
  return requestJson<MobileReleaseResponse | null>('/api/v1/mobile/releases/latest');
}

// ── Legal document URL helpers (use with Linking.openURL) ────────────────────

/** Returns the URL to stream a draft notice PDF; open with Linking.openURL. */
export function getNoticePdfUrl(noticeId: string): string {
  return `${API_BASE}/api/v1/legal/notices/${encodeURIComponent(noticeId)}/document.pdf`;
}

/** Returns the URL to stream an evidence-certificate draft PDF. */
export function getEvidenceCertUrl(noticeId: string): string {
  return `${API_BASE}/api/v1/legal/notices/${encodeURIComponent(noticeId)}/evidence-certificate.pdf`;
}

/** Returns the URL to download a full evidence dossier ZIP for an incident. */
export function getDossierZipUrl(incidentId: string): string {
  return `${API_BASE}/api/v1/legal/dossiers/${encodeURIComponent(incidentId)}.zip`;
}

// ── Briefing RSS feed ─────────────────────────────────────────────────────────

/** Returns the full URL of the atmospheric briefing RSS feed. */
export function getBriefingFeedUrl(): string {
  return `${API_BASE}/api/v1/briefings/feed.xml`;
}

// ── WebSocket connection helper ───────────────────────────────────────────────

export type WsMessageType = 'snapshot' | 'aqi_update' | 'alert' | 'pong';

export interface WsMessage {
  type: WsMessageType;
  city_id?: string;
  pm25_ugm3?: number | null;
  aqi_index?: number | null;
  delhi_pm25_ugm3?: number | null;
  delhi_aqi_index?: number | null;
  fire_count?: number | null;
  source?: string[];
  measured_at?: string | null;
  latest_alert?: Record<string, unknown> | null;
  // Alert broadcast fields
  incident_id?: string;
  severity?: string;
  title?: string;
  body?: string;
  created_at?: string;
}

/**
 * Opens a WebSocket to the PRANA real-time channel for the given city.
 * Valid city_ids: 'delhi' | 'ncr' | 'punjab' | 'haryana'
 *
 * Returns the WebSocket instance. Caller is responsible for closing it.
 *
 * @example
 *   const ws = connectWebSocket('delhi', (msg) => { ... });
 *   return () => ws.close();
 */
export function connectWebSocket(
  cityId: 'delhi' | 'ncr' | 'punjab' | 'haryana',
  onMessage: (msg: WsMessage) => void,
  onError?: (event: Event) => void,
): WebSocket {
  // Convert http(s) → ws(s) for any configured base URL
  const wsBase = API_BASE.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsBase}/ws/${cityId}`);

  ws.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      onMessage(msg);
    } catch {
      // Non-JSON frame (e.g. plain 'pong') — ignore
    }
  };

  ws.onerror = (event) => {
    if (onError) onError(event);
  };

  // Keep-alive ping every 30 s
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('ping');
    } else {
      clearInterval(pingInterval);
    }
  }, 30_000);

  ws.onclose = () => clearInterval(pingInterval);

  return ws;
}
