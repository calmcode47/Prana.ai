import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop, Circle, Polygon, G } from 'react-native-svg';
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
} from '../api/client';

interface CorridorNode {
  id: string;
  name: string;
  role: string;
  aqi: number;
  pm25: number;
  frp: number;
  windSpeed: number;
  eta: string;
  color: string;
  x: number;
  y: number;
}

const NODES: CorridorNode[] = [
  {
    id: 'sangrur',
    name: 'Sangrur Cluster',
    role: 'NW Primary Emitter (Punjab)',
    aqi: 420,
    pm25: 412,
    frp: 38.4,
    windSpeed: 28,
    eta: 'T+0h (Origin)',
    color: Colors.coralWatermelonVivid,
    x: 45,
    y: 35,
  },
  {
    id: 'patiala',
    name: 'Patiala Sub-Belt',
    role: 'Secondary Emitter',
    aqi: 380,
    pm25: 285,
    frp: 18.2,
    windSpeed: 24,
    eta: 'T+9h',
    color: Colors.aqiUnhealthy,
    x: 105,
    y: 80,
  },
  {
    id: 'karnal',
    name: 'Karnal Gate',
    role: 'Midpoint Transit Corridor (NH-44)',
    aqi: 360,
    pm25: 190,
    frp: 8.5,
    windSpeed: 20,
    eta: 'T+22h',
    color: Colors.aqiModerate,
    x: 170,
    y: 125,
  },
  {
    id: 'panipat',
    name: 'Panipat Choke Point',
    role: 'Atmospheric Compression Gate',
    aqi: 390,
    pm25: 240,
    frp: 4.2,
    windSpeed: 16,
    eta: 'T+38h',
    color: Colors.aqiUnhealthy,
    x: 235,
    y: 170,
  },
  {
    id: 'delhi',
    name: 'Delhi NCR Basin',
    role: 'Nocturnal Subsidence Sink',
    aqi: 445,
    pm25: 520,
    frp: 0,
    windSpeed: 10,
    eta: 'T+72h (Receptor)',
    color: Colors.aqiHazardous,
    x: 295,
    y: 220,
  },
];

export const AirCorridorMapScreen: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<CorridorNode>(NODES[0]);
  const [selectedSegment, setSelectedSegment] = useState<'origin' | 'transit' | 'sink'>('origin');
  const [trajectoryHours, setTrajectoryHours] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hotspotsCount, setHotspotsCount] = useState<number>(247);
  const [liveWindDelhi, setLiveWindDelhi] = useState<number>(10);
  const [liveWindPunjab, setLiveWindPunjab] = useState<number>(28);
  const [clustersCount, setClustersCount] = useState<number>(3);
  const [sensorCount, setSensorCount] = useState<number>(12);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [meteoData, setMeteoData] = useState<MeteorologyResponse | null>(null);

  const [layers, setLayers] = useState({
    frp: true,
    grid: true,
    plume: true,
  });

  // 72h Forward Scrubber simulation timer matching web
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTrajectoryHours((prev) => (prev >= 72 ? 0 : Number((prev + 2).toFixed(1))));
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    fetchHotspots(24, 'nominal')
      .then((res) => {
        if (res && typeof res.count === 'number' && res.count > 0) {
          setHotspotsCount(res.count);
        }
      })
      .catch(() => {});

    fetchMeteorology()
      .then((res) => {
        setMeteoData(res);
        if (res?.regions?.delhi?.wind_speed_ms) {
          setLiveWindDelhi(Math.round(res.regions.delhi.wind_speed_ms * 3.6));
        }
        if (res?.regions?.punjab?.wind_speed_ms) {
          setLiveWindPunjab(Math.round(res.regions.punjab.wind_speed_ms * 3.6));
        }
      })
      .catch(() => {});

    fetchForecastPlume()
      .then((res) => {
        if (res?.clusters_evaluated) {
          setClustersCount(res.clusters_evaluated);
        }
      })
      .catch(() => {});

    fetchBiomassEmissions(7)
      .then(setBiomassData)
      .catch(() => {});

    fetchSensorThings()
      .then((res: SensorThingsResponse) => {
        if (res?.['@iot.count']) {
          setSensorCount(res['@iot.count']);
        }
      })
      .catch(() => {});

    fetchAqiSurface(0.5)
      .then(setSurfaceData)
      .catch(() => {});
  }, []);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectSegment = (segment: 'origin' | 'transit' | 'sink') => {
    setSelectedSegment(segment);
    if (segment === 'origin') {
      setSelectedNode(NODES[0]);
      setTrajectoryHours(0);
    } else if (segment === 'transit') {
      setSelectedNode(NODES[2]);
      setTrajectoryHours(24);
    } else {
      setSelectedNode(NODES[4]);
      setTrajectoryHours(72);
    }
  };

  const punjabBiomass = biomassData?.regions?.find((r) => r.region === 'Punjab');
  const totalFrp = biomassData?.regions?.reduce((sum, r) => sum + r.frp_sum_mw, 0);

  // Dynamic particle coordinates based on trajectoryHours (0 to 72h)
  const particleProgress = trajectoryHours / 72;
  // Route from (45, 35) through (170, 125) to (295, 220)
  const particleX = 45 + particleProgress * (295 - 45);
  const particleY = 35 + Math.sin(particleProgress * Math.PI * 0.9) * 100 + particleProgress * 85;

  const getEffectiveWindSpeed = (nodeId: string) => {
    if (nodeId === 'delhi') return liveWindDelhi;
    if (nodeId === 'sangrur' || nodeId === 'patiala') return liveWindPunjab;
    return Math.round((liveWindPunjab + liveWindDelhi) / 2);
  };

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
        <StarburstBadge label="LIVE SATELLITE" rotation="2deg" shadowColor={Colors.cobaltDeep} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Container Card */}
        <NeoCard backgroundColor={Colors.canvasCream} style={styles.mapCard}>
          {/* Topographic & Plume SVG Canvas */}
          <View style={styles.svgContainer}>
            <Svg width="100%" height={260} viewBox="0 0 340 260">
              <Defs>
                <LinearGradient id="plumeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
                  <Stop offset="50%" stopColor="#FF5376" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#7C2D12" stopOpacity="0.5" />
                </LinearGradient>
              </Defs>

              {/* Background Dot Grid */}
              <Rect x="0" y="0" width="340" height="260" fill="#FAF6EE" />

              {/* Atmospheric Inversion Topographic Contour Waves */}
              <Path d="M-20 40 Q60 10 140 45 T300 30 T360 60" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />
              <Path d="M-10 110 Q80 70 170 120 T360 95" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />
              <Path d="M-30 190 Q90 160 190 200 T380 180" fill="none" stroke="#E4E1E6" strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Smoke Plume Swath Band */}
              {layers.plume && (
                <Path
                  d="M25 30 C75 40 95 100 140 115 C185 130 215 170 265 195 C305 215 335 240 340 260 C290 260 245 235 200 205 C155 175 115 135 70 100 C40 80 15 50 25 30 Z"
                  fill="url(#plumeGrad)"
                />
              )}

              {/* Wind Vector Streamlines */}
              <Path d="M40 40 Q95 70 135 105" stroke="#18181B" strokeWidth="1.5" strokeDasharray="5 3" />
              <Polygon points="138,107 130,101 132,108" fill="#18181B" />

              <Path d="M135 105 Q190 140 220 165" stroke="#18181B" strokeWidth="1.5" strokeDasharray="5 3" />
              <Polygon points="223,167 215,161 217,168" fill="#18181B" />

              <Path d="M220 165 Q265 200 310 240" stroke="#18181B" strokeWidth="1.5" strokeDasharray="5 3" />
              <Polygon points="313,242 305,236 307,243" fill="#18181B" />

              {/* Dynamic Animated Particle Head following trajectory scrubber */}
              <Circle
                cx={particleX}
                cy={particleY}
                r={14}
                fill={Colors.cobaltDeep}
                opacity={0.3}
              />
              <Circle
                cx={particleX}
                cy={particleY}
                r={8}
                fill={Colors.cobaltDeep}
                stroke="#FFFFFF"
                strokeWidth={2.5}
              />

              {/* Trajectory Nodes on SVG */}
              {NODES.map((node) => {
                const isSelected = selectedNode.id === node.id;
                return (
                  <G key={node.id} onPress={() => setSelectedNode(node)}>
                    {isSelected && (
                      <Circle cx={node.x} cy={node.y} r={16} fill={node.color} opacity={0.3} />
                    )}
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={isSelected ? 10 : 8}
                      fill={node.color}
                      stroke={Colors.inkBlack}
                      strokeWidth={1.5}
                    />
                  </G>
                );
              })}
            </Svg>

            {/* Interactive Node Labels placed over map */}
            <View style={styles.nodesOverlay} pointerEvents="box-none">
              {NODES.map((node) => {
                const isSelected = selectedNode.id === node.id;
                return (
                  <Pressable
                    key={node.id}
                    onPress={() => setSelectedNode(node)}
                    style={[
                      styles.nodeTouchTarget,
                      { left: node.x - 30, top: node.y + 12 },
                      isSelected && styles.nodeTouchTargetActive,
                    ]}
                  >
                    <Text style={[styles.nodeTouchText, isSelected && styles.nodeTouchTextActive]}>
                      {node.name.split(' ')[0]} {node.id === 'sangrur' ? '🔥' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Scale watermark */}
            <View style={styles.mapWatermark}>
              <Text style={styles.watermarkText}>Scale: 1:2.4M • NW Inversion Layer</Text>
            </View>
          </View>

          {/* 72h Forward Trajectory Transit Scrubber Bar */}
          <View style={styles.scrubberBox}>
            <View style={styles.scrubberHeader}>
              <View style={styles.scrubberPlayRow}>
                <Pressable
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
                  { width: `${Math.min(100, Math.max(0, (trajectoryHours / 72) * 100))}%` as any },
                ]}
              />
            </View>

            {/* Step jump buttons */}
            <View style={styles.scrubberPillsRow}>
              <Pressable
                onPress={() => { setTrajectoryHours(0); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 0 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 0 && styles.scrubberPillTextActive]}>
                  T+0h Origin
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setTrajectoryHours(24); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 24 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 24 && styles.scrubberPillTextActive]}>
                  T+24h Transit
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setTrajectoryHours(48); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 48 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 48 && styles.scrubberPillTextActive]}>
                  T+48h Mid
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setTrajectoryHours(72); setIsPlaying(false); }}
                style={[styles.scrubberPill, trajectoryHours === 72 && styles.scrubberPillActive]}
              >
                <Text style={[styles.scrubberPillText, trajectoryHours === 72 && styles.scrubberPillTextActive]}>
                  T+72h Sink
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Geospatial Layer Switcher Chips */}
          <View style={styles.layerSwitcher}>
            <Pressable
              onPress={() => toggleLayer('frp')}
              style={[styles.layerChip, layers.frp && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="fire" size={14} color={layers.frp ? Colors.canvasCream : Colors.terracottaDeep} />
              <Text style={[styles.layerChipText, layers.frp && styles.layerChipTextActive]}>
                FRP Hotspots ({hotspotsCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => toggleLayer('grid')}
              style={[styles.layerChip, layers.grid && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="grid" size={14} color={layers.grid ? Colors.canvasCream : Colors.inkBlack} />
              <Text style={[styles.layerChipText, layers.grid && styles.layerChipTextActive]}>
                GPR PM2.5 Grid
              </Text>
            </Pressable>

            <Pressable
              onPress={() => toggleLayer('plume')}
              style={[styles.layerChip, layers.plume && styles.layerChipActive]}
            >
              <MaterialCommunityIcons name="weather-windy" size={14} color={layers.plume ? Colors.canvasCream : Colors.cobaltDeep} />
              <Text style={[styles.layerChipText, layers.plume && styles.layerChipTextActive]}>
                Plume Swath ({clustersCount} envel.)
              </Text>
            </Pressable>

            <View style={styles.sensorBadgeChip}>
              <MaterialCommunityIcons name="radio-tower" size={12} color={Colors.forestJade} />
              <Text style={styles.sensorBadgeText}>Sensors: {sensorCount}</Text>
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
                VIIRS observations record {totalFrp == null ? 'active' : `${totalFrp.toFixed(1)} MW`} fire radiative power across the agricultural corridor.
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Aerosol Emission Rate:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.terracottaDeep }]}>
                  {punjabBiomass?.estimated_aerosol_kg_s ? `${punjabBiomass.estimated_aerosol_kg_s.toFixed(2)} kg/s` : '3.80 kg/s'}
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
                Ammonia from agricultural fields mixes with urban NOx along the transport corridor, generating secondary inorganic aerosols.
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Advection Velocity:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.cobaltDeep }]}>
                  {meteoData?.regions?.punjab?.wind_speed_ms
                    ? `${meteoData.regions.punjab.wind_speed_ms.toFixed(1)} m/s from NW`
                    : '4.8 m/s from 315° NW'}
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
                Thermal inversion compresses the planetary boundary layer, capping surface particulate ventilation under calm wind regimes.
              </Text>
              <View style={styles.segmentDivider} />
              <View style={styles.segmentMetaRow}>
                <Text style={styles.segmentMetaLabel}>Inversion Severity / Mixing Layer:</Text>
                <Text style={[styles.segmentMetaVal, { color: Colors.aqiHazardous }]}>
                  {meteoData?.inversion?.status ?? 'STABLE'} • {meteoData?.regions?.delhi?.mixing_layer_height_m_agl ? `${Math.round(meteoData.regions.delhi.mixing_layer_height_m_agl)}m AGL` : '280m AGL'}
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
              <Text style={styles.inspectorAqiValue}>{selectedNode.aqi}</Text>
              <Text style={styles.inspectorAqiLabel}>AQI</Text>
            </View>
          </View>

          {/* Metric Grid */}
          <View style={styles.inspectorMetricsGrid}>
            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Particulate Mass</Text>
              <Text style={styles.metricVal}>{selectedNode.pm25} <Text style={styles.metricUnit}>µg/m³</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Wind Velocity</Text>
              <Text style={styles.metricVal}>{getEffectiveWindSpeed(selectedNode.id)} <Text style={styles.metricUnit}>km/h NW</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Thermal Radiation</Text>
              <Text style={styles.metricVal}>{selectedNode.frp} <Text style={styles.metricUnit}>MW FRP</Text></Text>
            </View>

            <View style={styles.inspectorMetricItem}>
              <Text style={styles.metricLabel}>Dispersion Status</Text>
              <Text style={[styles.metricVal, { color: selectedNode.color }]}>Compressed</Text>
            </View>
          </View>
        </NeoCard>

        {/* Downscaled Surface Grid Field */}
        {surfaceData && surfaceData.features?.length > 0 && (
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
            Smoke emitted in Sangrur and Patiala moves along the NH-44 highway transport spine. As nocturnal cooling sets in near Panipat, boundary layer compression traps smoke at &lt;300m before discharging into the Delhi NCR basin.
          </Text>
        </NeoCard>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
