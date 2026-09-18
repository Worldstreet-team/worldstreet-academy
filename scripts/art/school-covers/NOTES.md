# WSA school covers + program thumbnails: render notes

Eight 2400×1500 (16:10) school covers and twelve 2400×1350 (16:9) program
thumbnails. They are studio still lifes rendered in code. No image model was
involved. Every pixel comes from a small GPU path tracer running in headless
Chromium.

```
art/
  src/renderer.html      core: WebGL2 path tracer, shared studio rig, post pipeline
  src/scenes.js          the eight school covers (SDF geometry, materials, accent hue)
  src/programs.js        the twelve program thumbnails (same contract; accent borrowed from the school)
  src/render.mjs         Node driver: renders RGB PNGs and builds the contact sheets
  src/_montage.py        dev helper: quick 4x2 montage of a preview folder (PIL)
  schools/<slug>.png     cover finals, 2400x1500 RGB
  programs/<slug>.png    program finals, 2400x1350 RGB (file = course slug)
  contact-cards.png      all eight covers at landing-card size (400x250, 20px gaps/radius, #0C0A09)
  contact-hero.png       trading + ai-automation at 1280x800, 60% opacity, 85%->30% black gradient, headline left
  contact-programs.png   one row per school: its cover (gold outline) then its program cards (400x225)
  backup/                v1 digital-media-creative + ai-automation finals, v1 card sheet, scenes.v1.js
  preview/, preview-programs/   960px working renders (safe to delete)
  tmp/                   patch scripts and the generated contact-sheet HTML (safe to delete)
```

## Re-render

From `scripts/art/school-covers/` (needs Node 22.2+, for `zlib.crc32` in the
PNG encoder). Playwright is NOT a project dependency — install it globally
first (`npm i -g playwright`), then either point `NODE_PATH` at the global
`node_modules` or use `npx -p playwright`:

```
NODE_PATH=$(npm root -g) node render.mjs all                       # 8 covers (256 spp) + cover contact sheets, ~6 min
NODE_PATH=$(npm root -g) node render.mjs programs                  # 12 program thumbnails (256 spp) + contact-programs.png, ~12 min
npx -p playwright node render.mjs cybersecurity                    # one school cover
npx -p playwright node render.mjs program:cybersecurity            # the Cybersecurity *program* (its slug collides with the school's)
NODE_PATH=$(npm root -g) node render.mjs data-analysis virtual-assistance   # any program slug(s)
NODE_PATH=$(npm root -g) node render.mjs all programs --preview    # 960px @ 48 spp into ../preview/ and ../preview-programs/
NODE_PATH=$(npm root -g) node render.mjs contact                   # rebuild every contact sheet from the finals
NODE_PATH=$(npm root -g) node render.mjs ai-automation --spp=512   # more samples (GPU time is small; compile dominates)
python _montage.py ../preview ../preview/_sheet.png   # optional preview montage (not copied into this repo)
```

Outputs (PNGs) land relative to this script (`../schools`, `../programs`,
`../preview`, `../preview-programs`, `../tmp` next to wherever you run it
from) — pass `--out=<dir>` to redirect them, then run `optimize-art.mjs` from
the repo root to produce the committed WebPs:

```
node scripts/optimize-art.mjs <schools-dir> public/art/schools 1600x1000
node scripts/optimize-art.mjs <programs-dir> public/art/programs 1600x900
```

`render.mjs` reads the pixels straight back off the GPU and encodes them as
8-bit RGB PNGs (no alpha channel) with its own small encoder, so no
flattening step is needed. Framing is aspect-independent: `RIG.shiftFrac`
keeps the object centre at about 66% of the frame width, and `RIG.shiftY`
sets the vertical lens shift, so a 16:9 program frame keeps the covers'
vertical field and only gains width.

Chromium runs on the real GPU (`--use-angle=d3d11`). `--swiftshader` switches
to software GL. It works, but it is slow, so use preview sizes with it. Output
is deterministic: the RNG is a PCG hash of (pixel, sample index), the noise is
seeded, and nothing depends on time.

Time is dominated by the ANGLE/D3D shader compile (15-45 s per scene). Sampling
takes seconds, so raising `--spp` is cheap.

## Technique

- **Geometry**: signed distance fields, sphere-traced (`abs(d)` marching so
  rays can travel inside glass), with a bounding sphere per object and a
  stage sphere that lets background rays skip marching. The floor is an
  analytic plane.
- **Light transport**: a progressive path tracer, up to 5 bounces (9-10 for
  the glass scenes), with Russian roulette.
  - Next-event estimation samples four rectangular soft boxes. Each box has an
    egg-crate grid (cos^k falloff) to keep spill off the floor and the sweep.
  - MIS (power heuristic) against GGX/Lambert BSDF sampling.
  - Smooth and rough dielectric glass with Beer absorption, plus tinted
    shadow rays through glass.
  - The briefcase globe is a sampled sphere light.
- **Camera**: thin lens with depth of field (aperture 0.05, focused on the
  object), Gaussian pixel filter, and a lens shift that puts the object in the
  right 55% and slightly low while keeping verticals straight. The lens is a
  telephoto of about 70 mm equivalent.
- **Shared rig**: identical camera, lens, plinth, floor, sweep and lights in
  every scene. Only the object and the accent hue change.
  - Gold key/rim, upper-left behind the object (`#EAB308` family).
  - Saturated accent box at the right side. Per-hue `accentPower` evens out
    perceived strength, since blue reads darker than emerald at the same power.
  - Low warm bounce card in front, so vertical metal faces have something to
    mirror and the objects never crush to black.
  - Low gold kicker behind, for top faces and silhouettes.
  - None of these boxes is visible to camera rays.
- **Backdrop**: painted for camera rays. Warm stone from `#0C0A09` at the
  edges to about `#1C1917` behind the object, with a faint accent spill on the
  right and a trace of gold above. The floor fades into it, so the sweep is
  seamless. Measured left-third top is about `#100E0C`.
- **Post**:
  - Downsample-chain bloom (6 levels, subtle).
  - A tone curve that is linear to 0.6 and then an exponential shoulder.
    Darks are never crushed and highlights roll off instead of clipping.
  - Mild highlight desaturation.
  - Off-centre vignette.
  - About 1% luma-weighted film grain plus triangular dither, so gradients
    never band.

## Per image (school covers)

| Slug | Object | Accent | Notes |
|---|---|---|---|
| trading-financial-markets | Six polished-brass candlesticks (two dark-bronze pull-backs) on thin blackened stems, on a brushed-brass sill | emerald | Reads as a rising chart at card size. Emerald rims on the right edges. |
| blockchain-web3 | Cube whose 12 edges are pairs of interlocked brushed-steel links; the three links at each corner are mutually perpendicular | electric blue | Strongest silhouette of the set. |
| ai-automation | Glass bust (profile facing the empty left) holding an inner lattice of contour rings and meridians. About 20% of the nodes glow. Brushed-brass base | violet | The most "pizzazz" of the set. The head is a 23-point side-profile polygon intersected with a front silhouette, with the nose, lips and chin added as narrow shapes. In refinement pass v2, the polygon's crown vertices were pulled inside a smooth cranium ellipsoid, so the glass crown no longer shows facets. The hourglass neck was left alone to protect the silhouette. |
| software-app-development | Three upright glass screens cascading in depth on a dark steel stand. Each has an etched, softly glowing app layout (status bar, hero card, tiles, list rows, button) and lit edges | cyan | The layout is abstract etching: no text, no logos. |
| cybersecurity | Machined steel padlock, shackle lifted and swung open. The front-right quarter is cut away to show the brass plug, pin stacks and springs | teal | Open shackle is the read. The mechanism rewards a closer look. |
| data-analytics | Four polished Calacatta-style marble bars on a brass sill | amber (orange-leaning, so it separates from the gold rim) | Amber lights the right faces and gold tops the bars. |
| digital-media-creative | Satin bead-blasted aluminium cine lens on its side, with a machined straight-knurl focus ring, engraved lathe grooves, gold index and mount rings, a gunmetal hood and a bulging multicoated front element (green to magenta). A clapperboard (brighter stripes, chalk-ruled slate) stands behind | magenta (`accentPower` 0.35) | Refinement pass v2. The earlier front element had been accidentally cut flat inside the hood; it is now a real cap. A polished horizontal cylinder in this rig mirrors only a thin cone of directions. At the old angle that cone ran through the accent box, which caused the magenta wash. The axis was swung 16° further left, so the cone misses the accent, and the barrel became a part-diffuse satin alloy (metal 0.55) that shades smoothly from key, bounce and accent. Magenta now reads as a rim with a slight mauve cast on the barrel. Still the quietest card, but in range. The v1 final is kept in `backup/`. |
| digital-business-remote-careers | Cognac leather briefcase laid open, brass clasps and handle. A brass wire globe with a glowing core floats over the suede lining and lights the case from inside | coral | The only scene with a practical light: a sphere light, sampled with MIS. |

## Per image (program thumbnails, 16:9)

Each program borrows its school's accent hue and power and shares the
identical rig; only the object changes. The file name is the course slug
(`Course.slug`). `cybersecurity` is both a school slug and a program slug —
the program's scene id is `program:cybersecurity`.

| Slug | School accent | Object |
|---|---|---|
| forex-trading-mastery | emerald | Polished-brass balance (beam, three-rod pans) on a dark stone relief-map disc with raised bronze "continents" (seeded noise, not a real map) |
| crypto-trading-mastery | emerald | Unmarked 12-sided crystal coin (IOR 1.7, pyramid-faceted faces, chamfered rim, thin gold bezel) hovering over four small brass candlesticks |
| blockchain-technology-mastery | electric blue | Three clear glass blocks rising in a row, each holding meshed brass gears around a glowing axle core, joined by beams of light |
| ai-ai-automation | violet | Articulated brass arm with a three-finger gripper setting a glass sphere into the empty first slot of a brass rail of spheres |
| app-development-with-ai | cyan | Smoked-glass phone on a steel foot, with three layers of glowing wireframe UI (screen frame, cards, button and avatar) lifting off towards the viewer |
| cybersecurity (`program:cybersecurity`) | teal | Satin brushed-steel heater shield with a polished rim and a keyhole, a brass key floating in front of it on the keyhole axis, on a steel foot |
| data-analysis | amber | Walnut-handled brass magnifier over five polished marble columns; the lens really refracts the columns behind it |
| content-creation-mastery | magenta | A ring light (warm-white diffuser, practical light) haloing a studio condenser mic in a shock mount |
| video-editing-mastery | magenta | Brushed-aluminium jog dial on a black console, a satin reel standing behind, and a twisted, perforated film ribbon unspooling across the dial |
| tech-sales-digital-marketing | coral | Brass megaphone standing on its grip, aimed up a four-step travertine staircase |
| e-commerce-digital-business | coral | Travertine storefront arch (keystone, cornice, step) with a warmly glowing taped parcel in the doorway |
| virtual-assistance | coral | Headset lying on a stack of three leather notebooks (cream page blocks), with a brass desk clock at 10:10 beside it |

Weakest, after one iteration each:
- **crypto-trading-mastery**: the crystal refracts the dark studio, so the coin
  reads as a gold-bezelled dark gem with one bright facet glint, not as clear
  crystal. The next step would be a few internal bright facets, or a soft
  practical light under the coin.
- **video-editing-mastery**: legible (reel, perforated film, jog dial), but the
  mass sits low and it has the least sparkle.
- **virtual-assistance**: reads well but sits slightly small and low next to
  its siblings.

Renderer fixes found on the way:
- A glass block with objects inside must be unioned by `|d_glass|`, or the
  march steps straight over the contents (see blockchain-technology-mastery).
- WebGL GLSL forbids `?:` on structs.

## Contact sheet findings

- **Cards (400×250)**: all eight covers read at a glance and sit together as
  one series. The left third stays quiet under the label and chip. After the
  v2 pass, Digital Media sits in the same exposure range as the others: it is
  still the quietest card, but the lens now reads as silver glass and metal.
- **Hero (1280×800, 60% opacity under an 85%→30% black gradient)**: the
  headline and CTA are fully readable and the object never crosses the copy
  column. The treatment mutes the renders heavily, though. The candlesticks and
  the bust go murky, and most of the "razzmatazz" is lost. I recommend
  something closer to 85-100% image opacity under a 90%→0% gradient that stops
  at about 55% width. The left third is already dark in the source, so it
  needs little help.
- **Program rows (contact-programs.png)**: every program reads distinctly
  from its siblings under the same school (Forex's balance vs. Crypto's
  crystal, Content Creation's mic vs. Video Editing's jog dial), and each
  keeps its school's accent identifiable next to the cover.

## With more time

- True anisotropic GGX for the brushed metals. Streaks are currently faked
  with a normal-perturbation noise.
- A thin-film interference BRDF for the lens coating. It is currently tinted
  metal whose colour varies with the normal.
- Painted distance-scale numerals on the lens barrel, and stitching on the
  briefcase.
- Neutralise the slight mauve cast on the media lens barrel. The cleanest way
  is a per-scene gobo or flag that trims the accent box's spill on the barrel
  while keeping it on the rims.
- An OIDN-style denoise pass, or simply 1024 spp, to clean the last sparkle
  from caustic paths. These are the paths inside the briefcase lining and
  through the glass bust.
- A sculpted head mesh via an SDF-baked volume. The analytic bust is
  deliberately stylised.
- Per-scene variants cropped for 21:9. The current framing keeps each object
  inside the central 69% band, so a centred 21:9 crop keeps it whole, but the
  plinth drops out of frame.
- A few internal bright facets (or a soft practical light) for the crypto
  crystal coin, and a touch more mass for virtual-assistance.
