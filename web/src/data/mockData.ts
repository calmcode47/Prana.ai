import { StationAQI, FireHotspot, PlumeForecast, FLRoundState, IncidentAlert, SensorThing } from '../types';

export const mockStations: StationAQI[] = [
  {
    id: 'delhi-anand-vihar',
    name: 'Anand Vihar, Delhi',
    city: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.6476,
    lon: 77.3158,
    pm25_ugm3: 382.4,
    aqi_index: 442,
    category: 'Severe',
    category_color: '#b61b00',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'delhi-punjabi-bagh',
    name: 'Punjabi Bagh, Delhi',
    city: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.6720,
    lon: 77.1310,
    pm25_ugm3: 312.0,
    aqi_index: 388,
    category: 'Very Poor',
    category_color: '#db3417',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'delhi-rk-puram',
    name: 'R K Puram, Delhi',
    city: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.5630,
    lon: 77.1860,
    pm25_ugm3: 295.6,
    aqi_index: 374,
    category: 'Very Poor',
    category_color: '#db3417',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'delhi-ito',
    name: 'ITO Crossing, Delhi',
    city: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.6289,
    lon: 77.2410,
    pm25_ugm3: 340.2,
    aqi_index: 412,
    category: 'Severe',
    category_color: '#b61b00',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'punjab-sangrur',
    name: 'Sangrur Agricultural Station',
    city: 'Sangrur',
    state: 'Punjab',
    lat: 30.2450,
    lon: 75.8430,
    pm25_ugm3: 420.8,
    aqi_index: 472,
    category: 'Severe',
    category_color: '#b61b00',
    timestamp: 'Just now',
    is_anomalous: true,
  },
  {
    id: 'punjab-ludhiana',
    name: 'PAU Campus, Ludhiana',
    city: 'Ludhiana',
    state: 'Punjab',
    lat: 30.9010,
    lon: 75.8573,
    pm25_ugm3: 280.4,
    aqi_index: 360,
    category: 'Very Poor',
    category_color: '#db3417',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'punjab-patiala',
    name: 'Model Town, Patiala',
    city: 'Patiala',
    state: 'Punjab',
    lat: 30.3400,
    lon: 76.3800,
    pm25_ugm3: 298.1,
    aqi_index: 376,
    category: 'Very Poor',
    category_color: '#db3417',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'haryana-karnal',
    name: 'Sector 12, Karnal',
    city: 'Karnal',
    state: 'Haryana',
    lat: 29.6857,
    lon: 76.9905,
    pm25_ugm3: 310.5,
    aqi_index: 386,
    category: 'Very Poor',
    category_color: '#db3417',
    timestamp: 'Just now',
    is_anomalous: false,
  },
  {
    id: 'haryana-panipat',
    name: 'Industrial Area, Panipat',
    city: 'Panipat',
    state: 'Haryana',
    lat: 29.3909,
    lon: 76.9635,
    pm25_ugm3: 365.2,
    aqi_index: 428,
    category: 'Severe',
    category_color: '#b61b00',
    timestamp: 'Just now',
    is_anomalous: true,
  },
  {
    id: 'delhi-bawana',
    name: 'Bawana Industrial, Delhi',
    city: 'Delhi NCR',
    state: 'Delhi',
    lat: 28.7762,
    lon: 77.0510,
    pm25_ugm3: 410.0,
    aqi_index: 465,
    category: 'Severe',
    category_color: '#b61b00',
    timestamp: 'Just now',
    is_anomalous: true,
  }
];

export const mockHotspots: FireHotspot[] = [
  { id: 'VIIRS-001', lat: 30.312, lon: 75.792, frp_mw: 420.5, brightness_k: 364.2, confidence: 'high', district: 'Sangrur', state: 'Punjab', acq_time: '13:42 UTC' },
  { id: 'VIIRS-002', lat: 30.285, lon: 75.845, frp_mw: 380.0, brightness_k: 358.1, confidence: 'high', district: 'Sangrur', state: 'Punjab', acq_time: '13:42 UTC' },
  { id: 'VIIRS-003', lat: 30.820, lon: 75.430, frp_mw: 290.4, brightness_k: 349.0, confidence: 'high', district: 'Moga', state: 'Punjab', acq_time: '13:42 UTC' },
  { id: 'VIIRS-004', lat: 30.150, lon: 75.920, frp_mw: 310.2, brightness_k: 352.4, confidence: 'high', district: 'Barnala', state: 'Punjab', acq_time: '13:42 UTC' },
  { id: 'VIIRS-005', lat: 29.980, lon: 76.120, frp_mw: 260.0, brightness_k: 345.8, confidence: 'nominal', district: 'Kaithal', state: 'Haryana', acq_time: '13:42 UTC' },
  { id: 'VIIRS-006', lat: 29.690, lon: 76.850, frp_mw: 195.8, brightness_k: 338.2, confidence: 'nominal', district: 'Karnal', state: 'Haryana', acq_time: '13:42 UTC' },
  { id: 'VIIRS-007', lat: 30.450, lon: 76.210, frp_mw: 340.0, brightness_k: 355.0, confidence: 'high', district: 'Patiala', state: 'Punjab', acq_time: '13:42 UTC' },
  { id: 'VIIRS-008', lat: 30.940, lon: 75.910, frp_mw: 215.3, brightness_k: 341.1, confidence: 'nominal', district: 'Ludhiana', state: 'Punjab', acq_time: '13:42 UTC' }
];

export const mockForecasts: Record<string, PlumeForecast> = {
  'Now': {
    horizon: 'Now',
    lead_hours: 0,
    description: 'Active burning at Sangrur & Moga clusters; initial smoke front building over central Punjab.',
    avg_wind_speed_kmh: 14.2,
    wind_direction_deg: 312,
    boundary_layer_height_m: 680,
    inversion_risk: 'Moderate',
    delhi_projected_aqi: 387,
    impacted_wards: [
      { ward: 'Sangrur Rural', delhi_zone: 'Punjab Source', expected_pm25: 420.8, risk_level: 'Hazardous' },
      { ward: 'Barnala Central', delhi_zone: 'Punjab Source', expected_pm25: 385.0, risk_level: 'Severe' },
      { ward: 'Patiala West', delhi_zone: 'Transit Corridor', expected_pm25: 298.1, risk_level: 'Very Poor' }
    ]
  },
  '+24h': {
    horizon: '+24h',
    lead_hours: 24,
    description: 'Advective smoke corridor crosses Haryana border; mixing height collapses at twilight to 410m.',
    avg_wind_speed_kmh: 12.8,
    wind_direction_deg: 318,
    boundary_layer_height_m: 410,
    inversion_risk: 'High',
    delhi_projected_aqi: 415,
    impacted_wards: [
      { ward: 'Kaithal Plains', delhi_zone: 'Haryana Transit', expected_pm25: 360.4, risk_level: 'Severe' },
      { ward: 'Karnal South', delhi_zone: 'Haryana Transit', expected_pm25: 388.2, risk_level: 'Severe' },
      { ward: 'Narela Border', delhi_zone: 'North Delhi', expected_pm25: 412.0, risk_level: 'Hazardous' }
    ]
  },
  '+48h': {
    horizon: '+48h',
    lead_hours: 48,
    description: 'Main plume front enters Delhi NCR basin; sharp nocturnal temperature inversion caps dispersion.',
    avg_wind_speed_kmh: 9.5,
    wind_direction_deg: 325,
    boundary_layer_height_m: 340,
    inversion_risk: 'Extreme',
    delhi_projected_aqi: 458,
    impacted_wards: [
      { ward: 'Bawana & Narela', delhi_zone: 'North-West Delhi', expected_pm25: 465.0, risk_level: 'Hazardous' },
      { ward: 'Punjabi Bagh & Rohini', delhi_zone: 'West Delhi', expected_pm25: 448.5, risk_level: 'Hazardous' },
      { ward: 'Anand Vihar', delhi_zone: 'East Delhi', expected_pm25: 482.0, risk_level: 'Hazardous' }
    ]
  },
  '+72h': {
    horizon: '+72h',
    lead_hours: 72,
    description: 'Complete basin stagnation. Secondary aerosol formation amplifies PM2.5 across entire NCR.',
    avg_wind_speed_kmh: 6.2,
    wind_direction_deg: 330,
    boundary_layer_height_m: 290,
    inversion_risk: 'Extreme',
    delhi_projected_aqi: 488,
    impacted_wards: [
      { ward: 'Anand Vihar & Trans-Yamuna', delhi_zone: 'East Delhi', expected_pm25: 520.0, risk_level: 'Hazardous' },
      { ward: 'RK Puram & South Campus', delhi_zone: 'South Delhi', expected_pm25: 475.0, risk_level: 'Hazardous' },
      { ward: 'Noida & Greater Noida', delhi_zone: 'NCR Border', expected_pm25: 495.0, risk_level: 'Hazardous' }
    ]
  }
};

export const mockFLHistory: FLRoundState[] = [
  { round: 1, total_rounds: 10, global_loss: 0.482, global_rmse: 54.2, accuracy_lift_pct: 0.0, punjab_loss: 0.512, delhi_loss: 0.468, tensors_exchanged: 128, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 2, total_rounds: 10, global_loss: 0.415, global_rmse: 47.8, accuracy_lift_pct: 3.2, punjab_loss: 0.435, delhi_loss: 0.402, tensors_exchanged: 256, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 3, total_rounds: 10, global_loss: 0.364, global_rmse: 41.5, accuracy_lift_pct: 6.1, punjab_loss: 0.380, delhi_loss: 0.352, tensors_exchanged: 384, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 4, total_rounds: 10, global_loss: 0.320, global_rmse: 36.9, accuracy_lift_pct: 8.4, punjab_loss: 0.338, delhi_loss: 0.309, tensors_exchanged: 512, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 5, total_rounds: 10, global_loss: 0.285, global_rmse: 32.4, accuracy_lift_pct: 10.2, punjab_loss: 0.298, delhi_loss: 0.276, tensors_exchanged: 640, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 6, total_rounds: 10, global_loss: 0.254, global_rmse: 28.8, accuracy_lift_pct: 11.5, punjab_loss: 0.267, delhi_loss: 0.244, tensors_exchanged: 768, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 7, total_rounds: 10, global_loss: 0.231, global_rmse: 26.1, accuracy_lift_pct: 12.1, punjab_loss: 0.242, delhi_loss: 0.223, tensors_exchanged: 896, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 8, total_rounds: 10, global_loss: 0.212, global_rmse: 23.9, accuracy_lift_pct: 12.8, punjab_loss: 0.224, delhi_loss: 0.203, tensors_exchanged: 1024, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 9, total_rounds: 10, global_loss: 0.198, global_rmse: 22.3, accuracy_lift_pct: 13.4, punjab_loss: 0.210, delhi_loss: 0.189, tensors_exchanged: 1152, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' },
  { round: 10, total_rounds: 10, global_loss: 0.186, global_rmse: 20.9, accuracy_lift_pct: 14.1, punjab_loss: 0.197, delhi_loss: 0.178, tensors_exchanged: 1280, privacy_epsilon: 1.2, differential_privacy_active: true, homomorphic_encrypted: true, status: 'converged' }
];

export const mockIncidents: IncidentAlert[] = [
  {
    id: 'INC-2026-0891',
    ticket_number: 'SPCB/PB/2026/0891',
    timestamp: '2026-09-06T13:42:00Z',
    district: 'Sangrur',
    state: 'Punjab',
    coordinates: [30.312, 75.792],
    frp_mw: 420.5,
    confidence: 98,
    estimated_emissions_tonnes: 184.2,
    status: 'NOTICE_SERVED',
    viirs_verified: true,
    modis_verified: true,
    insat_verified: true,
    legal_notice_draft: {
      statutory_act: 'Air (Prevention and Control of Pollution) Act, 1981',
      section: 'Section 31A',
      addressed_to: 'Regional Officer, Punjab Pollution Control Board, Sangrur Division',
      subject: 'Show-Cause Notice for Detected Open Crop-Residue Incineration (Thermal FRP: 420.5 MW)',
      body: 'WHEREAS multi-satellite telemetry from NASA VIIRS and INSAT-3DR confirmed high-intensity open biomass burning at coordinates 30.3120°N, 75.7920°E on 06-Sep-2026 13:42 UTC. You are hereby directed to dispatch the designated flying squad for immediate ground enforcement and fine assessment under NGT guidelines.'
    },
    vernacular_advisory: {
      en: 'High particulate smoke plume originating from Sangrur district. Downwind transit toward Patiala-Karnal within 14 hours. High-risk individuals advised to restrict outdoor activities.',
      hi: 'संगरूर जिले से अत्यधिक धुएं का गुबार उठा है। अगले 14 घंटों में पटियाला-करनाल की ओर बढ़ने की संभावना है। सांस के रोगी घर पर रहें।',
      pa: 'ਸੰਗਰੂਰ ਜ਼ਿਲ੍ਹੇ ਤੋਂ ਪਰਾਲੀ ਦੇ ਧੂੰਏਂ ਦਾ ਵੱਡਾ ਗੁਬਾਰ ਨਿਕਲ ਰਿਹਾ ਹੈ। ਅਗਲੇ 14 ਘੰਟਿਆਂ ਵਿੱਚ ਪਟਿਆਲਾ-ਕਰਨਾਲ ਵੱਲ ਵਧਣ ਦਾ ਖਦਸ਼ਾ ਹੈ।'
    }
  },
  {
    id: 'INC-2026-0892',
    ticket_number: 'SPCB/HR/2026/0892',
    timestamp: '2026-09-06T14:10:00Z',
    district: 'Panipat Industrial Zone',
    state: 'Haryana',
    coordinates: [29.3909, 76.9635],
    frp_mw: 195.8,
    confidence: 94,
    estimated_emissions_tonnes: 72.0,
    status: 'FLAGGED',
    viirs_verified: true,
    modis_verified: false,
    insat_verified: true,
    legal_notice_draft: {
      statutory_act: 'Environment (Protection) Act, 1986',
      section: 'Section 5',
      addressed_to: 'Haryana State Pollution Control Board, Panipat Industrial Circle',
      subject: 'Nighttime Industrial SO2/NO2 Emission Spike Anomaly Flagged via IsolationForest',
      body: 'Continuous emission monitoring system (CEMS) recorded unpermitted nighttime stack emission spike of 365.2 µg/m³ PM2.5 between 01:00 and 04:00 hrs. Inspection team required.'
    },
    vernacular_advisory: {
      en: 'Industrial nighttime emissions spike flagged in Panipat industrial zone. Local ambient AQI reached 428 (Severe).',
      hi: 'पानीपत औद्योगिक क्षेत्र में रात के समय भारी उत्सर्जन दर्ज किया गया है। स्थानीय एक्यूआई 428 (गंभीर) पर पहुंच गया है।',
      pa: 'ਪਾਣੀਪਤ ਉਦਯੋਗਿਕ ਖੇਤਰ ਵਿੱਚ ਰਾਤ ਵੇਲੇ ਧੂੰਏਂ ਦਾ ਵੱਡਾ ਵਾਧਾ ਦਰਜ ਕੀਤਾ ਗਿਆ। ਏਅਰ ਕੁਆਲਿਟੀ 428 ਗੰਭੀਰ ਪੱਧਰ ਤੇ ਪਹੁੰਚੀ।'
    }
  }
];

export const mockSensorThingsData: SensorThing = {
  '@iot.id': 'prana-indo-gangetic-corridor-v1',
  '@iot.selfLink': 'https://prana.ai/api/v1/sensorthings/Things(1)',
  name: 'PRANA Indo-Gangetic Airshed Fused Sensor Grid',
  description: 'Multi-modal continuous PM2.5 surface fusion grid combining Sentinel-5P TROPOMI, NASA FIRMS VIIRS, and CPCB ground monitors.',
  properties: {
    corridor_bbox: '73.5E, 28.5N to 77.5E, 32.5N',
    primary_pollutant: 'PM2.5 (Mass Concentration)',
    standard: 'CPCB National Air Quality Index (India Breakpoints)',
    fused_resolution_deg: 0.1
  },
  Locations: [
    { name: 'Delhi NCR Basin Centroid', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
    { name: 'Sangrur Agricultural Hotspot', location: { type: 'Point', coordinates: [75.8430, 30.2450] } },
    { name: 'Karnal Transit Airshed', location: { type: 'Point', coordinates: [76.9905, 29.6857] } }
  ],
  Datastreams: [
    {
      name: 'Fused PM2.5 Surface Grid',
      unitOfMeasurement: { name: 'microgram per cubic meter', symbol: 'µg/m³', definition: 'http://unitsofmeasure.org/ucum.html#para-28' }
    },
    {
      name: 'CPCB Air Quality Index',
      unitOfMeasurement: { name: 'dimensionless index', symbol: 'AQI', definition: 'https://cpcb.nic.in/national-air-quality-index/' }
    },
    {
      name: 'Fire Radiative Power',
      unitOfMeasurement: { name: 'megawatt', symbol: 'MW', definition: 'http://unitsofmeasure.org/ucum.html#para-29' }
    }
  ]
};
