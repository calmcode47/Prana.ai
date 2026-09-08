import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  DimensionValue,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { NeoButton } from '../components/NeoButton';
import { StarburstBadge } from '../components/StarburstBadge';
import { uploadCitizenSkyPhoto, CitizenPhotoResponse } from '../api/client';

interface CitizenScannerScreenProps {
  onClose?: () => void;
}

type PresetKey = 'clear' | 'haze' | 'smog';

interface PresetInfo {
  name: string;
  desc: string;
  lat: string;
  lon: string;
  color: string;
  gradientBg: string;
}

const PRESETS: Record<PresetKey, PresetInfo> = {
  clear: {
    name: 'Sangrur Rural Harvest Outskirts',
    desc: 'Saved observation coordinates for the Sangrur area',
    lat: '30.2450',
    lon: '75.8420',
    color: '#92D050',
    gradientBg: '#38BDF8',
  },
  haze: {
    name: 'Panipat NH-44 Highway Transit Belt',
    desc: 'Saved observation coordinates for the Panipat area',
    lat: '29.3909',
    lon: '76.9635',
    color: '#F97316',
    gradientBg: '#F59E0B',
  },
  smog: {
    name: 'Anand Vihar ISBT Receptor Basin',
    desc: 'Saved observation coordinates for the Anand Vihar area',
    lat: '28.6472',
    lon: '77.3160',
    color: '#8F3F97',
    gradientBg: '#64748B',
  },
};

export const CitizenScannerScreen: React.FC<CitizenScannerScreenProps> = ({ onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('smog');
  const [latitude, setLatitude] = useState<string>('28.6472');
  const [longitude, setLongitude] = useState<string>('77.3160');

  const [isInferring, setIsInferring] = useState<boolean>(false);
  const [hasResult, setHasResult] = useState<boolean>(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // Optical and PM2.5 results
  const [pm25Est, setPm25Est] = useState<number>(0);
  const [aqiIndex, setAqiIndex] = useState<number>(0);
  const [aqiCategory, setAqiCategory] = useState<string>('Not analysed');
  const [aqiColor, setAqiColor] = useState<string>(Colors.inkMuted);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [inferenceTimeMs, setInferenceTimeMs] = useState<number>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    const p = PRESETS[key];
    setLatitude(p.lat);
    setLongitude(p.lon);
    setPhotoUri(null);
    setHasResult(false);
    setReportSubmitted(false);
    setAnalysisError(null);
  };

  const usePickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setPhotoUri(asset.uri);
    setPhotoMimeType(asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg');
    setHasResult(false);
    setReportSubmitted(false);
    setAnalysisError(null);
  };

  const handleCapturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setAnalysisError('Camera permission is required to capture a sky photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) usePickedAsset(result.assets[0]);
  };

  const handleChoosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) usePickedAsset(result.assets[0]);
  };

  const handleAnalyseHaze = async () => {
    if (isInferring) return;
    if (!photoUri) {
      setAnalysisError('Capture or choose a real sky photo before analysis.');
      return;
    }
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      setAnalysisError('Enter valid latitude and longitude values.');
      return;
    }
    setIsInferring(true);
    setReportSubmitted(false);
    setAnalysisError(null);

    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await fetch(photoUri).then((response) => response.blob());
        formData.append('photo', blob, photoMimeType === 'image/png' ? 'sky_photo.png' : 'sky_photo.jpg');
      } else {
        formData.append('photo', { uri: photoUri, name: photoMimeType === 'image/png' ? 'sky_photo.png' : 'sky_photo.jpg', type: photoMimeType } as any);
      }
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);

      const res: CitizenPhotoResponse = await uploadCitizenSkyPhoto(formData);
      if (res && typeof res.pm25_estimate === 'number') {
        setPm25Est(Math.round(res.pm25_estimate));
        setAqiIndex(res.aqi_index);
        setAqiCategory(res.aqi_category);
        setAqiColor(res.aqi_color);
        setConfidence(res.confidence === 'low' ? 'low' : res.confidence === 'medium' ? 'medium' : 'high');
        setInferenceTimeMs(res.processing_time_ms);
        setReportSubmitted(true);
        setHasResult(true);
      }
    } catch (error) {
      setHasResult(false);
      setReportSubmitted(false);
      setAnalysisError(error instanceof Error ? error.message : 'Photo analysis failed.');
    } finally {
      setIsInferring(false);
    }
  };

  const activePreset = PRESETS[selectedPreset];

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={Colors.inkBlack} />
            </Pressable>
          )}
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Sky Haze Scanner</Text>
              <Text style={styles.titleSparkle}>✦</Text>
            </View>
            <Text style={styles.screenSubtitle}>DCP Optical Extinction &amp; Ingestion Engine</Text>
          </View>
        </View>
        <StarburstBadge label="DCP OPTICAL τ" rotation="-2deg" shadowColor={Colors.coralWatermelon} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Editorial Policy Badges */}
        <View style={styles.editorialBadgeRow}>
          <View style={styles.policyPill}>
            <View style={styles.livePulseDot} />
            <Text style={styles.policyPillText}>PHOTO HAZE ESTIMATE</Text>
          </View>
          <View style={styles.privacyPill}>
            <MaterialCommunityIcons name="shield-lock-outline" size={12} color={Colors.cobaltDeep} />
            <Text style={styles.privacyPillText}>METADATA REMOVED</Text>
          </View>
          <View style={styles.noisePill}>
            <Text style={styles.noisePillText}>σ=0.02 Noise</Text>
          </View>
        </View>

        {/* Section Headline & Description */}
        <View style={styles.introBox}>
          <Text style={styles.introPretitle}>CITIZEN SCIENCE PHOTO ANALYSIS</Text>
          <Text style={styles.introHeading}>
            Decomposes RGB sky imagery using Dark Channel Prior to estimate optical thickness (τ) and compute ground PM2.5 concentrations.
          </Text>
        </View>

        {/* Atmospheric Calibration Presets Selector */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.presetCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="tune-variant" size={16} color={Colors.cobaltDeep} />
              <Text style={styles.cardTitle}>Atmospheric Calibration Presets</Text>
            </View>
            <Text style={styles.cardHeaderBadge}>3 Airshed Zones</Text>
          </View>
          <Text style={styles.presetExplainer}>
            Select saved observation coordinates, then capture or choose the real sky image to analyse:
          </Text>

          <View style={styles.presetGrid}>
            {(['clear', 'haze', 'smog'] as const).map((key) => {
              const isSelected = selectedPreset === key;
              const p = PRESETS[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => handleSelectPreset(key)}
                  style={[
                    styles.presetButton,
                    isSelected ? styles.presetButtonActive : styles.presetButtonInactive,
                  ]}
                >
                  <View style={styles.presetButtonTop}>
                    <Text style={[styles.presetKeyText, isSelected && styles.presetKeyTextActive]}>
                      {key.toUpperCase()}
                    </Text>
                    <View style={[styles.presetDot, { backgroundColor: p.color }]} />
                  </View>
                  <Text style={styles.presetZoneName} numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                  <Text style={styles.presetCoordsText}>
                    {p.lat}°N, {p.lon}°E
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Active Preset Description Banner */}
          <View style={styles.activePresetDescBanner}>
            <View style={[styles.activePresetStripe, { backgroundColor: activePreset.color }]} />
            <View style={styles.activePresetDescBody}>
              <Text style={styles.activePresetTitle}>{activePreset.name}</Text>
              <Text style={styles.activePresetDesc}>{activePreset.desc}</Text>
            </View>
          </View>
        </NeoCard>

        {/* Camera Viewfinder & Sky Photo Canvas */}
        <NeoCard backgroundColor={Colors.inkBlack} style={styles.viewfinderCard}>
          <View style={styles.viewfinder}>
            {/* Ambient Haze Tone Preview */}
            <View
              style={[
                styles.hazeCanvasBackground,
                { backgroundColor: photoUri ? '#3F3F46' : activePreset.gradientBg },
              ]}
            >
              {photoUri && <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
              <View style={styles.reticleOverlayGrid} />

              {/* Scanning Sweep Laser Beam */}
              {isInferring && <View style={styles.scanningBeam} />}
            </View>

            {/* Top Viewfinder Stats */}
            <View style={styles.vfTopRow}>
              <View style={styles.reticleBadge}>
                <View style={styles.redPulse} />
                <Text style={styles.reticleText}>224 × 224 RGB TENSOR</Text>
              </View>
              <View style={styles.sunBadge}>
                <MaterialCommunityIcons name="white-balance-sunny" size={13} color={Colors.aqiModerate} />
                <Text style={styles.sunText}>{photoUri ? 'Real image selected' : 'No image selected'}</Text>
              </View>
            </View>

            {/* Center Viewfinder Reticle & Crosshair */}
            <View style={styles.reticleCrosshairBox}>
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />
              <View style={styles.reticleCircle}>
                <View style={styles.centerDot} />
              </View>
              <View style={styles.horizonGuide}>
                <Text style={styles.horizonGuideText}>ALIGN HORIZON SKYLINE</Text>
              </View>
            </View>

            {/* Bottom Viewfinder Telemetry */}
            <View style={styles.vfBottomRow}>
              <View style={styles.gpsRow}>
                <MaterialCommunityIcons name="map-marker" size={14} color={Colors.terracottaDeep} />
                <Text style={styles.gpsText}>
                  {latitude}° N, {longitude}° E
                </Text>
              </View>
              <Text style={styles.isoText}>
                {photoUri ? 'FRAME SELECTED' : 'READY TO CAPTURE'}
              </Text>
            </View>
          </View>

          {/* Shutter & Sample Optic Toolbar */}
          <View style={styles.captureToolbar}>
            <Pressable
              onPress={handleCapturePhoto}
              style={styles.shutterBtn}
            >
              <MaterialCommunityIcons
                name={photoUri ? 'camera-retake' : 'camera'}
                size={18}
                color={Colors.coralWatermelonVivid}
              />
              <Text style={styles.shutterBtnText}>{photoUri ? 'Retake Sky Frame' : 'Capture Sky Photo'}</Text>
            </Pressable>

            <Pressable
              onPress={handleChoosePhoto}
              style={styles.sampleOpticBtn}
            >
              <MaterialCommunityIcons name="image-filter-hdr" size={18} color={Colors.cobaltDeep} />
              <Text style={styles.sampleOpticText}>Choose Sky Photo</Text>
            </Pressable>
          </View>
        </NeoCard>

        {/* Observation Coordinates Form */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.coordsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="crosshairs-gps" size={16} color={Colors.coralWatermelonVivid} />
              <Text style={styles.cardTitle}>Observation Coordinates</Text>
            </View>
            <Text style={styles.cardHeaderBadge}>GPS WGS-84</Text>
          </View>

          <View style={styles.coordsInputRow}>
            <View style={styles.coordInputCol}>
              <Text style={styles.coordInputLabel}>Observation Latitude (°N)</Text>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
                style={styles.coordInputField}
              />
            </View>

            <View style={styles.coordInputCol}>
              <Text style={styles.coordInputLabel}>Observation Longitude (°E)</Text>
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
                style={styles.coordInputField}
              />
            </View>
          </View>
        </NeoCard>

        {/* Tactile Inference Action Trigger */}
        <NeoButton
          onPress={handleAnalyseHaze}
          disabled={isInferring}
          backgroundColor={Colors.inkBlack}
          shadowColor={Colors.cobaltDeep}
          shadowOffset={4}
          style={styles.inferenceBtnContent}
        >
          <View style={styles.inferenceBtnLeft}>
            <Text style={styles.btnSparkle}>✦</Text>
            <Text style={styles.inferenceBtnText}>
              {isInferring ? 'Decomposing Optical Depth...' : 'Trigger DCP Sky Haze Inference'}
            </Text>
          </View>
          <View style={styles.arrowCircle}>
            <MaterialCommunityIcons
              name={isInferring ? 'loading' : 'arrow-right'}
              size={18}
              color={Colors.canvasCream}
            />
          </View>
        </NeoButton>
        {analysisError && <Text style={styles.presetExplainer}>{analysisError}</Text>}

        {/* Live Ground Receptor Estimation Result Card */}
        {hasResult && (
          <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.resultCard}>
            {/* Speed & Algorithm Header */}
            <View style={styles.resultHeader}>
              <View style={styles.speedBadge}>
                <View style={styles.speedDot} />
                <Text style={styles.speedText}>Latency: {inferenceTimeMs}ms</Text>
              </View>
              <View style={styles.modelTag}>
                <MaterialCommunityIcons name="brain" size={14} color={Colors.inkMuted} />
                <Text style={styles.modelTagText}>FastAPI DCP Dark Channel Prior</Text>
              </View>
            </View>

            {/* Primary Telemetry Readout Block */}
            <View style={styles.readoutBox}>
              <View style={styles.readoutTop}>
                <Text style={styles.readoutLabel}>GROUND RECEPTOR ESTIMATION</Text>
                <View style={[styles.hazardChip, { backgroundColor: aqiColor }]}>
                  <Text style={styles.hazardChipText}>AQI {aqiIndex} • {aqiCategory}</Text>
                </View>
              </View>

              <View style={styles.readoutNumbersRow}>
                <View>
                  <Text style={styles.bigMassNumber}>
                    {pm25Est} <Text style={styles.bigMassUnit}>µg/m³</Text>
                  </Text>
                  <Text style={styles.massSub}>PM2.5 Mass Concentration</Text>
                </View>

                <View style={[styles.aqiReadoutBox, { borderColor: aqiColor }]}>
                  <Text style={[styles.aqiReadoutVal, { color: aqiColor }]}>{aqiIndex}</Text>
                  <Text style={styles.aqiReadoutLabel}>Sub-Index</Text>
                </View>
              </View>
            </View>

            {/* Monte-Carlo Confidence Bar */}
            <View style={styles.confidenceBox}>
              <View style={styles.confidenceTop}>
                <Text style={styles.confidenceLabel}>Backend perturbation confidence:</Text>
                <Text style={styles.confidenceVal}>{confidence.toUpperCase()} CONFIDENCE</Text>
              </View>
              <View style={styles.confidenceTrack}>
                <View
                  style={[
                    styles.confidenceBar,
                    {
                      width:
                        confidence === 'high'
                          ? ('92%' as DimensionValue)
                          : confidence === 'medium'
                          ? ('68%' as DimensionValue)
                          : ('40%' as DimensionValue),
                    },
                  ]}
                />
              </View>
            </View>

            {/* Optical Diagnostic Metrics Grid */}
            <View style={styles.diagGrid}>
              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Patch Min Window</Text>
                <Text style={styles.diagVal}>Ω(x) = 7×7 px</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Transmission Weight</Text>
                <Text style={styles.diagVal}>ω = 0.95 Factor</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Atmospheric Light A</Text>
                <Text style={styles.diagVal}>Top 0.1% Dark</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Detailed Optical Metrics</Text>
                <Text style={styles.diagVal}>Not returned by API</Text>
              </View>
            </View>

            {/* Success Submission Banner */}
            {reportSubmitted && (
              <View style={styles.submissionAlert}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" />
                <Text style={styles.submissionAlertText}>
                  Observation digested. Anonymous SHA-256 telemetry committed to registry.
                </Text>
              </View>
            )}

            {/* Citizen Protection Protocol Advice */}
            <View style={styles.protocolBox}>
              <View style={styles.protocolTitleRow}>
                <MaterialCommunityIcons name="heart-pulse" size={16} color={Colors.coralWatermelonVivid} />
                <Text style={styles.protocolTitle}>Citizen Advisory Protocol</Text>
              </View>

              <View style={styles.protocolItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.forestJade} />
                <Text style={styles.protocolText}>
                  {aqiIndex > 300
                    ? 'Wear N95 respirator mask during all outdoor transit'
                    : 'Air quality within acceptable recreational limits'}
                </Text>
              </View>

              <View style={styles.protocolItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.forestJade} />
                <Text style={styles.protocolText}>
                  {aqiIndex > 300
                    ? 'Operate indoor HEPA air purifier on high speed'
                    : 'Natural cross-ventilation permitted during midday'}
                </Text>
              </View>

              <View style={styles.protocolItem}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={Colors.terracottaDeep} />
                <Text style={styles.protocolText}>
                  {aqiIndex > 300
                    ? 'Cancel outdoor morning athletic and cardio routines'
                    : 'Monitor evening boundary layer inversion descent'}
                </Text>
              </View>
            </View>
          </NeoCard>
        )}

        {/* Zero-Retention Privacy Security Guarantee Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.securityCard}>
          <View style={styles.securityRow}>
            <View style={styles.securityIconCircle}>
              <MaterialCommunityIcons name="shield-check" size={20} color={Colors.coralWatermelonVivid} />
            </View>
            <View style={styles.securityTextCol}>
              <Text style={styles.securityTitle}>Photo Privacy</Text>
              <Text style={styles.securityBody}>
                Uploaded imagery is decoded in memory and stripped of EXIF and camera metadata. The backend stores the anonymous SHA-256 hash, optional coordinates, PM2.5 estimate, and confidence; it does not store the original frame.
              </Text>
            </View>
          </View>
        </NeoCard>

        {/* Scientific Regression Formula Banner */}
        <View style={styles.formulaCard}>
          <View style={styles.formulaHeaderRow}>
            <View style={styles.formulaIconBox}>
              <MaterialCommunityIcons name="calculator-variant" size={20} color={Colors.canvasCream} />
            </View>
            <View style={styles.formulaTitleCol}>
              <Text style={styles.formulaTitle}>Backend Scattering Heuristic</Text>
              <Text style={styles.formulaSubtitle}>Photo-based PM2.5 estimate</Text>
            </View>
            <View style={styles.decPill}>
              <Text style={styles.decPillText}>CPCB AQI MAPPING</Text>
            </View>
          </View>

          <View style={styles.formulaMathBox}>
            <Text style={styles.formulaMathText}>
              PM2.5 (µg/m³) = 20.0 + 125.0 · τ_mean + 18.0 · τ_max − 12.0 · Contrast_lum
            </Text>
            <Text style={styles.formulaSubCaption}>
              The PM2.5 estimate is heuristic and is converted to a CPCB PM2.5 sub-index by the backend.
            </Text>
          </View>
        </View>

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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceVanillaStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
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
  editorialBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  policyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.forestJade,
  },
  policyPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
    letterSpacing: 0.3,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceVanilla,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  privacyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.cobaltDeep,
  },
  noisePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  noisePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  introBox: {
    gap: 4,
    paddingVertical: 2,
  },
  introPretitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.cobaltDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  introHeading: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  presetCard: {
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  cardHeaderBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkMuted,
    backgroundColor: Colors.canvasCream,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  presetExplainer: {
    fontSize: 11,
    color: Colors.inkMuted,
    lineHeight: 15,
  },
  presetGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 3,
  },
  presetButtonActive: {
    backgroundColor: Colors.canvasCream,
    borderColor: Colors.inkBlack,
    shadowColor: Colors.cobaltDeep,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  presetButtonInactive: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderColor: '#DDD7C9',
  },
  presetButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetKeyText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkMuted,
  },
  presetKeyTextActive: {
    color: Colors.inkBlack,
  },
  presetDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  presetZoneName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  presetCoordsText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: Colors.inkMuted,
  },
  activePresetDescBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  activePresetStripe: {
    width: 5,
  },
  activePresetDescBody: {
    flex: 1,
    padding: 8,
    gap: 2,
  },
  activePresetTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  activePresetDesc: {
    fontSize: 10,
    color: Colors.inkMuted,
  },
  viewfinderCard: {
    padding: 8,
    gap: 8,
  },
  viewfinder: {
    height: 220,
    backgroundColor: '#09090B',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  hazeCanvasBackground: {
    ...StyleSheet.absoluteFill,
    opacity: 0.65,
  },
  reticleOverlayGrid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  scanningBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: Colors.coralWatermelonVivid,
    shadowColor: Colors.coralWatermelonVivid,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  vfTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  reticleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#18181BCC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  redPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.coralWatermelonVivid,
  },
  reticleText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.canvasCream,
    letterSpacing: 0.8,
  },
  sunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#18181B99',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  sunText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.surfaceVanilla,
  },
  reticleCrosshairBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 100,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  crosshairV: {
    position: 'absolute',
    height: 100,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  reticleCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.coralWatermelonVivid,
  },
  horizonGuide: {
    position: 'absolute',
    bottom: 35,
    backgroundColor: Colors.surfaceVanilla,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  horizonGuideText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.inkBlack,
    letterSpacing: 0.5,
  },
  vfBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surfaceVanilla,
  },
  isoText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  captureToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  shutterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.inkBlack,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: '#3F3F46',
  },
  shutterBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  sampleOpticBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceVanilla,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
  },
  sampleOpticText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  coordsCard: {
    padding: 14,
    gap: 10,
  },
  coordsInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordInputCol: {
    flex: 1,
    gap: 4,
  },
  coordInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  coordInputField: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  inferenceBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  inferenceBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  btnSparkle: {
    fontSize: 15,
    color: Colors.coralWatermelonVivid,
  },
  inferenceBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.canvasCream,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  resultCard: {
    padding: 14,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceWhite,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
  },
  speedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.coralWatermelonVivid,
  },
  speedText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.inkBlack,
    textTransform: 'uppercase',
  },
  modelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  readoutBox: {
    backgroundColor: Colors.surfaceWhite,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 12,
    gap: 8,
  },
  readoutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readoutLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkMuted,
    letterSpacing: 0.8,
  },
  hazardChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  hazardChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  readoutNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigMassNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  bigMassUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  massSub: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginTop: 2,
  },
  aqiReadoutBox: {
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  aqiReadoutVal: {
    fontSize: 22,
    fontWeight: '900',
  },
  aqiReadoutLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  confidenceBox: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  confidenceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  confidenceVal: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.forestJade,
  },
  confidenceTrack: {
    height: 6,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#DDD7C9',
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: Colors.forestJade,
    borderRadius: 3,
  },
  diagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  diagItem: {
    width: '48%',
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  diagLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  diagVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
    marginTop: 2,
  },
  diagUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  submissionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.forestJade,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  submissionAlertText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  protocolBox: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D4CEBF',
  },
  protocolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  protocolTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protocolText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkBlack,
    flex: 1,
  },
  securityCard: {
    padding: 12,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  securityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTextCol: {
    flex: 1,
    gap: 3,
  },
  securityTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  securityBody: {
    fontSize: 10,
    lineHeight: 14,
    color: Colors.inkMuted,
  },
  formulaCard: {
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 12,
    gap: 8,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  formulaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  formulaIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.cobaltDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaTitleCol: {
    flex: 1,
  },
  formulaTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  formulaSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  decPill: {
    backgroundColor: Colors.canvasCream,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  decPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  formulaMathBox: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D4CEBF',
    gap: 4,
  },
  formulaMathText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.cobaltDeep,
    lineHeight: 14,
  },
  formulaSubCaption: {
    fontSize: 9,
    color: Colors.inkMuted,
  },
});
