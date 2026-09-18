import { create } from "zustand"
import type { SchoolSlug } from "@/lib/schools"
import { START_SCHOOL_COOKIE } from "@/lib/start-gate"

/** The school picked on the landing — shared by the hero's chips and the bar that follows the visitor down the page. */
export const useStartSchool = create<{ picked: SchoolSlug | null; pick: (slug: SchoolSlug) => void }>((set) => ({
  picked: null,
  pick: (slug) => {
    // Survives the sign-up round trip even if the hub drops the return URL.
    document.cookie = `${START_SCHOOL_COOKIE}=${slug}; path=/; max-age=2592000; samesite=lax`
    set({ picked: slug })
  },
}))
