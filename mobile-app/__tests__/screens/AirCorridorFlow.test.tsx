import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  AirCorridorMapScreen,
  getCorridorTrajectoryPoint,
  NODES,
} from '../../src/screens/AirCorridorMapScreen';

// Mock API Client to test screen in isolation
jest.mock('../../src/api/client', () => {
  const actual = jest.requireActual('../../src/api/client');
  return {
    ...actual,
    fetchHotspots: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      fetched_at: '2026-09-09T12:00:00Z',
      source: 'NASA_FIRMS_VIIRS_SNPP_NRT',
      count: 24,
      features: [],
    }),
    fetchMeteorology: jest.fn().mockResolvedValue({
      fetched_at: '2026-09-09T12:00:00Z',
      regions: {
        punjab: {
          latitude: 30.7,
          longitude: 76.8,
          observed_at: '2026-09-09T12:00:00Z',
          source: 'OPEN_METEO_LIVE',
          wind_speed_ms: 4.5,
          wind: {
            eastward_ms: 3.2,
            northward_ms: -3.1,
            direction_from_deg: 315,
            direction_toward_deg: 135,
          },
          mixing_layer_height_m_agl: 450,
        },
        delhi: {
          latitude: 28.6,
          longitude: 77.2,
          observed_at: '2026-09-09T12:00:00Z',
          source: 'OPEN_METEO_LIVE',
          wind_speed_ms: 2.2,
          wind: {
            eastward_ms: 1.5,
            northward_ms: -1.6,
            direction_from_deg: 320,
            direction_toward_deg: 140,
          },
          mixing_layer_height_m_agl: 350,
        },
      },
      streamlines: { status: 'computed' },
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
          region: 'Punjab',
          hotspot_count: 24,
          frp_sum_mw: 310.5,
          frp_share_percent: 88.0,
          estimated_aerosol_kg_s: 10.2,
        },
      ],
      source: 'NASA_FIRMS',
    }),
    fetchSensorThings: jest.fn().mockResolvedValue({
      '@iot.count': 12,
      value: [],
    }),
    fetchAqiSurface: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      computed_at: '2026-09-09T12:00:00Z',
      resolution_deg: 0.5,
      features: [],
      source: 'GP_DOWNSCALER_CORRIDOR',
    }),
  };
});

describe('Air Corridor Flow Dynamics & Cartography', () => {
  describe('Mathematical Trajectory Kinematics (getCorridorTrajectoryPoint)', () => {
    it('accurately resolves each of the 5 corridor node milestones', () => {
      // T=0h: Sangrur Cluster
      const t0 = getCorridorTrajectoryPoint(0);
      expect(t0.x).toBe(45);
      expect(t0.y).toBe(35);

      // T=18h: Patiala Sub-Belt
      const t18 = getCorridorTrajectoryPoint(18);
      expect(t18.x).toBe(105);
      expect(t18.y).toBe(80);

      // T=36h: Karnal Midpoint Gate
      const t36 = getCorridorTrajectoryPoint(36);
      expect(t36.x).toBe(170);
      expect(t36.y).toBe(125);

      // T=54h: Panipat Choke Point
      const t54 = getCorridorTrajectoryPoint(54);
      expect(t54.x).toBe(235);
      expect(t54.y).toBe(170);

      // T=72h: Delhi NCR Basin Sink
      const t72 = getCorridorTrajectoryPoint(72);
      expect(t72.x).toBe(295);
      expect(t72.y).toBe(220);
    });

    it('clamps gracefully for negative hours and overflow (>72h)', () => {
      const underflow = getCorridorTrajectoryPoint(-10);
      expect(underflow.x).toBe(45);
      expect(underflow.y).toBe(35);

      const overflow = getCorridorTrajectoryPoint(120);
      expect(overflow.x).toBe(295);
      expect(overflow.y).toBe(220);
    });

    it('interpolates smoothly along corridor segments', () => {
      // Midway between Sangrur (45, 35) and Patiala (105, 80) at T=9h
      const mid0_18 = getCorridorTrajectoryPoint(9);
      expect(mid0_18.x).toBe(75);
      expect(mid0_18.y).toBe(57.5);

      // Midway between Karnal (170, 125) and Panipat (235, 170) at T=45h
      const mid36_54 = getCorridorTrajectoryPoint(45);
      expect(mid36_54.x).toBe(202.5);
      expect(mid36_54.y).toBe(147.5);
    });

    it('retains NW-to-SE advection angle along the entire corridor', () => {
      for (const h of [5, 20, 40, 60]) {
        const pt = getCorridorTrajectoryPoint(h);
        // Angle in SVG coordinate space (down and right) is positive (~30° to ~45°)
        expect(pt.angleDeg).toBeGreaterThan(30);
        expect(pt.angleDeg).toBeLessThan(50);
      }
    });
  });

  describe('Corridor Flow UI Component Testing', () => {
    it('renders the complete corridor flow elements (plume swath, transport spine, flow particle)', async () => {
      const { getByTestId, getByText } = render(<AirCorridorMapScreen />);

      await waitFor(() => {
        expect(getByText('Air Corridor Map')).toBeTruthy();
      });

      // Verify the screen title and subtitle
      expect(getByText('Synoptic NW-to-SE Dispersion Swath')).toBeTruthy();

      // Verify the Plume Swath is visible
      expect(getByTestId('corridor-plume-swath')).toBeTruthy();

      // Verify the Corridor Transport Spine and streamlines are visible
      expect(getByTestId('corridor-flow-spine')).toBeTruthy();

      // Verify the Forward Trajectory Particle is visible
      expect(getByTestId('corridor-flow-particle')).toBeTruthy();

      // Verify all 5 corridor node checkpoints are present
      for (const node of NODES) {
        expect(getByTestId(`corridor-node-${node.id}`)).toBeTruthy();
      }

      // Verify synoptic flow watermark
      expect(getByText('NW (315°) → SE (135°) Synoptic Chute • 1:2.4M')).toBeTruthy();
    });

    it('allows jumping across all 5 corridor milestone checkpoints via scrubber pills', async () => {
      const { getByText, getByLabelText } = render(<AirCorridorMapScreen />);

      await waitFor(() => {
        expect(getByText('Air Corridor Map')).toBeTruthy();
      });

      // 1. Jump to Patiala (18h)
      fireEvent.press(getByLabelText('Jump to Patiala T+18 hours'));
      await waitFor(() => {
        expect(getByText('T + 18.0h')).toBeTruthy();
      });

      // 2. Jump to Midpoint (36h - Karnal)
      fireEvent.press(getByLabelText('Jump to Midpoint T+36 hours'));
      await waitFor(() => {
        expect(getByText('T + 36.0h')).toBeTruthy();
      });

      // 3. Jump to Panipat (54h)
      fireEvent.press(getByLabelText('Jump to Panipat T+54 hours'));
      await waitFor(() => {
        expect(getByText('T + 54.0h')).toBeTruthy();
      });

      // 4. Jump to Basin Sink (72h - Delhi)
      fireEvent.press(getByLabelText('Jump to Basin Sink T+72 hours'));
      await waitFor(() => {
        expect(getByText('T + 72.0h')).toBeTruthy();
      });

      // 5. Jump back to Origin (0h - Sangrur)
      fireEvent.press(getByLabelText('Jump to Origin T+0 hours'));
      await waitFor(() => {
        expect(getByText('T + 0.0h')).toBeTruthy();
      });
    });

    it('synchronizes node selection with inspector card', async () => {
      const { getByText, getByLabelText } = render(<AirCorridorMapScreen />);

      await waitFor(() => {
        expect(getByText('Air Corridor Map')).toBeTruthy();
      });

      // Select Karnal Gate
      fireEvent.press(getByLabelText('Karnal Gate corridor node'));
      await waitFor(() => {
        expect(getByText('Karnal Gate')).toBeTruthy();
        expect(getByText('Midpoint Transit Corridor (NH-44)')).toBeTruthy();
        expect(getByText('T + 36.0h')).toBeTruthy();
      });

      // Select Delhi NCR Basin
      fireEvent.press(getByLabelText('Delhi NCR Basin corridor node'));
      await waitFor(() => {
        expect(getByText('Delhi NCR Basin')).toBeTruthy();
        expect(getByText('Nocturnal Subsidence Sink')).toBeTruthy();
        expect(getByText('T + 72.0h')).toBeTruthy();
      });
    });

    it('toggles plume swath layer and updates visibility state', async () => {
      const { queryByTestId, getByLabelText, getByText } = render(<AirCorridorMapScreen />);

      await waitFor(() => {
        expect(getByText('Air Corridor Map')).toBeTruthy();
      });

      // Initially plume swath is visible
      expect(queryByTestId('corridor-plume-swath')).toBeTruthy();

      // Toggle off plume swath
      fireEvent.press(getByLabelText('Toggle plume swath layer'));
      await waitFor(() => {
        expect(queryByTestId('corridor-plume-swath')).toBeNull();
      });

      // Toggle back on
      fireEvent.press(getByLabelText('Toggle plume swath layer'));
      await waitFor(() => {
        expect(queryByTestId('corridor-plume-swath')).toBeTruthy();
      });
    });

    it('toggles playback simulation on play button press', async () => {
      const { getByLabelText, getByText } = render(<AirCorridorMapScreen />);

      await waitFor(() => {
        expect(getByText('Air Corridor Map')).toBeTruthy();
      });

      const playBtn = getByLabelText('Play forward trajectory animation');
      expect(playBtn).toBeTruthy();

      fireEvent.press(playBtn);
      await waitFor(() => {
        expect(getByLabelText('Pause forward trajectory animation')).toBeTruthy();
      });

      fireEvent.press(getByLabelText('Pause forward trajectory animation'));
      await waitFor(() => {
        expect(getByLabelText('Play forward trajectory animation')).toBeTruthy();
      });
    });

    it('calibrates trajectory points dynamically with backend plume cluster features', () => {
      const mockBackendPlumes: any[] = [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [76.2, 30.1],
                [76.4, 30.1],
                [76.4, 29.9],
                [76.2, 29.9],
              ],
            ],
          },
          properties: {
            cluster_id: 'CLU-20260909-001',
            horizon_hours: 24,
            max_pm25_est: 240,
            max_aqi_est: 390,
            wind_speed_ms: 4.8,
            wind_dir_deg: 315,
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [76.8, 29.5],
                [77.0, 29.5],
                [77.0, 29.3],
                [76.8, 29.3],
              ],
            ],
          },
          properties: {
            cluster_id: 'CLU-20260909-001',
            horizon_hours: 48,
            max_pm25_est: 180,
            max_aqi_est: 340,
            wind_speed_ms: 4.8,
            wind_dir_deg: 315,
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.1, 28.7],
                [77.3, 28.7],
                [77.3, 28.5],
                [77.1, 28.5],
              ],
            ],
          },
          properties: {
            cluster_id: 'CLU-20260909-001',
            horizon_hours: 72,
            max_pm25_est: 120,
            max_aqi_est: 280,
            wind_speed_ms: 4.8,
            wind_dir_deg: 315,
          },
        },
      ];

      const calibratedPt = getCorridorTrajectoryPoint(36, mockBackendPlumes);
      expect(calibratedPt.x).toBeGreaterThan(0);
      expect(calibratedPt.y).toBeGreaterThan(0);
      expect(calibratedPt.angleDeg).toBeGreaterThan(0);
    });

    it('displays backend plume model estimates when forecast telemetry is available', async () => {
      const { fetchForecastPlume } = require('../../src/api/client');
      (fetchForecastPlume as jest.Mock).mockResolvedValueOnce({
        type: 'FeatureCollection',
        computed_at: '2026-09-09T12:00:00Z',
        source: 'GAUSSIAN_PLUME_DBSCAN',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [76.2, 30.1],
                  [76.4, 30.1],
                  [76.4, 29.9],
                  [76.2, 29.9],
                ],
              ],
            },
            properties: {
              cluster_id: 'CLU-001',
              horizon_hours: 24,
              max_pm25_est: 245.5,
              max_aqi_est: 395,
              wind_speed_ms: 4.8,
            },
          },
        ],
      });

      const { getByText } = render(<AirCorridorMapScreen />);
      await waitFor(() => {
        expect(getByText(/T\+24h Model: Max PM2\.5/)).toBeTruthy();
        expect(getByText(/245\.5 µg\/m³/)).toBeTruthy();
        expect(getByText(/4\.8 m\/s/)).toBeTruthy();
      });
    });
  });
});
