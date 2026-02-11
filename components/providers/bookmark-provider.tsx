"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useBookmarks } from "@/lib/hooks/use-bookmarks"

type BookmarkCtx = {
  isBookmarked: (id: string) => boolean
  toggle: (id: string) => void
}

const BookmarkContext = createContext<BookmarkCtx>({
  isBookmarked: () => false,
  toggle: () => {},
})

export function useBookmarkContext() {
  return useContext(BookmarkContext)
}

export function BookmarkProvider({
  courseIds,
  children,
}: {
  courseIds: string[]
  children: ReactNode
}) {
  const { isBookmarked, toggle } = useBookmarks(courseIds)

  const value = useMemo(() => ({ isBookmarked, toggle }), [isBookmarked, toggle])

  return (
    <BookmarkContext.Provider value={value}>
      {children}
    </BookmarkContext.Provider>
  )
}
