import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Linking } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { fetchLatestBriefing, BriefingResponse, formatBackendStatus, getBriefingFeedUrl } from '../api/client';

interface FloatingAudioPlayerProps {
  /** Live telemetry note shown under the episode title; defaults to 'No current briefing'. */
  telemetryNote?: string;
}

export const FloatingAudioPlayer: React.FC<FloatingAudioPlayerProps> = ({
  telemetryNote = 'No current briefing',
}) => {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const player = useAudioPlayer(briefing?.audio_url ?? null, {
    downloadFirst: true,
    updateInterval: 500,
  });
  const playbackStatus = useAudioPlayerStatus(player);
  const isPlaying = playbackStatus.playing;

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
    fetchLatestBriefing()
      .then((res) => {
        if (res && res.script) {
          setBriefing(res);
        }
      })
      .catch((err: unknown) => console.warn('[FloatingAudioPlayer] briefing:', err instanceof Error ? err.message : err));
  }, []);


  const displayTitle = briefing?.incident_id
    ? `Briefing ${briefing.incident_id.slice(0, 16)}`
    : 'PRANA Atmospheric Briefing';

  const displayNote = telemetryNote
    ? `${telemetryNote} · Tap for briefing`
    : briefing?.script
      ? 'Tap to read full atmospheric briefing'
      : 'No current briefing';
  const hasAudio = Boolean(briefing?.audio_url);

  // Equalizer bar animated values
  const bar1 = useRef(new Animated.Value(6)).current;
  const bar2 = useRef(new Animated.Value(14)).current;
  const bar3 = useRef(new Animated.Value(8)).current;
  const bar4 = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    let anim1: Animated.CompositeAnimation;
    let anim2: Animated.CompositeAnimation;
    let anim3: Animated.CompositeAnimation;
    let anim4: Animated.CompositeAnimation;

    const createLoop = (val: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: max,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(val, {
            toValue: min,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      );
    };

    if (isPlaying && hasAudio) {
      anim1 = createLoop(bar1, 4, 16, 280);
      anim2 = createLoop(bar2, 4, 18, 360);
      anim3 = createLoop(bar3, 4, 14, 220);
      anim4 = createLoop(bar4, 4, 20, 310);

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
    } else {
      Animated.timing(bar1, { toValue: 4, duration: 150, useNativeDriver: false }).start();
      Animated.timing(bar2, { toValue: 4, duration: 150, useNativeDriver: false }).start();
      Animated.timing(bar3, { toValue: 4, duration: 150, useNativeDriver: false }).start();
      Animated.timing(bar4, { toValue: 4, duration: 150, useNativeDriver: false }).start();
    }

    return () => {
      anim1?.stop();
      anim2?.stop();
      anim3?.stop();
      anim4?.stop();
    };
  }, [hasAudio, isPlaying]);

  const handleAudioPress = async () => {
    if (!briefing?.audio_url) {
      setShowBriefingModal(true);
      return;
    }
    if (isPlaying) {
      player.pause();
      return;
    }
    if (playbackStatus.didJustFinish) await player.seekTo(0);
    player.setActiveForLockScreen(true, {
      title: displayTitle,
      artist: 'PRANA Air',
      albumTitle: 'Atmospheric Briefings',
    });
    player.play();
  };

  const handleRssFeedPress = async () => {
    try {
      await Linking.openURL(getBriefingFeedUrl());
    } catch {
      // Linking failure — silently ignore (no RSS reader installed)
    }
  };

  return (
    <View style={styles.outerWrapper}>
      {/* Neo-brutalist shadow */}
      <View style={styles.shadowLayer} />

      <Pressable
        onPress={() => setShowBriefingModal(true)}
        style={styles.container}
      >
        {/* Left artwork icon */}
        <View style={styles.artBox}>
          <MaterialCommunityIcons name="waveform" size={20} color={Colors.onTertiary} />
        </View>

        {/* Middle title and subtitle */}
        <View style={styles.metaContainer}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.episodeText}>
              {displayTitle}
            </Text>
            <View style={styles.livePip} />
          </View>
          <Text numberOfLines={1} style={styles.telemetryText}>
            {displayNote}
          </Text>
        </View>

        {/* Right animated EQ and Play/Pause button */}
        <View style={styles.controlsRow}>
          {/* Animated Equalizer Waveform */}
          <View style={styles.eqContainer}>
            <Animated.View style={[styles.eqBar, { height: bar1 }]} />
            <Animated.View style={[styles.eqBar, { height: bar2 }]} />
            <Animated.View style={[styles.eqBar, { height: bar3 }]} />
            <Animated.View style={[styles.eqBar, { height: bar4 }]} />
          </View>

          {/* Chunky black Play/Pause button */}
          <Pressable
            onPress={handleAudioPress}
            style={({ pressed }) => [
              styles.playButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <MaterialCommunityIcons
              name={hasAudio && isPlaying ? 'pause' : hasAudio ? 'play' : 'text-box-search'}
              size={18}
              color={Colors.canvasCream}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* Atmospheric Briefing Script Dialog Modal */}
      <Modal
        visible={showBriefingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBriefingModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialCommunityIcons name="broadcast" size={20} color={Colors.terracottaDeep} />
                <Text style={styles.modalTitle}>PRANA Atmospheric Briefing</Text>
              </View>
              <Pressable onPress={() => setShowBriefingModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={Colors.inkBlack} />
              </Pressable>
            </View>

            <Text style={styles.modalScriptText}>
              {briefing?.script ?? 'No current atmospheric briefing is available from the backend.'}
            </Text>

            <View style={styles.modalFooter}>
              <View style={styles.ttsBadge}>
                <Text style={styles.ttsBadgeText}>
                  {briefing ? formatBackendStatus(briefing.audio_status) : 'No briefing available'}
                </Text>
              </View>
              <View style={styles.modalFooterActions}>
                {/* RSS Feed share button */}
                <Pressable onPress={handleRssFeedPress} style={styles.rssFeedBtn}>
                  <MaterialCommunityIcons name="rss" size={14} color={Colors.inkBlack} />
                  <Text style={styles.rssFeedBtnText}>RSS</Text>
                </Pressable>
                <Pressable onPress={() => setShowBriefingModal(false)} style={styles.modalDismissBtn}>
                  <Text style={styles.modalDismissText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    marginHorizontal: 12,
    position: 'relative',
    marginBottom: 4,
  },
  shadowLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.inkBlack,
    borderRadius: 16,
    top: 3,
    left: 3,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  artBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.terracottaDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    marginRight: 10,
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  episodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.inkBlack,
    maxWidth: 160,
  },
  livePip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.forestJade,
  },
  telemetryText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    gap: 3,
    paddingHorizontal: 4,
  },
  eqBar: {
    width: 3.5,
    backgroundColor: Colors.coralWatermelonVivid,
    borderRadius: 2,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.inkBlack,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.inkBlack,
    padding: 18,
    shadowColor: Colors.inkBlack,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3D7',
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScriptText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkBlack,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttsBadge: {
    backgroundColor: '#F3EDE2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  ttsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkMuted,
    letterSpacing: 0.5,
  },
  modalDismissBtn: {
    backgroundColor: Colors.inkBlack,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalDismissText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rssFeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkBlack,
    backgroundColor: Colors.surfaceVanilla,
  },
  rssFeedBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
});

