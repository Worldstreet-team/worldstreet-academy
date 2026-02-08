/**
 * Seed script for WorldStreet Academy
 * Adds demo instructor and sample courses to the database
 * 
 * Run with: npx tsx scripts/seed.ts
 */

import mongoose from "mongoose"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

const MONGODB_URI_ENV = process.env.MONGODB_URI

if (!MONGODB_URI_ENV) {
  console.error("MONGODB_URI not found in environment variables")
  process.exit(1)
}

// Now TypeScript knows this is definitely a string
const MONGODB_URI: string = MONGODB_URI_ENV

// ============================================================================
// SCHEMAS (inline to avoid module resolution issues in standalone script)
// ============================================================================

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ["USER", "INSTRUCTOR", "ADMIN"], default: "USER" },
    walletBalance: { type: Number, default: 0 },
    instructorProfile: {
      headline: { type: String, default: null },
      bio: { type: String, default: null },
      expertise: [{ type: String }],
      socialLinks: { type: mongoose.Schema.Types.Mixed, default: {} },
      totalStudents: { type: Number, default: 0 },
      totalCourses: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      isVerified: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    shortDescription: { type: String, default: null, maxlength: 200 },
    thumbnailUrl: { type: String, default: null },
    thumbnailPublicId: { type: String, default: null },
    previewVideoUrl: { type: String, default: null },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    level: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    pricing: { type: String, enum: ["free", "paid"], default: "free" },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
    category: { type: String, required: true, index: true },
    tags: [{ type: String }],
    totalLessons: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    enrolledCount: { type: Number, default: 0 },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      distribution: { 1: { type: Number, default: 0 }, 2: { type: Number, default: 0 }, 3: { type: Number, default: 0 }, 4: { type: Number, default: 0 }, 5: { type: Number, default: 0 } },
    },
    whatYouWillLearn: [{ type: String }],
    requirements: [{ type: String }],
    targetAudience: [{ type: String }],
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const LessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    type: { type: String, enum: ["video", "live"], default: "video" },
    videoUrl: { type: String, default: null },
    videoPublicId: { type: String, default: null },
    videoDuration: { type: Number, default: null },
    content: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    isFree: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

// Generate slug before save
CourseSchema.pre("save", function () {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      + "-" + Date.now().toString(36)
  }
})

// ============================================================================
// SEED DATA
// ============================================================================

const seedCourses = [
  {
    title: "Bitcoin & Cryptocurrency Fundamentals",
    slug: "bitcoin-cryptocurrency-fundamentals",
    description: "Master the fundamentals of Bitcoin and cryptocurrency. Learn how blockchain technology works, understand cryptocurrency wallets, exchanges, and start your journey into the world of digital assets. This comprehensive course covers everything from the history of Bitcoin to practical tips for safe investing.",
    shortDescription: "Learn the basics of Bitcoin and crypto from scratch",
    thumbnailUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=450&fit=crop",
    level: "beginner" as const,
    pricing: "free" as const,
    price: 0,
    status: "published" as const,
    category: "Cryptocurrency",
    tags: ["bitcoin", "cryptocurrency", "blockchain", "beginner"],
    totalLessons: 12,
    totalDuration: 180,
    enrolledCount: 1250,
    rating: { average: 4.8, count: 342, distribution: { 1: 5, 2: 8, 3: 20, 4: 65, 5: 244 } },
    whatYouWillLearn: [
      "Understand how Bitcoin and blockchain technology work",
      "Set up and secure your first cryptocurrency wallet",
      "Navigate cryptocurrency exchanges safely",
      "Identify common scams and how to avoid them",
    ],
    requirements: ["No prior experience required", "Basic computer skills"],
    targetAudience: ["Complete beginners to cryptocurrency", "Anyone curious about Bitcoin"],
  },
  {
    title: "Technical Analysis for Crypto Trading",
    slug: "technical-analysis-crypto-trading",
    description: "Learn professional technical analysis techniques specifically tailored for cryptocurrency markets. Understand chart patterns, indicators, support and resistance levels, and develop your own trading strategy. This course covers candlestick patterns, moving averages, RSI, MACD, and more.",
    shortDescription: "Master chart analysis for profitable crypto trading",
    thumbnailUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
    level: "intermediate" as const,
    pricing: "paid" as const,
    price: 79,
    status: "published" as const,
    category: "Trading",
    tags: ["technical-analysis", "trading", "charts", "indicators"],
    totalLessons: 24,
    totalDuration: 420,
    enrolledCount: 856,
    rating: { average: 4.6, count: 198, distribution: { 1: 3, 2: 5, 3: 15, 4: 55, 5: 120 } },
    whatYouWillLearn: [
      "Read and interpret candlestick charts",
      "Use technical indicators like RSI, MACD, and Bollinger Bands",
      "Identify support and resistance levels",
      "Develop a personal trading strategy",
    ],
    requirements: ["Basic understanding of cryptocurrency", "Familiarity with trading concepts"],
    targetAudience: ["Aspiring crypto traders", "Investors looking to improve their analysis"],
  },
  {
    title: "DeFi Masterclass: Yield Farming & Liquidity",
    slug: "defi-masterclass-yield-farming-liquidity",
    description: "Dive deep into Decentralized Finance (DeFi). Learn about yield farming, liquidity pools, automated market makers, and how to earn passive income with your crypto. Understand the risks and rewards of DeFi protocols like Uniswap, Aave, and Compound.",
    shortDescription: "Unlock passive income through DeFi protocols",
    thumbnailUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=450&fit=crop",
    level: "advanced" as const,
    pricing: "paid" as const,
    price: 149,
    status: "published" as const,
    category: "DeFi",
    tags: ["defi", "yield-farming", "liquidity", "passive-income"],
    totalLessons: 18,
    totalDuration: 300,
    enrolledCount: 423,
    rating: { average: 4.9, count: 89, distribution: { 1: 0, 2: 2, 3: 5, 4: 12, 5: 70 } },
    whatYouWillLearn: [
      "Navigate major DeFi protocols safely",
      "Provide liquidity and understand impermanent loss",
      "Maximize yield farming strategies",
      "Assess smart contract risks",
    ],
    requirements: ["Solid understanding of crypto fundamentals", "Experience with crypto wallets"],
    targetAudience: ["Intermediate to advanced crypto users", "Those seeking passive income strategies"],
  },
  {
    title: "NFT Creation & Marketing Strategies",
    slug: "nft-creation-marketing-strategies",
    description: "Learn how to create, mint, and sell NFTs successfully. From digital art creation to smart contract deployment, marketing strategies, and building a community around your NFT collection. Covers OpenSea, Rarible, and other major marketplaces.",
    shortDescription: "Create and sell NFTs like a pro",
    thumbnailUrl: "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&h=450&fit=crop",
    level: "intermediate" as const,
    pricing: "paid" as const,
    price: 99,
    status: "published" as const,
    category: "NFTs",
    tags: ["nft", "digital-art", "marketing", "opensea"],
    totalLessons: 15,
    totalDuration: 240,
    enrolledCount: 678,
    rating: { average: 4.5, count: 156, distribution: { 1: 4, 2: 6, 3: 18, 4: 48, 5: 80 } },
    whatYouWillLearn: [
      "Create digital art suitable for NFTs",
      "Mint NFTs on various blockchains",
      "List and market your NFT collection",
      "Build a community around your brand",
    ],
    requirements: ["Basic digital skills", "Crypto wallet setup"],
    targetAudience: ["Artists and creators", "Entrepreneurs interested in NFTs"],
  },
  {
    title: "Risk Management in Crypto Trading",
    slug: "risk-management-crypto-trading",
    description: "Learn essential risk management techniques to protect your capital. Understand position sizing, stop-loss strategies, portfolio diversification, and emotional discipline. This course will help you survive and thrive in volatile crypto markets.",
    shortDescription: "Protect your capital with proven strategies",
    thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop",
    level: "intermediate" as const,
    pricing: "paid" as const,
    price: 59,
    status: "published" as const,
    category: "Trading",
    tags: ["risk-management", "trading", "portfolio", "strategy"],
    totalLessons: 10,
    totalDuration: 150,
    enrolledCount: 534,
    rating: { average: 4.7, count: 123, distribution: { 1: 2, 2: 3, 3: 10, 4: 35, 5: 73 } },
    whatYouWillLearn: [
      "Calculate proper position sizes",
      "Set effective stop-loss orders",
      "Diversify your crypto portfolio",
      "Manage emotions during volatile markets",
    ],
    requirements: ["Basic trading knowledge", "Active crypto trading experience"],
    targetAudience: ["Active traders", "Anyone who has lost money in crypto"],
  },
  {
    title: "Smart Contract Development with Solidity",
    slug: "smart-contract-development-solidity",
    description: "Become a blockchain developer by learning Solidity programming. Build decentralized applications (dApps), deploy smart contracts on Ethereum, and understand the fundamentals of Web3 development. Hands-on projects included.",
    shortDescription: "Build dApps and smart contracts on Ethereum",
    thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=450&fit=crop",
    level: "advanced" as const,
    pricing: "paid" as const,
    price: 199,
    status: "draft" as const,
    category: "Development",
    tags: ["solidity", "smart-contracts", "ethereum", "web3"],
    totalLessons: 30,
    totalDuration: 600,
    enrolledCount: 0,
    rating: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    whatYouWillLearn: [
      "Write and deploy Solidity smart contracts",
      "Build full-stack dApps",
      "Understand Ethereum gas and optimization",
      "Implement security best practices",
    ],
    requirements: ["Programming experience (any language)", "Basic blockchain knowledge"],
    targetAudience: ["Developers wanting to enter Web3", "Entrepreneurs building blockchain products"],
  },
]

const sampleVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"

const seedLessons = [
  // Bitcoin Fundamentals Course (12 lessons)
  { courseIndex: 0, title: "What is Bitcoin?", description: "Introduction to Bitcoin and its history", type: "video", videoUrl: sampleVideoUrl, videoDuration: 900, isFree: true },
  { courseIndex: 0, title: "How Blockchain Works", description: "Understanding the blockchain technology", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1200, isFree: true },
  { courseIndex: 0, title: "Bitcoin Mining Explained", description: "Learn how new bitcoins are created", type: "video", videoUrl: sampleVideoUrl, videoDuration: 900, isFree: false },
  { courseIndex: 0, title: "Setting Up Your First Wallet", description: "Step-by-step wallet setup guide", type: "video", videoUrl: sampleVideoUrl, videoDuration: 800, isFree: false },
  { courseIndex: 0, title: "Buying Your First Bitcoin", description: "How to purchase Bitcoin safely", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1000, isFree: false },
  { courseIndex: 0, title: "Cryptocurrency Exchanges", description: "Comparing popular exchanges", type: "video", videoUrl: sampleVideoUrl, videoDuration: 850, isFree: false },
  { courseIndex: 0, title: "Security Best Practices", description: "Protecting your crypto assets", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1100, isFree: false },
  { courseIndex: 0, title: "Understanding Market Cycles", description: "Bull and bear markets explained", type: "video", videoUrl: sampleVideoUrl, videoDuration: 950, isFree: false },
  { courseIndex: 0, title: "Common Scams to Avoid", description: "Protecting yourself from fraud", type: "video", videoUrl: sampleVideoUrl, videoDuration: 800, isFree: false },
  { courseIndex: 0, title: "Tax Implications", description: "Crypto taxes explained simply", type: "video", videoUrl: sampleVideoUrl, videoDuration: 700, isFree: false },
  { courseIndex: 0, title: "Future of Bitcoin", description: "Where Bitcoin is heading", type: "video", videoUrl: sampleVideoUrl, videoDuration: 600, isFree: false },
  { courseIndex: 0, title: "Course Summary & Next Steps", description: "Review and action items", type: "video", videoUrl: sampleVideoUrl, videoDuration: 500, isFree: false },
  
  // Technical Analysis Course (8 sample lessons)
  { courseIndex: 1, title: "Introduction to Technical Analysis", description: "Why TA matters in crypto", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1000, isFree: true },
  { courseIndex: 1, title: "Reading Candlestick Charts", description: "Understanding price action", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1400, isFree: true },
  { courseIndex: 1, title: "Support and Resistance Levels", description: "Finding key price levels", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1200, isFree: false },
  { courseIndex: 1, title: "Moving Averages Explained", description: "SMA, EMA, and their uses", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1100, isFree: false },
  { courseIndex: 1, title: "RSI - Relative Strength Index", description: "Identifying overbought/oversold", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1000, isFree: false },
  { courseIndex: 1, title: "MACD Indicator Deep Dive", description: "Momentum and trend following", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1150, isFree: false },
  { courseIndex: 1, title: "Chart Patterns", description: "Head & shoulders, triangles, flags", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1300, isFree: false },
  { courseIndex: 1, title: "Building Your Trading Strategy", description: "Putting it all together", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1500, isFree: false },
  
  // DeFi Course (5 sample lessons)
  { courseIndex: 2, title: "What is DeFi?", description: "Decentralized finance explained", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1000, isFree: true },
  { courseIndex: 2, title: "Understanding Liquidity Pools", description: "How AMMs work", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1200, isFree: false },
  { courseIndex: 2, title: "Yield Farming Strategies", description: "Maximize your returns", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1400, isFree: false },
  { courseIndex: 2, title: "Impermanent Loss Explained", description: "The hidden cost of LP", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1100, isFree: false },
  { courseIndex: 2, title: "Risk Assessment in DeFi", description: "Evaluating protocol safety", type: "video", videoUrl: sampleVideoUrl, videoDuration: 1000, isFree: false },
]

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seed() {
  console.log("🌱 Starting seed process...")
  
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("✅ Connected to MongoDB")
    
    // Get models
    const User = mongoose.models.User || mongoose.model("User", UserSchema)
    const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema)
    const Lesson = mongoose.models.Lesson || mongoose.model("Lesson", LessonSchema)
    
    // Check if instructor already exists
    let instructor = await User.findOne({ email: "instructor@worldstreet.academy" })
    
    if (!instructor) {
      // Create instructor
      instructor = await User.create({
        email: "instructor@worldstreet.academy",
        username: "sarah_chen",
        firstName: "Sarah",
        lastName: "Chen",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face",
        role: "INSTRUCTOR",
        walletBalance: 15420.50,
        instructorProfile: {
          headline: "Crypto Trading Expert & Blockchain Educator",
          bio: "Former Wall Street analyst turned crypto educator. Teaching thousands of students how to navigate the exciting world of cryptocurrency and blockchain technology.",
          expertise: ["cryptocurrency", "trading", "blockchain", "defi", "technical-analysis"],
          totalStudents: 3741,
          totalCourses: 6,
          totalEarnings: 125840,
          isVerified: true,
        },
      })
      console.log("✅ Created instructor:", instructor.email)
    } else {
      console.log("ℹ️ Instructor already exists:", instructor.email)
    }
    
    // Check existing courses
    const existingCourses = await Course.countDocuments({ instructor: instructor._id })
    
    if (existingCourses > 0) {
      console.log(`ℹ️ Found ${existingCourses} existing courses. Skipping course creation.`)
      console.log("   To re-seed, delete existing courses first.")
    } else {
      // Create courses
      const createdCourses = []
      
      for (const courseData of seedCourses) {
        const course = await Course.create({
          ...courseData,
          instructor: instructor._id,
          publishedAt: courseData.status === "published" ? new Date() : null,
        })
        createdCourses.push(course)
        console.log(`✅ Created course: ${course.title}`)
      }
      
      // Create lessons
      for (const lessonData of seedLessons) {
        const { courseIndex, ...lessonFields } = lessonData
        const course = createdCourses[courseIndex]
        
        if (course) {
          const lessonCount = await Lesson.countDocuments({ course: course._id })
          
          await Lesson.create({
            ...lessonFields,
            course: course._id,
            order: lessonCount,
            isPublished: course.status === "published",
          })
        }
      }
      console.log(`✅ Created ${seedLessons.length} lessons`)
      
      // Update instructor course count
      await User.findByIdAndUpdate(instructor._id, {
        "instructorProfile.totalCourses": seedCourses.length,
      })
    }
    
    // Also create demo student if doesn't exist
    let student = await User.findOne({ email: "student@worldstreet.academy" })
    
    if (!student) {
      student = await User.create({
        email: "student@worldstreet.academy",
        username: "demo_student",
        firstName: "Johnson",
        lastName: "Demo",
        role: "USER",
        walletBalance: 2450.00,
      })
      console.log("✅ Created demo student:", student.email)
    }
    
    console.log("\n🎉 Seed completed successfully!")
    console.log("\nYou can now:")
    console.log("  - View courses at: http://localhost:3000/dashboard/courses")
    console.log("  - Manage courses at: http://localhost:3000/instructor/courses")
    
  } catch (error) {
    console.error("❌ Seed error:", error)
    throw error
  } finally {
    await mongoose.disconnect()
    console.log("📤 Disconnected from MongoDB")
  }
}

// Run seed
seed().catch(console.error)
