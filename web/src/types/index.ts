export interface StationAQI {
  id: string;
  name: string;
  city: string;
  state: 'Delhi' | 'Punjab' | 'Haryana';
  lat: number;
  lon: number;
  pm25_ugm3: number;
  aqi_index: number;
  category: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe' | 'Hazardous';
  category_color: string;
  timestamp: string;
  is_anomalous?: boolean;
}

export interface FireHotspot {
  id: string;
  lat: number;
  lon: number;
  frp_mw: number;
  brightness_k: number;
  confidence: 'nominal' | 'high';
  district: string;
  state: 'Punjab' | 'Haryana';
  acq_time: string;
}

export interface PlumeForecast {
  horizon: 'Now' | '+24h' | '+48h' | '+72h';
  lead_hours: number;
  description: string;
  avg_wind_speed_kmh: number;
  wind_direction_deg: number;
  boundary_layer_height_m: number;
  inversion_risk: 'Low' | 'Moderate' | 'High' | 'Extreme';
  delhi_projected_aqi: number;
  impacted_wards: {
    ward: string;
    delhi_zone: string;
    expected_pm25: number;
    risk_level: 'Very Poor' | 'Severe' | 'Hazardous';
  }[];
  plume_geojson?: any;
}

export interface FLRoundState {
  round: number;
  total_rounds: number;
  global_loss: number;
  global_rmse: number;
  accuracy_lift_pct: number;
  punjab_loss: number;
  delhi_loss: number;
  tensors_exchanged: number;
  privacy_epsilon: number;
  differential_privacy_active: boolean;
  homomorphic_encrypted: boolean;
  status: 'idle' | 'running' | 'converged';
}

export interface IncidentAlert {
  id: string;
  ticket_number: string;
  timestamp: string;
  district: string;
  state: string;
  coordinates: [number, number];
  frp_mw: number;
  confidence: number;
  estimated_emissions_tonnes: number;
  status: 'FLAGGED' | 'VERIFIED' | 'NOTICE_SERVED' | 'DISPATCHED' | 'RESOLVED';
  viirs_verified: boolean;
  modis_verified: boolean;
  insat_verified: boolean;
  legal_notice_draft: {
    statutory_act: string;
    section: string;
    addressed_to: string;
    subject: string;
    body: string;
  };
  vernacular_advisory: {
    en: string;
    hi: string;
    pa: string;
  };
}

export interface SensorThing {
  '@iot.id': string;
  '@iot.selfLink': string;
  name: string;
  description: string;
  properties: {
    corridor_bbox: string;
    primary_pollutant: string;
    standard: string;
    fused_resolution_deg: number;
  };
  Locations: {
    name: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
  }[];
  Datastreams: {
    name: string;
    unitOfMeasurement: {
      name: string;
      symbol: string;
      definition: string;
    };
  }[];
}
