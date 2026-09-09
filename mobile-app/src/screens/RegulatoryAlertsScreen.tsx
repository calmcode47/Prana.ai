import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { StarburstBadge } from '../components/StarburstBadge';
import {
  fetchAlerts,
  fetchLatestAlert,
  fetchHotspots,
  fetchCemsForensics,
  fetchAnomalies,
  fetchLegalRegistry,
  fetchSignaturePackage,
  queueLegalDispatch,
  createLegalNotice,
  IncidentItem,
  CemsForensicsResponse,
  AnomaliesResponse,
  LegalRegistryResponse,
  formatDataSource,
  formatBackendStatus,
  getNoticePdfUrl,
  getEvidenceCertUrl,
  getDossierZipUrl,
} from '../api/client';

export const RegulatoryAlertsScreen: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi' | 'pa'>('en');
  const [filter, setFilter] = useState<'all' | 'emergency' | 'nighttime' | 'stubble'>('all');
  const [noticeDrafted, setNoticeDrafted] = useState<boolean>(false);
  const [draftedNoticeId, setDraftedNoticeId] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [sealedPramaan, setSealedPramaan] = useState<boolean>(false);
  const [transmittedToDM, setTransmittedToDM] = useState<boolean>(false);
  const [pipelineToast, setPipelineToast] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [activeFiresCount, setActiveFiresCount] = useState<number | null>(null);
  const [cemsData, setCemsData] = useState<CemsForensicsResponse | null>(null);
  const [legalRegistry, setLegalRegistry] = useState<LegalRegistryResponse | null>(null);
  const [anomaliesCount, setAnomaliesCount] = useState<number | null>(null);

  const [bulletinHeading, setBulletinHeading] = useState<string>('Checking current alerts…');
  const [bulletinBody, setBulletinBody] = useState<string>('The backend has not returned a bulletin yet.');

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBulletin = useCallback(async (lang: 'en' | 'hi' | 'pa') => {
    try {
      const res = await fetchLatestAlert(lang);
      if (res?.title && res?.body) {
        setBulletinHeading(res.title);
        setBulletinBody(res.body);
      } else {
        setBulletinHeading('No alert issued in the last 24 hours');
        setBulletinBody('There is no current multilingual regulatory bulletin from the backend.');
      }
    } catch (error) {
      setBulletinHeading('Bulletin unavailable');
      setBulletinBody(error instanceof Error ? error.message : 'The backend could not be reached.');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [hotspotsRes, alertsRes, cemsRes, registryRes, anomaliesRes] = await Promise.allSettled([
        fetchHotspots(24, 'nominal'),
        fetchAlerts(),
        fetchCemsForensics('CEMS-FLUE-MAN8', 24),
        fetchLegalRegistry(),
        fetchAnomalies('no2', true, 7),
      ]);

      if (hotspotsRes.status === 'fulfilled') setActiveFiresCount(hotspotsRes.value.count);
      if (alertsRes.status === 'fulfilled') setIncidents(alertsRes.value.items);
      if (cemsRes.status === 'fulfilled') setCemsData(cemsRes.value);
      if (registryRes.status === 'fulfilled') setLegalRegistry(registryRes.value);
      if (anomaliesRes.status === 'fulfilled' && typeof anomaliesRes.value?.count === 'number') {
        setAnomaliesCount(anomaliesRes.value.count);
      }
    } catch (err: unknown) {
      console.warn('[RegulatoryAlerts] loadData:', err instanceof Error ? err.message : err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      loadData(),
      fetchBulletin(selectedLang),
    ]);
    setRefreshing(false);
  }, [loadData, fetchBulletin, selectedLang]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchBulletin(selectedLang);
  }, [fetchBulletin, selectedLang]);

  const handleDraftNotice = async (incidentId: string) => {
    if (isDrafting) return;
    setIsDrafting(true);
    try {
      const res = await createLegalNotice({
        incident_id: incidentId,
        issuing_authority: 'Delhi Pollution Control Committee (DPCC)',
        authorized_officer: 'Member Secretary, Air Laboratory Division',
        requested_direction: 'Seal unmonitored flue gates and verify ambient PM2.5 within 24 hours under Air Act Section 31A.',
      });
      setDraftedNoticeId(res.notice_id);
      setNoticeDrafted(true);
      setPipelineToast(`Section 31A Notice #${res.notice_id.slice(-6)} Drafted`);
      setTimeout(() => setPipelineToast(null), 3000);
      fetchLegalRegistry().then(setLegalRegistry).catch((err: unknown) => console.warn('[RegulatoryAlerts] legalRegistry refresh:', err instanceof Error ? err.message : err));
    } catch (error) {
      setNoticeDrafted(false);
      setPipelineToast(`Notice failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setPipelineToast(null), 3000);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSignPramaan = async () => {
    if (!draftedNoticeId) return;
    try {
      const res = await fetchSignaturePackage(draftedNoticeId);
      setSealedPramaan(true);
      setPipelineToast(`Signature package: ${formatBackendStatus(res.status)}`);
      setTimeout(() => setPipelineToast(null), 3000);
    } catch (error) {
      setSealedPramaan(false);
      setPipelineToast(`Signature package failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setPipelineToast(null), 3000);
    }
  };

  const handleTransmitDM = async (incidentId: string) => {
    try {
      const dispatch = await queueLegalDispatch({
        incident_id: incidentId,
        recipient_kind: 'district_magistrate',
        recipient_reference: 'District Magistrate & Police Flying Squad',
        notice_id: draftedNoticeId ?? undefined,
      });
      setTransmittedToDM(true);
      setPipelineToast(`Transmitted to DM & Police (#${dispatch.dispatch_id.slice(-6)})`);
      setTimeout(() => setPipelineToast(null), 3000);
      fetchLegalRegistry().then(setLegalRegistry).catch((err: unknown) => console.warn('[RegulatoryAlerts] legalRegistry refresh:', err instanceof Error ? err.message : err));
    } catch (error) {
      setTransmittedToDM(false);
      setPipelineToast(`Dispatch failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
      setTimeout(() => setPipelineToast(null), 3000);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'emergency') return inc.severity === 'emergency';
    if (filter === 'nighttime') return inc.satellite_source?.toLowerCase().includes('night') || inc.location_text?.toLowerCase().includes('karnal');
    if (filter === 'stubble') return (inc.satellite_evidence?.fire_count_50km ?? 0) > 0;
    return true;
  });

  const firstIncident = filteredIncidents[0];
  const firstId = firstIncident?.incident_id;
  const firstTitle = firstIncident?.location_text ?? 'Location not provided';
  const firstAqi = firstIncident?.measured_aqi;
  const firstPm25 = firstIncident?.measured_pm25;
  const firstFires = firstIncident?.satellite_evidence?.fire_count_50km;
  const firstSource = formatDataSource(firstIncident?.satellite_source, 'Satellite evidence unavailable');

  const secondIncident = filteredIncidents[1];
  const latestCemsWindow = cemsData?.review_windows?.length ? cemsData.review_windows[cemsData.review_windows.length - 1] : null;

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Regulatory Ticker</Text>
            <Text style={styles.titleSparkle}>✦</Text>
          </View>
          <Text style={styles.screenSubtitle}>Statutory SPCB Enforcement Stream</Text>
        </View>
        <StarburstBadge label="SPCB ENFORCEMENT" rotation="3deg" shadowColor={Colors.coralWatermelon} />
      </View>

      {/* Initial Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={Colors.terracottaDeep} />
          <Text style={styles.loadingBannerText}>Fetching regulatory alerts and CEMS telemetry…</Text>
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
        {/* Top 3 Metric Cards */}
        <View style={styles.metricsRow}>
          {/* Metric 1 */}
          <View style={[styles.metricCard, { backgroundColor: Colors.terracottaDeep }]}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricNumber}>{activeFiresCount ?? '—'}</Text>
              <MaterialCommunityIcons name="fire" size={18} color={Colors.canvasCream} />
            </View>
            <Text style={styles.metricName}>Active Fires</Text>
            <Text style={styles.metricSub}>VIIRS Sat 24h</Text>
          </View>

          {/* Metric 2 */}
          <View style={[styles.metricCard, { backgroundColor: Colors.forestJade }]}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricNumber}>{anomaliesCount ?? '—'}</Text>
              <MaterialCommunityIcons name="weather-windy" size={18} color={Colors.canvasCream} />
            </View>
            <Text style={styles.metricName}>Night Anomalies</Text>
            <Text style={styles.metricSub}>Last 7 days</Text>
          </View>

          {/* Metric 3 */}
          <View style={[styles.metricCard, { backgroundColor: Colors.primaryContainer }]}>
            <View style={styles.metricCardTop}>
              <Text style={styles.metricNumber}>{legalRegistry?.notices.length ?? '—'}</Text>
              <MaterialCommunityIcons name="file-document-alert" size={18} color={Colors.canvasCream} />
            </View>
            <Text style={styles.metricName}>SPCB Dockets</Text>
            <Text style={styles.metricSub}>Show-Cause Iss.</Text>
          </View>
        </View>

        {/* Multilingual Advisory Language Toggle */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.langCard}>
          <View style={styles.langHeader}>
            <View style={styles.langTitleRow}>
              <MaterialCommunityIcons name="translate" size={18} color={Colors.inkMuted} />
              <Text style={styles.langLabel}>Advisory Language:</Text>
            </View>
            <View style={styles.langToggleGroup}>
              <Pressable
                onPress={() => setSelectedLang('en')}
                style={[styles.langBtn, selectedLang === 'en' && styles.langBtnActive]}
              >
                <Text style={[styles.langBtnText, selectedLang === 'en' && styles.langBtnTextActive]}>EN</Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedLang('hi')}
                style={[styles.langBtn, selectedLang === 'hi' && styles.langBtnActive]}
              >
                <Text style={[styles.langBtnText, selectedLang === 'hi' && styles.langBtnTextActive]}>हिन्दी</Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedLang('pa')}
                style={[styles.langBtn, selectedLang === 'pa' && styles.langBtnActive]}
              >
                <Text style={[styles.langBtnText, selectedLang === 'pa' && styles.langBtnTextActive]}>ਪੰਜਾਬੀ</Text>
              </Pressable>
            </View>
          </View>

          {/* Translated Bulletin */}
          <View style={styles.bulletinBox}>
            <Text style={styles.bulletinHeading}>{bulletinHeading}</Text>
            <Text style={styles.bulletinBody}>{bulletinBody}</Text>
          </View>
        </NeoCard>

        {/* Category Filter Pills Matching Web */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFiltersRow}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.categoryPill, filter === 'all' && styles.categoryPillActive]}
          >
            <Text style={[styles.categoryPillText, filter === 'all' && styles.categoryPillTextActive]}>
              ✦ All Incidents ({incidents.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('emergency')}
            style={[styles.categoryPill, filter === 'emergency' && styles.categoryPillActive]}
          >
            <View style={[styles.filterDot, { backgroundColor: Colors.aqiSevere }]} />
            <Text style={[styles.categoryPillText, filter === 'emergency' && styles.categoryPillTextActive]}>
              Emergency Breaches ({incidents.filter((i) => i.severity === 'emergency').length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('nighttime')}
            style={[styles.categoryPill, filter === 'nighttime' && styles.categoryPillActive]}
          >
            <MaterialCommunityIcons name="weather-night" size={13} color={filter === 'nighttime' ? Colors.canvasCream : Colors.inkBlack} />
            <Text style={[styles.categoryPillText, filter === 'nighttime' && styles.categoryPillTextActive]}>
              Nighttime Anomalies ({anomaliesCount ?? '—'})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('stubble')}
            style={[styles.categoryPill, filter === 'stubble' && styles.categoryPillActive]}
          >
            <MaterialCommunityIcons name="fire" size={13} color={filter === 'stubble' ? Colors.canvasCream : Colors.terracottaDeep} />
            <Text style={[styles.categoryPillText, filter === 'stubble' && styles.categoryPillTextActive]}>
              Stubble Hotspots ({activeFiresCount ?? '—'})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Legal Pipeline Action Toast */}
        {pipelineToast && (
          <View style={styles.toastBanner}>
            <MaterialCommunityIcons name="check-circle" size={16} color={Colors.canvasCream} />
            <Text style={styles.toastText}>{pipelineToast}</Text>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.streamSectionHeader}>
          <View style={styles.streamTitleRow}>
            <Text style={styles.streamTitle}>Active Enforcement Stream</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>{filteredIncidents.length} live</Text>
            </View>
          </View>
          <Text style={styles.streamMeta}>Backend SPCB Registry</Text>
        </View>

        {/* Enforcement Card 1: Emergency Incident with 3-Step Pipeline */}
        {firstIncident && firstId ? <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.incidentCard}>
          {/* Top header row */}
          <View style={styles.incidentTopRow}>
            <View style={styles.incidentTagsRow}>
              <View style={styles.emergencyTag}>
                <View style={styles.whitePulse} />
                <Text style={styles.emergencyTagText}>{firstIncident.severity.toUpperCase()}</Text>
              </View>
              <Text style={styles.incidentCode}>{firstId}</Text>
            </View>
            <View style={styles.aqiChip}>
              <Text style={styles.aqiChipText}>AQI {firstAqi ?? '—'} • {firstIncident.severity.toUpperCase()}</Text>
            </View>
          </View>

          {/* Incident title and details */}
          <Text style={styles.incidentTitle}>{firstTitle}</Text>
          <Text style={styles.incidentDesc}>
            Backend incident created {new Date(firstIncident.created_at).toLocaleString()} by {firstIncident.authority ?? 'authority not provided'}.
          </Text>

          {/* Evidence Visual Block */}
          <View style={styles.evidenceBlock}>
            <View style={styles.evidenceBanner}>
              <View style={styles.evidenceSource}>
                <MaterialCommunityIcons name="satellite-variant" size={14} color={Colors.coralWatermelonVivid} />
                <Text style={styles.evidenceSourceText}>{firstSource}</Text>
              </View>
              <Text style={styles.evidenceTime}>{firstIncident.satellite_ts ? new Date(firstIncident.satellite_ts).toLocaleString() : 'No evidence timestamp'}</Text>
            </View>

            <View style={styles.evidenceMetrics}>
              <View style={styles.evidenceMetric}>
                <MaterialCommunityIcons name="fire" size={14} color={Colors.terracottaDeep} />
                <Text style={styles.evidenceMetricText}>{firstFires ?? '—'} fires within 50 km</Text>
              </View>
              <View style={styles.evidenceDivider} />
              <Text style={styles.evidenceMetricText}>
                <Text style={{ fontWeight: '800', color: Colors.coralWatermelonVivid }}>{firstPm25 != null ? `${firstPm25.toFixed(1)} µg/m³` : 'No PM2.5 value'}</Text> PM2.5
              </Text>
            </View>
          </View>

          {/* 3-Step Statutory Enforcement Action Strip */}
          <View style={styles.legalPipelineBox}>
            <Text style={styles.legalPipelineTitle}>Statutory Enforcement Pipeline (Air Act § 31A):</Text>
            
            {/* Step 1: Draft notice */}
            <Pressable
              onPress={() => handleDraftNotice(firstId)}
              disabled={isDrafting}
              style={[styles.pipelineStepBtn, noticeDrafted && styles.pipelineStepBtnComplete]}
            >
              <MaterialCommunityIcons
                name={noticeDrafted ? 'check-circle' : 'file-document-edit'}
                size={14}
                color={noticeDrafted ? Colors.canvasCream : Colors.inkBlack}
              />
              <Text style={[styles.pipelineStepBtnText, noticeDrafted && styles.pipelineStepBtnTextComplete]}>
                1. {noticeDrafted ? `Notice ${draftedNoticeId ?? 'Drafted'}` : 'Draft Section 31A Notice'}
              </Text>
            </Pressable>

            {/* Step 2: Prepare provider package */}
            <Pressable
              onPress={handleSignPramaan}
              disabled={!noticeDrafted}
              style={[
                styles.pipelineStepBtn,
                sealedPramaan && styles.pipelineStepBtnComplete,
                !noticeDrafted && { opacity: 0.5 },
              ]}
            >
              <MaterialCommunityIcons
                name={sealedPramaan ? 'check-decagram' : 'certificate'}
                size={14}
                color={sealedPramaan ? Colors.canvasCream : Colors.inkBlack}
              />
              <Text style={[styles.pipelineStepBtnText, sealedPramaan && styles.pipelineStepBtnTextComplete]}>
                2. {sealedPramaan ? 'Signature Package Prepared' : 'Prepare Signature Package'}
              </Text>
            </Pressable>

            {/* Step 3: Transmit to DM */}
            <Pressable
              onPress={() => handleTransmitDM(firstId)}
              disabled={!sealedPramaan}
              style={[
                styles.pipelineStepBtn,
                styles.pipelineStepBtnPrimary,
                transmittedToDM && styles.pipelineStepBtnComplete,
                !sealedPramaan && { opacity: 0.5 },
              ]}
            >
              <MaterialCommunityIcons
                name={transmittedToDM ? 'truck-fast' : 'send-circle'}
                size={14}
                color={Colors.canvasCream}
              />
              <Text style={[styles.pipelineStepBtnText, { color: Colors.canvasCream }]}>
                3. {transmittedToDM ? 'Dispatched to Flying Squad' : 'Transmit to District Magistrate'}
              </Text>
            </Pressable>

            {/* Document download row — shown once a notice has been drafted */}
            {noticeDrafted && draftedNoticeId && (
              <View style={styles.downloadRow}>
                <Pressable
                  onPress={() => Linking.openURL(getNoticePdfUrl(draftedNoticeId))}
                  style={styles.downloadBtn}
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={14} color={Colors.terracottaDeep} />
                  <Text style={styles.downloadBtnText}>Draft PDF</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(getEvidenceCertUrl(draftedNoticeId))}
                  style={styles.downloadBtn}
                >
                  <MaterialCommunityIcons name="certificate" size={14} color={Colors.primaryContainer} />
                  <Text style={styles.downloadBtnText}>Evidence Cert</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(getDossierZipUrl(firstId))}
                  style={styles.downloadBtn}
                >
                  <MaterialCommunityIcons name="folder-zip" size={14} color={Colors.forestJade} />
                  <Text style={styles.downloadBtnText}>Dossier ZIP</Text>
                </Pressable>
              </View>
            )}
          </View>
        </NeoCard> : (
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.incidentCard}>
            <Text style={styles.incidentTitle}>No incidents match this filter</Text>
            <Text style={styles.incidentDesc}>The backend returned no current enforcement record for this view.</Text>
          </NeoCard>
        )}

        {/* CEMS Industrial Forensics Dossier Card */}
        <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.cemsCard}>
          <View style={styles.cemsHeader}>
            <View style={styles.cemsTitleRow}>
              <MaterialCommunityIcons name="factory" size={18} color={Colors.terracottaDeep} />
              <Text style={styles.cemsTitle}>CEMS Industrial Forensic Dossier</Text>
            </View>
            <View style={styles.cemsBadge}>
              <Text style={styles.cemsBadgeText}>
                {formatBackendStatus(cemsData?.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.cemsFacilityText}>Facility ID: CEMS-FLUE-MAN8 • Manesar Flue Gate</Text>
          <Text style={styles.cemsDesc}>
            Backend forensic ratios from the latest available CEMS review window. This feed is empty unless industrial telemetry has been ingested.
          </Text>

          <View style={styles.cemsRatiosGrid}>
            <View style={styles.cemsRatioBox}>
              <Text style={styles.cemsRatioLabel}>Stack Velocity Ratio</Text>
              <Text style={[styles.cemsRatioVal, { color: Colors.coralWatermelonVivid }]}>{latestCemsWindow ? latestCemsWindow.stack_velocity_ratio.toFixed(2) : '—'}</Text>
              <Text style={styles.cemsRatioSub}>Latest backend review window</Text>
            </View>
            <View style={styles.cemsRatioBox}>
              <Text style={styles.cemsRatioLabel}>Scrubber Load Ratio</Text>
              <Text style={[styles.cemsRatioVal, { color: Colors.terracottaDeep }]}>{latestCemsWindow ? latestCemsWindow.scrubber_load_ratio.toFixed(2) : '—'}</Text>
              <Text style={styles.cemsRatioSub}>{latestCemsWindow?.classification ?? 'No current review window'}</Text>
            </View>
          </View>
        </NeoCard>

        {/* Legal Registry Feed Card */}
        {legalRegistry && (legalRegistry.notices.length > 0 || legalRegistry.dispatches.length > 0) && (
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.registryCard}>
            <View style={styles.registryHeader}>
              <View style={styles.registryTitleRow}>
                <MaterialCommunityIcons name="book-clock" size={18} color={Colors.cobaltDeep} />
                <Text style={styles.registryTitle}>SPCB Regulatory Registry</Text>
              </View>
              <Text style={styles.registryMeta}>
                {legalRegistry.notices.length} Notices • {legalRegistry.dispatches.length} Dispatches
              </Text>
            </View>

            <View style={styles.registryList}>
              {[...legalRegistry.notices.slice(0, 3)].map((n, idx) => (
                <View key={`n-${idx}`} style={styles.registryItem}>
                  <View style={styles.registryItemTop}>
                    <Text style={styles.registryItemName}>{n.issuing_authority}</Text>
                    <Text style={styles.registryItemStatus}>{formatBackendStatus(n.status)}</Text>
                  </View>
                  <Text style={styles.registryItemSub}>{n.legal_basis} • Notice {n.notice_id}</Text>
                </View>
              ))}
            </View>
          </NeoCard>
        )}

        {/* Enforcement Card 2: Nocturnal Anomaly */}
        {secondIncident && <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.incidentCard}>
          <View style={styles.incidentTopRow}>
            <View style={styles.incidentTagsRow}>
              <View style={[styles.emergencyTag, { backgroundColor: Colors.terracottaDeep }]}>
                <Text style={styles.emergencyTagText}>Nocturnal Anomaly</Text>
              </View>
              <Text style={styles.incidentCode}>{secondIncident.incident_id}</Text>
            </View>
            <View style={styles.aqiChip}>
              <Text style={styles.aqiChipText}>AQI {secondIncident.measured_aqi ?? '—'} • {secondIncident.severity.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.incidentTitle}>{secondIncident.location_text ?? 'Location not provided'}</Text>
          <Text style={styles.incidentDesc}>
            Backend incident created {new Date(secondIncident.created_at).toLocaleString()}; PM2.5 {secondIncident.measured_pm25 != null ? `${secondIncident.measured_pm25.toFixed(1)} µg/m³` : 'not provided'}.
          </Text>
        </NeoCard>}

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
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 10,
  },
  metricCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  metricName: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
    marginTop: 6,
  },
  metricSub: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.canvasCream,
    opacity: 0.8,
  },
  langCard: {
    padding: 12,
    gap: 8,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  langToggleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceVanillaStrong,
  },
  langBtnActive: {
    backgroundColor: Colors.inkBlack,
  },
  langBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  langBtnTextActive: {
    color: Colors.canvasCream,
  },
  bulletinBox: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 8,
    padding: 8,
    gap: 3,
  },
  bulletinHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  bulletinBody: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  streamSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  liveBadge: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  streamMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  incidentCard: {
    padding: 12,
    gap: 8,
  },
  incidentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incidentTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.coralWatermelonVivid,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
    gap: 4,
  },
  whitePulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
  },
  emergencyTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  incidentCode: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  aqiChip: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aqiChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.coralWatermelonVivid,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  incidentDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  evidenceBlock: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    overflow: 'hidden',
  },
  evidenceBanner: {
    backgroundColor: Colors.inkBlack,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceSourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.canvasCream,
  },
  evidenceTime: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.outlineVariant,
  },
  evidenceMetrics: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.outlineVariant,
  },
  evidenceMetricText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkBlack,
  },
  noticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inkBlack,
    borderRadius: 9999,
    paddingVertical: 9,
    gap: 6,
    marginTop: 2,
  },
  noticeButtonDrafted: {
    backgroundColor: Colors.forestJade,
  },
  noticeButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  categoryFiltersRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  categoryPillActive: {
    backgroundColor: Colors.inkBlack,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  categoryPillTextActive: {
    color: Colors.canvasCream,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.forestJade,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  legalPipelineBox: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    padding: 10,
    gap: 6,
    marginTop: 4,
  },
  legalPipelineTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
    textTransform: 'uppercase',
  },
  pipelineStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.canvasCream,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pipelineStepBtnComplete: {
    backgroundColor: Colors.forestJade,
    borderColor: Colors.inkBlack,
  },
  pipelineStepBtnPrimary: {
    backgroundColor: Colors.terracottaDeep,
    borderColor: Colors.inkBlack,
  },
  pipelineStepBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  pipelineStepBtnTextComplete: {
    color: Colors.canvasCream,
  },
  cemsCard: {
    padding: 12,
    gap: 8,
  },
  cemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cemsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cemsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  cemsBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  cemsBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.terracottaDeep,
  },
  cemsFacilityText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  cemsDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 14,
  },
  cemsRatiosGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  cemsRatioBox: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    padding: 8,
    alignItems: 'center',
  },
  cemsRatioLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  cemsRatioVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cemsRatioSub: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginTop: 1,
  },
  registryCard: {
    padding: 12,
    gap: 8,
  },
  registryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  registryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  registryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  registryMeta: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  registryList: {
    gap: 6,
  },
  registryItem: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    padding: 8,
    gap: 2,
  },
  registryItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  registryItemName: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  registryItemStatus: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.cobaltDeep,
  },
  registryItemSub: {
    fontSize: 9,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  downloadRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    backgroundColor: Colors.surfaceVanilla,
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
});
