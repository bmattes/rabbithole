import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (!error && data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        display_name: `Player${Math.floor(Math.random() * 9999)}`,
      })
    }
  }

  return { session, loading, signInAnonymously, userId: session?.user.id ?? null }
}
