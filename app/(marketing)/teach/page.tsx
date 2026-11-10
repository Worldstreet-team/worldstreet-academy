import { permanentRedirect } from "next/navigation"

/**
 * `/teach` used to pitch "Become a WMA Instructor" from the main navigation.
 * Staff tutors are now hired like employees through the vacancy page (owner
 * voice note, 2026-11-05: "it shouldn't be on the main website"), so old links,
 * emails and search results land on /careers. Selling your own course stays
 * at /sell.
 */
export default function TeachPage(): never {
  permanentRedirect("/careers")
}
