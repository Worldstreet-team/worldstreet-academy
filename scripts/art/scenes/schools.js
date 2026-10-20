/*
  WorldStreet Mastery Academy: the two school covers added after the
  seven-school restructure (Phase 13). They join the original covers in
  public/art/schools/ (scene source frozen in scripts/art/school-covers/) and
  use the same rig, framing and size: 2400x1500 (16:10), object at ~66% of the
  width, gold key, one accent hue per school.

  Rendered with the render-3d-assets skill engine (Playwright installed
  globally; nothing here is a project dependency). From the repo root:

    node ~/.claude/skills/render-3d-assets/engine/render.mjs --scenes=scripts/art/scenes/schools.js --out=<dir>
    node scripts/optimize-art.mjs <dir> public/art/schools 1600x1000

  Preview next to shipped siblings (960px, 48 spp, contact sheet):

    node ~/.claude/skills/render-3d-assets/engine/render.mjs --scenes=worldstreet-schools,scripts/art/scenes/schools.js \
      trading-financial-markets ai-automation entrepreneurship-wealth-creation leadership-personal-development \
      --preview --sheet --out=<dir>

  Accents: the five other schools hold emerald, violet, coral, magenta and
  blue, so these take the two open gaps on the wheel: amber-orange and cyan.
  Amber goes on the gold coins because metal tints what it reflects, so a cool
  accent turns green on gold and reads as Trading's emerald. Cyan goes on the
  white marble king, which shows the hue as it is.
*/
window.SCENES = window.SCENES || {};

// ---------------------------------------------------------------- Entrepreneurship & Wealth Creation
// A green-gold sapling growing out of a hand-stacked column of unmarked gold
// coins, a shorter stack behind and one loose coin in front: wealth built up
// and growing.
window.SCENES["entrepreneurship-wealth-creation"] = {
  name: "Entrepreneurship & Wealth Creation",
  accent: [1.0, 0.34, 0.0],
  palette: { envHi: [0.05, 0.042, 0.034] },
  glsl: `
#define STEP_K 0.8
#define OBJ_C vec3(0.0, 0.66, 0.0)
#define OBJ_R 1.3
#define M_COIN 30
#define M_LEAF 31
#define COIN_R 0.29
#define COIN_H 0.021
#define COIN_P 0.0435
vec3 eLocal(vec3 p){ vec3 q = p; q.xz = rot(0.35)*q.xz; return q; }
// an unmarked coin: reeded edge, raised rim, recessed field with one plain ring in relief
float coin(vec3 p){
  float a = atan(p.z, p.x);
  float reed = 0.0022*smoothstep(-0.5, 0.5, sin(a*150.0));
  float d = sdRoundCyl(p, COIN_R - 0.0022 + reed, COIN_H, 0.006);
  vec3 f = vec3(p.x, abs(p.y) - COIN_H, p.z);
  d = max(d, -sdCyl(f, COIN_R - 0.034, 0.0035));
  d = min(d, sdTorus(f + vec3(0.0, 0.0035, 0.0), vec2(0.165, 0.0045)));
  return d;
}
const vec2 JIT[10] = vec2[10](
  vec2(0.0, 0.0), vec2(0.012, -0.006), vec2(-0.008, 0.010), vec2(0.014, 0.004), vec2(-0.004, -0.012),
  vec2(0.010, 0.012), vec2(-0.012, 0.002), vec2(0.004, -0.008), vec2(0.013, 0.006), vec2(0.002, 0.001));
const vec3 STACK_A = vec3(-0.12, 0.0, 0.08);
const vec3 STACK_B = vec3(0.46, 0.0, -0.26);
const vec3 LOOSE = vec3(-0.52, 0.0, 0.56);   // clear of stack A (centres 0.62 apart > two radii)
float stack(vec3 q, int n){
  float top = float(n)*COIN_P;
  float bnd = sdCyl(q - vec3(0.0, top*0.5, 0.0), COIN_R + 0.03, top*0.5 + 0.01);
  if (bnd > 0.05) return bnd;
  float d = 1e5;
  for (int i = 0; i < 10; i++){
    if (i >= n) break;
    d = min(d, coin(q - vec3(JIT[i].x, COIN_H + float(i)*COIN_P, JIT[i].y)));
  }
  return d;
}
// tapered capsule (round cone) between a and b
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr*rr; float il2 = 1.0/l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa*l2 - ba*y; float x2 = dot(xv, xv); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}
float sdVesica(vec2 p, float r, float d){
  p = abs(p); float b = sqrt(r*r - d*d);
  return ((p.y - b)*d > p.x*b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
// a leaf from 'base', pointing along yaw, pitched up, rolled about its own
// axis (so side leaves turn their blade to the camera instead of showing an
// edge), drooping to the tip and folded along its midrib; hl/hw = half
// length / half width
float leaf(vec3 p, vec3 base, float yaw, float pitch, float roll, float hl, float hw){
  vec3 q = p - base;
  q.xz = rot(yaw)*q.xz;
  q.xy = rot(-pitch)*q.xy;
  q.yz = rot(roll)*q.yz;
  float bb = length(q - vec3(hl, 0.0, 0.0)) - hl - 0.04;
  if (bb > 0.03) return bb;
  float u = q.x/hl;
  q.y += 0.30*hl*u*u*0.25;
  q.y -= 2.6*q.z*q.z;
  float r = (hl*hl + hw*hw)/(2.0*hw);
  float d2 = sdVesica(vec2(q.z, q.x - hl), r, r - hw);
  float d = extrude(d2, q.y, 0.0055, 0.004);
  d = min(d, sdCapsule(q, vec3(-0.03, 0.0, 0.0), vec3(0.04, 0.0, 0.0), 0.0075));   // petiole
  return d;
}
const vec3 SB = STACK_A + vec3(0.002, 10.0*COIN_P - 0.004, 0.001);
const vec3 S1 = SB + vec3(0.030, 0.30, 0.010);
const vec3 S2 = SB + vec3(-0.012, 0.62, -0.006);
const vec3 S3 = SB + vec3(0.016, 0.90, 0.004);
float sapling(vec3 q){
  float bnd = length(q - (SB + vec3(0.0, 0.50, 0.0))) - 0.70;
  if (bnd > 0.05) return bnd;
  float d = sdRoundCone(q, SB, S1, 0.032, 0.025);
  d = min(d, sdRoundCone(q, S1, S2, 0.025, 0.018));
  d = min(d, sdRoundCone(q, S2, S3, 0.018, 0.010));
  d = smin(d, sdCappedCone(q - SB - vec3(0.0, 0.014, 0.0), 0.014, 0.055, 0.032), 0.012);  // root flare on the coin
  d = min(d, leaf(q, SB + vec3(0.022, 0.26, 0.008), 0.0, 0.42, -0.55, 0.205, 0.092));      // low, right
  d = min(d, leaf(q, SB + vec3(0.022, 0.28, 0.008), 2.60, 0.38, 0.55, 0.195, 0.088));      // low, left
  d = min(d, leaf(q, SB + vec3(-0.006, 0.57, -0.005), 1.65, 0.55, 0.30, 0.170, 0.078));    // upper, back-left
  d = min(d, leaf(q, SB + vec3(-0.006, 0.61, -0.005), 5.55, 0.45, -0.50, 0.165, 0.075));   // upper, right
  d = min(d, leaf(q, S3 + vec3(0.0, -0.025, 0.0), 0.25, 1.05, 0.0, 0.100, 0.044));          // opening bud
  d = min(d, leaf(q, S3 + vec3(0.0, -0.025, 0.0), 0.25 + PI, 1.10, 0.0, 0.094, 0.042));
  return d;
}
vec2 objMap(vec3 p){
  vec3 q = eLocal(p);
  float c = stack(q - STACK_A, 10);
  c = min(c, stack(q - STACK_B, 4));
  c = min(c, coin(q - LOOSE - vec3(0.0, COIN_H, 0.0)));
  vec2 res = vec2(c, float(M_COIN));
  res = opU(res, vec2(sapling(q), float(M_LEAF)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_COIN){
    float side = 1.0 - abs(n.y);
    m = mkMat(vec3(1.0, 0.76, 0.33), 1.0, mix(0.11, 0.22, side));
    return true;
  }
  if (id == M_LEAF){
    // green gold: the alloy's paler, greener yellow, satin so every leaf holds a highlight
    n = normalize(n + 0.025*(vec3(vnoise(p*180.0), vnoise(p*180.0 + 5.0), vnoise(p*180.0 + 9.0)) - 0.5));
    m = mkMat(vec3(0.80, 0.80, 0.42), 1.0, 0.20);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Leadership & Personal Development
// A white marble Staunton king (brass collars, crown band and cross finial)
// standing ahead of two smaller marble pawns: the piece the game turns on,
// leading its side.
window.SCENES["leadership-personal-development"] = {
  name: "Leadership & Personal Development",
  accent: [0.0, 0.78, 1.0],
  accentPower: 0.9,
  palette: { envHi: [0.05, 0.042, 0.034] },
  glsl: `
#define STEP_K 0.85
#define OBJ_C vec3(0.15, 0.62, -0.08)
#define OBJ_R 1.2
#define M_TRIM 30
#define M_STONE 31
vec3 kLocal(vec3 p){ vec3 q = p; q.xz = rot(0.0)*q.xz; return q; }
const vec3 KING = vec3(-0.18, 0.0, 0.18);
const vec3 PAWN1 = vec3(0.36, 0.0, -0.10);
const vec3 PAWN2 = vec3(0.66, 0.0, -0.44);
float kingStone(vec3 p){
  float d = sdRoundCyl(p - vec3(0.0, 0.045, 0.0), 0.31, 0.045, 0.02);                 // foot
  d = smin(d, sdCappedCone(p - vec3(0.0, 0.14, 0.0), 0.05, 0.27, 0.20), 0.03);           // base cove
  d = smin(d, sdCappedCone(p - vec3(0.0, 0.46, 0.0), 0.28, 0.185, 0.105), 0.05);         // tapering column
  d = smin(d, sdCappedCone(p - vec3(0.0, 0.92, 0.0), 0.12, 0.10, 0.20), 0.03);           // crown flare
  d = smin(d, sdEllipsoid(p - vec3(0.0, 1.045, 0.0), vec3(0.17, 0.085, 0.17)), 0.03);   // crown dome
  return d;
}
float kingTrim(vec3 p){
  float d = sdTorus(p - vec3(0.0, 0.098, 0.0), vec2(0.262, 0.018));                      // foot bead
  d = min(d, sdRoundCyl(p - vec3(0.0, 0.762, 0.0), 0.195, 0.022, 0.011));                // collar
  d = min(d, sdRoundCyl(p - vec3(0.0, 0.718, 0.0), 0.142, 0.012, 0.006));               // under-collar
  d = min(d, sdTorus(p - vec3(0.0, 1.035, 0.0), vec2(0.195, 0.021)));                     // crown band
  // cross finial on a short neck
  vec3 c = p - vec3(0.0, 1.13, 0.0); c.xz = rot(0.35)*c.xz;
  float f = sdSphere(c, 0.042);
  f = min(f, sdRoundBox(c - vec3(0.0, 0.12, 0.0), vec3(0.024, 0.10, 0.024), 0.008));
  f = min(f, sdRoundBox(c - vec3(0.0, 0.15, 0.0), vec3(0.078, 0.024, 0.024), 0.008));
  return min(d, f);
}
float pawnStone(vec3 p){
  float d = sdRoundCyl(p - vec3(0.0, 0.035, 0.0), 0.21, 0.035, 0.015);
  d = smin(d, sdCappedCone(p - vec3(0.0, 0.10, 0.0), 0.035, 0.19, 0.14), 0.02);
  d = smin(d, sdCappedCone(p - vec3(0.0, 0.25, 0.0), 0.13, 0.12, 0.065), 0.04);
  d = smin(d, sdSphere(p - vec3(0.0, 0.49, 0.0), 0.105), 0.02);
  return d;
}
float pawnTrim(vec3 p){ return sdRoundCyl(p - vec3(0.0, 0.385, 0.0), 0.12, 0.016, 0.008); }
vec2 objMap(vec3 p){
  vec3 q = kLocal(p);
  vec3 k = q - KING;
  vec2 res = vec2(kingStone(k), float(M_STONE));
  res = opU(res, vec2(kingTrim(k), float(M_TRIM)));
  vec3 a = q - PAWN1; vec3 b = q - PAWN2;
  res = opU(res, vec2(min(pawnStone(a), pawnStone(b)), float(M_STONE)));
  res = opU(res, vec2(min(pawnTrim(a), pawnTrim(b)), float(M_TRIM)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_STONE){
    // the library Calacatta at a finer scale, so veins cross the narrow turned pieces
    vec3 q = p*2.6;
    float w = fbm(q*1.1 + 11.0);
    float band = abs(sin(q.x*1.2 + q.y*2.2 + q.z*0.8 + w*6.0));
    float vein = smoothstep(0.12, 0.0, band)*(0.55 + 0.45*fbm(q*3.0 + 5.0));
    float haze = smoothstep(0.6, 0.0, band)*0.18;
    float band2 = abs(sin(q.x*-2.3 + q.y*1.1 + q.z*2.9 + fbm(q*2.0 + 3.0)*8.0));
    float vein2 = smoothstep(0.05, 0.0, band2)*0.3;
    vec3 base = vec3(0.80, 0.77, 0.72)*(0.94 + 0.08*fbm(q*5.0));
    m = mkMat(mix(base, vec3(0.44, 0.40, 0.36), clamp(vein*0.75 + haze + vein2, 0.0, 1.0)), 0.0, 0.06);
    return true;
  }
  if (id == M_TRIM){
    // turned brass: circumferential brushing around whichever piece this is
    vec3 q = kLocal(p);
    vec3 c = KING;
    if (length(q.xz - PAWN1.xz) < length(q.xz - c.xz)) c = PAWN1;
    if (length(q.xz - PAWN2.xz) < length(q.xz - c.xz)) c = PAWN2;
    vec3 r = q - c;
    n = brushN(n, p, normalize(vec3(-r.z, 0.0, r.x) + 1e-5), 0.04);
    m = mkMat(vec3(0.95, 0.73, 0.38), 1.0, 0.18);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};
