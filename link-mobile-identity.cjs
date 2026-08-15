/*
 * One-time identity linker — connects your MOBILE Clerk login to your WEB account
 * so the mobile app shows your real data (enrollments, certificates, messages…).
 *
 * What it does (UPDATES ONLY — no deletions):
 *   1) Adds the mobile Clerk id to your web account's `linkedAuthIds`.
 *   2) Neutralizes the throwaway placeholder's authUserId so it stops shadowing
 *      the link (the placeholder doc + any test data are kept, just orphaned).
 *
 * Run from the web app dir (it has `mongoose`), which also holds .env.local:
 *   cd /Users/richie/Desktop/spot/worldstreet_academy && node link-mobile-identity.cjs
 *
 * Safe to delete this file afterwards.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MOBILE_SUB = "user_39g90279TclK5YnhhzASY02VwFM"; // mobile placeholder Clerk id
const WEB_SUB = "user_3D5GKA4qvR364rpNHcTgeC2sgiS"; // your real web account Clerk id

(async () => {
  const env = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
  const uri = (env.match(/^\s*MONGODB_URI\s*=\s*(.+?)\s*$/m) || [])[1];
  if (!uri) throw new Error("MONGODB_URI not found in .env.local");

  await mongoose.connect(uri);
  const U = mongoose.connection.db.collection("users");

  const web = await U.findOne({ authUserId: WEB_SUB });
  if (!web) throw new Error("web account not found — aborting");
  const placeholder = await U.findOne({ authUserId: MOBILE_SUB });
  console.log("web account:", web._id.toString(), web.email, "|", web.firstName, web.lastName);
  console.log("placeholder:", placeholder ? `${placeholder._id} ${placeholder.email} name="${placeholder.firstName}"` : "(none)");

  const linkRes = await U.updateOne({ _id: web._id }, { $addToSet: { linkedAuthIds: MOBILE_SUB } });
  console.log("1) linked mobile id -> web account (modified):", linkRes.modifiedCount);

  if (placeholder) {
    const isThinJIT = String(placeholder.email || "").endsWith("@users.noemail") && (placeholder.firstName === "User" || !placeholder.firstName);
    if (!isThinJIT) {
      console.log("2) placeholder is NOT a thin placeholder — left untouched for safety");
    } else {
      const r = await U.updateOne({ _id: placeholder._id }, { $set: { authUserId: "orphaned:" + MOBILE_SUB } });
      console.log("2) neutralized placeholder authUserId (modified):", r.modifiedCount);
    }
  }

  const resolved = await U.findOne({ $or: [{ authUserId: MOBILE_SUB }, { linkedAuthIds: MOBILE_SUB }] });
  console.log("✓ mobile id now resolves to:", resolved ? `${resolved._id} ${resolved.email} (${resolved.firstName})` : "(none)");
  await mongoose.disconnect();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
