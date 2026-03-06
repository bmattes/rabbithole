import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('[Auth] getSession failed:', error.message)
      console.log('[Auth] session:', session?.user?.id ?? 'none')
      setSession(session)
      setLoading(false)
      if (session?.user) {
        supabase.from('users').upsert({
          id: session.user.id,
          display_name: `Player${Math.floor(Math.random() * 9999)}`,
        }, { onConflict: 'id', ignoreDuplicates: true }).then(({ error }) => {
          if (error) console.error('[Auth] users upsert (existing session) failed:', error.message)
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInAnonymously() {
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) return
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('[Auth] signInAnonymously failed:', error.message)
      return
    }
    if (data.user) {
      const { error: upsertError } = await supabase.from('users').upsert({
        id: data.user.id,
        display_name: `Player${Math.floor(Math.random() * 9999)}`,
      }, { onConflict: 'id', ignoreDuplicates: true })
      if (upsertError) console.error('[Auth] users upsert failed:', upsertError.message)
    }
  }

  return { session, loading, signInAnonymously, userId: session?.user.id ?? null }
}
