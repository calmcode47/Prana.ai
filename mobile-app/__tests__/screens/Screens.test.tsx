import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AirshedDashboardScreen } from '../../src/screens/AirshedDashboardScreen';
import { AirCorridorMapScreen } from '../../src/screens/AirCorridorMapScreen';
import { CitizenScannerScreen } from '../../src/screens/CitizenScannerScreen';

// Mock API Client to test screen mounting and interaction in isolation
jest.mock('../../src/api/client', () => {
  const actual = jest.requireActual('../../src/api/client');
  return {
    ...actual,
    uploadCitizenSkyPhoto: jest.fn().mockResolvedValue({
      pm25_estimate: 142.5,
      aqi_index: 318,
      aqi_category: 'Very Poor',
      aqi_color: '#FF0000',
      confidence: 'high',
      processing_time_ms: 185,
    }),
    fetchHotspots: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      fetched_at: '2026-09-09T12:00:00Z',
      source: 'NASA_FIRMS_VIIRS_SNPP_NRT',
      count: 42,
      features: [],
    }),
    fetchStations: jest.fn().mockResolvedValue({
      '@iot.count': 8,
      value: [
        {
          '@iot.id': 'DL-01',
          name: 'Anand Vihar, Delhi - DPCC',
          Locations: [{ location: { type: 'Point', coordinates: [77.316, 28.647] } }],
          Datastreams: [
            {
              name: 'PM2.5',
              Observations: [
                {
                  pm25_ugm3: 312.4,
                  aqi_index: 387,
                  phenomenonTime: '2026-09-09T12:00:00Z',
                  source: 'OPENAQ_LIVE',
                  averaging_period: '1h',
                },
              ],
            },
          ],
        },
      ],
    }),
    fetchMeteorology: jest.fn().mockResolvedValue({
      fetched_at: '2026-09-09T12:00:00Z',
      regions: {
        punjab: {
          latitude: 30.7,
          longitude: 76.8,
          observed_at: '2026-09-09T12:00:00Z',
          source: 'OPEN_METEO_LIVE',
          wind_speed_ms: 4.2,
          wind: {
            eastward_ms: 3.1,
            northward_ms: -2.8,
            direction_from_deg: 315,
            direction_toward_deg: 135,
          },
          mixing_layer_height_m_agl: 450,
          forecast_mixing_layer_min_m_agl: 300,
          forecast_mixing_layer_max_m_agl: 900,
        },
        delhi: {
          latitude: 28.6,
          longitude: 77.2,
          observed_at: '2026-09-09T12:00:00Z',
          source: 'OPEN_METEO_LIVE',
          wind_speed_ms: 2.1,
          wind: {
            eastward_ms: 1.5,
            northward_ms: -1.4,
            direction_from_deg: 320,
            direction_toward_deg: 140,
          },
          mixing_layer_height_m_agl: 380,
          forecast_mixing_layer_min_m_agl: 250,
          forecast_mixing_layer_max_m_agl: 750,
        },
      },
      streamlines: { status: 'computed', integration_method: 'runge_kutta_4' },
      inversion: { status: 'active_subsidence_inversion', reason: 'nocturnal_surface_cooling' },
    }),
    fetchForecastPlume: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      computed_at: '2026-09-09T12:00:00Z',
      source: 'GAUSSIAN_PLUME_DBSCAN',
      features: [],
    }),
    fetchBiomassEmissions: jest.fn().mockResolvedValue({
      period_days: 7,
      regions: [
        {
          region: 'punjab',
          hotspot_count: 35,
          frp_sum_mw: 420.5,
          frp_share_percent: 85.2,
          estimated_aerosol_kg_s: 14.2,
        },
      ],
      source: 'NASA_FIRMS',
      emissions_model: 'configured',
      coefficient_kg_s_per_mw: 0.033,
      caution: 'Model estimate based on satellite FRP',
    }),
    fetchSensorThings: jest.fn().mockResolvedValue({
      '@iot.count': 2,
      value: [],
    }),
    fetchAqiSurface: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      computed_at: '2026-09-09T12:00:00Z',
      resolution_deg: 0.5,
      features: [],
      source: 'GP_DOWNSCALER_CORRIDOR',
    }),
    fetchAlerts: jest.fn().mockResolvedValue({
      count: 1,
      items: [],
    }),
    fetchLatestBriefing: jest.fn().mockResolvedValue({
      status: 'script_ready',
      script: 'Current corridor conditions indicate northwest advection toward Delhi NCR.',
      audio_url: null,
      audio_status: 'available',
    }),
    fetchFireAqiLag: jest.fn().mockResolvedValue({
      period_days: 7,
      status: 'computed',
      strongest_lag: { lag_hours: 36, pearson_r: 0.78, paired_hours: 140 },
      correlations: [],
      method: 'pearson_cross_correlation',
      caution: 'Observational correlation',
    }),
  };
});

describe('Mobile App Screen Integration', () => {
  describe('AirshedDashboardScreen', () => {
    it('mounts cleanly and displays primary airshed telemetries', async () => {
      const { getByText } = render(
        <AirshedDashboardScreen
          onOpenScanner={jest.fn()}
          onNavigateCorridor={jest.fn()}
        />
      );
      expect(getByText('PRANA Air')).toBeTruthy();
      expect(getByText('72H FORECAST')).toBeTruthy();
      expect(getByText('+ Analyse Sky Haze')).toBeTruthy();

      await waitFor(() => {
        expect(getByText('SPCB Operational Command')).toBeTruthy();
        expect(getByText('Biomass Emissions & Crop Fires')).toBeTruthy();
      });
    });
  });

  describe('AirCorridorMapScreen', () => {
    it('mounts cleanly with interactive pan & zoom controls and mode switcher', async () => {
      const { getByText, getByLabelText } = render(<AirCorridorMapScreen />);
      expect(getByText('Air Corridor Map')).toBeTruthy();
      expect(getByText('Corridor Flow')).toBeTruthy();
      expect(getByText('Station & Grid Inspector')).toBeTruthy();

      // Verify zoom controls are present
      expect(getByLabelText('Zoom in')).toBeTruthy();
      expect(getByLabelText('Zoom out')).toBeTruthy();
      expect(getByLabelText('Reset zoom to 1x')).toBeTruthy();
      expect(getByLabelText('Center view on selected node')).toBeTruthy();

      // Verify DEC-008 architecture toggle exists
      expect(getByLabelText('Toggle native MapLibre cartography architecture details')).toBeTruthy();

      // Test switching mode to inspector
      fireEvent.press(getByText('Station & Grid Inspector'));
      await waitFor(() => {
        expect(getByText('Station & Grid Inspector')).toBeTruthy();
      });

      // Test zooming in
      fireEvent.press(getByLabelText('Zoom in'));
      await waitFor(() => {
        expect(getByText('2.0x')).toBeTruthy();
      });

      // Test reset zoom
      fireEvent.press(getByLabelText('Reset zoom to 1x'));
      await waitFor(() => {
        expect(getByText('1.0x')).toBeTruthy();
      });
    });
  });

  describe('CitizenScannerScreen', () => {
    it('mounts cleanly, renders location presets and camera/gallery triggers', async () => {
      const onCloseMock = jest.fn();
      const { getByText, getByLabelText } = render(<CitizenScannerScreen onClose={onCloseMock} />);

      await waitFor(() => {
        expect(getByText('Sky Haze Scanner')).toBeTruthy();
      });
      expect(getByText('DCP Optical Extinction & Ingestion Engine')).toBeTruthy();

      // Verify location preset buttons exist
      expect(getByLabelText('Anand Vihar ISBT Receptor Basin calibration preset')).toBeTruthy();
      expect(getByLabelText('Panipat NH-44 Highway Transit Belt calibration preset')).toBeTruthy();
      expect(getByLabelText('Sangrur Rural Harvest Outskirts calibration preset')).toBeTruthy();

      // Verify photo acquisition buttons
      expect(getByLabelText('Capture sky photo with camera')).toBeTruthy();
      expect(getByLabelText('Choose sky photo from gallery')).toBeTruthy();

      // Verify inference trigger button
      expect(getByText('Trigger DCP Sky Haze Inference')).toBeTruthy();

      // Verify close button
      const closeBtn = getByLabelText('Close Sky Haze Scanner');
      expect(closeBtn).toBeTruthy();
      fireEvent.press(closeBtn);
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
