import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { useProgression } from '../hooks/useProgression'

function RedirectToOnboarding() {
  const { userId, loading: authLoading, session, signInAnonymously } = useAuth()
  const progression = useProgression(userId)
  const hasNavigated = useRef(false)

  useEffect(() => {
    if (!authLoading && !session) {
      signInAnonymously()
    }
  }, [authLoading, session])

  useEffect(() => {
    if (authLoading || progression.loading) return
    if (!hasNavigated.current && userId) {
      hasNavigated.current = true
      if (progression.unlockedCategories.length === 0) {
        router.replace('/howtoplay')
      } else {
        router.replace('/(tabs)')
      }
    }
  }, [authLoading, progression.loading, userId, progression.unlockedCategories.length])

  return null
}

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, presentation: 'fullScreenModal' }} initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="howtoplay" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="puzzle/[id]" />
        <Stack.Screen name="results/[id]" />
      </Stack>
      <RedirectToOnboarding />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
