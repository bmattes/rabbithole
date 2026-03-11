import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Modal, ScrollView } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { computeNodeScores, computeFinalScore, computeLiveTimeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'
import { separateBubbles } from '../../lib/bubbleLayout'
import { colors } from '../../lib/theme'
import { useHints } from '../../hooks/useHints'
import { HintTray, HintType } from '../../components/HintTray'
import * as Haptics from 'expo-haptics'


const DOMAIN_HINTS: Record<string, string> = {
  movies: 'via directors, cast & studios',
  sport: 'via teams, cities & coaches',
  music: 'via performers, covers & influences',
  science: 'via institutions & fields',
  history: 'via parties & offices',
}

const { width: SW } = Dimensions.get('window')

const HINT_FTUE_ITEMS = [
  {
    type: 'connection',
    icon: '🔗',
    label: 'Connection',
    desc: 'Activates a mode where only valid connections are possible. Hover over any bubble to see how it links to your current node. Spends when you make a connection.',
  },
  {
    type: 'shuffle',
    icon: '🔀',
    label: 'Shuffle',
    desc: 'Rearranges all the bubbles into a new layout. Useful if the current arrangement feels cluttered.',
  },
  {
    type: 'flash',
    icon: '⚡',
    label: 'Flash',
    desc: 'Briefly shows 4 possible paths from Start to End — one is the real optimal path, three are red herrings. Watch carefully!',
  },
  {
    type: 'bridge',
    icon: '🌉',
    label: 'Reveal',
    desc: 'Highlights one unknown node on the optimal path. Use up to 3 times to reveal up to 3 bridge nodes on a single puzzle.',
  },
]

function buildFakePaths(
  realPath: string[],
  startId: string,
  endId: string,
  allIds: string[],
  count: number
): string[][] {
  const intermediatePool = allIds.filter(id => id !== startId && id !== endId)
  const numIntermediates = realPath.length - 2  // same length as real path
  const seen = new Set<string>([realPath.slice(1, -1).join('|')])
  const results: string[][] = []

  for (let attempt = 0; attempt < count * 20 && results.length < count; attempt++) {
    const shuffled = [...intermediatePool].sort(() => Math.random() - 0.5)
    const intermediates = shuffled.slice(0, numIntermediates)
    if (intermediates.length < numIntermediates) continue
    const key = intermediates.join('|')
    if (seen.has(key)) continue
    seen.add(key)
    results.push([startId, ...intermediates, endId])
  }

  return results
}

export default function PuzzleScreen() {
  const { id: categoryId, categoryName } = useLocalSearchParams<{ id: string; categoryName?: string }>()
  const { elapsed, start, stop } = useTimer()
  const { userId } = useAuth()
  const progression = useProgression(userId)
  const unlockedDifficulties = progression.unlockedDifficulties
  const difficulty = (unlockedDifficulties[unlockedDifficulties.length - 1] ?? 'easy') as 'easy' | 'medium' | 'hard'
  const { puzzle: livePuzzle, loading, alreadyCompleted } = usePuzzle(categoryId, userId, difficulty)
  const [started, setStarted] = useState(false)
  const [currentHops, setCurrentHops] = useState(0)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const canvasHeightSetRef = useRef(false)

  const { remainingByType, useHint } = useHints(userId)
  const [activeHint, setActiveHint] = useState<HintType | null>(null)
  const [bridgeNodeIds, setBridgeNodeIds] = useState<Set<string>>(new Set())
  const [flashPaths, setFlashPaths] = useState<string[][] | null>(null)
  const [shuffledBubbles, setShuffledBubbles] = useState<typeof layoutBubbles | null>(null)
  const [showHintsFtue, setShowHintsFtue] = useState(false)

  const [liveScore, setLiveScore] = useState(0)
  const liveScoreRef = useRef(0)
  const penaltyRef = useRef(0)
  const [penaltyFlash, setPenaltyFlash] = useState<number | null>(null)

  useEffect(() => {
    AsyncStorage.getItem('hasSeenHintsFtue').then(val => {
      if (!val) setShowHintsFtue(true)
    })
  }, [])

  async function dismissHintsFtue() {
    await AsyncStorage.setItem('hasSeenHintsFtue', '1')
    setShowHintsFtue(false)
  }

  const puzzle = livePuzzle
  const domain = puzzle?.domain
  const optimalHops = puzzle ? puzzle.optimal_path.length - 1 : 0

  const bubbleScale = useMemo(() => {
    if (!puzzle || canvasHeight === 0) return 1
    const n = puzzle.bubbles.length - 2  // intermediates only
    const BASE_W = 180, BASE_H = 60, GAP = 16
    const canvasArea = SW * canvasHeight
    const neededArea = n * (BASE_W + GAP) * (BASE_H + GAP) * 2.5  // 2.5x packing factor
    if (neededArea <= canvasArea) return 1
    return Math.max(0.55, Math.sqrt(canvasArea / neededArea))
  }, [puzzle?.id, canvasHeight])

  const layoutBubbles = useMemo(() => {
    if (!puzzle || canvasHeight === 0) return []
    const n = puzzle.bubbles.length
    const fixedIndices = new Set([0, n - 1])
    const positions = separateBubbles(
      puzzle.bubbles.map(b => b.position),
      SW,
      canvasHeight,
      fixedIndices,
      200,
      undefined,
      bubbleScale
    )
    return puzzle.bubbles.map((b, i) => ({ ...b, position: positions[i] }))
  }, [puzzle?.id, canvasHeight, bubbleScale])

  useEffect(() => {
    if (layoutBubbles.length > 0 && !started) { start(); setStarted(true) }
  }, [layoutBubbles.length])

  useEffect(() => {
    if (!started) return
    let animFrameId: number
    const tick = () => {
      const timeScore = computeLiveTimeScore(elapsed, difficulty)
      const score = Math.max(0, timeScore - penaltyRef.current)
      liveScoreRef.current = score
      setLiveScore(score)
      animFrameId = requestAnimationFrame(tick)
    }
    animFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameId)
  }, [started, elapsed, difficulty])

  useEffect(() => {
    if (alreadyCompleted) router.replace('/(tabs)')
  }, [alreadyCompleted])

  if (loading) return <View style={styles.center}><ActivityIndicator color="#7c3aed" size="large" /></View>
  if (!puzzle) return (
    <View style={styles.center}>
      <Text style={styles.error}>No puzzle available</Text>
      <Pressable onPress={() => router.back()} style={styles.backFallback}>
        <Text style={styles.backFallbackText}>← Back</Text>
      </Pressable>
    </View>
  )

  async function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const labelMap = Object.fromEntries(puzzle!.bubbles.map(b => [b.id, b.label]))
    const nodeScores = computeNodeScores(path, puzzle!.optimal_path, difficulty, labelMap, puzzle!.alternative_paths)
    const finalScore = computeFinalScore(liveScoreRef.current, nodeScores)
    const nodeScoresParam = encodeURIComponent(JSON.stringify(nodeScores))

    const playerPathLabels = path.map(id => labelMap[id] ?? id).join('|')
    const optimalPathLabels = puzzle!.optimal_path.map(id => labelMap[id] ?? id).join('|')

    if (!puzzle!.id.startsWith('mock-') && userId) {
      await submitRun({ puzzleId: puzzle!.id, userId, path, timeMs, score: finalScore })
    }

    const narrativeParam = puzzle!.narrative ? `&narrative=${encodeURIComponent(puzzle!.narrative)}` : ''
    const categoryParam = categoryName ? `&categoryName=${encodeURIComponent(categoryName)}` : ''
    const dateParam = puzzle!.date ? `&puzzleDate=${encodeURIComponent(puzzle!.date)}` : ''
    router.replace(
      `/results/${puzzle!.id}?score=${finalScore}&timeMs=${timeMs}&hops=${path.length - 1}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}&difficulty=${difficulty}&liveScore=${liveScoreRef.current}&nodeScores=${nodeScoresParam}${narrativeParam}${categoryParam}${dateParam}`
    )
  }

  function handleBacktrack() {
    penaltyRef.current += 25
    setPenaltyFlash(-25)
    setTimeout(() => setPenaltyFlash(null), 800)
  }

  function handleReset() {
    penaltyRef.current += 100
    setPenaltyFlash(-100)
    setTimeout(() => setPenaltyFlash(null), 800)
  }

  async function handleUseHint(type: HintType) {
    // Bridge pre-check: skip if no unrevealed intermediate nodes remain
    if (type === 'bridge') {
      const unrevealed = puzzle!.optimal_path.slice(1, -1).filter(id => !bridgeNodeIds.has(id))
      if (unrevealed.length === 0) return  // nothing new to reveal, don't charge
    }

    const ok = await useHint(type)
    if (!ok) return

    if (type === 'connection') {
      setActiveHint('connection')
    }

    if (type === 'shuffle') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      const base = shuffledBubbles ?? layoutBubbles
      const n = base.length
      const fixed = new Set([0, n - 1])
      const separated = separateBubbles(base.map(b => b.position), SW, canvasHeight, fixed, 200, Date.now(), bubbleScale)
      setShuffledBubbles(base.map((b, i) => ({ ...b, position: separated[i] })))
      setActiveHint(null)
    }

    if (type === 'flash') {
      const realPath = puzzle!.optimal_path
      const allBubbleIds = (shuffledBubbles ?? layoutBubbles).map(b => b.id)
      const fakePaths = buildFakePaths(realPath, puzzle!.bubbles[0].id, puzzle!.bubbles[puzzle!.bubbles.length - 1].id, allBubbleIds, 3)
      const allPaths = [...fakePaths, realPath].sort(() => Math.random() - 0.5)
      setFlashPaths(allPaths)
      setActiveHint('flash')
    }

    if (type === 'bridge') {
      const unrevealed = puzzle!.optimal_path.slice(1, -1).filter(id => !bridgeNodeIds.has(id))
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)]
      setBridgeNodeIds(prev => new Set(prev).add(pick))
      setActiveHint(null)
    }
  }

  const hopColor = currentHops === 0 ? '#555' : currentHops <= optimalHops ? '#7c3aed' : '#eab308'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerMiddle}>
          <Text style={styles.title}>{puzzle.start_concept} → {puzzle.end_concept}</Text>
          <View style={styles.constraintRow}>
            {puzzle.domain && DOMAIN_HINTS[puzzle.domain] && (
              <Text style={styles.constraint}>{DOMAIN_HINTS[puzzle.domain]}</Text>
            )}
            {puzzle.difficulty && (
              <Text style={[styles.diffBadge, puzzle.difficulty === 'hard' ? styles.diffHard : puzzle.difficulty === 'medium' ? styles.diffMedium : styles.diffEasy]}>
                {puzzle.difficulty}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.scoreDisplay}>
            <Text style={[styles.scoreNum, { color: liveScore > 200 ? colors.textPrimary : '#dc2626' }]}>
              {liveScore}
            </Text>
            {penaltyFlash !== null && (
              <Text style={styles.penaltyFlash}>{penaltyFlash}</Text>
            )}
          </View>
          <View style={styles.hopBadge}>
            <Text style={[styles.hopCount, { color: hopColor }]}>{currentHops}</Text>
            <Text style={styles.hopLabel}> / {optimalHops} hops</Text>
          </View>
        </View>
      </View>
      <View style={styles.canvasWrapper}>
        <PuzzleCanvas
          bubbles={shuffledBubbles ?? layoutBubbles}
          connections={puzzle.connections}
          startId={puzzle.bubbles[0]?.id}
          endId={puzzle.bubbles[puzzle.bubbles.length - 1]?.id}
          minHops={optimalHops}
          onPathComplete={handlePathComplete}
          onPathChange={(path) => setCurrentHops(Math.max(0, path.length - 1))}
          edgeLabels={puzzle.edgeLabels}
          onCanvasLayout={h => {
            if (!canvasHeightSetRef.current && h > 0) {
              canvasHeightSetRef.current = true
              setCanvasHeight(h)
            }
          }}
          connectionModeActive={activeHint === 'connection'}
          onConnectionModeUsed={() => setActiveHint(null)}
          bridgeNodeIds={bridgeNodeIds}
          flashPaths={flashPaths}
          onFlashComplete={() => { setFlashPaths(null); setActiveHint(null) }}
          bubbleScale={bubbleScale}
          onBacktrack={handleBacktrack}
          onReset={handleReset}
        />
      </View>
      <HintTray
        remainingByType={remainingByType}
        activeHint={activeHint}
        onUseHint={handleUseHint}
        connectionAvailable={!!(puzzle.edgeLabels && Object.keys(puzzle.edgeLabels).length > 0)}
      />

      <Modal visible={showHintsFtue} transparent animationType="fade">
        <View style={ftue.overlay}>
          <View style={ftue.sheet}>
            <Text style={ftue.heading}>Your Hints</Text>
            <Text style={ftue.sub}>You get 3 uses of each hint per day.</Text>

            <ScrollView style={ftue.scroll} showsVerticalScrollIndicator={false}>
              {HINT_FTUE_ITEMS.map(h => (
                <View key={h.type} style={ftue.row}>
                  <Text style={ftue.icon}>{h.icon}</Text>
                  <View style={ftue.rowText}>
                    <Text style={ftue.rowTitle}>{h.label}</Text>
                    <Text style={ftue.rowBody}>{h.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable style={ftue.btn} onPress={dismissHintsFtue}>
              <Text style={ftue.btnText}>Got it →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, flexDirection: 'column' },
  canvasWrapper: { flex: 1 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: 12, paddingTop: 2 },
  backText: { color: colors.accent, fontSize: 22 },
  headerMiddle: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  constraintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  constraint: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  diffBadge: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  diffEasy: { color: '#22c55e', backgroundColor: '#f0fdf4' },
  diffMedium: { color: '#d97706', backgroundColor: '#fffbeb' },
  diffHard: { color: '#dc2626', backgroundColor: '#fef2f2' },
  headerRight: { alignItems: 'flex-end', marginLeft: 12 },
  scoreDisplay: { alignItems: 'flex-end' },
  scoreNum: { fontSize: 22, fontWeight: '800' },
  penaltyFlash: { color: '#dc2626', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  hopBadge: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  hopCount: { fontSize: 15, fontWeight: '800' },
  hopLabel: { color: colors.textTertiary, fontSize: 12 },
  error: { color: colors.error, fontSize: 16, marginBottom: 20 },
  backFallback: { paddingVertical: 10, paddingHorizontal: 20 },
  backFallbackText: { color: colors.accent, fontSize: 16 },
})

const ftue = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
    maxHeight: '80%',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  scroll: { marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  icon: { fontSize: 26, marginTop: 2 },
  rowText: { flex: 1 },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
