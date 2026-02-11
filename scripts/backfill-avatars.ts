/**
 * Backfill script: Add/update default avatar URLs for all users.
 * 
 * Usage: 
 *   npx tsx scripts/backfill-avatars.ts              # Only users without avatars
 *   npx tsx scripts/backfill-avatars.ts --force      # Update ALL users (replaces existing)
 *   npx tsx scripts/backfill-avatars.ts --initials   # Only update old "initials" style avatars
 */

// Set MongoDB URI directly for this temporary script (MUST be before any imports)
process.env.MONGODB_URI = "mongodb+srv://samsonrichfield_db_user:abisam105@auth.fc2qg29.mongodb.net/worldstreet-academy?appName=auth"

function generateDefaultAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed)
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encoded}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf&backgroundType=gradientLinear`
}

async function main() {
  // Dynamic imports after env var is set
  const { default: connectDB } = await import("@/lib/db")
  const { User } = await import("@/lib/db/models")

  const args = process.argv.slice(2)
  const forceUpdate = args.includes("--force")
  const updateInitialsOnly = args.includes("--initials")

  await connectDB()

  let query = {}
  let description = "users without avatars"

  if (forceUpdate) {
    // Update ALL users
    query = {}
    description = "ALL users (force update)"
  } else if (updateInitialsOnly) {
    // Only update users with old "initials" style avatars
    query = {
      avatarUrl: { $regex: /dicebear\.com\/9\.x\/initials/ }
    }
    description = "users with old 'initials' style avatars"
  } else {
    // Default: only users without avatars
    query = {
      $or: [{ avatarUrl: null }, { avatarUrl: "" }],
    }
  }

  const users = await User.find(query)
  console.log(`\n🔍 Found ${users.length} ${description}\n`)

  if (users.length === 0) {
    console.log("✨ Nothing to update!")
    process.exit(0)
  }

  // Confirm before mass update
  if (forceUpdate && users.length > 10) {
    console.log("⚠️  WARNING: You're about to update ALL users. This will replace existing avatars.")
    console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n")
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  let updated = 0
  for (const user of users) {
    const seed = `${user.firstName} ${user.lastName}`.trim() || user.username
    const newAvatar = generateDefaultAvatarUrl(seed)
    const oldAvatar = user.avatarUrl
    
    // Use updateOne to bypass validation (some old users may be missing required fields)
    await User.updateOne(
      { _id: user._id },
      { $set: { avatarUrl: newAvatar } }
    )
    updated++
    
    console.log(`  ✓ ${user.email}`)
    if (oldAvatar && oldAvatar !== newAvatar) {
      console.log(`    ${oldAvatar.includes('initials') ? '📝 initials' : '🔄 old'} → 🎨 notionists`)
    } else {
      console.log(`    🆕 new avatar`)
    }
  }

  console.log(`\n✅ Done! Updated ${updated} users.\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err)
  process.exit(1)
})
