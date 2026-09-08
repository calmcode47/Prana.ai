import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  DimensionValue,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/tokens';
import { NeoCard } from '../components/NeoCard';
import { NeoButton } from '../components/NeoButton';
import { StarburstBadge } from '../components/StarburstBadge';
import {
  fetchFederatedStatus,
  triggerFederatedRun,
  FLRoundStatus,
  FLStatusResponse,
  formatFederatedDataset,
  formatFederatedImplementation,
  formatFederatedMetric,
} from '../api/client';

export const FederatedMeshScreen: React.FC = () => {
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [globalLoss, setGlobalLoss] = useState<number | null>(null);
  const [globalAcc, setGlobalAcc] = useState<number | null>(null);
  const [delhiAcc, setDelhiAcc] = useState<number | null>(null);
  const [punjabAcc, setPunjabAcc] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [roundsList, setRoundsList] = useState<FLRoundStatus[]>([]);
  const [statusData, setStatusData] = useState<FLStatusResponse | null>(null);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isMounted = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const status = await fetchFederatedStatus();
      if (!isMounted.current) return;
      setStatusData(status);
      if (status?.rounds && status.rounds.length > 0) {
        setRoundsList(status.rounds);
        const last = status.rounds[status.rounds.length - 1];
        setCurrentRound(last.round_number);
        setGlobalLoss(Number(last.global_loss.toFixed(3)));
        setGlobalAcc(last.global_accuracy);
        setDelhiAcc(last.delhi_accuracy);
        setPunjabAcc(last.punjab_accuracy);
      }
    } catch (error: unknown) {
      if (isMounted.current) {
        setRunFeedback(`Status unavailable: ${error instanceof Error ? error.message : 'backend error'}`);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (isMounted.current) setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    return () => {
      isMounted.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadData]);

  const handleSimulateRound = async () => {
    if (isSimulating) return;
    setIsSimulating(true);

    try {
      const runResult = await triggerFederatedRun(10);
      if (!isMounted.current) return;
      setStatusData(runResult);
      const rounds = runResult?.rounds || [];
      if (rounds.length > 0) {
        setRoundsList(rounds);
        let i = 0;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (!isMounted.current) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
          }
          if (i < rounds.length) {
            const r = rounds[i];
            setCurrentRound(r.round_number);
            setGlobalLoss(Number(r.global_loss.toFixed(3)));
            setGlobalAcc(r.global_accuracy);
            setDelhiAcc(r.delhi_accuracy);
            setPunjabAcc(r.punjab_accuracy);
            i++;
          } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsSimulating(false);
          }
        }, 220);
      } else {
        setIsSimulating(false);
      }
    } catch (error) {
      if (isMounted.current) {
        setRunFeedback(`Training failed: ${error instanceof Error ? error.message : 'backend error'}`);
        setIsSimulating(false);
      }
    }
  };

  const latestGain = globalAcc !== null && delhiAcc !== null && punjabAcc !== null ? globalAcc - Math.max(delhiAcc, punjabAcc) : null;
  const chartX = (index: number, total: number) => 30 + (index / Math.max(1, total - 1)) * 260;
  const chartY = (accuracy: number) => 140 - Math.max(0, Math.min(1, accuracy)) * 115;
  const buildPath = (field: 'global_accuracy' | 'delhi_accuracy' | 'punjab_accuracy') =>
    roundsList.map((r, i) => `${i === 0 ? 'M' : 'L'}${chartX(i, roundsList.length).toFixed(1)},${chartY(r[field]).toFixed(1)}`).join(' ');

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Federated Mesh</Text>
            <Text style={styles.titleSparkle}>✦</Text>
          </View>
          <Text style={styles.screenSubtitle}>Privacy-Preserving Inter-State AI</Text>
        </View>
        <StarburstBadge label="FEDAVG MESH" rotation="-3deg" shadowColor={Colors.forestJade} />
      </View>

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
        {/* Configured privacy controls */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <View style={styles.privacyBadge}>
              <MaterialCommunityIcons name="shield-lock" size={16} color={Colors.forestJade} />
              <Text style={styles.privacyBadgeText}>Differential Privacy ε = {statusData?.privacy?.dp_sgd?.epsilon_spent?.toFixed(2) ?? '—'}</Text>
            </View>
            <View style={styles.statusLivePip} />
          </View>
          <Text style={styles.privacyBody}>
            {statusData
              ? `${formatFederatedDataset(statusData.dataset)} runs locally in the backend. Client fit calls omit local metrics; production separation of clients and key custody requires an external deployment.`
              : 'Federated status is unavailable from the backend.'}
          </Text>
          <View style={styles.privacyPillsRow}>
            <View style={styles.miniTag}>
              <MaterialCommunityIcons name="lock-check" size={13} color={Colors.forestJade} />
              <Text style={styles.miniTagText}>{statusData?.privacy?.secure_aggregation?.enabled ? `${statusData.privacy.secure_aggregation.scheme ?? 'Paillier'} ${statusData.privacy.secure_aggregation.key_bits ?? '—'}-bit` : 'Secure aggregation disabled'}</Text>
            </View>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.miniTagMuted}>{statusData?.privacy?.dp_sgd?.enabled ? 'Configured DP-SGD noise' : 'DP-SGD disabled'}</Text>
          </View>
        </NeoCard>

        {/* Scheduled Dispatch Ticker Pill */}
        <View style={styles.dispatchPill}>
          <View style={styles.dispatchLeft}>
            <View style={styles.dispatchPulse} />
            <Text style={styles.dispatchLabel}>Federated execution</Text>
          </View>
          <Text style={styles.dispatchTime}>Manual local run</Text>
        </View>
        {runFeedback && <Text style={styles.chartSubtitle}>{runFeedback}</Text>}

        {/* Decentralized Mesh Topology Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.topologyCard}>
          <View style={styles.topologyHeader}>
            <View style={styles.topologyTitleRow}>
              <View style={styles.topologyIcon}>
                <MaterialCommunityIcons name="hub" size={16} color={Colors.canvasCream} />
              </View>
              <Text style={styles.topologyTitle}>Decentralized Mesh Topology</Text>
            </View>
            <Text style={styles.roundSettledText}>{currentRound ? `Round #${currentRound} Settled` : 'No completed round'}</Text>
          </View>

          {/* 2 Regional Nodes Grid */}
          <View style={styles.nodesGrid}>
            {/* Punjab Node */}
            <View style={styles.nodeTile}>
              <View style={styles.nodeTileHeader}>
                <View style={[styles.nodeIconSquare, { backgroundColor: '#F59E0B22' }]}>
                  <MaterialCommunityIcons name="tractor" size={18} color={Colors.aqiModerate} />
                </View>
                <Text style={styles.nodeIdTag}>NODE 01</Text>
              </View>
              <Text style={styles.nodeTileTitle}>Punjab Node</Text>
              <Text style={styles.nodeTileSubtitle}>Farms / PPCB Sub-station</Text>

              <View style={styles.sampleBox}>
                <Text style={styles.sampleCount}>Synthetic</Text>
                <Text style={styles.sampleUnit}>backend training partition</Text>
              </View>

              <View style={styles.tensorStatus}>
                <Text style={styles.tensorStatusText}>Local simulation</Text>
                <MaterialCommunityIcons name="check-decagram" size={14} color={Colors.forestJade} />
              </View>
            </View>

            {/* Delhi Node */}
            <View style={styles.nodeTile}>
              <View style={styles.nodeTileHeader}>
                <View style={[styles.nodeIconSquare, { backgroundColor: '#1D4ED822' }]}>
                  <MaterialCommunityIcons name="city" size={18} color={Colors.cobaltDeep} />
                </View>
                <Text style={styles.nodeIdTag}>NODE 02</Text>
              </View>
              <Text style={styles.nodeTileTitle}>Delhi Node</Text>
              <Text style={styles.nodeTileSubtitle}>DPCC / Urban Canopy</Text>

              <View style={styles.sampleBox}>
                <Text style={styles.sampleCount}>Synthetic</Text>
                <Text style={styles.sampleUnit}>backend training partition</Text>
              </View>

              <View style={styles.tensorStatus}>
                <Text style={styles.tensorStatusText}>Local simulation</Text>
                <MaterialCommunityIcons name="check-decagram" size={14} color={Colors.forestJade} />
              </View>
            </View>
          </View>

          {/* Animated Convergence Spine SVG */}
          <View style={styles.spineContainer}>
            <Svg width={240} height={40} viewBox="0 0 240 40">
              <Path d="M40 0 C40 22, 120 18, 120 38" stroke="#18181B" strokeWidth="2" strokeDasharray="3 3" opacity={0.4} />
              <Path d="M200 0 C200 22, 120 18, 120 38" stroke="#18181B" strokeWidth="2" strokeDasharray="3 3" opacity={0.4} />
              <Circle cx={120} cy={38} r={4.5} fill={Colors.coralWatermelonVivid} />
              <Circle cx={40} cy={2} r={3} fill="#18181B" />
              <Circle cx={200} cy={2} r={3} fill="#18181B" />
            </Svg>
          </View>

          {/* Central Aggregator Box */}
          <View style={styles.centralAggregator}>
            <View style={styles.aggregatorHeader}>
              <View style={styles.aggregatorIcon}>
                <MaterialCommunityIcons name="layers-triple" size={20} color={Colors.canvasCream} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aggregatorTitle}>FedAvg Central Core</Text>
                <Text style={styles.aggregatorSubtitle}>{formatFederatedImplementation(statusData?.implementation)}</Text>
              </View>
              <View style={styles.lossBadge}>
                <Text style={styles.lossBadgeText}>MSE: {globalLoss ?? '—'}</Text>
              </View>
            </View>

            {/* Simulation Trigger Button */}
            <Pressable
              onPress={handleSimulateRound}
              disabled={isSimulating}
              style={[styles.simulateBtn, isSimulating && { opacity: 0.7 }]}
            >
              <MaterialCommunityIcons
                name={isSimulating ? 'refresh' : 'play-circle'}
                size={18}
                color={Colors.inkBlack}
              />
              <Text style={styles.simulateBtnText}>
                {isSimulating ? 'Aggregating Weight Tensors...' : 'Run Federated Training Round'}
              </Text>
            </Pressable>
          </View>
        </NeoCard>

        {/* Multi-Line Convergence Chart Card */}
        <NeoCard backgroundColor={Colors.surfaceVanilla} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <View style={styles.chartTitleRow}>
                <Text style={styles.chartTitle}>Federated Convergence Curves</Text>
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillText}>{formatFederatedMetric(statusData?.metric).toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.chartSubtitle}>
                {roundsList.length} synchronization rounds across decoupled silos
              </Text>
            </View>

            {/* Superiority Accolade Badge */}
            <View style={styles.gainBadge}>
              <MaterialCommunityIcons name="trending-up" size={16} color={Colors.forestJade} />
              <Text style={styles.gainBadgeText}>
                {latestGain === null ? 'No measured result' : `${latestGain >= 0 ? '+' : ''}${(latestGain * 100).toFixed(1)} pts vs best local`}
              </Text>
            </View>
          </View>

          {/* SVG Multi-Line Chart Canvas */}
          <View style={styles.svgChartContainer}>
            <Svg width="100%" height={160} viewBox="0 0 300 160">
              {/* Background horizontal grid lines */}
              <Line x1="20" y1="25" x2="290" y2="25" stroke="#E4E1E6" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="20" y1="54" x2="290" y2="54" stroke="#E4E1E6" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="20" y1="83" x2="290" y2="83" stroke="#E4E1E6" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="20" y1="112" x2="290" y2="112" stroke="#E4E1E6" strokeWidth="1" strokeDasharray="3 3" />
              <Line x1="20" y1="140" x2="290" y2="140" stroke={Colors.inkBlack} strokeWidth="1.5" />

              {/* Y-axis text labels */}
              <SvgText x="16" y="28" fill="#737686" fontSize="8" textAnchor="end">100%</SvgText>
              <SvgText x="16" y="86" fill="#737686" fontSize="8" textAnchor="end">50%</SvgText>
              <SvgText x="16" y="143" fill="#737686" fontSize="8" textAnchor="end">0%</SvgText>

              {/* Punjab Silo Path (Terracotta) */}
              <Path
                d={buildPath('punjab_accuracy')}
                fill="none"
                stroke={Colors.terracottaDeep}
                strokeWidth="2"
                strokeDasharray="4 3"
              />

              {/* Delhi Silo Path (Cobalt) */}
              <Path
                d={buildPath('delhi_accuracy')}
                fill="none"
                stroke={Colors.cobaltDeep}
                strokeWidth="2"
                strokeDasharray="4 3"
              />

              {/* Global FedAvg Path (Coral Watermelon Vivid) */}
              <Path
                d={buildPath('global_accuracy')}
                fill="none"
                stroke={Colors.coralWatermelonVivid}
                strokeWidth="3"
              />

              {/* Data points for current round */}
              {roundsList.map((r, i) => {
                const x = chartX(i, roundsList.length);
                const yGlobal = chartY(r.global_accuracy);
                return (
                  <Circle
                    key={`pt-${r.round_number}`}
                    cx={x}
                    cy={yGlobal}
                    r={r.round_number === currentRound ? 4 : 2}
                    fill={Colors.coralWatermelonVivid}
                    stroke={Colors.inkBlack}
                    strokeWidth={1}
                  />
                );
              })}
            </Svg>

            {/* X Axis round milestones */}
            <View style={styles.chartXLabels}>
              {roundsList.length > 0 ? [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const index = Math.min(roundsList.length - 1, Math.round((roundsList.length - 1) * fraction));
                return <Text key={fraction} style={styles.chartXText}>R{roundsList[index].round_number}</Text>;
              }) : <Text style={styles.chartXText}>No completed rounds</Text>}
            </View>
          </View>

          {/* Chart Legend Chips */}
          <View style={styles.legendRow}>
            <View style={styles.legendPill}>
              <View style={[styles.legendColor, { backgroundColor: Colors.coralWatermelonVivid }]} />
              <Text style={styles.legendText}>Global FL ({globalAcc === null ? '—' : `${(globalAcc * 100).toFixed(1)}%`})</Text>
            </View>
            <View style={styles.legendPill}>
              <View style={[styles.legendColor, { backgroundColor: Colors.cobaltDeep }]} />
              <Text style={styles.legendText}>Delhi Silo ({delhiAcc === null ? '—' : `${(delhiAcc * 100).toFixed(1)}%`})</Text>
            </View>
            <View style={styles.legendPill}>
              <View style={[styles.legendColor, { backgroundColor: Colors.terracottaDeep }]} />
              <Text style={styles.legendText}>Punjab Silo ({punjabAcc === null ? '—' : `${(punjabAcc * 100).toFixed(1)}%`})</Text>
            </View>
          </View>
        </NeoCard>

        {/* Cryptographic Pipeline Connection Strip */}
        <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.pipelineCard}>
          <View style={styles.pipelineRow}>
            <View style={styles.pipelineNode}>
              <Text style={styles.pipelineNodeName}>Punjab Node</Text>
              <Text style={styles.pipelineNodeRole}>Agri Ingress</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right-thick" size={14} color={Colors.terracottaDeep} />
            <View style={styles.pipelineNodeCenter}>
              <MaterialCommunityIcons name="lock-check" size={16} color={Colors.forestJade} />
              <Text style={styles.pipelineCenterText}>{statusData?.privacy?.secure_aggregation?.enabled ? 'Paillier enabled' : 'Plain aggregation'}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right-thick" size={14} color={Colors.cobaltDeep} />
            <View style={styles.pipelineNode}>
              <Text style={styles.pipelineNodeName}>Delhi Node</Text>
              <Text style={styles.pipelineNodeRole}>Receptor Grid</Text>
            </View>
          </View>
        </NeoCard>

        {/* Model Accuracy Comparison Bars */}
        <NeoCard backgroundColor={Colors.surfaceVanillaStrong} style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Federated Model Prediction Scores</Text>
          <View style={styles.barsContainer}>
            {/* Global FedAvg Model */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Global FedAvg Model</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${((globalAcc ?? 0) * 100).toFixed(1)}%` as DimensionValue, backgroundColor: Colors.coralWatermelonVivid }]} />
              </View>
              <Text style={styles.barPercent}>{globalAcc === null ? '—' : `${(globalAcc * 100).toFixed(1)}%`}</Text>
            </View>

            {/* Delhi Local Isolated */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Delhi Local Isolated</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${((delhiAcc ?? 0) * 100).toFixed(1)}%` as DimensionValue, backgroundColor: Colors.cobaltDeep }]} />
              </View>
              <Text style={styles.barPercent}>{delhiAcc === null ? '—' : `${(delhiAcc * 100).toFixed(1)}%`}</Text>
            </View>

            {/* Punjab Local Isolated */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Punjab Local Isolated</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${((punjabAcc ?? 0) * 100).toFixed(1)}%` as DimensionValue, backgroundColor: Colors.terracottaDeep }]} />
              </View>
              <Text style={styles.barPercent}>{punjabAcc === null ? '—' : `${(punjabAcc * 100).toFixed(1)}%`}</Text>
            </View>
          </View>
        </NeoCard>

        <View style={{ height: 165 }} />
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
  privacyCard: {
    padding: 12,
    gap: 8,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98122',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.forestJade,
  },
  statusLivePip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.forestJade,
  },
  privacyBody: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  privacyPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.forestJade,
  },
  bulletDot: {
    fontSize: 10,
    color: Colors.inkMuted,
  },
  miniTagMuted: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  dispatchPill: {
    backgroundColor: Colors.surfaceVanillaStrong,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dispatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dispatchPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.terracottaDeep,
  },
  dispatchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  dispatchTime: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.terracottaDeep,
  },
  topologyCard: {
    padding: 14,
  },
  topologyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topologyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topologyIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topologyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  roundSettledText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  nodesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  nodeTile: {
    flex: 1,
    backgroundColor: Colors.canvasCream,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.inkBlack,
    padding: 10,
  },
  nodeTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeIconSquare: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIdTag: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkMuted,
  },
  nodeTileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
    marginTop: 6,
  },
  nodeTileSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  sampleBox: {
    backgroundColor: Colors.surfaceVanilla,
    borderRadius: 6,
    padding: 6,
    marginTop: 8,
  },
  sampleCount: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  sampleUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  tensorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tensorStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.forestJade,
  },
  spineContainer: {
    alignItems: 'center',
    marginVertical: -2,
  },
  centralAggregator: {
    backgroundColor: Colors.inkBlack,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  aggregatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aggregatorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.coralWatermelonVivid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aggregatorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  aggregatorSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  lossBadge: {
    backgroundColor: '#3F3F46',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  lossBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.canvasCream,
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvasCream,
    paddingVertical: 8,
    borderRadius: 9999,
    gap: 6,
  },
  simulateBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.inkBlack,
  },
  comparisonCard: {
    padding: 12,
    gap: 10,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  barsContainer: {
    gap: 8,
  },
  barRow: {
    gap: 3,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  barTrack: {
    height: 8,
    backgroundColor: '#E4E1E6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barPercent: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkMuted,
    alignSelf: 'flex-end',
  },
  chartCard: {
    padding: 12,
    gap: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  metricPill: {
    backgroundColor: '#FFE4E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  metricPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.coralWatermelonVivid,
  },
  chartSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
    marginTop: 2,
  },
  gainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.canvasCream,
    borderWidth: 1,
    borderColor: Colors.forestJade,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  gainBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.forestJade,
  },
  svgChartContainer: {
    backgroundColor: Colors.canvasCream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    padding: 8,
    position: 'relative',
  },
  chartXLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  chartXText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.canvasCream,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8E3D7',
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.inkBlack,
  },
  pipelineCard: {
    padding: 10,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineNode: {
    alignItems: 'center',
  },
  pipelineNodeName: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
  pipelineNodeRole: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  pipelineNodeCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.canvasCream,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.inkBlack,
  },
  pipelineCenterText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.inkBlack,
  },
});
