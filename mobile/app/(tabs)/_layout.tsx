import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#222' },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
