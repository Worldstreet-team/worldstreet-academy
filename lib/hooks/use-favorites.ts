"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "worldstreet_favorites"

// External store for cross-component sync
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function emitChange() {
  listeners.forEach((l) => l())
}

// Cached snapshot to avoid returning a new array reference each render
let cachedRaw: string | null = null
let cachedResult: string[] = []
const EMPTY: string[] = []

function getSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedResult = raw ? JSON.parse(raw) : []
    }
    return cachedResult
  } catch {
    return EMPTY
  }
}

function getServerSnapshot(): string[] {
  return EMPTY
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggleFavorite = useCallback((courseId: string) => {
    const current = getSnapshot()
    const next = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    emitChange()
  }, [])

  const isFavorite = useCallback(
    (courseId: string) => favorites.includes(courseId),
    [favorites]
  )

  return { favorites, toggleFavorite, isFavorite }
}
