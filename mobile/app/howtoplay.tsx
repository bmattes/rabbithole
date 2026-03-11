import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native'
import Svg, { Path } from 'react-native-svg'
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
    title: 'Drag to connect',
    body: 'Drag a line from one bubble to a connected one to hop. Drag backward to undo. Find a route from Start to End.',
    visual: <BubbleVisual />,
  },
  {
    emoji: '⚡',
    title: 'Fewer hops = more points',
    body: 'There\'s an optimal path — the shortest route through the rabbit hole. Match it for a perfect score. Speed and streaks earn bonus points too.',
    visual: <HopsVisual />,
  },
  {
    emoji: '🎯',
    title: 'Choose your challenge',
    body: 'Three difficulty levels — each with a different puzzle structure.',
    visual: <DifficultyVisual />,
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

// Fixed bubble positions for the visual — laid out to look like a real puzzle
const BV_W = 260
const BV_H = 200
const BV_BUBBLES = [
  { label: 'Monaco',     x: 130, y: 20,  state: 'start' },
  { label: 'Europe',     x: 130, y: 90,  state: 'active' },
  { label: 'Kazakhstan', x: 30,  y: 155, state: 'idle' },
  { label: 'Asia',       x: 130, y: 155, state: 'idle' },
  { label: 'Turkey',     x: 230, y: 155, state: 'end' },
]
// Lines: [fromIndex, toIndex, active]
const BV_LINES = [
  { from: 0, to: 1, active: true },
  { from: 1, to: 4, active: false }, // the path continues to Turkey (dashed — not yet traced)
  { from: 1, to: 2, active: false },
  { from: 1, to: 3, active: false },
]

function BubbleVisual() {
  return (
    <View style={{ width: BV_W, height: BV_H }}>
      <Svg width={BV_W} height={BV_H} style={StyleSheet.absoluteFill} pointerEvents="none">
        {BV_LINES.map((l, i) => {
          const from = BV_BUBBLES[l.from]
          const to = BV_BUBBLES[l.to]
          const d = `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`
          return (
            <Path
              key={i}
              d={d}
              stroke={l.active ? colors.accent : colors.border}
              strokeWidth={l.active ? 3 : 1.5}
              strokeDasharray={l.active ? undefined : '5,4'}
              fill="none"
              strokeLinecap="round"
              opacity={l.active ? 1 : 0.6}
            />
          )
        })}
      </Svg>
      {BV_BUBBLES.map((b) => {
        const isStart = b.state === 'start'
        const isEnd = b.state === 'end'
        const isActive = b.state === 'active'
        const isPill = isStart || isEnd
        return (
          <View
            key={b.label}
            style={[
              v.bvBubble,
              isPill && (isStart ? v.bvStart : v.bvEnd),
              isActive && v.bvActive,
              !isPill && !isActive && v.bvIdle,
              { left: b.x, top: b.y, transform: [{ translateX: -45 }, { translateY: -14 }] },
            ]}
          >
            <Text style={[v.bvText, (isPill || isActive) && v.bvTextBright]}>{b.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function HopsVisual() {
  const optimalNodes = ['Monaco', 'Europe', 'Turkey']
  const playerNodes = ['Monaco', 'Europe', 'Asia', 'Turkey']
  return (
    <View style={v.container}>
      {/* Optimal path */}
      <View style={v.pathRow}>
        <View style={v.pathLabelCol}>
          <Text style={v.pathLabel}>Optimal</Text>
          <Text style={[v.pathHops, { color: colors.accent }]}>3 hops ✓</Text>
        </View>
        <View style={v.pathBubbles}>
          {optimalNodes.map((n, i) => (
            <View key={n} style={v.pathStep}>
              <View style={[v.pathBubble, i === 0 && v.pathBubbleStart, i === optimalNodes.length - 1 && v.pathBubbleEnd, i > 0 && i < optimalNodes.length - 1 && v.pathBubbleOptimal]}>
                <Text style={[v.pathBubbleText, (i === 0 || i === optimalNodes.length - 1) && v.pathBubbleTextPill]}>{n}</Text>
              </View>
              {i < optimalNodes.length - 1 && <Text style={v.pathArrow}>→</Text>}
            </View>
          ))}
        </View>
      </View>

      <View style={v.hopsDivider} />

      {/* Player path */}
      <View style={v.pathRow}>
        <View style={v.pathLabelCol}>
          <Text style={v.pathLabel}>You</Text>
          <Text style={[v.pathHops, { color: '#d97706' }]}>4 hops</Text>
        </View>
        <View style={v.pathBubbles}>
          {playerNodes.map((n, i) => (
            <View key={n} style={v.pathStep}>
              <View style={[v.pathBubble, i === 0 && v.pathBubbleStart, i === playerNodes.length - 1 && v.pathBubbleEnd, i > 0 && i < playerNodes.length - 1 && v.pathBubbleIdle]}>
                <Text style={[v.pathBubbleText, (i === 0 || i === playerNodes.length - 1) && v.pathBubbleTextPill]}>{n}</Text>
              </View>
              {i < playerNodes.length - 1 && <Text style={v.pathArrow}>→</Text>}
            </View>
          ))}
        </View>
      </View>

      <Text style={v.hopsHint}>Match the optimal path for full score</Text>
    </View>
  )
}

function DifficultyVisual() {
  const rows = [
    { label: '🟢 Easy', desc: 'One path connects Start to End. The other bubbles are red herrings — can you find THE bridge?' },
    { label: '🟡 Medium', desc: 'Only one route completes the connection. Can you navigate through the dead ends?' },
    { label: '🔴 Hard', desc: 'Multiple paths work — but only one is shortest. Can you find the optimal route?' },
  ]
  return (
    <View style={dv.container}>
      {rows.map(r => (
        <View key={r.label} style={dv.row}>
          <Text style={dv.label}>{r.label}</Text>
          <Text style={dv.desc}>{r.desc}</Text>
        </View>
      ))}
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

  bvBubble: {
    position: 'absolute',
    width: 90,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  bvStart: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  bvEnd: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  bvActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  bvIdle: { borderColor: colors.border, backgroundColor: colors.bgCard },
  bvText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  bvTextBright: { color: '#fff' },

  hopsDivider: { height: 1, width: '100%', backgroundColor: colors.border, marginVertical: 12 },
  hopsHint: { color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8 },

  pathRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pathLabelCol: { width: 52, alignItems: 'flex-end' },
  pathLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  pathHops: { fontSize: 11, fontWeight: '700' },
  pathBubbles: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
  pathStep: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pathArrow: { color: colors.textTertiary, fontSize: 10 },
  pathBubble: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCardAlt,
  },
  pathBubbleStart: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pathBubbleEnd: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  pathBubbleOptimal: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  pathBubbleIdle: { borderColor: colors.border, backgroundColor: colors.bgCardAlt },
  pathBubbleText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  pathBubbleTextPill: { color: '#fff' },

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

const dv = StyleSheet.create({
  container: { width: '100%', gap: 12 },
  row: {
    backgroundColor: colors.bgCardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  label: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  desc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
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
  dots: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 16, justifyContent: 'center' },
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
