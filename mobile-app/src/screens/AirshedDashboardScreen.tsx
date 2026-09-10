import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  DimensionValue,
} from 'react-native';
import Svg, { Path, Ellipse, Circle, G, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { NeoButton } from '../components/NeoButton';
import { DualUnitChip } from '../components/DualUnitChip';
import { StarburstBadge } from '../components/StarburstBadge';
import {
  fetchHotspots,
  fetchStations,
  fetchMeteorology,
  computeCpcbAqi,
  getAqiCategoryAndColor,
  fetchBiomassEmissions,
  fetchFireAqiLag,
  fetchAqiSurface,
  fetchSensorThings,
  queueLegalDispatch,
  createLegalNotice,
  createIncident,
  BiomassEmissionsResponse,
  FireAqiLagResponse,
  HotspotsResponse,
  MeteorologyResponse,
  StationThing,
  SurfaceGridResponse,
  WsMessage,
  formatDataSource,
  formatBackendStatus,
} from '../api/client';
import { getPreference, setPreference } from '../services/preferences';

export interface AirshedDashboardScreenProps {
  onOpenScanner: () => void;
  onNavigateCorridor: () => void;
  liveMessage?: WsMessage | null;
  insets?: { top: number; bottom: number; left: number; right: number };
}

export type CorridorNodeKey = 'pb_04' | 'transit_02' | 'delhi_09';

interface CorridorNodeData {
  id: string;
  name: string;
  category: string;
  state: string;
  coords: string;
  latitude: number;
  longitude: number;
  pm25: number | null;
  aqi: number | null;
  aqiCategory: string;
  aqiColor: string;
  wind: string;
  inversion: string;
  metric1: { label: string; val: string; sub: string };
  metric2: { label: string; val: string; sub: string };
  metric3: { label: string; val: string; sub: string };
  metric4: { label: string; val: string; sub: string };
  statusNote: string;
}

export const CORRIDOR_NODES: Record<CorridorNodeKey, CorridorNodeData> = {
  pb_04: {
    id: 'PB-STUBBLE-04',
    name: 'Punjab Agricultural Node 04',
    category: 'Upwind Origin Basin',
    state: 'Punjab (Sangrur Cluster)',
    coords: '30.2450°N, 75.8420°E',
    latitude: 30.245,
    longitude: 75.842,
    pm25: null, aqi: null, aqiCategory: 'Data pending', aqiColor: Colors.inkMuted,
    wind: 'Data pending', inversion: 'Data pending',
    metric1: { label: 'ACTIVE FIRE HOTSPOTS', val: 'N/A', sub: 'NASA FIRMS, last 24 hours' },
    metric2: { label: 'TOTAL FIRE RADIATIVE POWER', val: 'N/A', sub: 'NASA FIRMS' },
    metric3: { label: 'WIND', val: 'N/A', sub: 'Open-Meteo' },
    metric4: { label: 'PM2.5 SURFACE', val: 'N/A', sub: 'Backend model pending' },
    statusNote: 'Waiting for current backend observations.',
  },
  transit_02: {
    id: 'TR-CORRIDOR-02',
    name: 'Panipat NH-44 Highway Node',
    category: 'Transit Transport Channel',
    state: 'Haryana (Karnal-Panipat)',
    coords: '29.3909°N, 76.9635°E',
    latitude: 29.3909,
    longitude: 76.9635,
    pm25: null, aqi: null, aqiCategory: 'Data pending', aqiColor: Colors.inkMuted,
    wind: 'Data pending', inversion: 'Data pending',
    metric1: { label: 'SMOKE TRANSPORT LAG', val: 'N/A', sub: 'Needs sufficient history' },
    metric2: { label: 'WIND SPEED', val: 'N/A', sub: 'Open-Meteo' },
    metric3: { label: 'CORRIDOR PM2.5', val: 'N/A', sub: 'Backend surface model' },
    metric4: { label: 'DATA STATUS', val: 'Pending', sub: 'Backend request in progress' },
    statusNote: 'Waiting for current backend observations.',
  },
  delhi_09: {
    id: 'DL-URBAN-09',
    name: 'Delhi Anand Vihar Receptor Node',
    category: 'Target Receptor Sink',
    state: 'Delhi NCR (Anand Vihar ISBT)',
    coords: '28.6472°N, 77.3160°E',
    latitude: 28.6472,
    longitude: 77.316,
    pm25: null, aqi: null, aqiCategory: 'Data pending', aqiColor: Colors.inkMuted,
    wind: 'Data pending', inversion: 'Data pending',
    metric1: { label: 'MIXING LAYER HEIGHT', val: 'N/A', sub: 'Open-Meteo' },
    metric2: { label: 'VENTILATION ESTIMATE', val: 'N/A', sub: 'Wind speed × mixing height' },
    metric3: { label: 'PM2.5', val: 'N/A', sub: 'Backend surface model' },
    metric4: { label: 'AQI CATEGORY', val: 'N/A', sub: 'CPCB PM2.5 sub-index' },
    statusNote: 'Waiting for current backend observations.',
  },
};

const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const AirshedDashboardScreen: React.FC<AirshedDashboardScreenProps> = ({
  onOpenScanner,
  onNavigateCorridor,
  liveMessage,
  insets = { top: 0, bottom: 0, left: 0, right: 0 },
}) => {
  const fabBottom = Math.max(162, insets.bottom + 130);
  const scrollBottomPadding = Math.max(190, insets.bottom + 160);

  const [activeFilter, setActiveFilter] = useState('foryou');
  const [selectedCorridorNode, setSelectedCorridorNode] = useState<CorridorNodeKey>('pb_04');
  const [searchQuery, setSearchQuery] = useState('');

  // Live backend data state
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null);
  const [meteorology, setMeteorology] = useState<MeteorologyResponse | null>(null);
  const [stations, setStations] = useState<StationThing[]>([]);
  const [surface, setSurface] = useState<SurfaceGridResponse | null>(null);
  const [sensorCount, setSensorCount] = useState<number | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [lagData, setLagData] = useState<FireAqiLagResponse | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Load default corridor node preference on mount
  useEffect(() => {
    getPreference('defaultCorridorNode').then((node) => {
      if (node === 'punjab') setSelectedCorridorNode('pb_04');
      else if (node === 'transit') setSelectedCorridorNode('transit_02');
      else if (node === 'delhi') setSelectedCorridorNode('delhi_09');
    });
  }, []);

  const handleSelectCorridorNode = (key: CorridorNodeKey) => {
    setSelectedCorridorNode(key);
    const pref = key === 'pb_04' ? 'punjab' : key === 'transit_02' ? 'transit' : 'delhi';
    setPreference('defaultCorridorNode', pref);
  };

  const loadData = useCallback(async () => {
    try {
      const [hotspotsRes, meteoRes, stationsRes, biomassRes, lagRes, surfaceRes, sensorsRes] = await Promise.allSettled([
        fetchHotspots(24, 'nominal'),
        fetchMeteorology(),
        fetchStations('pm25'),
        fetchBiomassEmissions(7),
        fetchFireAqiLag(7),
        fetchAqiSurface(0.5),
        fetchSensorThings(),
      ]);

      const anyRejected = [hotspotsRes, meteoRes, stationsRes, biomassRes, lagRes, surfaceRes, sensorsRes].some(
        (r) => r.status === 'rejected'
      );
      setIsOffline(anyRejected);

      if (hotspotsRes.status === 'fulfilled') setHotspots(hotspotsRes.value);
      if (meteoRes.status === 'fulfilled') setMeteorology(meteoRes.value);
      if (stationsRes.status === 'fulfilled') setStations(stationsRes.value?.value ?? []);
      if (biomassRes.status === 'fulfilled') setBiomassData(biomassRes.value);
      if (lagRes.status === 'fulfilled') setLagData(lagRes.value);
      if (surfaceRes.status === 'fulfilled') setSurface(surfaceRes.value);
      if (sensorsRes.status === 'fulfilled') setSensorCount(sensorsRes.value['@iot.count']);
    } catch (err: unknown) {
      console.warn('[Dashboard] loadData:', err instanceof Error ? err.message : err);
      setIsOffline(true);
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

  const nodeData = useMemo<CorridorNodeData>(() => {
    const base = CORRIDOR_NODES[selectedCorridorNode];
    const surfacePoint = surface?.features.reduce<typeof surface.features[number] | null>((best, feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      if (!best) return feature;
      const [bestLon, bestLat] = best.geometry.coordinates;
      return distanceKm(base.latitude, base.longitude, lat, lon) < distanceKm(base.latitude, base.longitude, bestLat, bestLon) ? feature : best;
    }, null);

    // If live WebSocket push is active for Delhi and Delhi node is selected
    const isLiveDelhi = selectedCorridorNode === 'delhi_09' && liveMessage?.delhi_pm25_ugm3 != null;
    const pm25 = isLiveDelhi
      ? liveMessage.delhi_pm25_ugm3!
      : (surfacePoint?.properties.pm25_estimate ?? null);
    const aqi = isLiveDelhi && liveMessage.delhi_aqi_index != null
      ? liveMessage.delhi_aqi_index
      : (surfacePoint?.properties.aqi_index ?? (pm25 !== null ? computeCpcbAqi(pm25) : null));
    const aqiMeta = aqi !== null ? getAqiCategoryAndColor(aqi) : { category: 'Data unavailable', color: Colors.inkMuted };
    const region = selectedCorridorNode === 'pb_04' ? meteorology?.regions.punjab : meteorology?.regions.delhi;
    const windKmh = region ? region.wind_speed_ms * 3.6 : null;
    const windDirection = region ? Math.round(region.wind.direction_from_deg) : null;
    const mixing = region?.mixing_layer_height_m_agl ?? null;
    const totalFrp = hotspots?.features.reduce((sum, feature) => sum + (feature.properties.frp ?? 0), 0) ?? null;
    const nearestFire = hotspots?.features.length
      ? Math.min(...hotspots.features.map((feature) => distanceKm(base.latitude, base.longitude, feature.geometry.coordinates[1], feature.geometry.coordinates[0])))
      : null;
    const strongestLag = lagData?.strongest_lag;
    const windText = windKmh !== null && windDirection !== null ? `${windDirection}° @ ${windKmh.toFixed(1)} km/h` : 'Data unavailable';
    const inversionText = mixing !== null ? `${Math.round(mixing)} m AGL; ${formatBackendStatus(meteorology?.inversion.status)}` : 'Not measured';
    const sourceNote = isLiveDelhi
      ? 'Live WebSocket real-time broadcast (60s push)'
      : (surface?.source ? `Current backend surface; ${formatDataSource(surface.source)}` : 'Current backend surface unavailable');
    let metrics: CorridorNodeData['metric1'][];
    if (selectedCorridorNode === 'pb_04') {
      metrics = [
        { label: 'ACTIVE FIRE HOTSPOTS', val: hotspots ? String(hotspots.count) : 'N/A', sub: 'NASA FIRMS, last 24 hours' },
        { label: 'TOTAL FIRE RADIATIVE POWER', val: totalFrp !== null ? `${totalFrp.toFixed(1)} MW` : 'N/A', sub: 'Sum of current FIRMS detections' },
        { label: 'WIND', val: windText, sub: 'Open-Meteo live weather' },
        { label: 'NEAREST FIRE', val: nearestFire !== null ? `${nearestFire.toFixed(1)} km` : 'None reported', sub: 'Distance from selected node' },
      ];
    } else if (selectedCorridorNode === 'transit_02') {
      metrics = [
        { label: 'SMOKE TRANSPORT LAG', val: strongestLag ? `T+${strongestLag.lag_hours}h` : 'Insufficient history', sub: strongestLag ? `Pearson r = ${strongestLag.pearson_r.toFixed(2)}` : 'No measured correlation yet' },
        { label: 'WIND SPEED', val: windKmh !== null ? `${windKmh.toFixed(1)} km/h` : 'N/A', sub: 'Open-Meteo live weather' },
        { label: 'CORRIDOR PM2.5', val: pm25 !== null ? `${pm25.toFixed(1)} µg/m³` : 'N/A', sub: sourceNote },
        { label: 'DATA STATUS', val: surfacePoint ? 'Available' : 'Unavailable', sub: 'Nearest backend grid point' },
      ];
    } else {
      const ventilation = region ? region.wind_speed_ms * region.mixing_layer_height_m_agl : null;
      metrics = [
        { label: 'MIXING LAYER HEIGHT', val: mixing !== null ? `${Math.round(mixing)} m AGL` : 'N/A', sub: 'Open-Meteo live weather' },
        { label: 'VENTILATION ESTIMATE', val: ventilation !== null ? `${Math.round(ventilation)} m²/s` : 'N/A', sub: 'Wind speed × mixing height' },
        { label: 'PM2.5', val: pm25 !== null ? `${pm25.toFixed(1)} µg/m³` : 'N/A', sub: sourceNote },
        { label: 'AQI CATEGORY', val: aqiMeta.category, sub: aqi !== null ? `CPCB PM2.5 sub-index ${aqi}` : 'No current value' },
      ];
    }
    return {
      ...base, pm25, aqi, aqiCategory: aqiMeta.category, aqiColor: aqiMeta.color,
      wind: windText, inversion: inversionText,
      metric1: metrics[0], metric2: metrics[1], metric3: metrics[2], metric4: metrics[3],
      statusNote: `${sourceNote}. Values are estimates unless identified as station observations.`,
    };
  }, [hotspots, lagData, liveMessage, meteorology, selectedCorridorNode, surface]);

  const nearestStation = useMemo(() => {
    if (!stations.length) return null;
    const base = CORRIDOR_NODES[selectedCorridorNode];
    return stations.reduce<StationThing | null>((best, station) => {
      const coords = station.Locations?.[0]?.location?.coordinates;
      if (!coords) return best;
      if (!best) return station;
      const bestCoords = best.Locations?.[0]?.location?.coordinates;
      if (!bestCoords) return station;
      return distanceKm(base.latitude, base.longitude, coords[1], coords[0]) < distanceKm(base.latitude, base.longitude, bestCoords[1], bestCoords[0]) ? station : best;
    }, null);
  }, [selectedCorridorNode, stations]);

  const createCurrentIncident = async () => {
    if (nodeData.pm25 === null) throw new Error('Current PM2.5 is unavailable');
    return createIncident({
      severity: (nodeData.aqi ?? 0) > 400 ? 'emergency' : (nodeData.aqi ?? 0) > 200 ? 'warning' : 'watch',
      location_text: nodeData.name,
      latitude: nodeData.latitude,
      longitude: nodeData.longitude,
      pollutant: 'PM2.5',
      measured_pm25: nodeData.pm25,
      satellite_source: hotspots?.source,
      authority: 'CPCB',
    });
  };

  const selectDashboardFilter = (value: string) => {
    setActiveFilter(value);
    if (value === 'stubble') setSelectedCorridorNode('pb_04');
    if (value === 'wind') setSelectedCorridorNode('transit_02');
  };

  const applySearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (query.includes('delhi') || query.includes('anand')) setSelectedCorridorNode('delhi_09');
    else if (query.includes('panipat') || query.includes('transit') || query.includes('haryana')) setSelectedCorridorNode('transit_02');
    else if (query.includes('punjab') || query.includes('sangrur') || query.includes('stubble')) setSelectedCorridorNode('pb_04');
  };

  const handleQuickDispatch = async () => {
    try {
      const incident = await createCurrentIncident();
      let targetRef = 'PPCB Flying Squad Command, Dirba Sector';
      let targetLabel = 'Dirba sector';
      if (selectedCorridorNode === 'transit_02') {
        targetRef = 'HSPCB Highway Enforcement Unit, Panipat Gateway';
        targetLabel = 'Panipat corridor';
      } else if (selectedCorridorNode === 'delhi_09') {
        targetRef = 'DPCC Rapid Response Team, Anand Vihar Basin';
        targetLabel = 'Anand Vihar';
      }
      const dispatch = await queueLegalDispatch({
        incident_id: incident.incident_id,
        recipient_kind: 'flying_squad',
        recipient_reference: targetRef,
      });
      setActionFeedback(dispatch.message_sent
        ? `⚡ Connector reported dispatch sent for ${targetLabel}`
        : `Review request recorded for ${targetLabel}; no external message sent`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (error) {
      setActionFeedback(`Dispatch failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleQuickNotice = async () => {
    try {
      const incident = await createCurrentIncident();
      let issuingAuthority = 'Punjab Pollution Control Board (PPCB)';
      let direction = 'Verify crop residue burning fires and enforce zero-emission compliance under Air Act Section 31A.';
      if (selectedCorridorNode === 'transit_02') {
        issuingAuthority = 'Haryana State Pollution Control Board (HSPCB)';
        direction = 'Inspect NH-44 corridor transport emissions and mandate dust control under Air Act Section 31A.';
      } else if (selectedCorridorNode === 'delhi_09') {
        issuingAuthority = 'Delhi Pollution Control Committee (DPCC)';
        direction = 'Review CEMS industrial stack discharge and mandate immediate scrubber activation under Air Act Section 31A.';
      }
      const res = await createLegalNotice({
        incident_id: incident.incident_id,
        issuing_authority: issuingAuthority,
        requested_direction: direction,
      });
      setActionFeedback(`Notice ${res.notice_id.slice(0, 16)} ${formatBackendStatus(res.status)}`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (error) {
      setActionFeedback(`Notice failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoRow}>
            <Text style={styles.brandTitle}>PRANA Air</Text>
            <Text style={styles.brandSparkle}>✦</Text>
          </View>
          {/* Location Chip */}
          <Pressable style={styles.locationChip} onPress={() => setSelectedCorridorNode('delhi_09')}>
            <MaterialCommunityIcons name="navigation-variant" size={14} color={Colors.terracottaDeep} />
            <Text style={styles.locationText} numberOfLines={1}>
              {nodeData.state}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={Colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.headerRight}>
          <StarburstBadge label="72H FORECAST" rotation="-4deg" shadowColor={Colors.coralWatermelon} />
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="account" size={18} color={Colors.canvasCream} />
          </View>
        </View>
      </View>

      {/* Initial Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={Colors.terracottaDeep} />
          <Text style={styles.loadingBannerText}>Fetching multi-node airshed telemetry…</Text>
        </View>
      )}

      {/* Offline Mode Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="cloud-off-outline" size={16} color={Colors.sandGold} />
          <Text style={styles.offlineBannerText}>Offline Mode: Displaying cached telemetry</Text>
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
        {/* Search & Filter Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color={Colors.inkBlack} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search air plumes, trajectories, nodes..."
              placeholderTextColor={Colors.inkMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={applySearch}
            />
            <Pressable style={styles.filterTuneBtn} onPress={applySearch}>
              <MaterialCommunityIcons name="tune" size={16} color={Colors.inkBlack} />
            </Pressable>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
            <Pressable
              onPress={() => selectDashboardFilter('foryou')}
              style={[
                styles.filterPill,
                activeFilter === 'foryou' ? styles.filterPillActive : styles.filterPillInactive,
              ]}
            >
              <Text style={[styles.filterPillText, activeFilter === 'foryou' && styles.filterPillTextActive]}>
                <Text style={{ color: Colors.coralWatermelon }}>✦ </Text>For you
              </Text>
            </Pressable>

            <Pressable
              onPress={() => selectDashboardFilter('stubble')}
              style={[
                styles.filterPill,
                activeFilter === 'stubble' ? styles.filterPillActive : styles.filterPillInactive,
              ]}
            >
              <Text style={[styles.filterPillText, activeFilter === 'stubble' && styles.filterPillTextActive]}>
                Stubble Fires
              </Text>
            </Pressable>

            <Pressable
              onPress={() => selectDashboardFilter('wind')}
              style={[
                styles.filterPill,
                activeFilter === 'wind' ? styles.filterPillActive : styles.filterPillInactive,
              ]}
            >
              <Text style={[styles.filterPillText, activeFilter === 'wind' && styles.filterPillTextActive]}>
                Wind Vectors
              </Text>
            </Pressable>

            <View style={styles.filterPillMore}>
              <Text style={styles.filterPillMoreText}>More data</Text>
            </View>
          </ScrollView>
        </View>

        {/* Live Fire Dispatch Marquee Banner */}
        <View style={styles.marqueeWrapper}>
          <View style={styles.marqueeShadow} />
          <View style={styles.marqueeBanner}>
            <MaterialCommunityIcons name="fire" size={20} color={Colors.canvasCream} style={styles.fireIcon} />
            <View style={styles.marqueeTextContainer}>
              <Text style={styles.marqueeText} numberOfLines={1}>
                <Text style={{ fontWeight: '900' }}>{hotspots ? `${hotspots.count} current fire hotspots` : 'Fire feed unavailable'}</Text> • NASA FIRMS, last 24 hours
              </Text>
            </View>
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>{hotspots ? 'CURRENT' : 'UNAVAILABLE'}</Text>
            </View>
          </View>
        </View>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <View style={styles.feedbackBanner}>
            <MaterialCommunityIcons name="check-circle" size={14} color={Colors.forestJade} />
            <Text style={styles.feedbackBannerText}>{actionFeedback}</Text>
          </View>
        )}

        {/* SECTION 1: Tri-Node Atmospheric Corridor Vector Strip */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.sectionCard}>
          {/* Card Meta Header */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="vector-polyline" size={18} color={Colors.cobaltDeep} />
              </View>
              <View>
                <Text style={styles.sectionCardTitle}>Northern Atmospheric Air Corridor</Text>
                <Text style={styles.sectionCardSubtitle}>Live OGC SensorThings &bull; NASA FIRMS &bull; Open-Meteo</Text>
              </View>
            </View>
            <View style={styles.badgeMini}>
              <Text style={styles.badgeMiniText}>INFLOW CORRIDOR</Text>
            </View>
          </View>

          {/* Corridor Node Selection Tabs */}
          <View style={styles.nodeTabsRow}>
            {(['pb_04', 'transit_02', 'delhi_09'] as const).map((key) => {
              const isSelected = selectedCorridorNode === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => handleSelectCorridorNode(key)}
                  style={[
                    styles.nodeTabButton,
                    isSelected ? styles.nodeTabButtonActive : styles.nodeTabButtonInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeTabButtonText,
                      isSelected && styles.nodeTabButtonTextActive,
                    ]}
                  >
                    {key === 'pb_04' ? '01. PB-04 Origin' : key === 'transit_02' ? '02. Transit Belt' : '03. Delhi Sink'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Station Identity & Telemetry Container */}
          <View style={styles.stationConsoleBox}>
            <View style={styles.stationHeaderRow}>
              <View style={styles.stationTitleCol}>
                <Text style={styles.stationNameText}>{nodeData.name}</Text>
                <View style={styles.stationCoordsRow}>
                  <MaterialCommunityIcons name="map-marker-radius" size={13} color={Colors.terracottaDeep} />
                  <Text style={styles.stationCoordsText}>{nodeData.coords}</Text>
                </View>
                <Text style={styles.stationStateText}>{nodeData.state}</Text>
              </View>

              <View style={[styles.stationAqiBadge, { backgroundColor: nodeData.aqiColor }]}>
                <Text style={styles.stationAqiVal}>AQI {nodeData.aqi ?? 'N/A'}</Text>
                <Text style={styles.stationAqiLabel}>{nodeData.aqiCategory.split('•')[0].trim()}</Text>
              </View>
            </View>

            {/* 2x2 Telemetry Metric Blocks */}
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryBlock}>
                <Text style={styles.telemetryLabel}>{nodeData.metric1.label}</Text>
                <Text style={styles.telemetryVal}>{nodeData.metric1.val}</Text>
                <Text style={styles.telemetrySub}>{nodeData.metric1.sub}</Text>
              </View>

              <View style={styles.telemetryBlock}>
                <Text style={styles.telemetryLabel}>{nodeData.metric2.label}</Text>
                <Text style={styles.telemetryVal}>{nodeData.metric2.val}</Text>
                <Text style={styles.telemetrySub}>{nodeData.metric2.sub}</Text>
              </View>

              <View style={styles.telemetryBlock}>
                <Text style={styles.telemetryLabel}>{nodeData.metric3.label}</Text>
                <Text style={styles.telemetryVal}>{nodeData.metric3.val}</Text>
                <Text style={styles.telemetrySub}>{nodeData.metric3.sub}</Text>
              </View>

              <View style={styles.telemetryBlock}>
                <Text style={styles.telemetryLabel}>{nodeData.metric4.label}</Text>
                <Text style={styles.telemetryVal}>{nodeData.metric4.val}</Text>
                <Text style={styles.telemetrySub}>{nodeData.metric4.sub}</Text>
              </View>
            </View>

            {/* 24-Hour Diurnal Trend Sparkline */}
            <View style={styles.trendSparklineCard}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendTitle}>24-HOUR DIURNAL PM2.5 PROFILE</Text>
                <Text style={styles.trendSub}>Nocturnal inversion peak 04:00 IST</Text>
              </View>
              <Svg width="100%" height="52" viewBox="0 0 300 52">
                <Defs>
                  <LinearGradient id="stationTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={nodeData.aqiColor} stopOpacity="0.45" />
                    <Stop offset="100%" stopColor={nodeData.aqiColor} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
                <Path
                  d="M 10 36 Q 50 12, 90 16 T 170 32 T 240 14 T 290 22 L 290 50 L 10 50 Z"
                  fill="url(#stationTrendGrad)"
                />
                <Path
                  d="M 10 36 Q 50 12, 90 16 T 170 32 T 240 14 T 290 22"
                  fill="none"
                  stroke={nodeData.aqiColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <Circle cx="90" cy="16" r="3.5" fill={Colors.coralWatermelonVivid} />
                <SvgText x="10" y="50" fontSize="8" fill={Colors.inkMuted} fontWeight="bold">00:00</SvgText>
                <SvgText x="78" y="10" fontSize="8" fill={Colors.coralWatermelonVivid} fontWeight="bold">04:00 (Peak)</SvgText>
                <SvgText x="155" y="50" fontSize="8" fill={Colors.inkMuted} fontWeight="bold">12:00</SvgText>
                <SvgText x="270" y="50" fontSize="8" fill={Colors.inkMuted} fontWeight="bold">23:00</SvgText>
              </Svg>
            </View>

            {/* Atmospheric Dynamics Banner */}
            <View style={styles.atmoDynamicsRow}>
              <View style={styles.atmoDynamicsItem}>
                <MaterialCommunityIcons name="weather-windy" size={14} color={Colors.forestJade} />
                <Text style={styles.atmoDynamicsText}>Wind: {nodeData.wind}</Text>
              </View>
              <View style={styles.atmoDynamicsItem}>
                <MaterialCommunityIcons name="arrow-collapse-down" size={14} color={Colors.coralWatermelonVivid} />
                <Text style={styles.atmoDynamicsText}>Inversion: {nodeData.inversion}</Text>
              </View>
            </View>

            {/* Ingress / Dispersion Narrative Note */}
            <View style={styles.statusNoteBox}>
              <MaterialCommunityIcons name="information" size={14} color={Colors.cobaltDeep} />
              <Text style={styles.statusNoteText}>{nodeData.statusNote}</Text>
            </View>
          </View>

          {/* SPCB Rapid Operational Triggers Strip */}
          <View style={styles.spcbActionRow}>
            <Pressable
              onPress={handleQuickDispatch}
              style={styles.squadActionBtn}
            >
              <MaterialCommunityIcons name="car-emergency" size={16} color={Colors.canvasCream} />
              <Text style={styles.squadActionBtnText}>Dispatch Flying Squad</Text>
            </Pressable>

            <Pressable
              onPress={handleQuickNotice}
              style={styles.noticeActionBtn}
            >
              <MaterialCommunityIcons name="file-document-edit-outline" size={16} color={Colors.inkBlack} />
              <Text style={styles.noticeActionBtnText}>Draft 31A Notice</Text>
            </Pressable>
          </View>

          {/* Dual-Unit Telemetry Chips */}
          <View style={styles.chipsRow}>
            {nodeData.pm25 !== null && nodeData.aqi !== null && (
              <DualUnitChip
                massValue={Number(nodeData.pm25.toFixed(1))}
                massUnit="µg/m³ PM2.5 model"
                aqiValue={nodeData.aqi}
                aqiColor={nodeData.aqiColor}
                aqiLabel={nodeData.aqiCategory}
              />
            )}
            {nearestStation?.Datastreams?.[0]?.Observations?.[0] && (() => {
              const observation = nearestStation.Datastreams[0].Observations[0];
              const meta = getAqiCategoryAndColor(observation.aqi_index);
              return (
                <DualUnitChip
                  massValue={Number(observation.pm25_ugm3.toFixed(1))}
                  massUnit="µg/m³ PM2.5 station"
                  aqiValue={observation.aqi_index}
                  aqiColor={meta.color}
                  aqiLabel={nearestStation.name}
                />
              );
            })()}
            {nodeData.pm25 === null && !nearestStation && <Text style={styles.sectionCardSubtitle}>No current PM2.5 value is available.</Text>}
          </View>
        </NeoCard>

        {/* Action feedback toast */}
        {actionFeedback && (
          <View style={styles.feedbackToast}>
            <Text style={styles.feedbackToastText}>{actionFeedback}</Text>
          </View>
        )}

        {/* Regional Biomass Emissions Breakdown Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="fire-circle" size={20} color={Colors.terracottaDeep} />
              <Text style={styles.sectionCardTitle}>Biomass Emissions &amp; Crop Fires</Text>
            </View>
            <View style={styles.badgeMini}>
              <Text style={styles.badgeMiniText}>7D SATELLITE</Text>
            </View>
          </View>

          <Text style={styles.sectionCardSubtitle}>
            Regional FRP thermal radiation shares across Indo-Gangetic emitter states.
          </Text>

          <View style={styles.biomassGrid}>
            {(biomassData?.regions ?? []).map((r) => (
              <View key={r.region} style={styles.biomassRow}>
                <View style={styles.biomassLeft}>
                  <Text style={styles.biomassRegionName}>{r.region}</Text>
                  <Text style={styles.biomassHotspotText}>{r.hotspot_count} active fires</Text>
                </View>
                <View style={styles.biomassTrack}>
                  <View
                    style={[
                      styles.biomassFill,
                      {
                        width: `${Math.min(100, r.frp_share_percent ?? 0)}%` as DimensionValue,
                        backgroundColor: r.region === 'Punjab' ? Colors.terracottaDeep : Colors.coralWatermelonVivid,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.biomassPercent}>
                  {r.frp_share_percent ? `${r.frp_share_percent.toFixed(1)}%` : 'N/A'}
                </Text>
              </View>
            ))}
            {!biomassData?.regions.length && <Text style={styles.sectionCardSubtitle}>No current regional fire-emissions summary is available.</Text>}
          </View>
        </NeoCard>

        {/* Smoke Advection Lag Correlation Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="transit-detour" size={20} color={Colors.cobaltDeep} />
              <Text style={styles.sectionCardTitle}>Smoke Advection Transport Lag</Text>
            </View>
            <View style={[styles.badgeMini, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.badgeMiniText, { color: Colors.cobaltDeep }]}>CORRELATION</Text>
            </View>
          </View>

          <Text style={styles.sectionCardSubtitle}>
            Estimated transit lag from upwind crop ignition to downwind urban subsidence trap.
          </Text>

          <View style={styles.lagMetricsRow}>
            <View style={styles.lagMetricBox}>
              <Text style={styles.lagMetricVal}>
                {lagData?.strongest_lag ? `T+${lagData.strongest_lag.lag_hours}h` : 'Insufficient history'}
              </Text>
              <Text style={styles.lagMetricLabel}>Peak Transit Window</Text>
            </View>
            <View style={styles.lagMetricBox}>
              <Text style={[styles.lagMetricVal, { color: Colors.forestJade }]}>
                {lagData?.strongest_lag ? `r = ${lagData.strongest_lag.pearson_r.toFixed(2)}` : 'Not computed'}
              </Text>
              <Text style={styles.lagMetricLabel}>Cross-Regional Correlation</Text>
            </View>
          </View>
        </NeoCard>

        {/* Operational Quick Enforcement Actions */}
        <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="shield-account" size={20} color={Colors.inkBlack} />
              <Text style={styles.sectionCardTitle}>SPCB Operational Command</Text>
            </View>
            <View style={[styles.badgeMini, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.badgeMiniText, { color: '#991B1B' }]}>WAR ROOM</Text>
            </View>
          </View>

          <View style={styles.quickActionBtns}>
            <Pressable onPress={handleQuickDispatch} style={styles.actionBtnSecondary}>
              <MaterialCommunityIcons name="police-badge" size={16} color={Colors.canvasCream} />
              <Text style={styles.actionBtnText}>Dispatch Flying Squad</Text>
            </Pressable>

            <Pressable onPress={handleQuickNotice} style={styles.actionBtnPrimary}>
              <MaterialCommunityIcons name="file-document-edit" size={16} color={Colors.canvasCream} />
              <Text style={styles.actionBtnText}>Issue Section 31A Notice</Text>
            </Pressable>
          </View>
        </NeoCard>

        {/* Quick Corridor Navigation Card */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Navigate to air corridor trajectory map"
          onPress={onNavigateCorridor}
          style={({ pressed }) => [{ width: '100%' }, pressed && { opacity: 0.92 }]}
        >
          <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.meshCard}>
            <View style={styles.meshCardLeft}>
              <View style={styles.meshIconSquare}>
                <MaterialCommunityIcons name="weather-windy" size={22} color={Colors.terracottaDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meshTitle}>Air Corridor Trajectory</Text>
                <Text style={styles.meshSubtitle}>Track smoke swath from Sangrur to Delhi Basin</Text>
              </View>
            </View>
            <View style={styles.meshArrowCircle}>
              <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.canvasCream} />
            </View>
          </NeoCard>
        </Pressable>

        {/* Citizen Science Engagement Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.meshCard}>
          <View style={styles.meshCardLeft}>
            <View style={[styles.meshIconSquare, { backgroundColor: Colors.forestJade }]}>
              <MaterialCommunityIcons name="hub" size={22} color={Colors.canvasCream} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.meshTitle}>Airshed Mesh: {sensorCount ?? 'N/A'} Registered Nodes</Text>
                <Text style={styles.meshSubtitle}>Backend SensorThings registry</Text>
            </View>
          </View>
          <View style={[styles.meshArrowCircle, { backgroundColor: Colors.forestJade }]}>
            <MaterialCommunityIcons name="check" size={16} color={Colors.canvasCream} />
          </View>
        </NeoCard>

        {/* Spacing for floating player & nav */}
        <View style={{ height: scrollBottomPadding }} />
      </ScrollView>

      {/* Floating Citizen Sky Haze FAB */}
      <View style={[styles.fabWrapper, { bottom: fabBottom }]}>
        <NeoButton
          onPress={onOpenScanner}
          backgroundColor={Colors.coralWatermelon}
          shadowColor={Colors.inkBlack}
          shadowOffset={3}
          style={styles.fabContent}
        >
          <MaterialCommunityIcons name="camera-outline" size={20} color={Colors.inkBlack} />
          <Text style={styles.fabText}>+ Analyse Sky Haze</Text>
        </NeoButton>
      </View>
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
    backgroundColor: Colors.canvasCream,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3D7',
  },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.inkBlack,
    letterSpacing: -0.5,
  },
  brandSparkle: {
    fontSize: 16,
    color: Colors.coralWatermelonVivid,
    fontWeight: '900',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVanillaStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 3,
    flexShrink: 1,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
    maxWidth: 95,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  searchSection: {
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkBlack,
    paddingVertical: 2,
  },
  filterTuneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceVanillaStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
  },
  filterPillActive: {
    backgroundColor: Colors.inkBlack,
  },
  filterPillInactive: {
    backgroundColor: Colors.surfaceVanilla,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  filterPillTextActive: {
    color: Colors.canvasCream,
  },
  filterPillMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterPillMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  marqueeWrapper: {
    position: 'relative',
    marginRight: 2,
    marginBottom: 2,
  },
  marqueeShadow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.inkBlack,
    borderRadius: 12,
    top: 2,
    left: 2,
  },
  marqueeBanner: {
    backgroundColor: Colors.terracottaDeep,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fireIcon: {
    marginRight: 2,
  },
  marqueeTextContainer: {
    flex: 1,
  },
  marqueeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.canvasCream,
  },
  urgentBadge: {
    backgroundColor: '#18181B66',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  urgentText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.canvasCream,
    letterSpacing: 0.8,
  },
  nodeCard: {
    padding: 14,
  },
  nodeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nodeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.coralWatermelonVivid,
  },
  nodeTitleText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.inkBlack,
    letterSpacing: 0.5,
  },
  nodeTitleFlexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeIdBadge: {
    backgroundColor: Colors.surfaceVanillaStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  nodeIdBadgeText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  nodeSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginTop: 1,
  },
  liveTelemetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.forestJade,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  telemetryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  liveTelemetryText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nodeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  nodeTabButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  nodeTabButtonActive: {
    backgroundColor: Colors.canvasCream,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.cobaltDeep,
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  nodeTabButtonInactive: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderColor: '#D4CEBF',
  },
  nodeTabButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  nodeTabButtonTextActive: {
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  stationConsoleBox: {
    backgroundColor: Colors.surfaceWhite,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 12,
    gap: 10,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  stationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E1E6',
    paddingBottom: 8,
  },
  stationTitleCol: {
    flex: 1,
    gap: 2,
  },
  stationNameText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.inkBlack,
    letterSpacing: -0.2,
  },
  stationCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stationCoordsText: {
    fontSize: 9.5,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  stationStateText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.cobaltDeep,
  },
  stationAqiBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  stationAqiVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stationAqiLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryBlock: {
    width: '48%',
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4CEBF',
    padding: 8,
    gap: 2,
  },
  telemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  telemetrySub: {
    fontSize: 8.5,
    fontWeight: '600',
    color: Colors.forestJade,
  },
  atmoDynamicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  atmoDynamicsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  atmoDynamicsText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  statusNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  statusNoteText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
    lineHeight: 14,
  },
  spcbActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  squadActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.terracottaDeep,
    borderRadius: 9999,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  squadActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  noticeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 9999,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  noticeActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  nowStreamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nowStreamingText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  soundingCardBox: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 10,
    gap: 8,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  soundingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  soundingCanvas: {
    height: 140,
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  soundingDataStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  soundingDataCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  soundingDataLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  soundingDataVal: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  soundingDataUnit: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  soundingDataTag: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.coralWatermelonVivid,
  },
  soundingDataDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#27272A',
  },
  artworkBox: {
    height: 180,
    backgroundColor: Colors.primaryContainer,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  artTopBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  windSpeedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inkBlack,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 4,
  },
  windSpeedText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.canvasCream,
  },
  severeAqiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 4,
    transform: [{ rotate: '2deg' }],
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  severeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.inkBlack,
  },
  severeAqiText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  svgWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artBottomTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181B77',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  artBottomTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.canvasCream,
    letterSpacing: 0.5,
  },
  nodeStoryContent: {
    marginTop: 12,
    gap: 8,
  },
  storyHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.inkBlack,
    letterSpacing: -0.3,
  },
  storyBody: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 18,
  },
  scrubberContainer: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 10,
    gap: 6,
  },
  scrubberTrack: {
    height: 6,
    backgroundColor: '#E4E1E6',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: 6,
    backgroundColor: Colors.coralWatermelonVivid,
    borderRadius: 3,
  },
  scrubberHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.inkBlack,
    borderWidth: 2,
    borderColor: Colors.canvasCream,
    top: -4,
    marginLeft: -7,
  },
  scrubberTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  scrubberTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  scrubberPlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  meshCard: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meshCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  meshIconSquare: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meshTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  meshSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    marginTop: 1,
  },
  meshArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionCard: {
    padding: 14,
    gap: 10,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  sectionCardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  badgeMini: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgeMiniText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.terracottaDeep,
    letterSpacing: 0.5,
  },
  biomassGrid: {
    gap: 8,
    marginTop: 4,
  },
  biomassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  biomassLeft: {
    width: 80,
  },
  biomassRegionName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  biomassHotspotText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  biomassTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E4E1E6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  biomassFill: {
    height: '100%',
    borderRadius: 5,
  },
  biomassPercent: {
    width: 44,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  lagMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  lagMetricBox: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  lagMetricVal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  lagMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  quickActionBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.inkBlack,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.terracottaDeep,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  feedbackToast: {
    backgroundColor: Colors.forestJade,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  feedbackToastText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.canvasCream,
    textAlign: 'center',
  },
  fabWrapper: {
    position: 'absolute',
    right: 16,
    zIndex: 40,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    gap: 6,
  },
  fabText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inkBlack,
    borderBottomWidth: 2,
    borderBottomColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
    textTransform: 'uppercase',
  },
  offlineRetryBtn: {
    backgroundColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offlineRetryText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  trendSparklineCard: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(24,24,27,0.1)',
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trendTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendSub: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedbackBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
