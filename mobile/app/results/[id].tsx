import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable, Share, Animated, Modal } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { colors } from '../../lib/theme'
import { awardXP, getPathStats, localDateString } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import {
  levelFromXP, titleForLevel, xpProgressInCurrentLevel, xpForLevel, UNLOCK_MILESTONES,
} from '../../lib/progression'
import type { NodeScore } from '../../lib/scoring'

function BoldTermsText({ text, terms, style }: { text: string; terms: string[]; style: object }) {
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)
  const seenIndices = new Set<number>()

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const termIndex = terms.findIndex(t => t.toLowerCase() === part.toLowerCase())
        if (termIndex === -1) return <React.Fragment key={i}>{part}</React.Fragment>
        const isFirst = !seenIndices.has(termIndex)
        if (isFirst) seenIndices.add(termIndex)
        return (
          <Text key={i} style={styles.narrativeBold}>
            {part}{isFirst ? <Text style={styles.narrativeNum}> ({termIndex + 1})</Text> : null}
          </Text>
        )
      })}
    </Text>
  )
}

function PathDisplay({ labels, color, stepOpacities }: { labels: string[]; color: string; stepOpacities?: Animated.Value[] }) {
  return (
    <View style={pathStyles.row}>
      {labels.map((label, i) => {
        const anim = stepOpacities?.[i]
        const content = (
          <View key={i} style={pathStyles.stepRow}>
            <View style={[pathStyles.dot, { backgroundColor: color }]} />
            <Text style={pathStyles.label}>{label}</Text>
            {i < labels.length - 1 && <Text style={pathStyles.arrow}>↓</Text>}
          </View>
        )
        if (!anim) return content
        return (
          <Animated.View key={i} style={{ opacity: anim }}>
            {content}
          </Animated.View>
        )
      })}
    </View>
  )
}

const pathStyles = StyleSheet.create({
  row: { alignItems: 'flex-start', width: '100%' },
  stepRow: { alignItems: 'center', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  arrow: { color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 2 },
})

export default function ResultsScreen() {
  const { id: puzzleId, score, timeMs, hops, optimalHops, playerPath, optimalPath, narrative, difficulty, categoryName, puzzleDate, skipXP, liveScore, nodeScores } =
    useLocalSearchParams<{
      id: string
      score: string
      timeMs: string
      hops: string
      optimalHops: string
      playerPath: string
      optimalPath: string
      narrative: string
      difficulty: string
      categoryName?: string
      puzzleDate?: string
      skipXP?: string
      liveScore: string
      nodeScores: string
    }>()

  const { userId } = useAuth()
  const xpAwarded = useRef(false)
  const [earnedXP, setEarnedXP] = useState(0)
  const [streak, setStreak] = useState(0)
  const [pathStats, setPathStats] = useState<{ totalPlayers: number; optimalPathPct: number; sameHopsPct: number } | null>(null)
  const [displayScore, setDisplayScore] = useState(0)
  const playerStepOpacities = useRef<Animated.Value[]>([]).current
  const optimalStepOpacities = useRef<Animated.Value[]>([]).current

  // Level-up state
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number
    newTitle: string
    prevTitle: string
    unlocks: typeof UNLOCK_MILESTONES
    xpBarAnim: Animated.Value
    xpBarOverflow: Animated.Value
  } | null>(null)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const xpBarAnim = useRef(new Animated.Value(0)).current
  const xpBarWidth = useRef(0)

  const totalMs = parseInt(timeMs ?? '0')
  const minutes = Math.floor(totalMs / 60000)
  const seconds = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0')
  const scoreNum = parseInt(score ?? '0')
  const hopsNum = parseInt(hops ?? '0')
  const optimalHopsNum = parseInt(optimalHops ?? '0')
  const liveScoreNum = parseInt(liveScore ?? '0')
  const nodeScoresList: NodeScore[] = nodeScores ? JSON.parse(decodeURIComponent(nodeScores)) : []
  const nodeTotal = nodeScoresList.reduce((s, n) => s + n.points, 0)

  const playerLabels = playerPath ? decodeURIComponent(playerPath).split('|') : []
  const optimalLabels = optimalPath ? decodeURIComponent(optimalPath).split('|') : []

  const beatOptimal = hopsNum < optimalHopsNum
  const samePathAsOptimal = playerLabels.join('|') === optimalLabels.join('|')
  const grade = beatOptimal ? 'Genius' : samePathAsOptimal ? 'Perfect' : scoreNum >= 700 ? 'Great' : scoreNum >= 500 ? 'Good' : 'Keep trying'

  useEffect(() => {
    if (xpAwarded.current || !userId || skipXP === '1') return
    xpAwarded.current = true
    awardXP({
      userId,
      difficulty: (difficulty as 'easy' | 'medium' | 'hard') ?? 'easy',
      isOptimalPath: samePathAsOptimal,
      timeMs: totalMs,
      playedDate: localDateString(),
    }).then(({ earnedXP: xp, totalXP, newStreak }) => {
      setEarnedXP(xp)
      setStreak(newStreak)

      const prevTotalXP = totalXP - xp
      const prevLevel = levelFromXP(prevTotalXP)
      const newLevel = levelFromXP(totalXP)
      const didLevelUp = newLevel > prevLevel

      // Animate XP bar filling from previous position
      const prevProgress = xpProgressInCurrentLevel(prevTotalXP)
      const newProgress = xpProgressInCurrentLevel(totalXP)
      const startFill = prevProgress.current / prevProgress.required
      const endFill = didLevelUp ? 1 : newProgress.current / newProgress.required

      xpBarAnim.setValue(startFill)
      Animated.timing(xpBarAnim, {
        toValue: endFill,
        duration: 900,
        delay: 400,
        useNativeDriver: false,
      }).start(() => {
        if (didLevelUp) {
          const unlocks = UNLOCK_MILESTONES.filter(m => m.level === newLevel)
          setLevelUpData({
            newLevel,
            newTitle: titleForLevel(newLevel),
            prevTitle: titleForLevel(prevLevel),
            unlocks,
            xpBarAnim: new Animated.Value(0),
            xpBarOverflow: new Animated.Value(0),
          })
          setTimeout(() => setShowLevelUpModal(true), 200)
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!puzzleId || hopsNum === 0) return
    getPathStats(puzzleId, hopsNum, optimalHopsNum, userId).then(setPathStats)
  }, [puzzleId, hopsNum])

  // Score count-up animation
  useEffect(() => {
    if (scoreNum === 0) return
    let start: number | null = null
    const duration = 800
    const step = (timestamp: number) => {
      if (start === null) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * scoreNum))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [scoreNum])

  // Staggered path reveal
  useEffect(() => {
    const allLabels = [...playerLabels, ...optimalLabels]
    if (allLabels.length === 0) return

    // Initialise opacity values
    playerLabels.forEach((_, i) => {
      if (!playerStepOpacities[i]) playerStepOpacities[i] = new Animated.Value(0)
      else playerStepOpacities[i].setValue(0)
    })
    optimalLabels.forEach((_, i) => {
      if (!optimalStepOpacities[i]) optimalStepOpacities[i] = new Animated.Value(0)
      else optimalStepOpacities[i].setValue(0)
    })

    const animations = playerLabels.map((_, i) =>
      Animated.timing(playerStepOpacities[i], { toValue: 1, duration: 200, delay: i * 80, useNativeDriver: true })
    )
    if (!samePathAsOptimal) {
      optimalLabels.forEach((_, i) => {
        animations.push(
          Animated.timing(optimalStepOpacities[i], {
            toValue: 1, duration: 200, delay: (playerLabels.length + i) * 80 + 200, useNativeDriver: true,
          })
        )
      })
    }
    Animated.parallel(animations).start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const DIFFICULTY_EMOJI: Record<string, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
  const diffEmoji = DIFFICULTY_EMOJI[(difficulty as string) ?? 'easy'] ?? '🟢'

  async function handleShare() {
    const hopDots = Array.from({ length: hopsNum + 1 }, (_, i) => {
      if (i === 0 || i === hopsNum) return '🐇'
      return samePathAsOptimal ? '🟣' : '⚪'
    }).join('')

    const lines = [
      `Hops 🐇`,
      `${diffEmoji} ${hopsNum} hop${hopsNum !== 1 ? 's' : ''} (optimal: ${optimalHopsNum})`,
      hopDots,
      `${playerLabels[0]} → ${playerLabels[playerLabels.length - 1]}`,
    ]
    if (pathStats && pathStats.totalPlayers >= 2) {
      lines.push(`${pathStats.optimalPathPct}% of players found optimal`)
    }
    lines.push(`\ndeepr.fm/play`)

    await Share.share({ message: lines.join('\n') })
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {categoryName ? (
        <View style={styles.header}>
          <Text style={styles.title}>{decodeURIComponent(categoryName)}</Text>
          {puzzleDate && (
            <Text style={styles.dateLabel}>
              {new Date(puzzleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.title}>RabbitHole</Text>
      )}

      <View style={styles.scoreCard}>
        <Text style={styles.grade}>{grade}</Text>
        <Text style={styles.scoreValue}>{displayScore}</Text>
        <Text style={styles.scoreLabel}>points</Text>
        <View style={styles.xpStreakRow}>
          {earnedXP > 0 && (
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>+{earnedXP} XP</Text>
            </View>
          )}
          {streak > 1 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {streak} day streak</Text>
            </View>
          )}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{minutes}:{seconds}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: beatOptimal ? '#22c55e' : samePathAsOptimal ? '#7c3aed' : '#eab308' }]}>
              {hopsNum} hop{hopsNum !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.statLabel}>your path</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{optimalHopsNum} hop{optimalHopsNum !== 1 ? 's' : ''}</Text>
            <Text style={styles.statLabel}>optimal</Text>
          </View>
        </View>
      </View>

      {/* XP progress bar */}
      <View
        style={styles.xpBarContainer}
        onLayout={e => { xpBarWidth.current = e.nativeEvent.layout.width }}
      >
        <View style={styles.xpBarRow}>
          <Text style={styles.xpBarLabel}>+{earnedXP} XP</Text>
          <Text style={styles.xpBarLabelRight}>
            {levelUpData ? `Level ${levelUpData.newLevel} 🎉` : ''}
          </Text>
        </View>
        <View style={styles.xpBarTrack}>
          <Animated.View style={[
            styles.xpBarFill,
            { width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]} />
        </View>
      </View>

      {/* Level-up modal */}
      <Modal visible={showLevelUpModal} transparent animationType="fade">
        <View style={levelUpStyles.overlay}>
          <View style={levelUpStyles.card}>
            <Text style={levelUpStyles.emoji}>🐇</Text>
            <Text style={levelUpStyles.levelText}>Level {levelUpData?.newLevel}</Text>
            <Text style={levelUpStyles.titleText}>{levelUpData?.newTitle}</Text>
            {levelUpData?.prevTitle !== levelUpData?.newTitle && (
              <Text style={levelUpStyles.titleChange}>
                {levelUpData?.prevTitle} → {levelUpData?.newTitle}
              </Text>
            )}
            {levelUpData?.unlocks.map((u, i) => (
              <View key={i} style={levelUpStyles.unlockBadge}>
                <Text style={levelUpStyles.unlockText}>
                  {u.type === 'difficulty'
                    ? `🔓 ${u.unlock === 'medium' ? 'Medium' : 'Hard'} difficulty unlocked!`
                    : `🔓 New category slot unlocked!`}
                </Text>
              </View>
            ))}
            <Pressable
              style={levelUpStyles.btn}
              onPress={() => {
                setShowLevelUpModal(false)
                if (levelUpData?.unlocks.some(u => u.type === 'category_slot')) {
                  router.replace('/onboarding')
                }
              }}
            >
              <Text style={levelUpStyles.btnText}>
                {levelUpData?.unlocks.some(u => u.type === 'category_slot')
                  ? 'Pick a new topic →'
                  : 'Keep going!'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Hard difficulty framing */}
      {difficulty === 'hard' && hopsNum === optimalHopsNum && !samePathAsOptimal && (
        <View style={styles.hardOptimalBanner}>
          <Text style={styles.hardOptimalBannerText}>Shortest route!</Text>
        </View>
      )}
      {difficulty === 'hard' && hopsNum > optimalHopsNum && (
        <View style={styles.hardAltBanner}>
          <Text style={styles.hardAltBannerText}>Shortest route: {optimalHopsNum} hop{optimalHopsNum !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Path comparison */}
      <View style={[styles.pathsCard, samePathAsOptimal && styles.pathsCardColumn]}>
        {samePathAsOptimal ? (
          <>
            <View style={styles.optimalBanner}>
              <Text style={styles.optimalBannerText}>⚡ You found the optimal path</Text>
            </View>
            <View style={styles.pathCol}>
              <Text style={styles.pathTitle}>Your Path = Optimal Path</Text>
              <PathDisplay labels={playerLabels} color="#7c3aed" stepOpacities={playerStepOpacities} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.pathCol}>
              <Text style={styles.pathTitle}>Your Path</Text>
              <PathDisplay labels={playerLabels} color="#eab308" stepOpacities={playerStepOpacities} />
            </View>
            <View style={styles.pathDivider} />
            <View style={styles.pathCol}>
              <Text style={styles.pathTitle}>Optimal Path</Text>
              <PathDisplay labels={optimalLabels} color="#7c3aed" stepOpacities={optimalStepOpacities} />
            </View>
          </>
        )}
      </View>

      {/* Score breakdown */}
      {nodeScoresList.length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Score Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownItem}>Time score</Text>
            <Text style={styles.breakdownPts}>{liveScoreNum}</Text>
          </View>
          {nodeScoresList.map((n, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownItem}>
                {n.label}
                <Text style={styles.breakdownCat}>
                  {n.category === 'right_place' ? ' (right place)' : n.category === 'wrong_place' ? ' (wrong place)' : ' (wrong node)'}
                </Text>
              </Text>
              <Text style={[styles.breakdownPts, n.points === 0 && styles.breakdownZero]}>
                +{n.points}
              </Text>
            </View>
          ))}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>Total</Text>
            <Text style={styles.breakdownTotalPts}>{scoreNum}</Text>
          </View>
        </View>
      )}

      {pathStats && pathStats.totalPlayers >= 2 && (
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>How others played</Text>
          <View style={styles.statsCardRow}>
            <View style={styles.statsCardItem}>
              <Text style={styles.statsCardBig}>{pathStats.optimalPathPct}%</Text>
              <Text style={styles.statsCardDesc}>found the optimal path</Text>
            </View>
            <View style={styles.statsCardDivider} />
            <View style={styles.statsCardItem}>
              <Text style={styles.statsCardBig}>{pathStats.sameHopsPct}%</Text>
              <Text style={styles.statsCardDesc}>took {hopsNum} hop{hopsNum !== 1 ? 's' : ''} like you</Text>
            </View>
          </View>
          <Text style={styles.statsCardFooter}>{pathStats.totalPlayers} player{pathStats.totalPlayers !== 1 ? 's' : ''} completed this puzzle</Text>
        </View>
      )}

      {/* AI narrative */}
      <View style={styles.narrativeCard}>
        <Text style={styles.narrativeTitle}>The RabbitHole</Text>
        <Text style={styles.narrativeSubtitle}>The optimal path through the rabbit hole</Text>
        {narrative ? (
          <BoldTermsText
            text={decodeURIComponent(narrative)}
            terms={optimalLabels}
            style={styles.narrativeText}
          />
        ) : (
          <Text style={styles.narrativePlaceholder}>No narrative available for this puzzle.</Text>
        )}
      </View>

      <Pressable style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareButtonText}>Share Result</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>Back to Today</Text>
      </Pressable>
      <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/leaderboard')}>
        <Text style={styles.buttonSecondaryText}>See Leaderboard</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 72, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { color: colors.accent, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  dateLabel: { color: colors.textTertiary, fontSize: 13, marginTop: 4 },
  scoreCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  grade: { color: colors.accent, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  scoreValue: { color: colors.textPrimary, fontSize: 72, fontWeight: '800', lineHeight: 80 },
  scoreLabel: { color: colors.textTertiary, fontSize: 14, marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: 16 },
  statValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  pathsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathsCardColumn: { flexDirection: 'column' },
  pathCol: { flex: 1 },
  pathTitle: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  optimalBanner: { backgroundColor: colors.accentLight, borderRadius: 10, padding: 10, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#c4b5fd' },
  optimalBannerText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  hardOptimalBanner: { backgroundColor: colors.accentLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c4b5fd', width: '100%' },
  hardOptimalBannerText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  hardAltBanner: { backgroundColor: colors.bgCard, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, width: '100%' },
  hardAltBannerText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  pathDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  narrativeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  narrativeTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  narrativeSubtitle: { color: colors.textTertiary, fontSize: 11, marginBottom: 10 },
  narrativeText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  narrativeBold: { color: colors.textPrimary, fontWeight: '700' },
  narrativeNum: { color: colors.accent, fontWeight: '400', fontSize: 12 },
  narrativePlaceholder: { color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: colors.textTertiary, fontSize: 15 },
  xpStreakRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  xpBadge: {
    backgroundColor: colors.accentLight,
    borderColor: '#c4b5fd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  streakBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: { color: '#c2410c', fontSize: 15, fontWeight: '700' },
  xpBarContainer: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  xpBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpBarLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  xpBarLabelRight: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  xpBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  statsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsCardTitle: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  statsCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statsCardItem: { flex: 1, alignItems: 'center' },
  statsCardBig: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  statsCardDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center' },
  statsCardDivider: { width: 1, height: 40, backgroundColor: colors.border },
  statsCardFooter: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
  shareButton: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  breakdownCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownTitle: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownItem: { color: colors.textPrimary, fontSize: 14, flex: 1 },
  breakdownCat: { color: colors.textTertiary, fontSize: 12, fontStyle: 'italic' },
  breakdownPts: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  breakdownZero: { color: colors.textTertiary },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 8,
  },
  breakdownTotalLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  breakdownTotalPts: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
})

const levelUpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  emoji: { fontSize: 56, marginBottom: 12 },
  levelText: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
  },
  titleText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  titleChange: {
    color: colors.textTertiary,
    fontSize: 13,
    marginBottom: 16,
  },
  unlockBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  unlockText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
