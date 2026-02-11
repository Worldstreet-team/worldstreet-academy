/**
 * Backfill script: Add default avatar URLs for all users without one.
 * 
 * Usage: npx tsx scripts/backfill-avatars.ts
 */

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"

function generateDefaultAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed)
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encoded}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf&backgroundType=gradientLinear`
}

async function main() {
  await connectDB()

  const usersWithoutAvatar = await User.find({
    $or: [{ avatarUrl: null }, { avatarUrl: "" }],
  })

  console.log(`Found ${usersWithoutAvatar.length} users without avatars`)

  let updated = 0
  for (const user of usersWithoutAvatar) {
    const seed = `${user.firstName} ${user.lastName}`.trim() || user.username
    user.avatarUrl = generateDefaultAvatarUrl(seed)
    await user.save()
    updated++
    console.log(`  ✓ ${user.email} → avatar set`)
  }

  console.log(`\nDone. Updated ${updated} users.`)
  process.exit(0)
}

main().catch((err) => {
  console.error("Backfill failed:", err)
  process.exit(1)
})
