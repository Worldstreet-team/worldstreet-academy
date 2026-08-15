const mongoose = require("mongoose");
const MOBILE_SUB = "user_39g90279TclK5YnhhzASY02VwFM";
const WEB_SUB = "user_3D5GKA4qvR364rpNHcTgeC2sgiS";
(async () => {
  await mongoose.connect(process.env.MURI);
  const U = mongoose.connection.db.collection("users");

  const web = await U.findOne({ authUserId: WEB_SUB });
  if (!web) throw new Error("web account not found — aborting");
  const placeholder = await U.findOne({ authUserId: MOBILE_SUB });
  console.log("web account:", web._id.toString(), web.email, "| name:", web.firstName, web.lastName);
  console.log("placeholder:", placeholder ? `${placeholder._id} ${placeholder.email} name="${placeholder.firstName}"` : "(none)");

  // 1) Link the mobile Clerk id to the real web account (additive, reversible).
  const linkRes = await U.updateOne({ _id: web._id }, { $addToSet: { linkedAuthIds: MOBILE_SUB } });
  console.log("linked mobile id -> web account (modified):", linkRes.modifiedCount);

  // 2) Neutralize the placeholder's auth id so it no longer shadows the link.
  //    UPDATE only (no deletion) — the doc + any test data are kept, just orphaned.
  if (placeholder) {
    const isThinJIT = String(placeholder.email || "").endsWith("@users.noemail") && (placeholder.firstName === "User" || !placeholder.firstName);
    if (!isThinJIT) {
      console.log("!! placeholder is NOT a thin JIT — leaving untouched for safety");
    } else {
      const r = await U.updateOne({ _id: placeholder._id }, { $set: { authUserId: "orphaned:" + MOBILE_SUB } });
      console.log("neutralized placeholder authUserId (modified):", r.modifiedCount);
    }
  }

  // 3) Verify resolution.
  const resolved = await U.findOne({ $or: [{ authUserId: MOBILE_SUB }, { linkedAuthIds: MOBILE_SUB }] });
  console.log("mobile id now resolves to:", resolved ? `${resolved._id} ${resolved.email}` : "(none)");
  await mongoose.disconnect();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
