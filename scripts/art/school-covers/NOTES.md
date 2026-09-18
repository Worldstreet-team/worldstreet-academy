# WSA school covers: render notes

Eight 2400×1500 (16:10) studio still lifes, one per school, rendered in code.
No image model was involved. Every pixel comes from a small GPU path tracer
running in headless Chromium.

```
art/
  src/renderer.html   core: WebGL2 path tracer, shared studio rig, post pipeline
  src/scenes.js       the eight objects (SDF geometry, materials, accent hue)
  src/render.mjs      Node driver: renders PNGs and builds the contact sheets
  src/_montage.py     dev helper: quick 4x2 montage of a preview folder (PIL)
  schools/<slug>.png  finals, 2400x1500
  contact-cards.png   all eight at landing-card size (400x250, 20px gaps/radius, #0C0A09)
  contact-hero.png    trading + ai-automation at 1280x800, 60% opacity, 85%->30% black gradient, headline left
  backup/             v1 digital-media-creative + ai-automation finals, v1 card sheet, scenes.v1.js
  preview/            960x600 working renders (safe to delete)
  tmp/                patch scripts and the generated contact-sheet HTML (safe to delete)
```

## Re-render

From `scripts/art/school-covers/` (needs Node 18+). Playwright is NOT a
project dependency — install it globally first (`npm i -g playwright`), then
either point `NODE_PATH` at the global `node_modules` or use `npx -p
playwright`:

```
NODE_PATH=$(npm root -g) node render.mjs all              # all eight finals (256 spp) + both contact sheets, ~6 min
npx -p playwright node render.mjs cybersecurity            # one school
NODE_PATH=$(npm root -g) node render.mjs all --preview     # 960x600 @ 48 spp into ../preview/ for fast iteration
NODE_PATH=$(npm root -g) node render.mjs contact            # rebuild the contact sheets only
NODE_PATH=$(npm root -g) node render.mjs ai-automation --spp=512   # more samples (GPU time is small; compile dominates)
python _montage.py ../preview ../preview/_sheet.png   # optional preview montage (not copied into this repo)
```

Outputs (PNGs) land relative to this script (`../schools`, `../preview`,
`../tmp` next to wherever you run it from) — pass `--out=<dir>` to redirect
them, then run `node scripts/optimize-art.mjs <dir>` from the repo root to
produce the committed WebPs.

Canvas export writes RGBA PNGs, with alpha fully opaque (the context is
created with `alpha: false`). The shipped finals were flattened to RGB, which
makes them about 35% smaller:

```
python -c "from PIL import Image;import glob;[Image.open(f).convert('RGB').save(f,optimize=True) for f in glob.glob('../schools/*.png')]"
```

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

## Per image

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

## Contact sheet findings

- **Cards (400×250)**: all eight read at a glance and sit together as one
  series. The left third stays quiet under the label and chip. After the v2
  pass, Digital Media sits in the same exposure range as the others: it is
  still the quietest card, but the lens now reads as silver glass and metal.
- **Hero (1280×800, 60% opacity under an 85%→30% black gradient)**: the
  headline and CTA are fully readable and the object never crosses the copy
  column. The treatment mutes the renders heavily, though. The candlesticks and
  the bust go murky, and most of the "razzmatazz" is lost. I recommend
  something closer to 85-100% image opacity under a 90%→0% gradient that stops
  at about 55% width. The left third is already dark in the source, so it
  needs little help.

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
