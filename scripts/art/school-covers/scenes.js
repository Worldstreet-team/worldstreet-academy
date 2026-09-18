/*
  School scenes. Each entry supplies only what differs between covers:
    accent        linear RGB of the saturated accent soft box (unit-ish)
    accentPower   optional multiplier on the rig's accent power
    glsl          OBJ_C / OBJ_R (bounding sphere), objMap(p) -> (dist, matId),
                  sceneMat(id, p, n, m) hook, sceneGlassAtten(id) hook,
                  optional SPHERE_LIGHT (SL_C, SL_R, SL_LE, SL_MAT) and MAX_DEPTH
  The object stands on the plinth top (y = 0), centred on the origin; the
  camera sees its "front" from +z. Library material ids live in renderer.html.
*/
window.SCENES = {};

// ---------------------------------------------------------------- Trading & Financial Markets
window.SCENES["trading-financial-markets"] = {
  name: "Trading & Financial Markets",
  accent: [0.02, 1.0, 0.42],
  accentPower: 0.8,
  glsl: `
#define OBJ_C vec3(0.0, 0.78, 0.0)
#define OBJ_R 1.32
#define M_BULL 30
#define M_BEAR 31
#define M_STEM 32
// body lo, body hi, wick lo, wick hi — a rising sequence with two pull-backs
const vec4 CANDLE[6] = vec4[6](
  vec4(0.30, 0.52, 0.22, 0.60),
  vec4(0.40, 0.56, 0.33, 0.64),
  vec4(0.50, 0.84, 0.43, 0.92),
  vec4(0.70, 0.88, 0.64, 0.97),
  vec4(0.84, 1.22, 0.76, 1.31),
  vec4(1.12, 1.54, 1.04, 1.64));
const float BEAR[6] = float[6](0.0, 1.0, 0.0, 1.0, 0.0, 0.0);
vec3 tLocal(vec3 p){ vec3 q = p; q.xz = rot(0.42)*q.xz; return q; }
vec2 objMap(vec3 p){
  vec3 q = tLocal(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.035, 0.0), vec3(0.98, 0.035, 0.2), 0.025), float(M_BRASS_BRUSHED));
  for (int i = 0; i < 6; i++){
    vec4 c = CANDLE[i];
    vec3 lp = q - vec3(-0.8 + float(i)*0.32, 0.0, 0.0);
    float body = sdRoundBox(lp - vec3(0.0, (c.x+c.y)*0.5, 0.0), vec3(0.105, (c.y-c.x)*0.5, 0.105), 0.035);
    float wick = sdCyl(lp - vec3(0.0, (c.z+c.w)*0.5, 0.0), 0.016, (c.w-c.z)*0.5);
    float stem = sdCyl(lp - vec3(0.0, c.z*0.5, 0.0), 0.0065, c.z*0.5);
    res = opU(res, vec2(min(body, wick), BEAR[i] > 0.5 ? float(M_BEAR) : float(M_BULL)));
    res = opU(res, vec2(stem, float(M_STEM)));
  }
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_BULL){ m = mkMat(vec3(0.94, 0.72, 0.38), 1.0, 0.13); return true; }
  if (id == M_BEAR){ m = mkMat(vec3(0.36, 0.22, 0.13), 1.0, 0.26); return true; }
  if (id == M_STEM){ m = mkMat(vec3(0.12, 0.11, 0.10), 1.0, 0.35); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Blockchain & Web3
// A cube whose twelve edges are chains of two interlocked links; at every
// corner the three meeting links sit in mutually perpendicular planes.
window.SCENES["blockchain-web3"] = {
  name: "Blockchain & Web3",
  accent: [0.06, 0.30, 1.0],
  accentPower: 1.8,
  glsl: `
#define OBJ_C vec3(0.0, 0.67, 0.0)
#define OBJ_R 1.2
vec3 bLocal(vec3 p){ vec3 q = p - vec3(0.0, 0.67, 0.0); q.xz = rot(0.62)*q.xz; return q; }
vec2 objMap(vec3 p){
  vec3 q = bLocal(p);
  vec3 a = abs(q);
  const float s = 0.5, le = 0.12, r1 = 0.13, r2 = 0.036, o = 0.25;
  float d = sdLink(vec3(a.z - s, q.x - o, a.y - s), le, r1, r2);          // x edges
  d = min(d, sdLink(vec3(a.y - s, q.x + o, a.z - s), le, r1, r2));
  d = min(d, sdLink(vec3(a.x - s, q.y - o, a.z - s), le, r1, r2));        // y edges
  d = min(d, sdLink(vec3(a.z - s, q.y + o, a.x - s), le, r1, r2));
  d = min(d, sdLink(vec3(a.y - s, q.z - o, a.x - s), le, r1, r2));        // z edges
  d = min(d, sdLink(vec3(a.x - s, q.z + o, a.y - s), le, r1, r2));
  return vec2(d, float(M_STEEL_BRUSHED));
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_STEEL_BRUSHED){ m = mkMat(vec3(0.62, 0.62, 0.64), 1.0, 0.2); n = normalize(n + 0.03*(vec3(vnoise(p*260.0), vnoise(p*260.0+5.0), vnoise(p*260.0+9.0)) - 0.5)); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- AI & Automation
// A glass bust whose skin carries an inner lattice of fine wires (contour
// rings + meridians); a few lattice nodes glow like firing neurons.
window.SCENES["ai-automation"] = {
  name: "AI & Automation",
  accent: [0.45, 0.14, 1.0],
  glsl: `
#define MAX_DEPTH 9
#define STEP_K 0.75
#define OBJ_C vec3(0.0, 0.76, 0.0)
#define OBJ_R 0.95
#define M_WIRE 30
#define HEAD_ROT 0.42
vec3 hLocal(vec3 p){ vec3 q = p; q.xz = rot(HEAD_ROT)*q.xz; return q; }
// Head = side-profile polygon (face towards -x) intersected with a front
// silhouette, rounded; nose, lips and chin are narrow add-ons so the face
// plane does not extrude into a muzzle.
const int NPROF = 23;
const vec2 PROF[23] = vec2[23](
  vec2(0.13, 0.20), vec2(0.13, 0.52), vec2(0.19, 0.68), vec2(0.30, 0.84), vec2(0.355, 1.00),
  vec2(0.34, 1.17), vec2(0.27, 1.30), vec2(0.15, 1.40), vec2(0.02, 1.44), vec2(-0.13, 1.41),
  vec2(-0.24, 1.34), vec2(-0.315, 1.25), vec2(-0.335, 1.12), vec2(-0.345, 1.04), vec2(-0.318, 0.99),
  vec2(-0.325, 0.90), vec2(-0.318, 0.80), vec2(-0.312, 0.70), vec2(-0.305, 0.62), vec2(-0.255, 0.575),
  vec2(-0.14, 0.565), vec2(-0.085, 0.52), vec2(-0.09, 0.20));
float sdProfile(vec2 p){
  float d = dot(p - PROF[0], p - PROF[0]); float s = 1.0;
  for (int i = 0; i < NPROF; i++){
    int j = i == 0 ? NPROF - 1 : i - 1;
    vec2 e = PROF[j] - PROF[i]; vec2 w = p - PROF[i];
    vec2 b = w - e*clamp(dot(w, e)/dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= PROF[i].y, p.y < PROF[j].y, e.x*w.y > e.y*w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s*sqrt(d);
}
float sdEll2(vec2 p, vec2 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.0)/k1; }
float sdHead(vec3 p){
  float side = sdProfile(p.xy);
  vec2 f = vec2(p.z, p.y);
  float front = smin(sdEll2(f - vec2(0.0, 1.10), vec2(0.285, 0.42)), sdEll2(f - vec2(0.0, 0.80), vec2(0.225, 0.27)), 0.10);
  front = smin(front, sdBox(vec3(f - vec2(0.0, 0.40), 0.0), vec3(0.125, 0.32, 1.0)), 0.10);
  float d = smax(side, front, 0.11);
  d = smin(d, sdEllipsoid(p - vec3(0.025, 1.115, 0.0), vec3(0.34, 0.375, 0.28)), 0.05);  // smooth cranium envelops the profile crown (no facets)
  // nose: narrow wedge, wider at the base
  float t = clamp((1.0 - p.y)/0.17, 0.0, 1.0);
  vec2 np = p.xy;
  float n2 = max(max(dot(np - vec2(-0.335, 1.00), normalize(vec2(-0.87, 0.49))), dot(np - vec2(-0.33, 0.83), normalize(vec2(-0.2, -0.98)))), p.x + 0.30);
  float nose = smax(n2, abs(p.z) - (0.018 + 0.03*t), 0.02);
  d = smin(d, nose, 0.025);
  d = smin(d, sdEllipsoid(p - vec3(-0.325, 0.775, 0.0), vec3(0.028, 0.026, 0.065)), 0.02);   // upper lip
  d = smin(d, sdEllipsoid(p - vec3(-0.322, 0.735, 0.0), vec3(0.026, 0.024, 0.06)), 0.02);    // lower lip
  d = smin(d, sdEllipsoid(p - vec3(-0.305, 0.655, 0.0), vec3(0.035, 0.045, 0.075)), 0.03);   // chin
  d = smax(d, -sdEllipsoid(vec3(p.x, p.y, abs(p.z)) - vec3(-0.335, 0.985, 0.10), vec3(0.04, 0.03, 0.05)), 0.025); // eye sockets
  d = smin(d, sdEllipsoid(p - vec3(0.06, 0.24, 0.0), vec3(0.24, 0.19, 0.42)), 0.16);        // shoulders
  return d;
}
#define BUST_S 1.1
// bust space: 10% larger, head lowered and tipped slightly forward about the neck
vec3 headSpace(vec3 q){ vec3 h = q/BUST_S; h.y += 0.06; vec3 pv = vec3(0.0, 0.72, 0.0); h -= pv; h.xy = rot(-0.12)*h.xy; return h + pv; }
vec2 objMap(vec3 p){
  vec3 w = hLocal(p);
  vec2 res = vec2(sdRoundCyl(w - vec3(0.04, 0.06, 0.0), 0.38, 0.06, 0.025), float(M_BRASS_BRUSHED)); // base
  vec3 q = headSpace(w);
  float h = sdHead(q);                       // head-space units; scaled back below
  float cutW = 0.125 - w.y;                  // level cut just above the base (world units)
  float shell = max((abs(h) - 0.006)*BUST_S, cutW);
  res = opU(res, vec2(shell, float(M_GLASS)));
  float hi = h + 0.045;
  const float sp = 0.068;
  float ry = (fract(q.y/sp) - 0.5)*sp;
  float rings = length(vec2(hi, ry)) - 0.0058;
  float a = atan(q.z, q.x); const float seg = TAU/22.0; float ra = length(q.xz);
  float ma = (fract(a/seg) - 0.5)*seg*ra;
  float mer = length(vec2(hi, ma)) - 0.0048;
  float lat = min(rings, mer)*BUST_S;
  // only some intersections carry a node: the "firing" ones
  float cy = floor(q.y/sp + 0.5), ca = floor(a/seg + 0.5);
  if (hash3(ivec3(int(cy), int(ca), 7)) > 0.8) lat = min(lat, (length(vec3(hi, ry, ma)) - 0.012)*BUST_S);
  lat = max(lat, 0.15 - w.y);
  res = opU(res, vec2(lat, float(M_WIRE)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_WIRE){
    vec3 q = headSpace(hLocal(p));
    const float sp = 0.068; const float seg = TAU/22.0;
    float cy = floor(q.y/sp + 0.5); float ca = floor(atan(q.z, q.x)/seg + 0.5);
    float ry = (fract(q.y/sp) - 0.5)*sp; float ma = (fract(atan(q.z, q.x)/seg) - 0.5)*seg*length(q.xz);
    bool node = abs(ry) < 0.016 && abs(ma) < 0.016;
    m = mkMat(vec3(0.80, 0.80, 0.84), 1.0, 0.18);
    if (node && hash3(ivec3(int(cy), int(ca), 7)) > 0.8){ m.emit = mix(uAccent, vec3(1.0), 0.4)*4.0; }
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Software & App Development
// Three upright glass screens cascading in depth on a steel stand; each
// carries a frosted, etched layout so they read as app screens.
window.SCENES["software-app-development"] = {
  name: "Software & App Development",
  accent: [0.0, 0.78, 1.0],
  accentPower: 0.9,
  glsl: `
#define MAX_DEPTH 10
#define OBJ_C vec3(0.0, 0.72, 0.0)
#define OBJ_R 1.02
#define M_SLAB 30
vec3 sLocal(vec3 p){ vec3 q = p; q.xz = rot(-0.45)*q.xz; return q; }
float sdSlab(vec3 p, vec2 b, float cr, float th, float er){
  vec2 q = abs(p.xy) - b + cr; float d2 = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cr;
  vec2 w = vec2(d2 + er, abs(p.z) - th + er);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - er;
}
vec3 slabCentre(int i){ float f = float(i); float hh = 0.52 + 0.06*f; return vec3(-0.16 + 0.15*f, 0.1 + hh, 0.27 - 0.27*f); }
vec2 slabHalf(int i){ return vec2(0.33, 0.52 + 0.06*float(i)); }
vec2 objMap(vec3 p){
  vec3 q = sLocal(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.05, 0.0), vec3(0.62, 0.05, 0.4), 0.035), float(M_DARKSTEEL));
  for (int i = 0; i < 3; i++){
    float s = sdSlab(q - slabCentre(i), slabHalf(i), 0.075, 0.019, 0.008);
    res = opU(res, vec2(s, float(M_SLAB)));
  }
  return res;
}
float sdRect(vec2 p, vec2 c, vec2 b, float r){ vec2 q = abs(p - c) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_SLAB){
    vec3 q = sLocal(p);
    int k = 0; float best = 1e5;
    for (int i = 0; i < 3; i++){ float dz = abs(q.z - slabCentre(i).z); if (dz < best){ best = dz; k = i; } }
    vec2 u = (q - slabCentre(k)).xy; vec2 hb = slabHalf(k);
    // etched layout: status bar, hero card, two tiles, list rows, pill button
    float e = sdRect(u, vec2(0.0, hb.y - 0.07), vec2(0.27, 0.018), 0.018);
    e = min(e, sdRect(u, vec2(0.0, hb.y - 0.25), vec2(0.27, 0.12), 0.035));
    e = min(e, sdRect(u, vec2(-0.14, hb.y - 0.50), vec2(0.13, 0.09), 0.03));
    e = min(e, sdRect(u, vec2(0.14, hb.y - 0.50), vec2(0.13, 0.09), 0.03));
    for (int r = 0; r < 3; r++) e = min(e, sdRect(u, vec2(0.0, hb.y - 0.69 - 0.075*float(r)), vec2(0.27, 0.022), 0.022));
    e = min(e, sdRect(u, vec2(0.0, -hb.y + 0.08), vec2(0.16, 0.032), 0.032));
    float frost = smoothstep(0.002, -0.002, e);
    vec2 qe = abs(u) - hb + 0.075; float edge = length(max(qe, 0.0)) + min(max(qe.x, qe.y), 0.0) - 0.075;
    float rim = smoothstep(-0.014, -0.004, edge);
    m = mkGlass(vec3(1.0), vec3(0.35, 0.10, 0.06), mix(0.0, 0.3, frost));
    float lvl = k == 0 ? 1.0 : (k == 1 ? 0.55 : 0.32);
    m.emit = mix(uAccent, vec3(1.0), 0.45)*(frost*0.55 + rim*1.6)*lvl;
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return id == M_SLAB ? 0.84 : 0.0; }
`,
};

// ---------------------------------------------------------------- Cybersecurity
// A machined steel padlock, shackle lifted and swung open, its front-right
// quarter cut away to show the brass plug, pin stacks and springs.
window.SCENES["cybersecurity"] = {
  name: "Cybersecurity",
  accent: [0.0, 0.95, 0.72],
  accentPower: 0.85,
  glsl: `
#define OBJ_C vec3(0.0, 0.70, 0.0)
#define OBJ_R 0.9
#define M_PIN 30
#define M_BODY 31
#define LOCK_ROT -0.62
vec3 lLocal(vec3 p){ vec3 q = p; q.xz = rot(LOCK_ROT)*q.xz; return q; }
float sdShackle(vec3 p, float R, float r, float legL, float legR){
  float d = p.y > 0.0 ? length(vec2(length(p.xy) - R, p.z)) - r : 1e5;
  d = min(d, sdCapsule(p, vec3(-R, 0.0, 0.0), vec3(-R, -legL, 0.0), r));
  d = min(d, sdCapsule(p, vec3(R, 0.0, 0.0), vec3(R, -legR, 0.0), r));
  return d;
}
const float PINZ[5] = float[5](-0.12, -0.06, 0.0, 0.06, 0.12);
const float PINL[5] = float[5](0.07, 0.11, 0.05, 0.09, 0.06);
vec2 objMap(vec3 p){
  vec3 q = lLocal(p);
  float body = sdRoundBox(q - vec3(0.0, 0.36, 0.0), vec3(0.40, 0.36, 0.185), 0.07);
  vec3 kp = q - vec3(-0.19, 0.40, 0.185);
  float kh = min(length(kp.xy) - 0.042, sdBox(kp - vec3(0.0, -0.075, 0.0), vec3(0.019, 0.075, 1.0)));
  body = max(body, -max(kh, abs(kp.z) - 0.05));                               // keyhole
  float cut = sdBox(q - vec3(0.34, 0.50, 0.16), vec3(0.34, 0.39, 0.16));       // cutaway
  body = max(body, -cut);
  vec2 res = vec2(body, float(M_BODY));
  // plug along z
  vec3 pp = q - vec3(0.15, 0.30, 0.0);
  float plug = sdCyl(vec3(pp.x, pp.z, pp.y), 0.092, 0.18);
  plug = max(plug, -sdBox(pp - vec3(0.0, -0.01, 0.0), vec3(0.012, 0.05, 0.2)));   // keyway
  res = opU(res, vec2(plug, float(M_PIN)));
  // pin stacks: brass key pins, steel drivers, springs
  for (int i = 0; i < 5; i++){
    vec3 lp = q - vec3(0.15, 0.392, PINZ[i]);
    float kpin = sdRoundCyl(lp - vec3(0.0, PINL[i]*0.5, 0.0), 0.021, PINL[i]*0.5, 0.008);
    float dpin = sdRoundCyl(lp - vec3(0.0, PINL[i] + 0.004 + 0.04, 0.0), 0.021, 0.04, 0.006);
    vec3 spp = lp - vec3(0.0, PINL[i] + 0.09, 0.0);
    float spring = length(vec2(length(spp.xz) - 0.017, (fract(spp.y/0.02) - 0.5)*0.02)) - 0.0045;
    spring = max(spring, abs(spp.y - 0.07) - 0.07);
    res = opU(res, vec2(kpin, float(M_PIN)));
    res = opU(res, vec2(min(dpin, spring), float(M_STEEL)));
  }
  // shackle: lifted and swung open about the left leg
  vec3 sp = q - vec3(-0.23, 0.0, 0.0); sp.xz = rot(0.62)*sp.xz; sp += vec3(-0.23, 0.0, 0.0);
  sp -= vec3(0.0, 0.72 + 0.20 + 0.17, 0.0);
  float sh = sdShackle(sp, 0.23, 0.058, 0.62, 0.16);
  res = opU(res, vec2(sh, float(M_STEEL)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_PIN){ m = mkMat(vec3(0.93, 0.72, 0.38), 1.0, 0.16); return true; }
  if (id == M_BODY){
    vec3 q = lLocal(p);
    // outside skin bead-blasted; machined cut faces brighter and finer
    float inCut = step(sdBox(q - vec3(0.34, 0.50, 0.16), vec3(0.345, 0.395, 0.165)), 0.0);
    m = mkMat(vec3(0.58, 0.58, 0.60), 1.0, mix(0.32, 0.14, inCut));
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Data & Analytics
// A column chart carved in polished marble, four bars on a brass sill.
window.SCENES["data-analytics"] = {
  name: "Data & Analytics",
  accent: [1.0, 0.30, 0.0],
  glsl: `
#define OBJ_C vec3(0.0, 0.70, 0.0)
#define OBJ_R 1.12
vec3 dLocal(vec3 p){ vec3 q = p; q.xz = rot(-0.34)*q.xz; return q; }
const float BARH[4] = float[4](0.56, 0.96, 0.74, 1.32);
vec2 objMap(vec3 p){
  vec3 q = dLocal(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.03, 0.0), vec3(0.80, 0.03, 0.25), 0.02), float(M_BRASS_BRUSHED));
  for (int i = 0; i < 4; i++){
    float x = -0.54 + 0.36*float(i); float h = BARH[i];
    float b = sdRoundBox(q - vec3(x, 0.06 + h*0.5, 0.0), vec3(0.145, h*0.5, 0.145), 0.04);
    res = opU(res, vec2(b, float(M_MARBLE)));
  }
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){ return false; }
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Digital Media & Creative
// A satin-aluminium cine lens on its side (machined knurl, engraved grooves,
// gold index ring, gunmetal hood, coated front element) with a clapperboard
// (sticks open) standing behind it. The lens axis is chosen so the barrel
// does not mirror the side accent box along its length.
window.SCENES["digital-media-creative"] = {
  name: "Digital Media & Creative",
  accent: [1.0, 0.08, 0.72],
  accentPower: 0.35,
  glsl: `
#define OBJ_C vec3(0.05, 0.55, -0.05)
#define OBJ_R 1.08
#define M_COAT 30
#define M_STRIPE 31
#define M_SLATE 32
#define M_KNURL 33
#define M_BARREL 34
const vec3 LENS_C = vec3(-0.22, 0.345, 0.28);
vec3 lensLocal(vec3 p){ vec3 q = p - LENS_C; q.xz = rot(-2.585)*q.xz; return q; } // local +x = lens front
float box2(vec2 p, vec2 c, vec2 b){ vec2 d = abs(p - c) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// lens axis in world space (local +x rotated back), for lathe-turned brushing
vec3 lensAxisW(){ vec2 a = rot(2.585)*vec2(1.0, 0.0); return vec3(a.x, 0.0, a.y); }
float groove(vec2 x, float xg, float R){ return box2(x, vec2(xg, R), vec2(0.0035, 0.007)); }
vec2 lensMap(vec3 q){
  float r = length(q.yz);
  vec2 x = vec2(q.x, r);
  float ang = atan(q.z, q.y);
  vec2 res = vec2(box2(x, vec2(-0.45, 0.0), vec2(0.05, 0.215)) - 0.008, float(M_STEEL));     // bayonet mount
  // satin aluminium barrel with engraved grooves
  float barrel = box2(x, vec2(-0.25, 0.0), vec2(0.15, 0.285)) - 0.01;
  barrel = max(barrel, -min(groove(x, -0.31, 0.295), groove(x, -0.21, 0.295)));
  res = opU(res, vec2(barrel, float(M_BARREL)));
  // machined straight-knurl focus ring
  float kn = 0.005*smoothstep(-0.25, 0.25, sin(ang*90.0));
  float fr = box2(x, vec2(0.03, 0.0), vec2(0.12, 0.296 + kn)) - 0.005;
  fr = max(fr, -min(groove(x, -0.075, 0.305), groove(x, 0.135, 0.305)));
  res = opU(res, vec2(fr, float(M_KNURL)));
  float front = box2(x, vec2(0.20, 0.0), vec2(0.045, 0.293)) - 0.006;
  front = max(front, -groove(x, 0.20, 0.303));
  res = opU(res, vec2(front, float(M_BARREL)));
  res = opU(res, vec2(box2(x, vec2(-0.115, 0.0), vec2(0.012, 0.299)) - 0.004, float(M_GOLD)));   // gold index ring
  res = opU(res, vec2(box2(x, vec2(-0.395, 0.0), vec2(0.008, 0.29)) - 0.004, float(M_GOLD)));    // gold mount ring
  float hood = box2(x, vec2(0.34, 0.3125), vec2(0.08, 0.0275)) - 0.01;                            // gunmetal hood (tube)
  res = opU(res, vec2(hood, float(M_ANODIZED)));
  // front element: a coated glass cap bulging out of a black retaining ring
  float floorR = box2(x, vec2(0.28, 0.0), vec2(0.02, 0.29));
  float cap = max(length(q) - 0.40, max(r - 0.268, 0.27 - q.x));
  res = opU(res, vec2(floorR, float(M_ANODIZED)));
  res = opU(res, vec2(cap, float(M_COAT)));
  return res;
}
const vec3 CLAP_C = vec3(0.42, 0.0, -0.40);
vec3 clapLocal(vec3 p){ vec3 q = p - CLAP_C; q.xz = rot(0.32)*q.xz; return q; }
vec2 clapMap(vec3 q){
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.34, 0.0), vec3(0.50, 0.34, 0.022), 0.012), float(M_SLATE));
  res = opU(res, vec2(sdRoundBox(q - vec3(0.0, 0.735, 0.0), vec3(0.50, 0.052, 0.024), 0.008), float(M_STRIPE)));
  vec3 h = q - vec3(-0.50, 0.79, 0.0); h.xy = rot(0.36)*h.xy;
  res = opU(res, vec2(sdRoundBox(h - vec3(0.50, 0.052, 0.0), vec3(0.50, 0.052, 0.024), 0.008), float(M_STRIPE)));
  res = opU(res, vec2(sdCyl(vec3(q.x + 0.47, q.z, q.y - 0.79), 0.03, 0.035), float(M_STEEL)));   // hinge
  return res;
}
vec2 objMap(vec3 p){ return opU(lensMap(lensLocal(p)), clapMap(clapLocal(p))); }
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_COAT){
    // multi-coated front element: reflections shift magenta -> green across the curvature
    vec3 q = lensLocal(p); float r = length(q.yz);
    vec3 nl = n; nl.xz = rot(-2.585)*nl.xz;
    float t = clamp(nl.x, 0.0, 1.0);
    vec3 tint = mix(vec3(0.16, 0.52, 0.26), vec3(0.62, 0.14, 0.56), smoothstep(0.80, 0.97, t));
    m = mkMat(tint, 1.0, 0.015); return true;
  }
  if (id == M_BARREL){
    vec3 A = lensAxisW(); n = brushN(n, p, cross(A, n), 0.05);   // lathe rings run around the barrel
    m = mkMat(vec3(0.66, 0.66, 0.68), 0.55, 0.30); return true;             // satin bead-blasted aluminium
  }
  if (id == M_KNURL){ m = mkMat(vec3(0.36, 0.36, 0.38), 0.6, 0.36); return true; }
  if (id == M_ANODIZED){ m = mkMat(vec3(0.06, 0.06, 0.065), 1.0, 0.24); return true; }  // gunmetal hood and retaining ring
  if (id == M_SLATE){
    // chalk rules on the slate face
    vec3 q = clapLocal(p);
    float ln = min(abs(q.y - 0.44), abs(q.y - 0.24));
    ln = min(ln, max(abs(q.x - 0.02), step(0.44, q.y)*1.0 + step(q.y, 0.24)*1.0));
    float chalk = (1.0 - smoothstep(0.004, 0.007, ln))*step(abs(q.x), 0.44)*step(0.06, q.y)*step(q.y, 0.62);
    m = mkMat(mix(vec3(0.02, 0.02, 0.021), vec3(0.55, 0.54, 0.52), chalk), 0.0, 0.42); return true;
  }
  if (id == M_STRIPE){
    vec3 q = clapLocal(p);
    vec3 h = q - vec3(-0.50, 0.79, 0.0); h.xy = rot(0.36)*h.xy;
    vec2 u = q.y < 0.79 - 0.002 ? q.xy : h.xy + vec2(-0.5, 0.0);
    float st = step(0.5, fract((u.x - u.y*1.1)/0.19 + 0.25));
    m = mkMat(mix(vec3(0.018), vec3(0.82, 0.80, 0.76), st), 0.0, 0.32);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};

// ---------------------------------------------------------------- Digital Business & Remote Careers
// A cognac leather briefcase laid open; a small wire globe with a glowing
// core floats above the lining and lights the case from inside.
window.SCENES["digital-business-remote-careers"] = {
  name: "Digital Business & Remote Careers",
  accent: [1.0, 0.30, 0.20],
  accentPower: 1.1,
  glsl: `
#define SPHERE_LIGHT
#define SL_C vec3(0.0, 0.54, 0.04)
#define SL_R 0.075
#define SL_LE (vec3(1.0, 0.72, 0.42)*16.0)
#define SL_MAT 33
#define OBJ_C vec3(0.0, 0.5, -0.05)
#define OBJ_R 1.08
#define M_WIREG 30
#define M_CLASP 32
#define BC_ROT -0.30
#define LID_OPEN 1.84
vec3 cLocal(vec3 p){ vec3 q = p; q.xz = rot(BC_ROT)*q.xz; return q; }
const vec3 HINGE = vec3(0.0, 0.17, -0.36);
vec3 lidLocal(vec3 q){ vec3 l = q - HINGE; l.yz = rot(LID_OPEN)*l.yz; return l + HINGE; }
vec2 caseMap(vec3 q){
  float base = sdRoundBox(q - vec3(0.0, 0.085, 0.0), vec3(0.56, 0.085, 0.36), 0.05);
  float cav = sdRoundBox(q - vec3(0.0, 0.14, 0.0), vec3(0.525, 0.09, 0.325), 0.03);
  vec2 res = vec2(max(base, -cav), float(M_LEATHER));
  // lid
  vec3 l = lidLocal(q);
  float lid = sdRoundBox(l - vec3(0.0, 0.24, 0.0), vec3(0.56, 0.07, 0.36), 0.05);
  float lcav = sdRoundBox(l - vec3(0.0, 0.19, 0.0), vec3(0.525, 0.07, 0.325), 0.03);
  res = opU(res, vec2(max(lid, -lcav), float(M_LEATHER)));
  // handle on the lid front edge
  vec3 hp = l - vec3(0.0, 0.24, 0.385);
  float hd = hp.z > 0.0 ? length(vec2(length(vec2(hp.x, hp.z*1.4)) - 0.14, hp.y)) - 0.026 : 1e5;
  hd = min(hd, sdCapsule(hp, vec3(-0.14, 0.0, 0.0), vec3(-0.14, 0.0, -0.03), 0.026));
  hd = min(hd, sdCapsule(hp, vec3(0.14, 0.0, 0.0), vec3(0.14, 0.0, -0.03), 0.026));
  res = opU(res, vec2(hd, float(M_LEATHER)));
  // brass fittings: handle loops, clasps on lid and base
  float fit = sdRoundBox(vec3(abs(hp.x) - 0.14, hp.y, hp.z + 0.01), vec3(0.03, 0.022, 0.02), 0.008);
  fit = min(fit, sdRoundBox(vec3(abs(l.x) - 0.36, l.y - 0.23, l.z - 0.365), vec3(0.05, 0.03, 0.012), 0.008));
  fit = min(fit, sdRoundBox(vec3(abs(q.x) - 0.36, q.y - 0.12, q.z - 0.365), vec3(0.05, 0.035, 0.012), 0.008));
  res = opU(res, vec2(fit, float(M_CLASP)));
  return res;
}
vec2 globeMap(vec3 p){
  vec3 g = p - SL_C;
  vec2 res = vec2(length(g) - SL_R, float(SL_MAT));
  vec3 t = g; t.xy = rot(0.41)*t.xy;                            // tilted axis
  float R = 0.19, w = 0.0055;
  float rr = length(t);
  float a = atan(t.z, t.x); const float seg = TAU/12.0;
  float mer = length(vec2(rr - R, (fract(a/seg) - 0.5)*seg*length(t.xz))) - w;
  float el = asin(clamp(t.y/max(rr, 1e-4), -1.0, 1.0)); const float es = PI/6.0;
  float par = length(vec2(rr - R, (fract(el/es + 0.5) - 0.5)*es*rr)) - w;
  float axis = sdCapsule(t, vec3(0.0, -0.25, 0.0), vec3(0.0, 0.25, 0.0), 0.007);
  res = opU(res, vec2(min(min(mer, par), axis), float(M_WIREG)));
  return res;
}
#define CASE_S 1.15
vec2 objMap(vec3 p){ vec2 c = caseMap(cLocal(p)/CASE_S); c.x *= CASE_S; return opU(c, globeMap(p)); }
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == SL_MAT){ m = mkMat(vec3(0.0), 0.0, 1.0); m.emit = SL_LE; return true; }
  if (id == M_WIREG){ m = mkMat(vec3(0.95, 0.74, 0.40), 1.0, 0.14); return true; }
  if (id == M_CLASP){ m = mkMat(vec3(0.93, 0.72, 0.38), 1.0, 0.12); return true; }
  if (id == M_LEATHER){
    vec3 q = cLocal(p)/CASE_S;
    // inside the cavities the leather gives way to a dark suede lining
    float inBase = step(sdRoundBox(q - vec3(0.0, 0.14, 0.0), vec3(0.527, 0.092, 0.327), 0.03), 0.0);
    vec3 l = lidLocal(q);
    float inLid = step(sdRoundBox(l - vec3(0.0, 0.19, 0.0), vec3(0.527, 0.072, 0.327), 0.03), 0.0);
    if (inBase + inLid > 0.5){ m = mkMat(vec3(0.07, 0.035, 0.022)*(0.9 + 0.2*vnoise(p*80.0)), 0.0, 0.85); return true; }
    return false;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`,
};
