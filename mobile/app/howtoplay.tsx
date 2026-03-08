import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native'
import { router } from 'expo-router'
import { colors } from '../lib/theme'

const { width: SW } = Dimensions.get('window')

const STEPS = [
  {
    emoji: '🐇',
    title: 'Follow the rabbit hole',
    body: 'Each day you get a set of puzzles. Your goal: connect a Start concept to an End concept by hopping through related ideas.',
    visual: <StartEndVisual />,
  },
  {
    emoji: '🫧',
    title: 'Tap bubbles to hop',
    body: 'Bubbles are connected to each other. Tap one to add it to your path. Tap again to backtrack. Find a route from Start to End.',
    visual: <BubbleVisual />,
  },
  {
    emoji: '⚡',
    title: 'Fewer hops = more points',
    body: 'There\'s an optimal path — the shortest route through the rabbit hole. Match it for a perfect score. Speed and streaks earn bonus points too.',
    visual: <HopsVisual />,
  },
  {
    emoji: '🏆',
    title: 'Come back every day',
    body: 'New puzzles drop daily. Build a streak, climb the leaderboard, and unlock harder puzzles as you level up.',
    visual: <StreakVisual />,
  },
]

function StartEndVisual() {
  return (
    <View style={v.container}>
      <View style={[v.pill, v.pillStart]}>
        <Text style={v.pillText}>Monaco</Text>
      </View>
      <Text style={v.arrow}>↓</Text>
      <View style={v.pillMid}>
        <Text style={[v.pillText, { color: colors.textTertiary }]}>?</Text>
      </View>
      <Text style={v.arrow}>↓</Text>
      <View style={[v.pill, v.pillEnd]}>
        <Text style={v.pillText}>Turkey</Text>
      </View>
    </View>
  )
}

function BubbleVisual() {
  return (
    <View style={v.container}>
      <View style={v.bubbleRow}>
        <View style={[v.bubble, v.bubbleActive]}><Text style={v.bubbleTextActive}>Monaco</Text></View>
        <View style={[v.bubble, v.bubbleActive]}><Text style={v.bubbleTextActive}>Europe</Text></View>
      </View>
      <View style={v.bubbleRow}>
        <View style={[v.bubble, v.bubbleIdle]}><Text style={v.bubbleTextIdle}>Kazakhstan</Text></View>
        <View style={[v.bubble, v.bubbleIdle]}><Text style={v.bubbleTextIdle}>Asia</Text></View>
      </View>
      <View style={v.bubbleRow}>
        <View style={[v.bubble, v.bubbleIdle]}><Text style={v.bubbleTextIdle}>Turkey</Text></View>
      </View>
    </View>
  )
}

function HopsVisual() {
  return (
    <View style={v.container}>
      <View style={v.hopsRow}>
        <View style={v.hopsCol}>
          <Text style={v.hopsLabel}>Your path</Text>
          <Text style={v.hopsNum}>4 hops</Text>
          <View style={v.scoreBadge}>
            <Text style={v.scoreText}>620 pts</Text>
          </View>
        </View>
        <View style={v.hopsDivider} />
        <View style={v.hopsCol}>
          <Text style={v.hopsLabel}>Optimal</Text>
          <Text style={[v.hopsNum, { color: colors.accent }]}>3 hops</Text>
          <View style={[v.scoreBadge, v.scoreBadgeOptimal]}>
            <Text style={[v.scoreText, { color: colors.accent }]}>850 pts</Text>
          </View>
        </View>
      </View>
      <Text style={v.hopsHint}>Match the optimal path for full score</Text>
    </View>
  )
}

function StreakVisual() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const done = [true, true, true, true, true, false, false]
  return (
    <View style={v.container}>
      <View style={v.streakRow}>
        {days.map((d, i) => (
          <View key={i} style={[v.streakDay, done[i] && v.streakDayDone]}>
            <Text style={[v.streakDayLabel, done[i] && v.streakDayLabelDone]}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={v.streakBadge}>
        <Text style={v.streakBadgeText}>5 day streak</Text>
      </View>
    </View>
  )
}

export default function HowToPlayScreen() {
  const [step, setStep] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  function goTo(i: number) {
    setStep(i)
    scrollRef.current?.scrollTo({ x: i * SW, animated: true })
  }

  function next() {
    if (step < STEPS.length - 1) {
      goTo(step + 1)
    } else {
      router.replace('/onboarding')
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
      >
        {STEPS.map((s, i) => (
          <View key={i} style={[styles.page, { width: SW }]}>
            <Text style={styles.emoji}>{s.emoji}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
            <View style={styles.visualBox}>{s.visual}</View>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={next}>
          <Text style={styles.primaryBtnText}>{isLast ? "Pick my topics →" : "Next →"}</Text>
        </Pressable>
        {!isLast && (
          <Pressable style={styles.skipBtn} onPress={() => router.replace('/onboarding')}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const v = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 8 },
  pill: {
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 2,
    marginVertical: 4,
  },
  pillStart: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  pillEnd: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  pillMid: {
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginVertical: 4,
  },
  pillText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  arrow: { color: colors.textTertiary, fontSize: 16 },

  bubbleRow: { flexDirection: 'row', gap: 10, marginVertical: 5 },
  bubble: { borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5 },
  bubbleActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  bubbleIdle: { borderColor: colors.border, backgroundColor: colors.bgCard },
  bubbleTextActive: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  bubbleTextIdle: { color: colors.textSecondary, fontSize: 13 },

  hopsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hopsCol: { flex: 1, alignItems: 'center' },
  hopsDivider: { width: 1, height: 60, backgroundColor: colors.border },
  hopsLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  hopsNum: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  scoreBadge: { backgroundColor: colors.bgCardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeOptimal: { backgroundColor: colors.accentLight },
  scoreText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  hopsHint: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },

  streakRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  streakDay: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.bgCardAlt,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  streakDayDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  streakDayLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  streakDayLabelDone: { color: '#fff' },
  streakBadge: { backgroundColor: colors.accentLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  streakBadgeText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pager: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
  },
  emoji: { fontSize: 52, marginBottom: 20 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: -0.3 },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 32 },
  visualBox: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.accent },
  footer: { paddingHorizontal: 24, paddingBottom: 48, width: '100%', gap: 4 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { color: colors.textTertiary, fontSize: 15 },
})
