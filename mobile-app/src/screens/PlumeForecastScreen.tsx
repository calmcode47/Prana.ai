import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  DimensionValue,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { StarburstBadge } from '../components/StarburstBadge';
import { DualUnitChip } from '../components/DualUnitChip';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText, Rect, Ellipse } from 'react-native-svg';
import {
  fetchForecastPlume,
  fetchMeteorology,
  fetchAqiSurface,
  fetchFireAqiLag,
  fetchBiomassEmissions,
  createIncident,
  queueLegalDispatch,
  getAqiCategoryAndColor,
  SurfaceGridResponse,
  FireAqiLagResponse,
  BiomassEmissionsResponse,
  PlumeResponse,
  MeteorologyResponse,
  formatDataSource,
} from '../api/client';

export const PlumeForecastScreen: React.FC = () => {
  const [currentHour, setCurrentHour] = useState<number>(0);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [plumeData, setPlumeData] = useState<PlumeResponse | null>(null);
  const [meteoData, setMeteoData] = useState<MeteorologyResponse | null>(null);
  const [mandateTriggered, setMandateTriggered] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [surfaceData, setSurfaceData] = useState<SurfaceGridResponse | null>(null);
  const [lagData, setLagData] = useState<FireAqiLagResponse | null>(null);
  const [biomassData, setBiomassData] = useState<BiomassEmissionsResponse | null>(null);

  // Auto-play timer when playing (safe guard to prevent clearInterval(undefined))
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentHour((prev) => (prev >= 72 ? 0 : prev + 2));
    }, 350);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      const [meteoRes, plumeRes, surfaceRes, lagRes, biomassRes] = await Promise.allSettled([
        fetchMeteorology(),
        fetchForecastPlume(),
        fetchAqiSurface(0.5),
        fetchFireAqiLag(7),
        fetchBiomassEmissions(7),
      ]);

      if (meteoRes.status === 'fulfilled') setMeteoData(meteoRes.value);
      if (plumeRes.status === 'fulfilled') setPlumeData(plumeRes.value);
      if (surfaceRes.status === 'fulfilled') setSurfaceData(surfaceRes.value);
      if (lagRes.status === 'fulfilled') setLagData(lagRes.value);
      if (biomassRes.status === 'fulfilled') setBiomassData(biomassRes.value);

      if (meteoRes.status === 'rejected' && plumeRes.status === 'rejected') {
        setLoadError(true);
      }
    } catch (err: unknown) {
      console.warn('[PlumeForecast] loadData:', err instanceof Error ? err.message : err);
      setLoadError(true);
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

  const handleSelectHorizon = (h: number) => {
    setSelectedHorizon(h);
    setCurrentHour(h);
  };

  const handleMandateQueue = async () => {
    try {
      if (!activeFeature) throw new Error('No current plume estimate is available');
      const maxPm = activeFeature.properties.max_pm25_est;
      const incident = await createIncident({
        severity: maxPm > 350 ? 'emergency' : 'warning',
        location_text: `Forecast Plume Corridor at T+${currentHour}h`,
        pollutant: 'PM2.5',
        measured_pm25: maxPm,
        authority: 'Inter-State Emergency Review',
      });
      await queueLegalDispatch({
        incident_id: incident.incident_id,
        recipient_kind: 'spcb',
        recipient_reference: 'Punjab, Haryana, and Delhi SPCB review queue',
      });
      setMandateTriggered(`Emergency Review Dispatched #${incident.incident_id.slice(-6)}`);
      setTimeout(() => setMandateTriggered(null), 3000);
    } catch (error) {
      setMandateTriggered(`Review failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setMandateTriggered(null), 3000);
    }
  };

  // Match live plume feature closest to current hour
  const plumeFeatures = plumeData?.features ?? [];
  const activeFeature = plumeFeatures.find((f) => {
    const h = f.properties.horizon_hours;
    if (currentHour <= 24) return h === 24;
    if (currentHour <= 48) return h === 48;
    return h === 72;
  });

  const progressPercent = Math.min(100, Math.max(0, (currentHour / 72) * 100));
  const estimatedPm25 = activeFeature?.properties.max_pm25_est ?? null;
  const estimatedAqi = activeFeature?.properties.max_aqi_est ?? null;
  const aqiDetails = estimatedAqi !== null ? getAqiCategoryAndColor(estimatedAqi) : { category: 'Data unavailable', color: Colors.inkMuted };
  const currentStage = activeFeature ? `Backend model horizon T+${activeFeature.properties.horizon_hours}h` : 'Forecast data unavailable';

  const totalFrp = biomassData?.regions?.reduce((sum, r) => sum + r.frp_sum_mw, 0) ?? null;
  const strongestLag = lagData?.strongest_lag;
  const delhiWeather = meteoData?.regions.delhi;
  const blMixingHeight = delhiWeather?.mixing_layer_height_m_agl ?? null;
  const liveWindKmh = delhiWeather ? delhiWeather.wind_speed_ms * 3.6 : null;
  const ventilationIndex = delhiWeather ? delhiWeather.wind_speed_ms * delhiWeather.mixing_layer_height_m_agl : null;

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>72h Plume Forecast</Text>
            <Text style={styles.titleSparkle}>✦</Text>
          </View>
          <Text style={styles.screenSubtitle}>Gaussian Inversion Dispersion Flow</Text>
        </View>
        <StarburstBadge label={activeFeature ? `T+${activeFeature.properties.horizon_hours}H MODEL` : 'DATA PENDING'} rotation="-2deg" shadowColor={Colors.coralWatermelon} />
      </View>

      {/* Initial Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={Colors.terracottaDeep} />
          <Text style={styles.loadingBannerText}>Fetching 72h plume dispersion models…</Text>
        </View>
      )}

      {/* Connection Error Banner */}
      {loadError && !isLoading && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.coralWatermelonVivid} />
          <Text style={styles.errorBannerText}>Dispersion telemetry unavailable. Displaying model defaults.</Text>
          <Pressable onPress={loadData} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>RETRY</Text>
          </Pressable>
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
        {/* Horizon Segmented Control Bar */}
        <View style={styles.horizonBar}>
          {[
            { hour: 0, label: 'Now (T+0h)' },
            { hour: 24, label: '+24h' },
            { hour: 48, label: '+48h' },
            { hour: 72, label: '+72h' },
          ].map((item) => (
            <Pressable
              key={item.hour}
              onPress={() => handleSelectHorizon(item.hour)}
              style={[
                styles.horizonPill,
                selectedHorizon === item.hour && styles.horizonPillActive,
              ]}
            >
              <Text
                style={[
                  styles.horizonPillText,
                  selectedHorizon === item.hour && styles.horizonPillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Action Trigger / Toast Feedback */}
        {mandateTriggered && (
          <View style={styles.mandateToast}>
            <MaterialCommunityIcons name="check-circle" size={16} color={Colors.canvasCream} />
            <Text style={styles.mandateToastText}>{mandateTriggered}</Text>
          </View>
        )}

        {/* Emergency Inter-State Review Action */}
        <Pressable onPress={handleMandateQueue} style={styles.mandateBtn}>
          <MaterialCommunityIcons name="shield-alert" size={18} color={Colors.canvasCream} />
          <Text style={styles.mandateBtnText}>Queue Inter-State Emergency Review</Text>
        </Pressable>

        {/* Inversion Trajectory Hero Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.heroCard}>
          {/* Card Visual Banner Box */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBannerTop}>
              <Text style={styles.heroSubTag}>INVERSION TRAJECTORY</Text>
              <View style={styles.warmBadge}>
                <Text style={styles.warmBadgeText}>{plumeData ? 'MODEL OUTPUT' : 'DATA PENDING'}</Text>
              </View>
            </View>
            <Text style={styles.heroHeading}>Forecast Selection T+{currentHour}h</Text>
            <Text style={styles.heroLocation}>{currentStage}</Text>
          </View>

          {/* Visual SVG Trajectory & Plume Dispersion Map */}
          <View style={styles.svgMapContainer}>
            <View style={styles.svgMapHeader}>
              <View style={styles.svgMapHeaderLeft}>
                <MaterialCommunityIcons name="compass-outline" size={14} color={Colors.sandGold} />
                <Text style={styles.svgMapTitle}>AIRSHED DISPERSION VECTOR (NW → SE)</Text>
              </View>
              <Text style={styles.svgMapFrontBadge}>FRONT: T+{currentHour}h</Text>
            </View>
            <Svg width="100%" height={180} viewBox="0 0 320 180" style={styles.svgCanvas}>
              <Defs>
                <LinearGradient id="plumeSkyGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#0F172A" />
                  <Stop offset="100%" stopColor="#1E293B" />
                </LinearGradient>
                <LinearGradient id="plumeGrad24" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0.05" />
                </LinearGradient>
                <LinearGradient id="plumeGrad48" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.75" />
                  <Stop offset="100%" stopColor="#EA580C" stopOpacity="0.05" />
                </LinearGradient>
                <LinearGradient id="plumeGrad72" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#FF5376" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor="#FF5376" stopOpacity="0.05" />
                </LinearGradient>
              </Defs>

              {/* Atmospheric Background */}
              <Rect width="320" height="180" fill="url(#plumeSkyGrad)" rx={6} />

              {/* Coordinate Grid Lines */}
              <Path d="M 0 45 L 320 45 M 0 90 L 320 90 M 0 135 L 320 135" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
              <Path d="M 80 0 L 80 180 M 160 0 L 160 180 M 240 0 L 240 180" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />

              {/* 72H Plume Ellipse (Broad Downwind Stagnation) */}
              <Ellipse
                cx="245"
                cy="135"
                rx="65"
                ry="38"
                fill="url(#plumeGrad72)"
                stroke={currentHour >= 48 ? Colors.coralWatermelonVivid : 'rgba(255,83,118,0.3)'}
                strokeWidth={currentHour >= 48 ? 2 : 1}
                strokeDasharray={currentHour >= 48 ? undefined : '3 3'}
                opacity={currentHour >= 36 ? Math.min(1, Math.max(0.2, (currentHour - 20) / 40)) : 0.15}
              />

              {/* 48H Plume Ellipse (Transit Corridor) */}
              <Ellipse
                cx="160"
                cy="92"
                rx="55"
                ry="32"
                fill="url(#plumeGrad48)"
                stroke={currentHour >= 24 && currentHour < 55 ? Colors.terracottaDeep : 'rgba(234,88,12,0.3)'}
                strokeWidth={currentHour >= 24 && currentHour < 55 ? 2 : 1}
                strokeDasharray={currentHour >= 24 && currentHour < 55 ? undefined : '3 3'}
                opacity={currentHour >= 12 ? Math.min(1, Math.max(0.25, (currentHour - 8) / 36)) : 0.2}
              />

              {/* 24H Plume Ellipse (Punjab Origin Ingress) */}
              <Ellipse
                cx="75"
                cy="48"
                rx="42"
                ry="24"
                fill="url(#plumeGrad24)"
                stroke={currentHour < 30 ? Colors.sandGold : 'rgba(245,158,11,0.3)'}
                strokeWidth={currentHour < 30 ? 2 : 1}
                strokeDasharray={currentHour < 30 ? undefined : '3 3'}
                opacity={Math.max(0.3, Math.min(1, 1.2 - currentHour / 80))}
              />

              {/* Wind Streamline Curves (NW -> SE Flow) */}
              <Path
                d="M 25 30 Q 110 50, 160 90 T 290 145"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <Path
                d="M 45 42 Q 130 65, 175 100 T 295 155"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Plume Front Dynamic Position */}
              <Circle
                cx={45 + (265 - 45) * (currentHour / 72)}
                cy={35 + (145 - 35) * (currentHour / 72)}
                r={7}
                fill={Colors.coralWatermelonVivid}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <Circle
                cx={45 + (265 - 45) * (currentHour / 72)}
                cy={35 + (145 - 35) * (currentHour / 72)}
                r={14}
                fill="none"
                stroke={Colors.coralWatermelonVivid}
                strokeWidth="1.5"
                opacity={0.6}
              />

              {/* Corridor Node Pins & Labels */}
              {/* Punjab Origin Node */}
              <Circle cx="45" cy="35" r={4.5} fill="#EF4444" stroke="#FAF6EE" strokeWidth="1.5" />
              <SvgText x="45" y="24" fontSize="8.5" fill="#FAF6EE" fontWeight="bold" textAnchor="middle">
                PB-04 Punjab
              </SvgText>

              {/* Transit Node */}
              <Circle cx="160" cy="90" r={4} fill="#F59E0B" stroke="#FAF6EE" strokeWidth="1.5" />
              <SvgText x="160" y="80" fontSize="8.5" fill="#FAF6EE" fontWeight="bold" textAnchor="middle">
                TR-02 Transit
              </SvgText>

              {/* Delhi Sink Node */}
              <Circle cx="275" cy="145" r={5} fill="#8B5CF6" stroke="#FAF6EE" strokeWidth="1.5" />
              <SvgText x="275" y="165" fontSize="8.5" fill="#FAF6EE" fontWeight="bold" textAnchor="middle">
                DL-09 Delhi NCR
              </SvgText>

              {/* Horizon Zone Tags */}
              <SvgText x="85" y="68" fontSize="7.5" fill="rgba(255,255,255,0.7)" fontWeight="700">
                T+24h Envelope
              </SvgText>
              <SvgText x="175" y="112" fontSize="7.5" fill="rgba(255,255,255,0.7)" fontWeight="700">
                T+48h Envelope
              </SvgText>
              <SvgText x="235" y="125" fontSize="7.5" fill="rgba(255,255,255,0.7)" fontWeight="700">
                T+72h Envelope
              </SvgText>
            </Svg>
          </View>

          {/* Telemetry Chips & Story */}
          <View style={styles.heroContent}>
            <View style={styles.heroChipsRow}>
              {estimatedPm25 !== null && estimatedAqi !== null && (
                <DualUnitChip
                  massValue={Number(estimatedPm25.toFixed(1))}
                  massUnit="µg/m³ model maximum"
                  aqiValue={estimatedAqi}
                  aqiLabel={aqiDetails.category}
                  aqiColor={aqiDetails.color}
                />
              )}
              <View style={styles.windChip}>
                <MaterialCommunityIcons name="weather-windy" size={13} color={Colors.terracottaDeep} />
                <Text style={styles.windChipText}>{liveWindKmh !== null ? `${liveWindKmh.toFixed(1)} km/h` : 'Wind unavailable'}</Text>
              </View>
            </View>

            <Text style={styles.heroBodyText}>
              {plumeData
                ? `${formatDataSource(plumeData.source)} computed ${plumeData.features.length} forecast envelopes. ${plumeData.model_assumptions}`
                : 'Current plume inputs are unavailable from the backend.'}
            </Text>

            {/* Interactive Timeline Scrubber */}
            <View style={styles.scrubberBox}>
              <View style={styles.scrubberHeader}>
                <View style={styles.scrubberTitleRow}>
                  <MaterialCommunityIcons name="radiobox-marked" size={16} color={Colors.coralWatermelonVivid} />
                  <Text style={styles.scrubberTitle}>Forecast Horizon Viewer</Text>
                </View>
                <Text style={styles.scrubberTimeIndicator}>Hour {currentHour} / 72</Text>
              </View>

              {/* Scrubber Track */}
              <Pressable
                style={styles.scrubberTrack}
                onPress={(e) => {
                  const locationX = e.nativeEvent.locationX;
                  const newHour = Math.round(Math.min(72, Math.max(0, (locationX / 280) * 72)));
                  setCurrentHour(newHour);
                }}
              >
                <View style={[styles.scrubberFill, { width: `${progressPercent}%` }]} />
                <View style={[styles.scrubberHandle, { left: `${progressPercent}%` }]}>
                  <View style={styles.handleInner} />
                </View>
              </Pressable>

              {/* Timeline Milestones */}
              <View style={styles.milestoneLabels}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Jump to hour 0"
                  onPress={() => setCurrentHour(0)}
                >
                  <Text style={[styles.milestoneText, currentHour < 15 && styles.milestoneActive]}>Selection (0h)</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Jump to hour 38"
                  onPress={() => setCurrentHour(38)}
                >
                  <Text style={[styles.milestoneText, currentHour >= 15 && currentHour < 55 && styles.milestoneActive]}>Model midpoints</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Jump to hour 72"
                  onPress={() => setCurrentHour(72)}
                >
                  <Text style={[styles.milestoneText, currentHour >= 55 && styles.milestoneActive]}>72h horizon</Text>
                </Pressable>
              </View>

              {/* Play / Pause Toggle Button */}
              <View style={styles.playBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause 72h simulation' : 'Play 72h timeline simulation'}
                  onPress={() => setIsPlaying(!isPlaying)}
                  style={styles.playButton}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={16}
                    color={Colors.canvasCream}
                  />
                  <Text style={styles.playButtonText}>{isPlaying ? 'Pause Simulation' : 'Play 72h Timeline'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reset timeline to hour 0"
                  onPress={() => setCurrentHour(0)}
                  style={styles.resetButton}
                >
                  <MaterialCommunityIcons name="restart" size={15} color={Colors.inkBlack} />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </NeoCard>

        {/* Corridor Horizon Comparison Matrix (T+24h / T+48h / T+72h) */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.horizonCard}>
          <View style={styles.horizonHeader}>
            <View style={styles.horizonTitleRow}>
              <MaterialCommunityIcons name="layers-triple-outline" size={18} color={Colors.cobaltDeep} />
              <Text style={styles.horizonCardTitle}>Corridor Horizon Comparison</Text>
            </View>
            <View style={styles.badgeMini}>
              <Text style={styles.badgeMiniText}>MULTI-TEMPORAL</Text>
            </View>
          </View>

          <View style={styles.horizonGrid}>
            {[
              {
                h: 24,
                title: 'T+24h Origin Ingress',
                location: 'Punjab → Haryana Border',
                maxPm: '320 µg/m³',
                aqi: '380 • Very Poor',
                wind: '14.2 km/h NW',
                status: 'High FRP emission source',
                color: Colors.sandGold,
              },
              {
                h: 48,
                title: 'T+48h Transit Channeling',
                location: 'GT Road / Karnal Belt',
                maxPm: '465 µg/m³',
                aqi: '440 • Severe',
                wind: '8.5 km/h NW',
                status: 'Channeling downwind',
                color: Colors.terracottaDeep,
              },
              {
                h: 72,
                title: 'T+72h Basin Stagnation',
                location: 'Delhi NCR & Yamuna Basin',
                maxPm: '592 µg/m³',
                aqi: '495 • Severe+',
                wind: '3.1 km/h (Calm)',
                status: 'Nocturnal inversion lock',
                color: Colors.coralWatermelonVivid,
              },
            ].map((item) => (
              <Pressable
                key={item.h}
                onPress={() => handleSelectHorizon(item.h)}
                style={[
                  styles.horizonBox,
                  selectedHorizon === item.h && { borderColor: item.color, borderWidth: 2 },
                ]}
              >
                <View style={styles.horizonBoxTop}>
                  <View style={[styles.horizonDot, { backgroundColor: item.color }]} />
                  <Text style={styles.horizonBoxTitle}>{item.title}</Text>
                  {selectedHorizon === item.h && (
                    <View style={[styles.activeTag, { backgroundColor: item.color }]}>
                      <Text style={styles.activeTagText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.horizonBoxLoc}>{item.location}</Text>
                <View style={styles.horizonMetricRow}>
                  <Text style={styles.horizonPmVal}>{item.maxPm}</Text>
                  <Text style={[styles.horizonAqiVal, { color: item.color }]}>{item.aqi}</Text>
                </View>
                <View style={styles.horizonFooter}>
                  <Text style={styles.horizonStatusText}>{item.status}</Text>
                  <Text style={styles.horizonWindText}>{item.wind}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </NeoCard>

        {/* Downwind Municipal Ward Vulnerability Matrix */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.wardCard}>
          <View style={styles.wardCardHeader}>
            <View style={styles.wardTitleRow}>
              <MaterialCommunityIcons name="shield-outline" size={18} color={Colors.terracottaDeep} />
              <Text style={styles.wardCardTitle}>Receptor Ward Vulnerability</Text>
            </View>
            <View style={styles.badgeMini}>
              <Text style={styles.badgeMiniText}>INFLOW IMPACT</Text>
            </View>
          </View>

          <View style={styles.wardList}>
            {(surfaceData?.features?.slice(0, 4) ?? []).map((item, idx) => {
              const p = item.properties;
              const coords = item.geometry.coordinates;
              const wardName = `Grid point ${Number(coords[1]).toFixed(2)}°N, ${Number(coords[0]).toFixed(2)}°E`;
              const arrivalEta = 'Current surface estimate';
              const barPercent = Math.min(100, Math.round(p.aqi_index / 5));
              const pointAqi = getAqiCategoryAndColor(p.aqi_index);

              return (
                <View key={idx} style={styles.wardItemBox}>
                  <View style={styles.wardItemTop}>
                    <Text style={styles.wardNameText}>{wardName}</Text>
                    <Text style={styles.wardEtaText}>{arrivalEta}</Text>
                  </View>
                  <View style={styles.wardBarTrack}>
                    <View
                      style={[
                        styles.wardBarFill,
                        {
                          width: `${barPercent}%` as DimensionValue,
                          backgroundColor:
                            p.aqi_index > 400
                              ? Colors.aqiHazardous
                              : p.aqi_index > 300
                              ? Colors.coralWatermelonVivid
                              : Colors.terracottaDeep,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.wardItemBottom}>
                    <Text style={styles.wardAqiText}>AQI {p.aqi_index} • {pointAqi.category}</Text>
                    <Text style={styles.wardPmText}>{Math.round(p.pm25_estimate)} µg/m³ PM2.5</Text>
                  </View>
                </View>
              );
            })}
            {!surfaceData?.features?.length && <Text style={styles.heroBodyText}>No current surface-grid values are available.</Text>}
          </View>
        </NeoCard>

        {/* Boundary Physics Bento Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Boundary Physics &amp; Lag</Text>
            <Text style={styles.titleSparkle}>✦</Text>
          </View>
          <Text style={styles.sectionMeta}>MODEL WEATHER &bull; CORRELATION</Text>
        </View>

        <View style={styles.bentoGrid}>
          {/* Bento Item 1: BL Mixing Height */}
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.bentoItem}>
            <View style={styles.bentoLeft}>
              <View style={[styles.bentoIcon, { backgroundColor: Colors.primary }]}>
                <MaterialCommunityIcons name="arrow-collapse-down" size={20} color={Colors.canvasCream} />
              </View>
              <View>
                <View style={styles.bentoTitleRow}>
                  <Text style={styles.bentoTitle}>BL Mixing Height</Text>
                  <Text style={styles.bentoTag}>{blMixingHeight !== null ? 'Model weather' : 'Unavailable'}</Text>
                </View>
                <Text style={styles.bentoDesc}>Open-Meteo boundary-layer estimate</Text>
              </View>
            </View>
            <View style={styles.bentoValBox}>
              <Text style={styles.bentoVal}>{blMixingHeight !== null ? Math.round(blMixingHeight) : 'N/A'}</Text>
              <Text style={styles.bentoUnit}>m AGL</Text>
            </View>
          </NeoCard>

          {/* Bento Item 2: Lag & Total FRP */}
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.bentoItem}>
            <View style={styles.bentoLeft}>
              <View style={[styles.bentoIcon, { backgroundColor: Colors.terracottaDeep }]}>
                <MaterialCommunityIcons name="fire" size={20} color={Colors.canvasCream} />
              </View>
              <View>
                <View style={styles.bentoTitleRow}>
                  <Text style={styles.bentoTitle}>Biomass FRP Flux</Text>
                  <Text style={[styles.bentoTag, { color: Colors.terracottaDeep }]}>{strongestLag ? `Pearson r=${strongestLag.pearson_r.toFixed(2)}` : 'Insufficient history'}</Text>
                </View>
                <Text style={styles.bentoDesc}>Strongest lag: {strongestLag ? `T+${strongestLag.lag_hours}h` : 'not computed'}</Text>
              </View>
            </View>
            <View style={styles.bentoValBox}>
              <Text style={styles.bentoVal}>{totalFrp !== null ? totalFrp.toFixed(1) : 'N/A'}</Text>
              <Text style={styles.bentoUnit}>MW FRP</Text>
            </View>
          </NeoCard>

          {/* Bento Item 3: Stagnation Lock */}
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.bentoItem}>
            <View style={styles.bentoLeft}>
              <View style={[styles.bentoIcon, { backgroundColor: Colors.forestJade }]}>
                <MaterialCommunityIcons name="lock" size={20} color={Colors.canvasCream} />
              </View>
              <View>
                <View style={styles.bentoTitleRow}>
                  <Text style={styles.bentoTitle}>Stagnation Lock</Text>
                  <Text style={[styles.bentoTag, { color: Colors.forestJade }]}>{ventilationIndex !== null ? (ventilationIndex < 2200 ? 'Low ventilation' : 'Ventilating') : 'Unavailable'}</Text>
                </View>
                <Text style={styles.bentoDesc}>Ventilation index &lt; 2,200 m²/s</Text>
              </View>
            </View>
            <View style={styles.bentoValBox}>
              <Text style={styles.bentoVal}>{ventilationIndex !== null ? Math.round(ventilationIndex).toLocaleString() : 'N/A'}</Text>
              <Text style={styles.bentoUnit}>m²/s</Text>
            </View>
          </NeoCard>
        </View>

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
  heroCard: {
    overflow: 'hidden',
  },
  heroBanner: {
    backgroundColor: Colors.primaryContainer,
    padding: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.inkBlack,
  },
  heroBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSubTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryFixedDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  warmBadge: {
    backgroundColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    transform: [{ rotate: '4deg' }],
  },
  warmBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  heroHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroLocation: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onPrimaryContainer,
    marginTop: 2,
  },
  heroContent: {
    padding: 14,
    gap: 10,
  },
  heroChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  windChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EA580C22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  windChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.terracottaDeep,
  },
  heroBodyText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 18,
  },
  scrubberBox: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 12,
    gap: 8,
  },
  scrubberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrubberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scrubberTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  scrubberTimeIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  scrubberTrack: {
    height: 10,
    backgroundColor: '#E4E1E6',
    borderRadius: 5,
    position: 'relative',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: 10,
    backgroundColor: Colors.coralWatermelonVivid,
    borderRadius: 5,
  },
  scrubberHandle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.inkBlack,
    borderWidth: 2,
    borderColor: Colors.coralWatermelonVivid,
    top: -4,
    marginLeft: -9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.canvasCream,
  },
  milestoneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  milestoneText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  milestoneActive: {
    fontWeight: '900',
    color: Colors.coralWatermelonVivid,
  },
  playBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inkBlack,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 5,
  },
  playButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resetButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
    letterSpacing: 0.5,
  },
  bentoGrid: {
    gap: 8,
  },
  bentoItem: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bentoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bentoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bentoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  bentoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.coralWatermelonVivid,
  },
  bentoDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
    marginTop: 1,
  },
  bentoValBox: {
    alignItems: 'flex-end',
  },
  bentoVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  bentoUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  horizonBar: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 3,
  },
  horizonPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9999,
  },
  horizonPillActive: {
    backgroundColor: Colors.inkBlack,
  },
  horizonPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  horizonPillTextActive: {
    color: Colors.canvasCream,
    fontWeight: '800',
  },
  mandateToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.forestJade,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mandateToastText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  mandateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.coralWatermelonVivid,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  mandateBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  wardCard: {
    padding: 12,
    gap: 10,
  },
  wardCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wardCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  badgeMini: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgeMiniText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.terracottaDeep,
    letterSpacing: 0.5,
  },
  wardList: {
    gap: 8,
  },
  wardItemBox: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    padding: 8,
    gap: 4,
  },
  wardItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wardNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  wardEtaText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  wardBarTrack: {
    height: 6,
    backgroundColor: '#E4E1E6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  wardBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  wardItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wardAqiText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  wardPmText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.terracottaDeep,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: Colors.coralWatermelonVivid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.coralWatermelonVivid,
  },
  errorRetryBtn: {
    backgroundColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorRetryText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  svgMapContainer: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.inkBlack,
    overflow: 'hidden',
  },
  svgMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  svgMapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  svgMapTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  svgMapFrontBadge: {
    fontSize: 9.5,
    fontWeight: '900',
    color: Colors.coralWatermelonVivid,
    backgroundColor: 'rgba(255,83,118,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  svgCanvas: {
    backgroundColor: '#0F172A',
  },
  horizonCard: {
    padding: 14,
    gap: 12,
  },
  horizonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horizonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  horizonCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  horizonGrid: {
    gap: 10,
  },
  horizonBox: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E3D7',
    padding: 10,
    gap: 6,
  },
  horizonBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horizonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  horizonBoxTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  horizonBoxLoc: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  horizonMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  horizonPmVal: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  horizonAqiVal: {
    fontSize: 11,
    fontWeight: '800',
  },
  horizonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(24,24,27,0.06)',
    paddingTop: 4,
  },
  horizonStatusText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  horizonWindText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
});
