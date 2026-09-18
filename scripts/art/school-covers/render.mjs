// Render driver for the WSA school covers and program thumbnails.
//
//   node render.mjs all                         # 8 school covers, 2400x1500 @256spp + cover contact sheets
//   node render.mjs programs                    # 12 program thumbnails, 2400x1350 @256spp + contact-programs.png
//   node render.mjs cybersecurity data-analysis # any cover or program slug(s)
//   node render.mjs all --preview               # 960x600 (covers) / 960x540 (programs), 48 spp, into ../preview/
//   node render.mjs contact                     # rebuild every contact sheet from the finals
//   options: --spp=256 --out=<dir> --swiftshader
//
// Launches headless Chromium on the real GPU (ANGLE/D3D11); --swiftshader
// falls back to software GL (slow: use preview sizes). PNGs are written as
// 8-bit RGB (no alpha) by a small encoder below.
//
// Playwright is NOT a project dependency (it isn't in this repo's
// package.json) — this script only runs from a machine with a global
// install: `npm i -g playwright`, then run this file with NODE_PATH pointing
// at that global node_modules (e.g. `NODE_PATH=$(npm root -g) node
// render.mjs all`), or use `npx -p playwright node render.mjs all`.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const artDir = path.resolve(here, "..");

// school covers (16:10)
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
// program thumbnails (16:9), grouped by school. The keys are program scene ids; "cybersecurity"
// is both a school slug and a program slug, so the program's scene id is "program:cybersecurity".
const PROGRAMS = {
  "trading-financial-markets": [["forex-trading-mastery", "Forex Trading Mastery"], ["crypto-trading-mastery", "Crypto Trading Mastery"]],
  "blockchain-web3": [["blockchain-technology-mastery", "Blockchain Technology Mastery"]],
  "ai-automation": [["ai-ai-automation", "AI & AI Automation"]],
  "software-app-development": [["app-development-with-ai", "App Development with AI"]],
  "cybersecurity": [["cybersecurity", "Cybersecurity"]],
  "data-analytics": [["data-analysis", "Data Analysis"]],
  "digital-media-creative": [["content-creation-mastery", "Content Creation Mastery"], ["video-editing-mastery", "Video Editing Mastery"]],
  "digital-business-remote-careers": [["tech-sales-digital-marketing", "Tech Sales & Digital Marketing"], ["e-commerce-digital-business", "E-commerce & Digital Business"], ["virtual-assistance", "Virtual Assistance"]],
};
const PROGRAM_SLUGS = Object.values(PROGRAMS).flat().map(([s]) => s);
const programScene = (slug) => (SLUGS.includes(slug) ? "program:" + slug : slug);

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
let targets = argv.filter((a) => !a.startsWith("--"));
if (targets.length === 0) targets = ["all"];
const preview = !!opt.preview;
const SPP = +(opt.spp || (preview ? 48 : 256));

// jobs: covers and/or programs
const jobs = [];
const addCover = (s) => jobs.push({ kind: "cover", slug: s, scene: s, w: preview ? 960 : 2400, h: preview ? 600 : 1500,
  dir: opt.out || path.join(artDir, preview ? "preview" : "schools") });
const addProgram = (s) => jobs.push({ kind: "program", slug: s, scene: programScene(s), w: preview ? 960 : 2400, h: preview ? 540 : 1350,
  dir: opt.out || path.join(artDir, preview ? "preview-programs" : "programs") });
for (const t of targets){
  if (t === "all") SLUGS.forEach(addCover);
  else if (t === "programs") PROGRAM_SLUGS.forEach(addProgram);
  else if (t === "contact") {}
  else if (PROGRAM_SLUGS.includes(t) && !SLUGS.includes(t)) addProgram(t);
  else if (t === "program:cybersecurity") addProgram("cybersecurity");
  else if (SLUGS.includes(t)) addCover(t);
  else throw new Error("unknown target " + t);
}

// ------------------------------------------------------------ minimal RGB PNG encoder
function png(w, h, rgb){
  const stride = w*3, raw = Buffer.alloc((stride + 1)*h);
  for (let y = 0; y < h; y++){
    const o = y*(stride + 1), s = y*stride; raw[o] = 1;               // filter: Sub
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (rgb[s + i] - (i >= 3 ? rgb[s + i - 3] : 0)) & 255;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const args = opt.swiftshader
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  : ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"];

const browser = await chromium.launch({ args });
try {
  if (jobs.length){
    const page = await browser.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.error("[page]", m.text()); });
    await page.goto(pathToFileURL(path.join(here, "renderer.html")).href);
    await page.waitForFunction(() => window.RENDERER_READY === true);
    for (const j of jobs){
      mkdirSync(j.dir, { recursive: true });
      process.stdout.write(`${j.slug} ${j.w}x${j.h} @${SPP}spp ... `);
      let r;
      try { r = await page.evaluate((o) => window.renderCover(o), { scene: j.scene, width: j.w, height: j.h, spp: SPP, format: "rgb" }); }
      catch (e) { console.log("FAILED\n" + String(e.message).split("\n").slice(0, 8).join("\n")); process.exitCode = 1; continue; }
      const file = path.join(j.dir, `${j.slug}.png`);
      writeFileSync(file, png(r.width, r.height, Buffer.from(r.rgb, "base64")));
      console.log(`${(r.ms/1000).toFixed(1)}s -> ${file}`);
    }
    await page.close();
  }
  if (!preview){
    const didCovers = jobs.filter((j) => j.kind === "cover").length === SLUGS.length;
    const didPrograms = jobs.filter((j) => j.kind === "program").length === PROGRAM_SLUGS.length;
    if (targets.includes("contact") || didCovers) await coverSheets(browser);
    if (targets.includes("contact") || didPrograms) await programSheet(browser);
  }
} finally {
  await browser.close();
}

// ------------------------------------------------------------ contact sheets
async function shoot(browser, name, html, width, height){
  const tmp = path.join(artDir, "tmp"); mkdirSync(tmp, { recursive: true });
  writeFileSync(path.join(tmp, name + ".html"), html);
  const p = await browser.newPage({ viewport: { width, height } });
  await p.goto(pathToFileURL(path.join(tmp, name + ".html")).href);
  // wait for every image to load; decode() can reject spuriously with many large images, so it is best-effort
  await p.evaluate(() => Promise.all([...document.images].map((i) =>
    (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; i.onerror = r; })).then(() => i.decode().catch(() => {})))));
  const broken = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  if (broken.length) throw new Error("images failed to load: " + broken.join(", "));
  await p.screenshot({ path: path.join(artDir, name + ".png"), fullPage: true });
  await p.close();
}
// hoisted helpers (the main block above runs before any const below would initialise)
function img(dir, s){ return pathToFileURL(path.join(artDir, dir, `${s}.png`)).href; }
function cardCss(){ return `
    body{margin:0;background:#0C0A09;font-family:"Public Sans","Segoe UI",sans-serif}
    figure{margin:0;position:relative;border-radius:20px;overflow:hidden;background:#1C1917}
    img{width:100%;height:100%;object-fit:cover;display:block}
    figcaption{position:absolute;left:16px;bottom:14px;color:#FAFAF9;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;text-shadow:0 1px 8px rgba(0,0,0,.6)}
    .chip{width:22px;height:22px;border-radius:7px;background:rgba(234,179,8,.16);box-shadow:inset 0 0 0 1px rgba(234,179,8,.35)}`; }

async function coverSheets(browser){
  for (const s of SLUGS) if (!existsSync(path.join(artDir, "schools", `${s}.png`))) throw new Error(`missing schools/${s}.png`);
  // 1. landing cards: 4 x 2 at 400x250, 20px gaps + radius, #0C0A09 ground
  const cards = SLUGS.map((s) => `
    <figure style="width:400px;height:250px"><img src="${img("schools", s)}"><figcaption><span class="chip"></span>${NAMES[s]}</figcaption></figure>`).join("");
  await shoot(browser, "contact-cards", `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss()}
    .grid{display:grid;grid-template-columns:repeat(4,400px);gap:20px;padding:20px}
  </style></head><body><div class="grid">${cards}</div></body></html>`, 1700, 560);

  // 2. hero crossfade simulation: image at 60% under a black 85% -> 30% gradient, headline left
  const hero = (s, eyebrow, h1) => `
    <section><img src="${img("schools", s)}"><div class="ov"></div>
      <div class="copy"><div class="eb">${eyebrow}</div><h1>${h1}</h1>
      <p>Eight schools. Programs taught by practitioners, with certificates you can verify.</p>
      <a>Choose your school</a></div></section>`;
  await shoot(browser, "contact-hero", `<!doctype html><html><head><meta charset="utf-8"><style>
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
  </body></html>`, 1280, 1616);
  console.log("cover contact sheets written");
}

async function programSheet(browser){
  for (const s of PROGRAM_SLUGS) if (!existsSync(path.join(artDir, "programs", `${s}.png`))) throw new Error(`missing programs/${s}.png`);
  // one row per school: its cover (16:10, 400x250) then its program cards (16:9, 400x225)
  const rows = SLUGS.map((school) => `
    <div class="row"><div class="lab">${NAMES[school]}</div>
      <div class="cards">
        <figure class="cover"><img src="${img("schools", school)}"><figcaption><span class="chip"></span>School cover</figcaption></figure>
        ${PROGRAMS[school].map(([s, n]) => `<figure class="prog"><img src="${img("programs", s)}"><figcaption>${n}</figcaption></figure>`).join("")}
      </div></div>`).join("");
  await shoot(browser, "contact-programs", `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss()}
    .wrap{padding:20px 20px 4px}
    .row{margin-bottom:22px}
    .lab{color:#A8A29E;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;margin:0 0 10px 4px}
    .cards{display:flex;gap:20px;align-items:flex-end}
    .cover{width:400px;height:250px;box-shadow:0 0 0 1px rgba(234,179,8,.35)}
    .prog{width:400px;height:225px}
  </style></head><body><div class="wrap">${rows}</div></body></html>`, 1700, 1000);
  console.log("program contact sheet written");
}
