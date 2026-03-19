import { useEffect, useRef, useState } from 'react'
import { Stack, router } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../hooks/useAuth'

function RedirectToOnboarding() {
  const { userId, loading: authLoading, session, signInAnonymously } = useAuth()
  const hasNavigated = useRef(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [hasOnboarded, setHasOnboarded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('hasCompletedOnboarding').then(val => {
      setHasOnboarded(val === '1')
      setOnboardingChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authLoading && !session) {
      signInAnonymously()
    }
  }, [authLoading, session])

  useEffect(() => {
    if (authLoading || !onboardingChecked) return
    if (!hasNavigated.current && userId) {
      hasNavigated.current = true
      if (hasOnboarded) {
        router.replace('/(tabs)')
      } else {
        router.replace('/howtoplay')
      }
    }
  }, [authLoading, onboardingChecked, userId, hasOnboarded])

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
