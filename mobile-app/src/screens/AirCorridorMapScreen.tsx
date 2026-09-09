import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  DimensionValue,
  PanResponder,
} from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop, Circle, Polygon, G, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { StarburstBadge } from '../components/StarburstBadge';
import {
  fetchHotspots,
  fetchMeteorology,
  fetchForecastPlume,
  fetchBiomassEmissions,
  fetchSensorThings,
  fetchAqiSurface,
  BiomassEmissionsResponse,
  SensorThingsResponse,
  SurfaceGridResponse,
  SurfaceGridFeature,
  MeteorologyResponse,
  HotspotsResponse,
  PlumeResponse,
  getAqiCategoryAndColor,
  formatBackendStatus,
} from '../api/client';

interface CorridorNode {
  id: string;
  name: string;
  role: string;
  latitude: number;
  longitude: number;
  aqi: number | null;
  pm25: number | null;
  frp: number | null;
  windSpeed: number | null;
  eta: string;
  color: string;
  x: number;
  y: number;
}

export interface CorridorTrajectoryPoint {
  x: number;
  y: number;
  angleDeg: number;
}

export function getCorridorTrajectoryPoint(hours: number): CorridorTrajectoryPoint {
  const clampedHours = Math.max(0, Math.min(72, hours));
  const milestones = [
    { hour: 0, x: 45, y: 35 },
    { hour: 18, x: 105, y: 80 },
    { hour: 36, x: 170, y: 125 },
    { hour: 54, x: 235, y: 170 },
    { hour: 72, x: 295, y: 220 },
  ];

  if (clampedHours <= 0) return { x: milestones[0].x, y: milestones[0].y, angleDeg: 36.8 };
  if (clampedHours >= 72) return { x: milestones[4].x, y: milestones[4].y, angleDeg: 39.8 };

  let idx = 0;
  for (let i = 0; i < milestones.length - 1; i++) {
    if (clampedHours >= milestones[i].hour && clampedHours <= milestones[i + 1].hour) {
      idx = i;
      break;
    }
  }

  const m0 = milestones[idx];
  const m1 = milestones[idx + 1];
  const fraction = (clampedHours - m0.hour) / (m1.hour - m0.hour);

  const x = m0.x + fraction * (m1.x - m0.x);
  const y = m0.y + fraction * (m1.y - m0.y);
  const angleDeg = (Math.atan2(m1.y - m0.y, m1.x - m0.x) * 180) / Math.PI;

  return {
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
    angleDeg: Number(angleDeg.toFixed(1)),
  };
}

export const NODES: CorridorNode[] = [
  {
    id: 'sangrur',
    name: 'Sangrur Cluster',
    role: 'NW Primary Emitter (Punjab)',
    latitude: 30.245, longitude: 75.842, aqi: null, pm25: null, frp: null, windSpeed: null,
    eta: 'T+0h (Origin)',
    color: Colors.coralWatermelonVivid,
    x: 45,
    y: 35,
  },
  {
    id: 'patiala',
    name: 'Patiala Sub-Belt',
    role: 'Secondary Emitter (Punjab)',
    latitude: 30.3398, longitude: 76.3869, aqi: null, pm25: null, frp: null, windSpeed: null,
    eta: 'T+18h (Advection)',
    color: Colors.aqiUnhealthy,
    x: 105,
    y: 80,
  },
  {
    id: 'karnal',
    name: 'Karnal Gate',
    role: 'Midpoint Transit Corridor (NH-44)',
    latitude: 29.6857, longitude: 76.9905, aqi: null, pm25: null, frp: null, windSpeed: null,
    eta: 'T+36h (Midpoint)',
    color: Colors.aqiModerate,
    x: 170,
    y: 125,
  },
  {
    id: 'panipat',
    name: 'Panipat Choke Point',
    role: 'Atmospheric Compression Gate',
    latitude: 29.3909, longitude: 76.9635, aqi: null, pm25: null, frp: null, windSpeed: null,
    eta: 'T+54h (Choke Point)',
    color: Colors.aqiUnhealthy,
    x: 235,
    y: 170,
  },
  {
    id: 'delhi',
    name: 'Delhi NCR Basin',
    role: 'Nocturnal Subsidence Sink',
    latitude: 28.6139, longitude: 77.209, aqi: null, pm25: null, frp: null, windSpeed: null,
    eta: 'T+72h (Basin Sink)',
    color: Colors.aqiHazardous,
    x: 295,
    y: 220,
  },
];

export const AirCorridorMapScreen: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(NODES[0].id);
  const [selectedSegment, setSelectedSegment] = useState<'origin' | 'transit' | 'sink'>('origin');
  const [trajectoryHours, setTrajectoryHours] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [plumeData, setPlumeData] = useState<PlumeResponse | null>(null);
  const [sensorCount, setSensorCount] = useState<number | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [meteoData, setMeteoData] = useState<MeteorologyResponse | null>(null);
  const [canvasLayout, setCanvasLayout] = useState<{ width: number; height: number }>({ width: 340, height: 260 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [layers, setLayers] = useState({
    frp: true,
    grid: true,
    plume: true,
  });

  // Interactive Pan & Zoom state (DEC-008 viewport interactivity)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mapMode, setMapMode] = useState<'flow' | 'inspector'>('flow');
  const [showMapLibreInfo, setShowMapLibreInfo] = useState<boolean>(false);
  const [selectedGridPoint, setSelectedGridPoint] = useState<SurfaceGridFeature | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoomScale((z) => Math.min(3.0, Number((z + 0.5).toFixed(1))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((z) => {
      const next = Math.max(1.0, Number((z - 0.5).toFixed(1)));
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetView = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleCenterOnNode = useCallback((node: CorridorNode) => {
    setZoomScale(1.8);
    const targetX = (170 - node.x) * 0.45;
    const targetY = (130 - node.y) * 0.45;
    setPanOffset({ x: targetX, y: targetY });
    setSelectedNodeId(node.id);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => zoomScale > 1.0,
        onMoveShouldSetPanResponder: (_, gesture) =>
          zoomScale > 1.0 && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
        onPanResponderMove: (_, gesture) => {
          if (zoomScale > 1.0) {
            const maxPanX = 75 * (zoomScale - 1);
            const maxPanY = 60 * (zoomScale - 1);
            setPanOffset((prev) => ({
              x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + gesture.dx * 0.05)),
              y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + gesture.dy * 0.05)),
            }));
          }
        },
      }),
    [zoomScale]
  );

  // 72h Forward Scrubber simulation timer matching web
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTrajectoryHours((prev) => {
        const next = prev >= 72 ? 0 : Number((prev + 2).toFixed(1));
        if (next < 18) {
          setSelectedSegment('origin');
          setSelectedNodeId('sangrur');
        } else if (next < 36) {
          setSelectedSegment('origin');
          setSelectedNodeId('patiala');
        } else if (next < 54) {
          setSelectedSegment('transit');
          setSelectedNodeId('karnal');
        } else if (next < 68) {
          setSelectedSegment('transit');
          setSelectedNodeId('panipat');
        } else {
          setSelectedSegment('sink');
          setSelectedNodeId('delhi');
        }
        return next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Ambient continuous corridor flow animation (3 gentle advection pulses)
  const [ambientFlowPhase, setAmbientFlowPhase] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setAmbientFlowPhase((prev) => (prev >= 1 ? 0 : Number((prev + 0.02).toFixed(3))));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [hotspotsRes, meteoRes, plumeRes, biomassRes, sensorsRes, surfaceRes] = await Promise.allSettled([
        fetchHotspots(24, 'nominal'),
        fetchMeteorology(),
        fetchForecastPlume(),
        fetchBiomassEmissions(7),
        fetchSensorThings(),
        fetchAqiSurface(0.5),
      ]);

      if (hotspotsRes.status === 'fulfilled') setHotspots(hotspotsRes.value);
      if (meteoRes.status === 'fulfilled') setMeteoData(meteoRes.value);
      if (plumeRes.status === 'fulfilled') setPlumeData(plumeRes.value);
      if (biomassRes.status === 'fulfilled') setBiomassData(biomassRes.value);
      if (sensorsRes.status === 'fulfilled') setSensorCount(sensorsRes.value['@iot.count']);
      if (surfaceRes.status === 'fulfilled') setSurfaceData(surfaceRes.value);
    } catch (err: unknown) {
      console.warn('[AirCorridorMap] loadData:', err instanceof Error ? err.message : err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectSegment = (segment: 'origin' | 'transit' | 'sink') => {
    setSelectedSegment(segment);
    if (segment === 'origin') {
      setSelectedNodeId('sangrur');
      setTrajectoryHours(0);
    } else if (segment === 'transit') {
      setSelectedNodeId('karnal');
      setTrajectoryHours(36);
    } else {
      setSelectedNodeId('delhi');
      setTrajectoryHours(72);
    }
  };

  const handleSelectNode = useCallback((node: CorridorNode) => {
    setSelectedNodeId(node.id);
    const nodeHoursMap: Record<string, number> = {
      sangrur: 0,
      patiala: 18,
      karnal: 36,
      panipat: 54,
      delhi: 72,
    };
    const hours = nodeHoursMap[node.id] ?? 0;
    setTrajectoryHours(hours);
    if (hours < 18) setSelectedSegment('origin');
    else if (hours < 54) setSelectedSegment('transit');
    else setSelectedSegment('sink');
  }, []);

  const handleSetTrajectoryHours = useCallback((hours: number) => {
    const clamped = Math.max(0, Math.min(72, hours));
    setTrajectoryHours(clamped);
    if (clamped < 18) {
      setSelectedSegment('origin');
      setSelectedNodeId('sangrur');
    } else if (clamped < 36) {
      setSelectedSegment('origin');
      setSelectedNodeId('patiala');
    } else if (clamped < 54) {
      setSelectedSegment('transit');
      setSelectedNodeId('karnal');
    } else if (clamped < 68) {
      setSelectedSegment('transit');
      setSelectedNodeId('panipat');
    } else {
      setSelectedSegment('sink');
      setSelectedNodeId('delhi');
    }
  }, []);

  const punjabBiomass = biomassData?.regions?.find((r) => r.region === 'Punjab');
  const totalFrp = biomassData?.regions?.reduce((sum, r) => sum + r.frp_sum_mw, 0);

  const nodes = useMemo(() => NODES.map((node) => {
    const point = surfaceData?.features.reduce<SurfaceGridFeature | null>((best, feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const distance = (lat - node.latitude) ** 2 + (lon - node.longitude) ** 2;
      if (!best) return feature;
      const [bestLon, bestLat] = best.geometry.coordinates;
      return distance < (bestLat - node.latitude) ** 2 + (bestLon - node.longitude) ** 2 ? feature : best;
    }, null);
    const nearbyFires = hotspots?.features.filter((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      return Math.hypot((lat - node.latitude) * 111, (lon - node.longitude) * 98) <= 100;
    }) ?? [];
    const frp = hotspots ? nearbyFires.reduce((sum, feature) => sum + (feature.properties.frp ?? 0), 0) : null;
    const region = node.id === 'sangrur' || node.id === 'patiala' ? meteoData?.regions.punjab : meteoData?.regions.delhi;
    const aqi = point?.properties.aqi_index ?? null;
    return {
      ...node,
      pm25: point?.properties.pm25_estimate ?? null,
      aqi,
      frp,
      windSpeed: region ? region.wind_speed_ms * 3.6 : null,
      color: aqi !== null ? getAqiCategoryAndColor(aqi).color : Colors.inkMuted,
    };
  }), [hotspots, meteoData, surfaceData]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];

  // Accurate piecewise corridor trajectory position (always traverses Sangrur -> Patiala -> Karnal -> Panipat -> Delhi)
  const particlePos = useMemo(() => getCorridorTrajectoryPoint(trajectoryHours), [trajectoryHours]);

  // Ambient continuous flow particles along the corridor chute
  const ambientParticles = useMemo(() => {
    return [0, 0.33, 0.67].map((offset) => {
      const phase = (ambientFlowPhase + offset) % 1;
      return getCorridorTrajectoryPoint(phase * 72);
    });
  }, [ambientFlowPhase]);

  const scaleX = canvasLayout.width / 340;
  const scaleY = canvasLayout.height / 260;

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Air Corridor Map</Text>
            <Text style={styles.titleSparkle}>✦</Text>
          </View>
          <Text style={styles.screenSubtitle}>Synoptic NW-to-SE Dispersion Swath</Text>
        </View>
        <StarburstBadge label={hotspots ? "LIVE SATELLITE" : "DATA PENDING"} rotation="2deg" shadowColor={Colors.cobaltDeep} />
      </View>

      {/* Initial Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={Colors.terracottaDeep} />
          <Text style={styles.loadingBannerText}>Fetching synoptic corridor observations…</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.inkBlack}
            colors={[Colors.terracottaDeep]}
          />
        }
      >
        {/* Mode Selector Tabs (Corridor Flow vs Inspector) */}
        <View style={styles.modeTabsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to corridor flow view"
            onPress={() => setMapMode('flow')}
            style={[styles.modeTab, mapMode === 'flow' && styles.modeTabActive]}
          >
            <MaterialCommunityIcons
              name="weather-windy"
              size={14}
              color={mapMode === 'flow' ? Colors.canvasCream : Colors.inkBlack}
            />
            <Text style={[styles.modeTabText, mapMode === 'flow' && styles.modeTabTextActive]}>
              Corridor Flow
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to interactive grid & station inspector"
            onPress={() => {
              setMapMode('inspector');
              if (zoomScale === 1.0) setZoomScale(1.5);
            }}
            style={[styles.modeTab, mapMode === 'inspector' && styles.modeTabActive]}
          >
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={14}
              color={mapMode === 'inspector' ? Colors.canvasCream : Colors.inkBlack}
            />
            <Text style={[styles.modeTabText, mapMode === 'inspector' && styles.modeTabTextActive]}>
              Station & Grid Inspector
            </Text>
          </Pressable>
        </View>

        {/* Map Container Card */}
        <NeoCard backgroundColor={Colors.canvasCream} style={styles.mapCard}>
          {/* Topographic & Plume SVG Canvas with PanResponder & Zoom Matrix */}
          <View
            style={styles.svgContainer}
            {...panResponder.panHandlers}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setCanvasLayout({ width, height });
              }
            }}
          >
            {/* Floating Zoom & Pan Controls Bar */}
            <View style={styles.zoomControlBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={handleZoomIn}
                style={styles.zoomBtn}
              >
                <MaterialCommunityIcons name="plus" size={16} color={Colors.inkBlack} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={handleZoomOut}
                style={styles.zoomBtn}
              >
                <MaterialCommunityIcons name="minus" size={16} color={Colors.inkBlack} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset zoom to 1x"
                onPress={handleResetView}
                style={[styles.zoomBtn, zoomScale > 1.0 && styles.zoomBtnActive]}
              >
                <Text style={styles.zoomResetText}>{zoomScale.toFixed(1)}x</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Center view on selected node"
                onPress={() => handleCenterOnNode(selectedNode)}
                style={styles.zoomBtn}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={14} color={Colors.cobaltDeep} />
              </Pressable>
            </View>

            {zoomScale > 1.0 && (
              <View style={styles.zoomHintBadge}>
                <Text style={styles.zoomHintText}>Drag to pan corridor</Text>
              </View>
            )}

            <Svg width="100%" height={260} viewBox="0 0 340 260">
              <Defs>
                <LinearGradient id="plumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.55" />
                  <Stop offset="50%" stopColor="#FF5376" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#7C2D12" stopOpacity="0.6" />
                </LinearGradient>
                <LinearGradient id="corePlumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#DC2626" stopOpacity="0.65" />
                  <Stop offset="50%" stopColor="#EA580C" stopOpacity="0.45" />
                  <Stop offset="100%" stopColor="#991B1B" stopOpacity="0.55" />
                </LinearGradient>
              </Defs>

              {/* Background Dot Grid */}
              <Rect x="0" y="0" width="340" height="260" fill="#FAF6EE" />

              {/* Zoom & Pan Viewport Group */}
              <G originX={170} originY={130} scale={zoomScale} x={panOffset.x} y={panOffset.y}>
                {/* Atmospheric Inversion Topographic Contour Waves */}
                <Path d="M-20 40 Q60 10 140 45 T300 30 T360 60" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />
                <Path d="M-10 110 Q80 70 170 120 T360 95" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />
                <Path d="M-30 190 Q90 160 190 200 T380 180" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Smoke Plume Swath Band */}
                {layers.plume && (
                  <G testID="corridor-plume-swath">
                    {/* Outer Gaussian Dispersion Swath */}
                    <Path
                      d="M25 25 C75 35 95 95 140 110 C185 125 215 160 265 185 C305 205 335 230 340 255 C285 255 240 230 195 200 C150 170 110 130 65 95 C35 75 15 45 25 25 Z"
                      fill="url(#plumeGrad)"
                      opacity={0.65}
                    />
                    {/* High-Density Core Plume */}
                    <Path
                      d="M35 30 C80 45 105 85 145 115 C185 130 220 165 255 185 C290 205 315 225 320 245 C275 245 235 220 200 195 C160 165 125 125 85 90 C55 70 30 50 35 30 Z"
                      fill="url(#corePlumeGrad)"
                      opacity={0.4}
                    />
                  </G>
                )}

                {/* Corridor Central Transport Spine & Synoptic Wind Streamlines */}
                <G testID="corridor-flow-spine">
                  {/* Wide Soft Glow Conduit */}
                  <Path
                    d="M 45 35 L 105 80 L 170 125 L 235 170 L 295 220"
                    fill="none"
                    stroke="#EA580C"
                    strokeWidth={6}
                    strokeOpacity={0.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Dashed Transport Corridor Track */}
                  <Path
                    d="M 45 35 L 105 80 L 170 125 L 235 170 L 295 220"
                    fill="none"
                    stroke={Colors.inkBlack}
                    strokeWidth={1.8}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Directional Flow Arrows Along Corridor */}
                  <Polygon points="79,61 69,54 73,62" fill="#EA580C" />
                  <Polygon points="142,106 132,99 136,107" fill="#EA580C" />
                  <Polygon points="207,151 197,144 201,152" fill="#EA580C" />
                  <Polygon points="270,199 260,192 264,200" fill="#EA580C" />

                  {/* Flanking Synoptic Wind Streamlines */}
                  <Path
                    d="M 30 18 Q 110 55 165 95 T 290 190"
                    fill="none"
                    stroke="#1D4ED8"
                    strokeWidth={1.3}
                    strokeDasharray="5 3"
                    strokeOpacity={0.55}
                  />
                  <Polygon points="293,192 284,187 287,194" fill="#1D4ED8" opacity={0.65} />

                  <Path
                    d="M 60 55 Q 125 105 180 150 T 315 240"
                    fill="none"
                    stroke="#1D4ED8"
                    strokeWidth={1.3}
                    strokeDasharray="5 3"
                    strokeOpacity={0.55}
                  />
                  <Polygon points="318,242 309,237 312,244" fill="#1D4ED8" opacity={0.65} />

                  {/* Ambient Continuous Flow Markers */}
                  {ambientParticles.map((pt, idx) => (
                    <Circle
                      key={`ambient-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3}
                      fill="#EA580C"
                      opacity={0.8}
                    />
                  ))}
                </G>

                {/* Inspector Mode: Downscaled GPR grid dots */}
                {mapMode === 'inspector' && surfaceData?.features?.slice(0, 16).map((feat, idx) => {
                  const [lon, lat] = feat.geometry.coordinates;
                  // Map coordinates 75.0-78.0 lon -> 30-310 px, 28.0-31.0 lat -> 240-30 px
                  const gridX = Math.max(20, Math.min(320, 30 + ((lon - 75.0) / 3.0) * 280));
                  const gridY = Math.max(20, Math.min(240, 240 - ((lat - 28.0) / 3.0) * 210));
                  const isSelected = selectedGridPoint?.geometry.coordinates[0] === lon && selectedGridPoint?.geometry.coordinates[1] === lat;
                  return (
                    <G key={`grid-${idx}`}>
                      <Circle
                        cx={gridX}
                        cy={gridY}
                        r={isSelected ? 6 : 4}
                        fill={getAqiCategoryAndColor(feat.properties.aqi_index).color}
                        stroke={Colors.inkBlack}
                        strokeWidth={1}
                        opacity={0.85}
                      />
                    </G>
                  );
                })}

                {/* Forward Trajectory Interactive Pulse & Position Marker */}
                <G testID="corridor-flow-particle">
                  {/* Outer Pulsing Aura */}
                  <Circle
                    cx={particlePos.x}
                    cy={particlePos.y}
                    r={16}
                    fill={Colors.cobaltDeep}
                    opacity={0.22}
                  />
                  {/* Intermediate Ring */}
                  <Circle
                    cx={particlePos.x}
                    cy={particlePos.y}
                    r={10}
                    fill={Colors.cobaltDeep}
                    opacity={0.45}
                  />
                  {/* Solid Head */}
                  <Circle
                    cx={particlePos.x}
                    cy={particlePos.y}
                    r={6.5}
                    fill={Colors.cobaltDeep}
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                  />
                  {/* Floating Milestone Label Badge */}
                  <G
                    x={Math.max(22, Math.min(310, particlePos.x))}
                    y={Math.max(14, particlePos.y - 12)}
                  >
                    <Rect
                      x="-18"
                      y="-8"
                      width="36"
                      height="12"
                      rx="3"
                      fill={Colors.inkBlack}
                      opacity={0.88}
                    />
                    <SvgText
                      x="0"
                      y="1.5"
                      fontSize="7.5"
                      fontWeight="900"
                      fill={Colors.canvasCream}
                      textAnchor="middle"
                    >
                      T+{Math.round(trajectoryHours)}h
                    </SvgText>
                  </G>
                </G>

                {/* Trajectory Nodes on SVG (Always visible as core corridor milestones) */}
                {nodes.map((node) => {
                  const isSelected = selectedNode.id === node.id;
                  return (
                    <G
                      key={node.id}
                      testID={`corridor-node-${node.id}`}
                      onPress={() => handleSelectNode(node)}
                    >
                      {isSelected && (
                        <Circle cx={node.x} cy={node.y} r={16} fill={node.color} opacity={0.35} />
                      )}
                      <Circle
                        cx={node.x}
                        cy={node.y}
                        r={isSelected ? 10 : 8}
                        fill={node.color}
                        stroke={Colors.inkBlack}
                        strokeWidth={1.8}
                      />
                      <SvgText
                        x={node.x}
                        y={node.y + (node.id === 'sangrur' ? -13 : 18)}
                        fontSize="8.5"
                        fontWeight="bold"
                        fill={Colors.inkBlack}
                        textAnchor="middle"
                      >
                        {node.name.split(' ')[0]} {node.id === 'sangrur' ? '🔥' : ''}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            </Svg>

            {/* Interactive Node Touch Targets */}
            <View style={[styles.nodesOverlay, { pointerEvents: 'box-none' }]}>
              {nodes.map((node) => {
                const isSelected = selectedNode.id === node.id;
                const scaledX = (170 + (node.x - 170) * zoomScale + panOffset.x) * scaleX;
                const scaledY = (130 + (node.y - 130) * zoomScale + panOffset.y) * scaleY;
                return (
                  <Pressable
                    key={node.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${node.name} corridor node`}
                    onPress={() => handleSelectNode(node)}
                    style={[
                      styles.nodeTouchTarget,
                      {
                        left: Math.round(scaledX) - 30,
                        top: Math.round(scaledY) + 12,
                      },
                      isSelected && styles.nodeTouchTargetActive,
                    ]}
                  >
                    <Text style={[styles.nodeTouchText, isSelected && styles.nodeTouchTextActive]}>
                      {node.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Scale watermark */}
            <View style={styles.mapWatermark}>
              <Text style={styles.watermarkText}>NW (315°) → SE (135°) Synoptic Chute • 1:2.4M</Text>
            </View>
          </View>

          {/* 72h Forward Trajectory Transit Scrubber Bar */}
          <View style={styles.scrubberBox}>
            <View style={styles.scrubberHeader}>
              <View style={styles.scrubberPlayRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause forward trajectory animation' : 'Play forward trajectory animation'}
                  onPress={() => setIsPlaying(!isPlaying)}
                  style={styles.playBtn}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={16}
                    color={Colors.canvasCream}
                  />
                </Pressable>
                <Text style={styles.scrubberTitle}>Forward Trajectory Scrubber</Text>
              </View>
              <Text style={styles.scrubberHoursVal}>T + {trajectoryHours.toFixed(1)}h</Text>
            </View>

            {/* Progress track */}
            <View style={styles.scrubberTrack}>
              <View
                style={[
                  styles.scrubberFill,
                  { width: `${Math.min(100, Math.max(0, (trajectoryHours / 72) * 100))}%` as DimensionValue },
                ]}
              />
            </View>

            {/* Step jump buttons for all 5 corridor milestones */}
            <View style={styles.scrubberPillsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jump to Origin T+0 hours"
                onPress={() => { handleSetTrajectoryHours(0); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 0 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 0 && styles.scrubberPillTextActive]}>
                  Origin (0h)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jump to Patiala T+18 hours"
                onPress={() => { handleSetTrajectoryHours(18); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 18 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 18 && styles.scrubberPillTextActive]}>
                  Patiala (18h)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jump to Midpoint T+36 hours"
                onPress={() => { handleSetTrajectoryHours(36); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 36 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 36 && styles.scrubberPillTextActive]}>
                  Midpoint (36h)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jump to Panipat T+54 hours"
                onPress={() => { handleSetTrajectoryHours(54); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 54 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 54 && styles.scrubberPillTextActive]}>
                  Panipat (54h)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jump to Basin Sink T+72 hours"
                onPress={() => { handleSetTrajectoryHours(72); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 72 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 72 && styles.scrubberPillTextActive]}>
                  Basin Sink (72h)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Geospatial Layer Switcher Chips */}
          <View style={styles.layerSwitcher}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle fire radiative power hotspots layer"
              onPress={() => toggleLayer('frp')}
              style={[styles.layerChip, layers.frp && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="fire" size={14} color={layers.frp ? Colors.canvasCream : Colors.terracottaDeep} />
              <Text style={[styles.layerChipText, layers.frp && styles.layerChipTextActive]}>
                FRP Hotspots ({hotspots?.count ?? 'N/A'})
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle GPR PM2.5 grid layer"
              onPress={() => toggleLayer('grid')}
              style={[styles.layerChip, layers.grid && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="grid" size={14} color={layers.grid ? Colors.canvasCream : Colors.inkBlack} />
              <Text style={[styles.layerChipText, layers.grid && styles.layerChipTextActive]}>
                GPR PM2.5 Grid
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle plume swath layer"
              onPress={() => toggleLayer('plume')}
              style={[styles.layerChip, layers.plume && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="weather-windy" size={14} color={layers.plume ? Colors.canvasCream : Colors.cobaltDeep} />
              <Text style={[styles.layerChipText, layers.plume && styles.layerChipTextActive]}>
                Plume Swath ({plumeData?.features.length ? `${plumeData.features.length} live` : 'Active'})
              </Text>
            </Pressable>

            <View style={styles.sensorBadgeChip}>
              <MaterialCommunityIcons name="radio-tower" size={12} color={Colors.forestJade} />
              <Text style={styles.sensorBadgeText}>Sensors: {sensorCount ?? 'N/A'}</Text>
            </View>
          </View>
        </NeoCard>

        {/* Corridor 3-Segment Tabs Selector */}
        <View style={styles.segmentSelector}>
          <Pressable
            onPress={() => handleSelectSegment('origin')}
            style={[styles.segmentBtn, selectedSegment === 'origin' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, selectedSegment === 'origin' && styles.segmentBtnTextActive]}>
              01. Upwind Origin
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSelectSegment('transit')}
            style={[styles.segmentBtn, selectedSegment === 'transit' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, selectedSegment === 'transit' && styles.segmentBtnTextActive]}>
              02. Transit Belt
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSelectSegment('sink')}
            style={[styles.segmentBtn, selectedSegment === 'sink' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, selectedSegment === 'sink' && styles.segmentBtnTextActive]}>
              03. Receptor Sink
            </Text>
          </Pressable>
        </View>

        {/* Selected Corridor Segment Ledger Detail Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.segmentCard}>
          {selectedSegment === 'origin' && (
            <View style={styles.segmentContent}>
              <View style={styles.segmentCardTop}>
                <Text style={styles.segmentCardZone}>SOURCE ZONE • PUNJAB MALWA</Text>
                <View style={[styles.statusDot, { backgroundColor: Colors.terracottaDeep }]} />
              </View>
              <Text style={styles.segmentCardHeading}>Punjab Biomass Harvest Ignition</Text>
              <Text style={styles.segmentCardBody}>
                {totalFrp == null ? 'Current regional fire-radiative-power data is unavailable.' : `NASA FIRMS observations total ${totalFrp.toFixed(1)} MW of fire radiative power across the agricultural corridor.`}
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Aerosol Emission Rate:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.terracottaDeep }]}>
                  {punjabBiomass?.estimated_aerosol_kg_s != null ? `${punjabBiomass.estimated_aerosol_kg_s.toFixed(2)} kg/s` : 'Not configured'}
                </Text>
              </View>
            </View>
          )}

          {selectedSegment === 'transit' && (
            <View style={styles.segmentContent}>
              <View style={styles.segmentCardTop}>
                <Text style={[styles.segmentCardZone, { color: Colors.cobaltDeep }]}>TRANSIT CHANNEL • NH-44 SPINE</Text>
                <View style={[styles.statusDot, { backgroundColor: Colors.cobaltDeep }]} />
              </View>
              <Text style={styles.segmentCardHeading}>Karnal-Panipat Secondary Aerosol Conversion</Text>
              <Text style={styles.segmentCardBody}>
                This corridor view follows the configured route between the Punjab source region and Delhi. The backend supplies the current wind vector; chemical conversion is not measured by this endpoint.
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Advection Velocity:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.cobaltDeep }]}>
                  {meteoData?.regions?.punjab
                    ? `${meteoData.regions.punjab.wind_speed_ms.toFixed(1)} m/s from ${Math.round(meteoData.regions.punjab.wind.direction_from_deg)}°`
                    : 'Data unavailable'}
                </Text>
              </View>
            </View>
          )}

          {selectedSegment === 'sink' && (
            <View style={styles.segmentContent}>
              <View style={styles.segmentCardTop}>
                <Text style={[styles.segmentCardZone, { color: Colors.coralWatermelonVivid }]}>RECEPTOR SINK • DELHI NCR BASIN</Text>
                <View style={[styles.statusDot, { backgroundColor: Colors.coralWatermelonVivid }]} />
              </View>
              <Text style={styles.segmentCardHeading}>Delhi Nocturnal Subsidence Trap</Text>
              <Text style={styles.segmentCardBody}>
                The current mixing-layer height and backend inversion status are shown below. The endpoint does not directly measure inversion severity.
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Inversion Severity / Mixing Layer:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.aqiHazardous }]}>
                  {meteoData ? `${formatBackendStatus(meteoData.inversion.status)} • ${Math.round(meteoData.regions.delhi.mixing_layer_height_m_agl)}m AGL` : 'Data unavailable'}
                </Text>
              </View>
            </View>
          )}
        </NeoCard>

        {/* Selected Node Inspector Drawer Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.inspectorCard}>
          <View style={styles.inspectorHeader}>
            <View>
              <View style={styles.inspectorTitleRow}>
                <Text style={styles.inspectorNodeName}>{selectedNode.name}</Text>
                <View style={[styles.nodeRoleChip, { backgroundColor: selectedNode.color }]}>
                  <Text style={styles.nodeRoleChipText}>{selectedNode.eta}</Text>
                </View>
              </View>
              <Text style={styles.inspectorRoleText}>{selectedNode.role}</Text>
            </View>

            <View style={styles.inspectorAqiBadge}>
              <Text style={styles.inspectorAqiValue}>{selectedNode.aqi ?? 'N/A'}</Text>
              <Text style={styles.inspectorAqiLabel}>AQI</Text>
            </View>
          </View>

          {/* Metric Grid */}
          <View style={styles.inspectorMetricsGrid}>
            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Particulate Mass</Text>
              <Text style={styles.metricVal}>{selectedNode.pm25 != null ? selectedNode.pm25.toFixed(1) : 'N/A'} <Text style={styles.metricUnit}>µg/m³ model</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Wind Velocity</Text>
              <Text style={styles.metricVal}>{selectedNode.windSpeed != null ? selectedNode.windSpeed.toFixed(1) : 'N/A'} <Text style={styles.metricUnit}>km/h</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Thermal Radiation</Text>
              <Text style={styles.metricVal}>{selectedNode.frp != null ? selectedNode.frp.toFixed(1) : 'N/A'} <Text style={styles.metricUnit}>MW within 100 km</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Dispersion Status</Text>
              <Text style={[styles.metricVal, { color: selectedNode.color }]}>{surfaceData ? 'Model available' : 'Data unavailable'}</Text>
            </View>
          </View>
        </NeoCard>

        {/* Downscaled Surface Grid Field */}
        {layers.grid && surfaceData && surfaceData.features?.length > 0 && (
          <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.surfaceCard}>
            <View style={styles.surfaceHeader}>
              <View style={styles.surfaceTitleRow}>
                <MaterialCommunityIcons name="grain" size={16} color={Colors.cobaltDeep} />
                <Text style={styles.surfaceTitle}>Downscaled Surface Grid</Text>
              </View>
              <Text style={styles.surfaceCountText}>{surfaceData.features.length} Nodes (±{surfaceData.resolution_deg}°)</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.surfaceRow}>
              {surfaceData.features.slice(0, 8).map((feat: SurfaceGridFeature, idx: number) => {
                const [lon, lat] = feat.geometry.coordinates;
                const p = feat.properties;
                return (
                  <View key={idx} style={styles.surfaceNodeBox}>
                    <Text style={styles.surfaceCoordText}>{lat.toFixed(1)}°N {lon.toFixed(1)}°E</Text>
                    <Text style={styles.surfacePmVal}>{Math.round(p.pm25_estimate)} <Text style={styles.surfacePmUnit}>µg/m³</Text></Text>
                    <Text style={[styles.surfaceAqiVal, { color: p.aqi_index > 300 ? Colors.terracottaDeep : Colors.inkBlack }]}>
                      AQI {p.aqi_index}
                    </Text>
                    {p.uncertainty_std != null && (
                      <Text style={styles.surfaceUncertainty}>±{p.uncertainty_std.toFixed(1)} σ</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </NeoCard>
        )}

        {/* Corridor Synopsis Card */}
        <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.synopsisCard}>
          <View style={styles.synopsisHeader}>
            <MaterialCommunityIcons name="information-outline" size={18} color={Colors.inkBlack} />
            <Text style={styles.synopsisTitle}>Synoptic Ingress Analysis</Text>
          </View>
          <Text style={styles.synopsisBody}>
            {meteoData
              ? `The configured corridor is shown with current Open-Meteo wind inputs (${meteoData.regions.punjab.wind_speed_ms.toFixed(1)} m/s in Punjab and ${meteoData.regions.delhi.wind_speed_ms.toFixed(1)} m/s in Delhi) and a Delhi mixing height of ${Math.round(meteoData.regions.delhi.mixing_layer_height_m_agl)} m. Forecast envelopes are model estimates, not direct plume observations.`
              : 'Current meteorological inputs are unavailable. The route remains a geographic corridor reference.'}
          </Text>
        </NeoCard>

        {/* Native Cartography & MapLibre Bridge Architecture (DEC-008) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle native MapLibre cartography architecture details"
          onPress={() => setShowMapLibreInfo((prev) => !prev)}
          style={styles.mapLibreToggle}
        >
          <View style={styles.mapLibreToggleLeft}>
            <MaterialCommunityIcons name="layers-triple-outline" size={16} color={Colors.cobaltDeep} />
            <Text style={styles.mapLibreToggleText}>Native Vector Cartography (DEC-008 Bridge)</Text>
          </View>
          <MaterialCommunityIcons
            name={showMapLibreInfo ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.inkBlack}
          />
        </Pressable>

        {showMapLibreInfo && (
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.mapLibreCard}>
            <Text style={styles.mapLibreHeading}>DEC-008 Architecture & Prebuild Instructions</Text>
            <Text style={styles.mapLibreBody}>
              • Current runtime uses scalable vector SVG with pinch/zoom gestures to guarantee 100% zero-config portability across Expo Go and web.{'\n'}
              • To build hardware-accelerated 60fps vector tile maps with MapLibre GL Native on physical Android & iOS devices:{'\n'}
              {'   '}1. Run: npx expo prebuild{'\n'}
              {'   '}2. Add: @maplibre/maplibre-react-native to package.json plugins{'\n'}
              {'   '}3. Configure offline corridor tile packs for rural Punjab/Haryana monitoring.
            </Text>
          </NeoCard>
        )}

        <View style={{ height: 165 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 9,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  loadingBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3D7',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.inkBlack,
    letterSpacing: -0.5,
  },
  titleSparkle: {
    fontSize: 16,
    color: Colors.coralWatermelonVivid,
    fontWeight: '900',
  },
  screenSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  mapCard: {
    padding: 10,
  },
  svgContainer: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    overflow: 'hidden',
    position: 'relative',
  },
  nodesOverlay: {
    ...StyleSheet.absoluteFill,
  },
  nodeTouchTarget: {
    position: 'absolute',
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  nodeTouchTargetActive: {
    backgroundColor: Colors.inkBlack,
  },
  nodeTouchText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  nodeTouchTextActive: {
    color: Colors.canvasCream,
  },
  mapWatermark: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: '#FAF6EECC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  watermarkText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  layerSwitcher: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  layerChipActive: {
    backgroundColor: Colors.inkBlack,
  },
  layerChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  layerChipTextActive: {
    color: Colors.canvasCream,
  },
  inspectorCard: {
    padding: 14,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 10,
    marginBottom: 10,
  },
  inspectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inspectorNodeName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  nodeRoleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  nodeRoleChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  inspectorRoleText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    marginTop: 2,
  },
  inspectorAqiBadge: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  inspectorAqiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.coralWatermelonVivid,
  },
  inspectorAqiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  inspectorMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inspectorMetricItem: {
    width: '47%',
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 8,
    padding: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkBlack,
    marginTop: 2,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  synopsisCard: {
    padding: 12,
  },
  synopsisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  synopsisTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  synopsisBody: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  scrubberBox: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  scrubberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrubberPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubberTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  scrubberHoursVal: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.cobaltDeep,
  },
  scrubberTrack: {
    height: 6,
    backgroundColor: '#E4E1E6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: Colors.cobaltDeep,
    borderRadius: 3,
  },
  scrubberPillsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  scrubberPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.canvasCream,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  scrubberPillActive: {
    backgroundColor: Colors.inkBlack,
  },
  scrubberPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  scrubberPillTextActive: {
    color: Colors.canvasCream,
  },
  sensorBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sensorBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  segmentSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.inkBlack,
  },
  segmentBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  segmentBtnTextActive: {
    color: Colors.canvasCream,
  },
  segmentCard: {
    padding: 12,
  },
  segmentContent: {
    gap: 6,
  },
  segmentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentCardZone: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.terracottaDeep,
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentCardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  segmentCardBody: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  segmentDivider: {
    height: 1,
    backgroundColor: '#E8E3D7',
    marginVertical: 4,
  },
  segmentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  segmentMetaVal: {
    fontSize: 11,
    fontWeight: '900',
  },
  surfaceCard: {
    padding: 12,
    gap: 8,
  },
  surfaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surfaceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  surfaceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  surfaceCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  surfaceRow: {
    gap: 8,
    paddingVertical: 2,
  },
  surfaceNodeBox: {
    backgroundColor: Colors.canvasCream,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 8,
    padding: 8,
    width: 100,
    gap: 2,
  },
  surfaceCoordText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  surfacePmVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  surfacePmUnit: {
    fontSize: 8,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  surfaceAqiVal: {
    fontSize: 10,
    fontWeight: '800',
  },
  surfaceUncertainty: {
    fontSize: 9,
    color: Colors.inkMuted,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
  },
  modeTabActive: {
    backgroundColor: Colors.inkBlack,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  modeTabTextActive: {
    color: Colors.canvasCream,
  },
  zoomControlBar: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 246, 238, 0.95)',
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 8,
    padding: 2,
    gap: 2,
    zIndex: 20,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: Colors.surfaceVanilla,
  },
  zoomBtnActive: {
    backgroundColor: Colors.surfaceVanillaStrong,
  },
  zoomResetText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 15,
  },
  zoomHintText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.canvasCream,
  },
  mapLibreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  mapLibreToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapLibreToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  mapLibreCard: {
    padding: 12,
    gap: 6,
    marginTop: 6,
  },
  mapLibreHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.cobaltDeep,
  },
  mapLibreBody: {
    fontSize: 10.5,
    lineHeight: 16,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
});
