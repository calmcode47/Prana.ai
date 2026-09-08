import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
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
  queueLegalDispatch,
  createLegalNotice,
  BiomassEmissionsResponse,
  FireAqiLagResponse,
} from '../api/client';

interface AirshedDashboardScreenProps {
  onOpenScanner: () => void;
  onNavigateCorridor: () => void;
}

export type CorridorNodeKey = 'pb_04' | 'transit_02' | 'delhi_09';

interface CorridorNodeData {
  id: string;
  name: string;
  category: string;
  state: string;
  coords: string;
  pm25: number;
  aqi: number;
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
    pm25: 142,
    aqi: 285,
    aqiCategory: 'Poor • Stubble Haze',
    aqiColor: Colors.terracottaDeep,
    wind: '295° WNW @ 18 km/h',
    inversion: '680m AGL (Lifting)',
    metric1: { label: 'ACTIVE STUBBLE FIRES', val: '247', sub: '+18% vs yday (VIIRS 375m)' },
    metric2: { label: 'TOTAL FRP FLUX', val: '1,420 MW', sub: 'Aerosol: 12.8 kg/s' },
    metric3: { label: 'WIND BEARING', val: '295° WNW', sub: 'Direct Ingress to NCR' },
    metric4: { label: 'SPCB ALERT STATUS', val: 'Armed', sub: 'Flying Squad Staged' },
    statusNote: 'Active harvest stubble burn cluster emitting dense smoke plume into the south-east transport corridor.',
  },
  transit_02: {
    id: 'TR-CORRIDOR-02',
    name: 'Panipat NH-44 Highway Node',
    category: 'Transit Transport Channel',
    state: 'Haryana (Karnal-Panipat)',
    coords: '29.3909°N, 76.9635°E',
    pm25: 284,
    aqi: 345,
    aqiCategory: 'Very Poor • In Transit',
    aqiColor: Colors.aqiUnhealthy,
    wind: '300° WNW @ 14 km/h',
    inversion: '480m AGL (Descending)',
    metric1: { label: 'SMOKE TRANSPORT LAG', val: 'T+36h', sub: 'Pearson r = 0.84' },
    metric2: { label: 'PLUME FLUX SPEED', val: '24 km/h', sub: 'ETA NCR: 8.5 Hours' },
    metric3: { label: 'HIGHWAY PM2.5', val: '284 µg/m³', sub: 'Dense Aerosol River' },
    metric4: { label: 'TRANSPORT CHANNEL', val: 'Open', sub: 'Nocturnal Advection' },
    statusNote: 'High-density particulate highway corridor funneling transboundary stubble emissions directly into Delhi airshed.',
  },
  delhi_09: {
    id: 'DL-URBAN-09',
    name: 'Delhi Anand Vihar Receptor Node',
    category: 'Target Receptor Sink',
    state: 'Delhi NCR (Anand Vihar ISBT)',
    coords: '28.6472°N, 77.3160°E',
    pm25: 312,
    aqi: 387,
    aqiCategory: 'Severe • Hazardous',
    aqiColor: Colors.aqiSevere,
    wind: '295° WNW @ 11 km/h',
    inversion: '340m AGL (Cap Locked)',
    metric1: { label: 'MIXING LAYER CAP', val: '340m AGL', sub: 'Subsidence Inversion' },
    metric2: { label: 'VENTILATION INDEX', val: '1,133 m²/s', sub: 'Critically Low Trap' },
    metric3: { label: 'GROUND PM2.5', val: '312 µg/m³', sub: 'CPCB Sub-Index 387' },
    metric4: { label: 'EMERGENCY STATUS', val: 'Active', sub: 'GRAP Stage IV Ready' },
    statusNote: 'Severe nocturnal inversion trap locking all regional & urban emissions in lower 340m canopy.',
  },
};

export const AirshedDashboardScreen: React.FC<AirshedDashboardScreenProps> = ({
  onOpenScanner,
  onNavigateCorridor,
}) => {
  const [activeFilter, setActiveFilter] = useState('foryou');
  const [selectedCorridorNode, setSelectedCorridorNode] = useState<CorridorNodeKey>('pb_04');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Live backend data state
  const [hotspotsCount, setHotspotsCount] = useState<number>(247);
  const [nearestFireKm, setNearestFireKm] = useState<number>(82);
  const [windSpeedKmH, setWindSpeedKmH] = useState<number>(28);
  const [mixingHeight, setMixingHeight] = useState<number>(340);
  const [localPm25, setLocalPm25] = useState<number>(48.2);
  const [localAqi, setLocalAqi] = useState<number>(162);
  const [aqiCategory, setAqiCategory] = useState<string>('MODERATE');
  const [aqiColor, setAqiColor] = useState<string>(Colors.aqiModerate);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);
  const [lagData, setLagData] = useState<FireAqiLagResponse | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    // Fetch live fire hotspots
    fetchHotspots(24, 'nominal')
      .then((res) => {
        if (res && typeof res.count === 'number' && res.count > 0) {
          setHotspotsCount(res.count);
        }
      })
      .catch(() => {});

    // Fetch live meteorology
    fetchMeteorology()
      .then((res) => {
        if (res?.regions?.delhi) {
          const speed = Math.round(res.regions.delhi.wind_speed_ms * 3.6);
          if (speed > 0) setWindSpeedKmH(speed);
          if (res.regions.delhi.mixing_layer_height_m_agl > 0) {
            setMixingHeight(Math.round(res.regions.delhi.mixing_layer_height_m_agl));
          }
        }
      })
      .catch(() => {});

    // Fetch live ground stations
    fetchStations('pm25')
      .then((res) => {
        if (res?.value && res.value.length > 0) {
          const firstStn = res.value[0];
          const obs = firstStn.Datastreams?.[0]?.Observations?.[0];
          if (obs && typeof obs.pm25_ugm3 === 'number') {
            const pm = Number(obs.pm25_ugm3.toFixed(1));
            const calculatedAqi = obs.aqi_index || computeCpcbAqi(pm);
            setLocalPm25(pm);
            setLocalAqi(calculatedAqi);
            const { category, color } = getAqiCategoryAndColor(calculatedAqi);
            setAqiCategory(category.toUpperCase());
            setAqiColor(color);
          }
        }
      })
      .catch(() => {});

    // Fetch regional biomass emissions breakdown
    fetchBiomassEmissions(7)
      .then(setBiomassData)
      .catch(() => {});

    // Fetch smoke advection lag correlation
    fetchFireAqiLag(7)
      .then(setLagData)
      .catch(() => {});
  }, []);

  const handleQuickDispatch = async () => {
    try {
      await queueLegalDispatch({
        incident_id: 'INC-QUICK-SQUAD',
        recipient_kind: 'flying_squad',
        recipient_reference: 'PPCB Flying Squad Command, Dirba Sector',
      });
      setActionFeedback('⚡ Flying squad dispatched to Dirba sector');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback('⚡ Flying squad alert queued for review');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleQuickNotice = async () => {
    try {
      const res = await createLegalNotice({
        incident_id: 'INC-20260908-2B2A460C75A7',
        issuing_authority: 'Delhi Pollution Control Committee (DPCC)',
        requested_direction: 'Review CEMS industrial stack discharge and mandate immediate scrubber activation.',
      });
      setActionFeedback(`⚖ Notice ${res.notice_id.slice(0, 16)} issued & sealed`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback('⚖ Section 31A Show-Cause notice drafted');
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const nodeData = CORRIDOR_NODES[selectedCorridorNode];

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
          <Pressable style={styles.locationChip}>
            <MaterialCommunityIcons name="navigation-variant" size={14} color={Colors.terracottaDeep} />
            <Text style={styles.locationText} numberOfLines={1}>
              Anand Vihar, DL
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={Colors.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.headerRight}>
          <StarburstBadge label="72H SMOG WATCH" rotation="-4deg" shadowColor={Colors.coralWatermelon} />
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="account" size={18} color={Colors.canvasCream} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
            />
            <Pressable style={styles.filterTuneBtn}>
              <MaterialCommunityIcons name="tune" size={16} color={Colors.inkBlack} />
            </Pressable>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
            <Pressable
              onPress={() => setActiveFilter('foryou')}
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
              onPress={() => setActiveFilter('stubble')}
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
              onPress={() => setActiveFilter('wind')}
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
              <Text style={styles.filterPillMoreText}>12+ more</Text>
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
                <Text style={{ fontWeight: '900' }}>{hotspotsCount} Active Stubble Fires</Text> in Punjab • Nearest: {nearestFireKm} km NW
              </Text>
            </View>
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          </View>
        </View>

        {/* Big Central Card: AIRSHED NODE 04 (Multi-Node Corridor Console) */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.nodeCard}>
          {/* Card Header */}
          <View style={styles.nodeCardHeader}>
            <View style={styles.nodeStatusRow}>
              <View style={styles.nodeLiveDot} />
              <View>
                <View style={styles.nodeTitleFlexRow}>
                  <Text style={styles.nodeTitleText}>AIRSHED NODE 04</Text>
                  <View style={styles.nodeIdBadge}>
                    <Text style={styles.nodeIdBadgeText}>{nodeData.id}</Text>
                  </View>
                </View>
                <Text style={styles.nodeSubText}>{nodeData.category} • OGC SensorThings</Text>
              </View>
            </View>
            <View style={styles.liveTelemetryChip}>
              <View style={styles.telemetryDot} />
              <Text style={styles.liveTelemetryText}>LIVE FEED</Text>
            </View>
          </View>

          {/* 3-Node Corridor Switcher Tabs */}
          <View style={styles.nodeTabsRow}>
            {(['pb_04', 'transit_02', 'delhi_09'] as const).map((key) => {
              const isSelected = selectedCorridorNode === key;
              const n = CORRIDOR_NODES[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedCorridorNode(key)}
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
                <Text style={styles.stationAqiVal}>AQI {nodeData.aqi}</Text>
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
            <DualUnitChip
              massValue={nodeData.pm25}
              massUnit="µg/m³ PM2.5"
              aqiValue={nodeData.aqi}
              aqiColor={nodeData.aqiColor}
              aqiLabel={nodeData.aqiCategory}
            />
            <DualUnitChip
              massValue={Math.round(nodeData.pm25 * 2.05)}
              massUnit="µg/m³ PM10"
              aqiValue={Math.min(500, Math.round(nodeData.aqi * 1.25))}
              aqiColor={Colors.aqiSevere}
              aqiLabel="Severe"
            />
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
            {(biomassData?.regions ?? [
              { region: 'Haryana', frp_sum_mw: 46.1, frp_share_percent: 94.9, hotspot_count: 3 },
              { region: 'Punjab', frp_sum_mw: 2.5, frp_share_percent: 5.1, hotspot_count: 1 },
            ]).map((r) => (
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
                        width: `${Math.min(100, r.frp_share_percent ?? 50)}%` as any,
                        backgroundColor: r.region === 'Punjab' ? Colors.terracottaDeep : Colors.coralWatermelonVivid,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.biomassPercent}>
                  {r.frp_share_percent ? `${r.frp_share_percent.toFixed(1)}%` : '—'}
                </Text>
              </View>
            ))}
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
                {lagData?.strongest_lag?.lag_hours ? `T+${lagData.strongest_lag.lag_hours}h` : 'T+36h'}
              </Text>
              <Text style={styles.lagMetricLabel}>Peak Transit Window</Text>
            </View>
            <View style={styles.lagMetricBox}>
              <Text style={[styles.lagMetricVal, { color: Colors.forestJade }]}>
                {lagData?.strongest_lag?.pearson_r ? `r = ${lagData.strongest_lag.pearson_r.toFixed(2)}` : 'r = 0.84'}
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
        <Pressable onPress={onNavigateCorridor}>
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
              <Text style={styles.meshTitle}>Airshed Mesh: 48 Nodes Active</Text>
              <Text style={styles.meshSubtitle}>Local calibrated optical particulate scatter</Text>
            </View>
          </View>
          <View style={[styles.meshArrowCircle, { backgroundColor: Colors.forestJade }]}>
            <MaterialCommunityIcons name="check" size={16} color={Colors.canvasCream} />
          </View>
        </NeoCard>

        {/* Spacing for floating player & nav */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating Citizen Sky Haze FAB */}
      <View style={styles.fabWrapper}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
    maxWidth: 95,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 8,
    marginTop: 4,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.inkBlack,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.terracottaDeep,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
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
    bottom: 85,
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
});
