"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { useVivid } from "@/lib/vivid/provider"
import { Input } from "@/components/ui/input"
import { CheckIcon, SearchIcon, UserIcon, UserPlusIcon, XIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

interface SearchUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl?: string
  bio?: string
  role?: string
}

export function FriendSearchUI() {
  const vivid = useVivid()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [isSearching, startSearch] = useTransition()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [isAdding, startAdd] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([])
        return
      }
      startSearch(async () => {
        const { vividSearchUsers } = await import("@/lib/vivid/actions/messages")
        const r = await vividSearchUsers({ query: q, limit: 10 })
        if (r.success) setResults(r.users)
      })
    },
    []
  )

  const handleInput = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const handleAdd = (user: SearchUser) => {
    startAdd(async () => {
      const { getOrCreateConversation } = await import("@/lib/actions/messages")
      const result = await getOrCreateConversation(user.id)
      if (result.success) {
        setAddedIds((prev) => new Set(prev).add(user.id))
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <SearchIcon
          
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9 pr-9 h-10 text-sm bg-muted/50 border-0 focus-visible:ring-1 rounded-lg"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <XIcon  size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="max-h-56 overflow-y-auto space-y-1">
        <AnimatePresence mode="popLayout">
          {isSearching && results.length === 0 && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="h-4 w-4 mx-auto rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
            </motion.div>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center text-sm text-muted-foreground"
            >
              No users found
            </motion.p>
          )}

          {results.map((user) => {
            const isAdded = addedIds.has(user.id)
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors"
              >
                {/* Avatar */}
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-accent/30 shrink-0">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon  size={18} className="text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.fullName}
                  </p>
                  {user.role && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {user.role}
                    </span>
                  )}
                </div>

                {/* Add button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={isAdded || isAdding}
                  onClick={() => handleAdd(user)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isAdded
                      ? "bg-ws-success/15 text-ws-success dark:text-ws-success"
                      : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                  }`}
                >
                  <RenderIcon icon={isAdded ? CheckIcon : UserPlusIcon}  size={13} />
                  {isAdded ? "Added" : "Add"}
                </motion.button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Done button */}
      {addedIds.size > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            vivid.resolveUI({
              action: "friends-added",
              addedCount: addedIds.size,
              userIds: [...addedIds],
            })
          }
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Done ({addedIds.size} added)
        </motion.button>
      )}
    </div>
  )
}
