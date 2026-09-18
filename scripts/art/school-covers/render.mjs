// Render driver for the WSA school covers.
//
//   node render.mjs all                         # all eight, 2400x1500, final quality
//   node render.mjs cybersecurity ai-automation # just these
//   node render.mjs all --preview               # 960x600, 48 spp, into ../preview/
//   node render.mjs contact                     # rebuild both contact sheets from ../schools
//   options: --w=2400 --h=1500 --spp=256 --out=<dir> --swiftshader
//
// Launches headless Chromium on the real GPU (ANGLE/D3D11). Falls back to
// SwiftShader with --swiftshader (slow: use --preview sizes).
//
// Playwright is NOT a project dependency (it isn't in this repo's
// package.json) — this script only runs from a machine with a global
// install: `npm i -g playwright`, then run this file with NODE_PATH pointing
// at that global node_modules (e.g. `NODE_PATH=$(npm root -g) node
// render.mjs all`), or use `npx -p playwright node render.mjs all`.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const artDir = path.resolve(here, "..");
const SLUGS = [
  "trading-financial-markets", "blockchain-web3", "ai-automation", "software-app-development",
  "cybersecurity", "data-analytics", "digital-media-creative", "digital-business-remote-careers",
];
const NAMES = {
  "trading-financial-markets": "Trading & Financial Markets",
  "blockchain-web3": "Blockchain & Web3",
  "ai-automation": "AI & Automation",
  "software-app-development": "Software & App Development",
  "cybersecurity": "Cybersecurity",
  "data-analytics": "Data & Analytics",
  "digital-media-creative": "Digital Media & Creative",
  "digital-business-remote-careers": "Digital Business & Remote Careers",
};

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
let targets = argv.filter((a) => !a.startsWith("--"));
if (targets.length === 0 || targets.includes("all")) targets = targets.includes("contact") ? ["contact"] : SLUGS;
const preview = !!opt.preview;
const W = +(opt.w || (preview ? 960 : 2400));
const H = +(opt.h || (preview ? 600 : 1500));
const SPP = +(opt.spp || (preview ? 48 : 256));
const outDir = path.resolve(opt.out || path.join(artDir, preview ? "preview" : "schools"));

const args = opt.swiftshader
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  : ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"];

const browser = await chromium.launch({ args });
try {
  const scenes = targets.filter((t) => SLUGS.includes(t));
  if (scenes.length){
    mkdirSync(outDir, { recursive: true });
    const page = await browser.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.error("[page]", m.text()); });
    await page.goto(pathToFileURL(path.join(here, "renderer.html")).href);
    await page.waitForFunction(() => window.RENDERER_READY === true);
    for (const slug of scenes){
      process.stdout.write(`${slug} ${W}x${H} @${SPP}spp ... `);
      const { url, ms } = await page.evaluate((o) => window.renderCover(o), { scene: slug, width: W, height: H, spp: SPP });
      const file = path.join(outDir, `${slug}.png`);
      writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
      console.log(`${(ms/1000).toFixed(1)}s -> ${file}`);
    }
    await page.close();
  }
  if (targets.includes("contact") || (scenes.length === SLUGS.length && !preview)) await contactSheets(browser);
} finally {
  await browser.close();
}

// ------------------------------------------------------------ contact sheets
async function contactSheets(browser){
  const dir = path.join(artDir, "schools");
  const img = (s) => pathToFileURL(path.join(dir, `${s}.png`)).href;
  for (const s of SLUGS) if (!existsSync(path.join(dir, `${s}.png`))) throw new Error(`missing ${s}.png`);

  // 1. landing cards: 4 x 2 at 400x250, 20px gaps + radius, #0C0A09 ground
  const cards = SLUGS.map((s) => `
    <figure><img src="${img(s)}"><figcaption><span class="chip"></span>${NAMES[s]}</figcaption></figure>`).join("");
  const cardsHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0C0A09;font-family:"Public Sans","Segoe UI",sans-serif}
    .grid{display:grid;grid-template-columns:repeat(4,400px);gap:20px;padding:20px}
    figure{margin:0;position:relative;width:400px;height:250px;border-radius:20px;overflow:hidden;background:#1C1917}
    img{width:100%;height:100%;object-fit:cover;display:block}
    figcaption{position:absolute;left:16px;bottom:14px;color:#FAFAF9;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;text-shadow:0 1px 8px rgba(0,0,0,.6)}
    .chip{width:22px;height:22px;border-radius:7px;background:rgba(234,179,8,.16);box-shadow:inset 0 0 0 1px rgba(234,179,8,.35)}
  </style></head><body><div class="grid">${cards}</div></body></html>`;
  const tmp = path.join(artDir, "tmp"); mkdirSync(tmp, { recursive: true });
  writeFileSync(path.join(tmp, "contact-cards.html"), cardsHtml);
  const p1 = await browser.newPage({ viewport: { width: 1700, height: 560 } });
  await p1.goto(pathToFileURL(path.join(tmp, "contact-cards.html")).href);
  await p1.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p1.screenshot({ path: path.join(artDir, "contact-cards.png") });
  await p1.close();

  // 2. hero crossfade simulation: image at 60% under a black 85% -> 30% gradient, headline left
  const hero = (s, eyebrow, h1) => `
    <section><img src="${img(s)}"><div class="ov"></div>
      <div class="copy"><div class="eb">${eyebrow}</div><h1>${h1}</h1>
      <p>Eight schools. Programs taught by practitioners, with certificates you can verify.</p>
      <a>Choose your school</a></div></section>`;
  const heroHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0C0A09}
    section{position:relative;width:1280px;height:800px;overflow:hidden;background:#0C0A09}
    section+section{margin-top:16px}
    img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6}
    .ov{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.30))}
    .copy{position:absolute;left:80px;top:230px;width:520px;color:#FAFAF9;font-family:"Public Sans","Segoe UI",sans-serif}
    .eb{color:#EAB308;font-size:13px;letter-spacing:.14em;font-weight:600;text-transform:uppercase;margin-bottom:18px}
    h1{font-family:Poppins,sans-serif;font-weight:300;font-size:58px;line-height:1.08;margin:0 0 22px;letter-spacing:-.01em}
    p{font-size:18px;line-height:1.55;color:#A8A29E;margin:0 0 34px}
    a{display:inline-block;background:#EAB308;color:#0C0A09;font-weight:600;font-size:15px;padding:14px 24px;border-radius:999px}
  </style></head><body>
    ${hero("trading-financial-markets", "Mastery Academy · Trading", "Read the markets<br>like a professional.")}
    ${hero("ai-automation", "Mastery Academy · AI", "Build with the<br>machines that learn.")}
  </body></html>`;
  writeFileSync(path.join(tmp, "contact-hero.html"), heroHtml);
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 1616 } });
  await p2.goto(pathToFileURL(path.join(tmp, "contact-hero.html")).href);
  await p2.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p2.screenshot({ path: path.join(artDir, "contact-hero.png") });
  await p2.close();
  console.log("contact sheets written");
}
