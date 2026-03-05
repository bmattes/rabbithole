import { Stack } from 'expo-router'
import { View } from 'react-native'
import { StyleSheet } from 'react-native'

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="puzzle/[id]" />
        <Stack.Screen name="results/[id]" />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
