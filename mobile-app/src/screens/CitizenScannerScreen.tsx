import React, { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { NeoButton } from '../components/NeoButton';
import { StarburstBadge } from '../components/StarburstBadge';
import { uploadCitizenSkyPhoto, CitizenPhotoResponse } from '../api/client';

export interface PastScanRecord {
  id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  pm25: number;
  aqi: number;
  category: string;
  color: string;
  confidence: string;
  presetName: string;
}

export interface QueuedScanItem {
  id: string;
  timestamp: string;
  latitude: string;
  longitude: string;
  photoUri?: string;
  photoBase64?: string | null;
  photoMimeType: string;
}

const SCANS_STORAGE_KEY = '@prana_citizen_scans';
const OFFLINE_QUEUE_KEY = '@prana_citizen_offline_queue';

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

export function base64ToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  if (typeof atob === 'function') {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let bufferLength = raw.length * 0.75;
  if (raw[raw.length - 1] === '=') {
    bufferLength--;
    if (raw[raw.length - 2] === '=') bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < raw.length; i += 4) {
    const encoded1 = lookup[raw.charCodeAt(i)];
    const encoded2 = lookup[raw.charCodeAt(i + 1)];
    const encoded3 = lookup[raw.charCodeAt(i + 2)];
    const encoded4 = lookup[raw.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64 && p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (encoded4 !== 64 && p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
}

export const CitizenScannerScreen: React.FC<CitizenScannerScreenProps> = ({ onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('smog');
  const [latitude, setLatitude] = useState<string>('28.6472');
  const [longitude, setLongitude] = useState<string>('77.3160');

  const [isInferring, setIsInferring] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [hasResult, setHasResult] = useState<boolean>(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // Past scans and offline queue
  const [pastScans, setPastScans] = useState<PastScanRecord[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<QueuedScanItem[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);

  // Optical and PM2.5 results
  const [pm25Est, setPm25Est] = useState<number>(0);
  const [aqiIndex, setAqiIndex] = useState<number>(0);
  const [aqiCategory, setAqiCategory] = useState<string>('Not analysed');
  const [aqiColor, setAqiColor] = useState<string>(Colors.inkMuted);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [inferenceTimeMs, setInferenceTimeMs] = useState<number>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Saved observation coordinates');

  // Load past scans and offline queue on mount
  useEffect(() => {
    AsyncStorage.getItem(SCANS_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) setPastScans(parsed);
        } catch {}
      }
    });
    AsyncStorage.getItem(OFFLINE_QUEUE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) setOfflineQueue(parsed);
        } catch {}
      }
    });
  }, []);

  const applyDeviceLocation = async (requestPermission: boolean) => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && requestPermission) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        if (requestPermission) setAnalysisError('Location permission is required to use device GPS.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
      setLocationStatus(position.coords.accuracy != null
        ? `Device GPS · ±${Math.round(position.coords.accuracy)} m`
        : 'Device GPS');
      setAnalysisError(null);
    } catch (error) {
      if (requestPermission) {
        setAnalysisError(error instanceof Error ? error.message : 'Device location is unavailable.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    applyDeviceLocation(false);
  }, []);

  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    const p = PRESETS[key];
    setLatitude(p.lat);
    setLongitude(p.lon);
    setLocationStatus('Saved observation coordinates');
    setPhotoUri(null);
    setPhotoBase64(null);
    setHasResult(false);
    setReportSubmitted(false);
    setAnalysisError(null);
  };

  const usePickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setPhotoUri(asset.uri);
    setPhotoBase64(asset.base64 ?? null);
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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) usePickedAsset(result.assets[0]);
  };

  const handleChoosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) usePickedAsset(result.assets[0]);
  };

  const handleAnalyseHaze = async () => {
    if (isInferring) return;
    if (!photoUri) {
      setAnalysisError('Capture or choose a real sky photo before analysis.');
      return;
    }
    const latStr = (latitude ?? '').trim();
    const lonStr = (longitude ?? '').trim();
    if (!latStr || !lonStr) {
      setAnalysisError('Please enter both latitude and longitude coordinates.');
      return;
    }
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (isNaN(lat) || !Number.isFinite(lat) || lat < -90 || lat > 90 || isNaN(lon) || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      setAnalysisError('Enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    setIsInferring(true);
    setReportSubmitted(false);
    setAnalysisError(null);
    setUploadProgress(15);
    setProgressStage('Validating & stripping EXIF metadata...');

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 40) {
          setProgressStage('Uploading 224×224 RGB tensor to DCP server...');
          return prev + 10;
        } else if (prev < 75) {
          setProgressStage('Running Dark Channel Prior (DCP) decomposition...');
          return prev + 8;
        } else if (prev < 92) {
          setProgressStage('Computing atmospheric extinction τ and CPCB AQI...');
          return prev + 4;
        }
        return prev;
      });
    }, 200);

    try {
      const filename = photoMimeType === 'image/png' ? 'sky_photo.png' : 'sky_photo.jpg';
      const formData = new FormData();
      let attached = false;

      // 1. If in-memory base64 is available, create binary bytes part supported by Expo WinterCG fetch
      if (photoBase64) {
        try {
          const bytes = base64ToUint8Array(photoBase64);
          formData.append(
            'photo',
            {
              name: filename,
              type: photoMimeType,
              bytes: async () => bytes,
            } as any,
            filename
          );
          attached = true;
        } catch {
          // Fall through to other approaches
        }
      }

      // 2. If not attached yet, attempt to read Blob or ArrayBuffer via fetch(photoUri)
      if (!attached && photoUri) {
        try {
          const resp = await fetch(photoUri);
          if (typeof resp.blob === 'function') {
            const blob = await resp.blob();
            formData.append('photo', blob, filename);
            attached = true;
          } else if (typeof resp.arrayBuffer === 'function') {
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            formData.append(
              'photo',
              {
                name: filename,
                type: photoMimeType,
                bytes: async () => bytes,
              } as any,
              filename
            );
            attached = true;
          }
        } catch {
          // Fall through to native URI object
        }
      }

      // 3. Fallback: native React Native { uri, name, type } object
      // (client.uploadCitizenSkyPhoto will route this to XMLHttpRequest if fetch throws)
      if (!attached && photoUri) {
        formData.append('photo', {
          uri: photoUri,
          name: filename,
          type: photoMimeType,
        } as any);
      }

      formData.append('latitude', latitude);
      formData.append('longitude', longitude);

      const res: CitizenPhotoResponse = await uploadCitizenSkyPhoto(formData);
      if (res && typeof res.pm25_estimate === 'number') {
        const roundedPm25 = Math.round(res.pm25_estimate);
        setPm25Est(roundedPm25);
        setAqiIndex(res.aqi_index);
        setAqiCategory(res.aqi_category);
        setAqiColor(res.aqi_color);
        setConfidence(res.confidence === 'low' ? 'low' : res.confidence === 'medium' ? 'medium' : 'high');
        setInferenceTimeMs(res.processing_time_ms);
        setReportSubmitted(true);
        setHasResult(true);

        const newRecord: PastScanRecord = {
          id: `scan_${Date.now()}`,
          timestamp: new Date().toISOString(),
          latitude,
          longitude,
          pm25: roundedPm25,
          aqi: res.aqi_index,
          category: res.aqi_category,
          color: res.aqi_color,
          confidence: res.confidence,
          presetName: PRESETS[selectedPreset]?.name ?? 'Ground Observation',
        };
        setPastScans((prev) => {
          const updated = [newRecord, ...prev.slice(0, 19)];
          AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    } catch (error) {
      setHasResult(false);
      setReportSubmitted(false);
      const errMsg = error instanceof Error ? error.message : 'Photo analysis failed.';
      setAnalysisError(errMsg);

      // Save to offline queue so user can retry when online
      const queuedItem: QueuedScanItem = {
        id: `queue_${Date.now()}`,
        timestamp: new Date().toISOString(),
        latitude,
        longitude,
        photoUri: photoUri ?? undefined,
        photoBase64: photoBase64 ?? undefined,
        photoMimeType,
      };
      setOfflineQueue((prev) => {
        const updated = [queuedItem, ...prev.slice(0, 9)];
        AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } finally {
      clearInterval(progressTimer);
      setUploadProgress(100);
      setProgressStage('Analysis complete');
      setTimeout(() => {
        setIsInferring(false);
        setUploadProgress(0);
        setProgressStage('');
      }, 350);
    }
  };

  const handleSyncOfflineQueue = async () => {
    if (isSyncingQueue || offlineQueue.length === 0) return;
    setIsSyncingQueue(true);
    try {
      const remaining: QueuedScanItem[] = [];
      for (const item of offlineQueue) {
        try {
          const formData = new FormData();
          const filename = item.photoMimeType === 'image/png' ? 'sky_photo.png' : 'sky_photo.jpg';
          if (item.photoBase64) {
            const bytes = base64ToUint8Array(item.photoBase64);
            formData.append('photo', { name: filename, type: item.photoMimeType, bytes: async () => bytes } as any, filename);
          } else if (item.photoUri) {
            formData.append('photo', { uri: item.photoUri, name: filename, type: item.photoMimeType } as any);
          }
          formData.append('latitude', item.latitude);
          formData.append('longitude', item.longitude);

          const res = await uploadCitizenSkyPhoto(formData);
          if (res && typeof res.pm25_estimate === 'number') {
            const syncedScan: PastScanRecord = {
              id: item.id,
              timestamp: item.timestamp,
              latitude: item.latitude,
              longitude: item.longitude,
              pm25: Math.round(res.pm25_estimate),
              aqi: res.aqi_index,
              category: res.aqi_category,
              color: res.aqi_color,
              confidence: res.confidence,
              presetName: 'Offline Synchronised',
            };
            setPastScans((prev) => {
              const updated = [syncedScan, ...prev.slice(0, 19)];
              AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
              return updated;
            });
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }
      setOfflineQueue(remaining);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const handleClearHistory = async () => {
    setPastScans([]);
    await AsyncStorage.removeItem(SCANS_STORAGE_KEY);
  };

  const activePreset = PRESETS[selectedPreset];

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Sky Haze Scanner"
              onPress={onClose}
              style={styles.closeBtn}
            >
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
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name} calibration preset`}
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
              accessibilityRole="button"
              accessibilityLabel={photoUri ? 'Retake sky photo frame' : 'Capture sky photo with camera'}
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
              accessibilityRole="button"
              accessibilityLabel="Choose sky photo from gallery"
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
                onChangeText={(value) => { setLatitude(value); setLocationStatus('Manually entered coordinates'); }}
                keyboardType="numeric"
                style={styles.coordInputField}
              />
            </View>

            <View style={styles.coordInputCol}>
              <Text style={styles.coordInputLabel}>Observation Longitude (°E)</Text>
              <TextInput
                value={longitude}
                onChangeText={(value) => { setLongitude(value); setLocationStatus('Manually entered coordinates'); }}
                keyboardType="numeric"
                style={styles.coordInputField}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use current device GPS location"
            onPress={() => applyDeviceLocation(true)}
            style={styles.gpsButton}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={15} color={Colors.canvasCream} />
            <Text style={styles.gpsButtonText}>{isLocating ? 'Getting Device Location…' : 'Use Device GPS'}</Text>
            <Text style={styles.gpsStatusText}>{locationStatus}</Text>
          </Pressable>
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

        {/* Visual Upload & DCP Inference Progress Bar */}
        {(isInferring || uploadProgress > 0) && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressLabelRow}>
                <MaterialCommunityIcons name="cloud-upload" size={14} color={Colors.coralWatermelonVivid} />
                <Text style={styles.progressStageText}>{progressStage || 'Processing sky image...'}</Text>
              </View>
              <Text style={styles.progressPercentText}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min(uploadProgress, 100)}%` as DimensionValue },
                ]}
              />
            </View>
          </View>
        )}

        {/* Offline Sync Queue Banner */}
        {offlineQueue.length > 0 && (
          <View style={styles.offlineQueueBanner}>
            <View style={styles.offlineQueueLeft}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={Colors.canvasCream} />
              <View>
                <Text style={styles.offlineQueueTitle}>Offline Queue ({offlineQueue.length} Pending)</Text>
                <Text style={styles.offlineQueueSub}>Stored locally for background sync</Text>
              </View>
            </View>
            <Pressable
              onPress={handleSyncOfflineQueue}
              disabled={isSyncingQueue}
              style={styles.syncQueueBtn}
            >
              <Text style={styles.syncQueueBtnText}>
                {isSyncingQueue ? 'Syncing...' : 'Retry Sync'}
              </Text>
            </Pressable>
          </View>
        )}

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

        {/* Past Observations History Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <MaterialCommunityIcons name="history" size={18} color={Colors.cobaltDeep} />
              <Text style={styles.historyTitle}>Past Observations History</Text>
            </View>
            <View style={styles.historyHeaderRight}>
              <Text style={styles.historyCountBadge}>{pastScans.length} scans</Text>
              {pastScans.length > 0 && (
                <Pressable onPress={handleClearHistory} style={styles.clearHistoryBtn}>
                  <Text style={styles.clearHistoryText}>Clear</Text>
                </Pressable>
              )}
            </View>
          </View>

          {pastScans.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              No past photo scans recorded yet. Capture a sky image and run inference to begin building your local observation ledger.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {pastScans.slice(0, 5).map((scan) => (
                <View key={scan.id} style={styles.historyItem}>
                  <View style={styles.historyItemTop}>
                    <View style={styles.historyItemLocation}>
                      <MaterialCommunityIcons name="map-marker-outline" size={13} color={Colors.inkMuted} />
                      <Text style={styles.historyItemCoords} numberOfLines={1}>
                        {scan.presetName || `${scan.latitude}°N, ${scan.longitude}°E`}
                      </Text>
                    </View>
                    <View style={[styles.historyAqiBadge, { backgroundColor: scan.color || Colors.aqiModerate }]}>
                      <Text style={styles.historyAqiText}>AQI {scan.aqi}</Text>
                    </View>
                  </View>
                  <View style={styles.historyItemBottom}>
                    <Text style={styles.historyTimeText}>
                      {new Date(scan.timestamp).toLocaleDateString()} {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.historyPm25Text}>
                      PM2.5: <Text style={{ fontWeight: '800', color: Colors.coralWatermelonVivid }}>{scan.pm25} µg/m³</Text> • {scan.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </NeoCard>

        <View style={{ height: 40 }} />
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
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.cobaltDeep,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gpsButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.canvasCream,
  },
  gpsStatusText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 9,
    fontWeight: '700',
    color: Colors.surfaceVanilla,
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
  progressContainer: {
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 10,
    gap: 6,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  progressStageText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
    flex: 1,
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.coralWatermelonVivid,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.coralWatermelonVivid,
  },
  offlineQueueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.terracottaDeep,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    padding: 10,
    gap: 8,
  },
  offlineQueueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  offlineQueueTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  offlineQueueSub: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.canvasCream,
    opacity: 0.85,
  },
  syncQueueBtn: {
    backgroundColor: Colors.canvasCream,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncQueueBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  historyCard: {
    padding: 12,
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  historyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyCountBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
    backgroundColor: Colors.surfaceVanillaStrong,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clearHistoryBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearHistoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.coralWatermelonVivid,
  },
  emptyHistoryText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 15,
  },
  historyList: {
    gap: 6,
  },
  historyItem: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    padding: 8,
    gap: 4,
  },
  historyItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyItemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 6,
  },
  historyItemCoords: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  historyAqiBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  historyAqiText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
  },
  historyItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTimeText: {
    fontSize: 9,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  historyPm25Text: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkBlack,
  },
});
