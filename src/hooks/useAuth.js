import { useSyncExternalStore, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// Module-level singleton store.
// All useAuth() callers share ONE subscription and ONE state.
// Multiple independent useState-based subscriptions caused a navigation loop
// between Login and ProtectedRoute (each saw session/isAdmin at different
// points in time).

let state = { session: null, role: null, loading: true }
const listeners = new Set()
let initialized = false

const emit = () => listeners.forEach((l) => l())
const setState = (patch) => {
  state = { ...state, ...patch }
  emit()
}

const loadRole = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[useAuth] loadRole error:', error.message)
      setState({ role: null })
    } else {
      setState({ role: data?.role ?? null })
    }
  } catch (err) {
    console.warn('[useAuth] loadRole exception:', err)
    setState({ role: null })
  }
}

const initAuthStore = () => {
  if (initialized) return
  initialized = true

  // Safety net: unblock UI if INITIAL_SESSION never fires (network hang, etc.)
  const safety = setTimeout(() => {
    if (state.loading) {
      console.warn('[useAuth] auth init timeout — forcing loading=false')
      setState({ loading: false })
    }
  }, 4000)

  // IMPORTANT: do NOT await Supabase queries inside this callback.
  // The auth client holds an internal lock (navigator.locks) while it runs;
  // awaiting another Supabase call can deadlock subsequent auth operations.
  // Defer with setTimeout(0) so the query runs OUTSIDE the lock.
  supabase.auth.onAuthStateChange((_event, newSession) => {
    clearTimeout(safety)
    setState({ session: newSession, loading: false })
    if (newSession) {
      setTimeout(() => loadRole(newSession.user.id), 0)
    } else {
      setState({ role: null })
    }
  })
}

const subscribe = (listener) => {
  initAuthStore()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

export const useAuth = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return {
    session: snap.session,
    user: snap.session?.user ?? null,
    role: snap.role,
    isAdmin: snap.role === 'admin',
    loading: snap.loading,
    signIn,
    signOut,
  }
}
