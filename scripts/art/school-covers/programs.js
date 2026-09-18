/*
  Program thumbnails (16:9, 2400x1350). Same studio rig as the school covers;
  each program borrows its SCHOOL's accent hue and power, but has its own object.
  Scene ids are the course slugs, except "program:cybersecurity" (the slug
  collides with the school cover's id). Entries follow the scenes.js contract,
  plus `common`: a GLSL helper chunk prepended to the scene.
*/
window.PROGRAMS = {};
(function(){
const S = window.SCENES;
const accentOf = (school) => ({ accent: S[school].accent, accentPower: S[school].accentPower || 1 });

// helpers shared by the program scenes
const COMMON = `
float sdRect2(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float extrude(float d2, float z, float h, float r){ vec2 w = vec2(d2 + r, abs(z) - h + r); return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r; }
vec3 rY(vec3 p, float a){ p.xz = rot(a)*p.xz; return p; }
vec3 rX(vec3 p, float a){ p.yz = rot(a)*p.yz; return p; }
vec3 rZ(vec3 p, float a){ p.xy = rot(a)*p.xy; return p; }
float sdCappedCone(vec3 p, float h, float r1, float r2){
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h); vec2 k2 = vec2(r2 - r1, 2.0*h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2*clamp(dot(k1 - q, k2)/dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s*sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdGear(vec2 p, float r, float n, float dep){ float a = atan(p.y, p.x); float t = smoothstep(-0.3, 0.3, cos(a*n)); return (length(p) - r - dep*t)*0.7; }
float sdPolyN(vec2 p, float n, float rin){ float s = TAU/n; float a = atan(p.y, p.x); a = mod(a + s*0.5, s) - s*0.5; return length(p)*cos(a) - rin; }
Mat travertine(vec3 p){
  float f = fbm(p*vec3(3.0, 9.0, 3.0) + 2.0);
  float pores = smoothstep(0.70, 0.78, vnoise(p*110.0));
  return mkMat(vec3(0.68, 0.60, 0.49)*(0.88 + 0.2*f)*(1.0 - 0.22*pores), 0.0, 0.4);
}
`;
const P = (id, school, glsl, extra) => { window.PROGRAMS[id] = Object.assign({ school, common: COMMON, glsl }, accentOf(school), extra || {}); };

// ---------------------------------------------------------------- Forex: brass balance over a relief map
P("forex-trading-mastery", "trading-financial-markets", `
#define STEP_K 0.8
#define OBJ_C vec3(0.0, 0.62, 0.0)
#define OBJ_R 1.16
#define M_MAP 30
float landMask(vec2 xz){ float m = vnoise(vec3(xz*2.4, 0.5)) + 0.55*vnoise(vec3(xz*5.1, 3.5)); return smoothstep(0.80, 0.86, m); }
vec2 objMap(vec3 p){
  float disc = sdRoundCyl(p - vec3(0.0, 0.035, 0.0), 0.95, 0.035, 0.012);
  disc -= 0.014*landMask(p.xz)*smoothstep(0.93, 0.85, length(p.xz))*smoothstep(0.03, 0.07, p.y);
  vec2 res = vec2(disc, float(M_MAP));
  vec3 q = rY(p, 0.30);
  float b = sdRoundCyl(q - vec3(0.0, 0.10, 0.0), 0.17, 0.03, 0.012);
  b = min(b, sdCyl(q - vec3(0.0, 0.62, 0.0), 0.024, 0.50));
  b = min(b, length(q - vec3(0.0, 1.17, 0.0)) - 0.045);
  b = min(b, sdCapsule(q, vec3(-0.56, 1.08, 0.0), vec3(0.56, 1.08, 0.0), 0.02));
  b = min(b, sdCyl(vec3(q.x, q.z, q.y - 1.08), 0.05, 0.03));
  vec3 qa = vec3(abs(q.x), q.y, q.z);
  b = min(b, length(qa - vec3(0.56, 1.08, 0.0)) - 0.03);
  b = min(b, max(abs(length(qa - vec3(0.56, 0.80, 0.0)) - 0.30) - 0.007, qa.y - 0.60));    // pans
  for (int i = 0; i < 3; i++){
    float a = float(i)*TAU/3.0 + 0.5;
    b = min(b, sdCapsule(qa, vec3(0.56, 1.08, 0.0), vec3(0.56 + 0.224*cos(a), 0.60, 0.224*sin(a)), 0.005));
  }
  return opU(res, vec2(b, float(M_BRASS)));
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_MAP){
    float land = landMask(p.xz)*step(0.055, p.y)*smoothstep(0.93, 0.85, length(p.xz));
    if (land > 0.5) m = mkMat(vec3(0.36, 0.24, 0.13)*(0.8 + 0.3*vnoise(p*40.0)), 1.0, 0.38);
    else m = mkMat(vec3(0.028, 0.026, 0.024), 0.0, 0.3);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Crypto: faceted crystal coin over a brass candlestick sculpture
P("crypto-trading-mastery", "trading-financial-markets", `
#define MAX_DEPTH 9
#define OBJ_C vec3(0.0, 0.72, 0.0)
#define OBJ_R 1.05
#define M_CRYSTAL 30
#define M_BEAR 31
#define M_STEM 32
const vec4 C4[4] = vec4[4](vec4(0.14, 0.32, 0.09, 0.38), vec4(0.24, 0.35, 0.19, 0.42), vec4(0.30, 0.54, 0.24, 0.60), vec4(0.46, 0.72, 0.40, 0.80));
vec3 coinSpace(vec3 p){ vec3 q = p - vec3(0.02, 1.20, 0.05); q = rY(q, -0.55); q = rX(q, 0.18); return q; }
float sdCoin(vec3 q){
  const float R = 0.40, n = 12.0; float rin = R*cos(PI/n);
  float dp = sdPolyN(q.xy, n, rin);
  float s = TAU/n; float a = atan(q.y, q.x); float af = mod(a + s*0.5, s) - s*0.5; float rr = length(q.xy)*cos(af);
  float h = 0.045 + 0.05*(1.0 - clamp(rr/rin, 0.0, 1.0));          // pyramid facets on each face
  float d = max(dp, abs(q.z) - h);
  return max(d, (dp + abs(q.z) - 0.03)*0.7071);                      // chamfered rim
}
vec2 objMap(vec3 p){
  vec3 cq = coinSpace(p);
  vec2 res = vec2(sdCoin(cq)*0.9, float(M_CRYSTAL));
  res = opU(res, vec2(length(vec2(sdPolyN(cq.xy, 12.0, 0.40*cos(PI/12.0)), cq.z)) - 0.024, float(M_GOLD)));
  vec3 q = rY(p, 0.40);
  res = opU(res, vec2(sdRoundBox(q - vec3(0.0, 0.025, 0.0), vec3(0.52, 0.025, 0.13), 0.015), float(M_BRASS_BRUSHED)));
  for (int i = 0; i < 4; i++){
    vec4 c = C4[i]; vec3 lp = q - vec3(-0.36 + 0.24*float(i), 0.0, 0.0);
    float body = sdRoundBox(lp - vec3(0.0, (c.x + c.y)*0.5, 0.0), vec3(0.072, (c.y - c.x)*0.5, 0.072), 0.025);
    float wick = sdCyl(lp - vec3(0.0, (c.z + c.w)*0.5, 0.0), 0.012, (c.w - c.z)*0.5);
    res = opU(res, vec2(min(body, wick), i == 1 ? float(M_BEAR) : float(M_BRASS)));
    res = opU(res, vec2(sdCyl(lp - vec3(0.0, c.z*0.5, 0.0), 0.005, c.z*0.5), float(M_STEM)));
  }
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_CRYSTAL){ m = mkGlass(vec3(1.0), vec3(0.12, 0.015, 0.07), 0.0); m.ior = 1.7; return true; }
  if (id == M_BEAR){ m = mkMat(vec3(0.36, 0.22, 0.13), 1.0, 0.26); return true; }
  if (id == M_STEM){ m = mkMat(vec3(0.12, 0.11, 0.10), 1.0, 0.35); return true; }
  return false;
}
float sceneGlassAtten(int id){ return id == M_CRYSTAL ? 0.8 : 0.0; }
`);

// ---------------------------------------------------------------- Blockchain technology: glass blocks with brass mechanisms, joined by light
P("blockchain-technology-mastery", "blockchain-web3", `
#define MAX_DEPTH 9
#define OBJ_C vec3(0.0, 0.58, 0.0)
#define OBJ_R 1.12
#define M_BLOCK 30
#define M_BEAM 31
vec3 bSpace(vec3 p){ return rY(p, 0.55); }
vec3 blockC(int i){ float f = float(i); return vec3(-0.62 + 0.62*f, 0.21 + 0.33*f, 0.0); }
vec2 objMap(vec3 p){
  vec3 q = bSpace(p);
  vec2 res = vec2(1e5, 0.0);
  float mech = 1e5, beam = 1e5;
  for (int i = 0; i < 3; i++){
    vec3 c = blockC(i); vec3 l = q - c;
    res = opU(res, vec2(sdRoundBox(l, vec3(0.2), 0.03), float(M_BLOCK)));
    vec3 g = rZ(l, float(i)*0.7);
    float g1 = extrude(max(sdGear(g.xy, 0.105, 12.0, 0.025), -(length(g.xy) - 0.034)), g.z, 0.026, 0.006);
    vec3 g2p = rZ(g - vec3(0.115, -0.09, 0.0), 0.3);
    float g2 = extrude(max(sdGear(g2p.xy, 0.05, 8.0, 0.02), -(length(g2p.xy) - 0.016)), g2p.z, 0.022, 0.005);
    float axle = sdCyl(vec3(g.x, g.z, g.y), 0.013, 0.19);
    mech = min(mech, min(g1, g2));
    beam = min(beam, axle);                                  // light core through each block
    if (i < 2) beam = min(beam, sdCapsule(q, c, blockC(i + 1), 0.011));
  }
  // mechanisms sit INSIDE the glass: compare against |d_glass| so the march does not step over them
  if (mech < abs(res.x)) res = vec2(mech, float(M_BRASS));
  if (beam < abs(res.x)) res = vec2(beam, float(M_BEAM));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_BLOCK){ m = mkGlass(vec3(1.0), vec3(0.12, 0.06, 0.012), 0.0); return true; }
  if (id == M_BEAM){ m = mkMat(vec3(0.02), 0.0, 0.3); m.emit = mix(uAccent, vec3(1.0), 0.55)*7.0; return true; }
  return false;
}
float sceneGlassAtten(int id){ return id == M_BLOCK ? 0.85 : 0.0; }
`);

// ---------------------------------------------------------------- AI: brass robotic hand placing a glass sphere into a line of spheres
P("ai-ai-automation", "ai-automation", `
#define MAX_DEPTH 8
#define OBJ_C vec3(0.05, 0.5, 0.0)
#define OBJ_R 1.12
#define M_JOINT 30
vec3 aSpace(vec3 p){ return rY(p, 0.35); }
vec2 objMap(vec3 p){
  vec3 q = aSpace(p);
  // brass rail and the line of spheres (first slot empty)
  float rail = sdRoundBox(q - vec3(0.32, 0.03, 0.0), vec3(0.66, 0.03, 0.11), 0.015);
  rail = max(rail, -sdCapsule(q, vec3(-0.34, 0.1, 0.0), vec3(0.98, 0.1, 0.0), 0.06));
  vec2 res = vec2(rail, float(M_BRASS_BRUSHED));
  float sph = 1e5;
  for (int i = 1; i < 5; i++) sph = min(sph, length(q - vec3(-0.24 + 0.28*float(i), 0.19, 0.0)) - 0.13);
  sph = min(sph, length(q - vec3(-0.24, 0.47, 0.0)) - 0.13);                       // the one being placed
  res = opU(res, vec2(sph, float(M_GLASS)));
  // articulated arm
  float arm = sdRoundCyl(q - vec3(-0.74, 0.04, 0.05), 0.16, 0.04, 0.015);
  arm = min(arm, sdCyl(q - vec3(-0.74, 0.13, 0.05), 0.085, 0.06));
  arm = min(arm, sdCapsule(q, vec3(-0.74, 0.22, 0.05), vec3(-0.62, 0.86, 0.03), 0.05));
  arm = min(arm, sdCapsule(q, vec3(-0.62, 0.86, 0.03), vec3(-0.27, 0.78, 0.0), 0.042));
  arm = min(arm, sdCapsule(q, vec3(-0.25, 0.77, 0.0), vec3(-0.24, 0.67, 0.0), 0.04));
  arm = min(arm, sdRoundCyl(q - vec3(-0.24, 0.645, 0.0), 0.065, 0.018, 0.008));
  float joint = min(length(q - vec3(-0.74, 0.22, 0.05)) - 0.075, length(q - vec3(-0.62, 0.86, 0.03)) - 0.065);
  joint = min(joint, length(q - vec3(-0.26, 0.775, 0.0)) - 0.052);
  for (int k = 0; k < 3; k++){
    float a = float(k)*TAU/3.0 + 0.4; vec2 d = vec2(cos(a), sin(a));
    vec3 B = vec3(-0.24 + 0.055*d.x, 0.63, 0.055*d.y), K = vec3(-0.24 + 0.165*d.x, 0.56, 0.165*d.y), T = vec3(-0.24 + 0.14*d.x, 0.44, 0.14*d.y);
    arm = min(arm, min(sdCapsule(q, B, K, 0.018), sdCapsule(q, K, T, 0.015)));
    joint = min(joint, length(q - K) - 0.024);
  }
  res = opU(res, vec2(arm, float(M_BRASS)));
  res = opU(res, vec2(joint, float(M_JOINT)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_JOINT){ m = mkMat(vec3(0.16, 0.155, 0.15), 1.0, 0.28); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- App development with AI: smoked-glass phone, wireframe layers lifting off
P("app-development-with-ai", "software-app-development", `
#define MAX_DEPTH 9
#define OBJ_C vec3(0.0, 0.70, 0.05)
#define OBJ_R 1.0
#define M_FRAME 30
#define M_FRAME2 31
vec3 pSpace(vec3 p){ return rY(p - vec3(0.12, 0.0, -0.12), -0.5); }
float frameT(vec3 q, vec2 c, vec2 b, float r, float z){ return length(vec2(abs(sdRect2(q.xy - c, b, r)), q.z - z)) - 0.0055; }
vec2 objMap(vec3 p){
  vec3 q = pSpace(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.04, 0.0), vec3(0.24, 0.04, 0.12), 0.02), float(M_DARKSTEEL));
  res = opU(res, vec2(extrude(sdRect2(q.xy - vec2(0.0, 0.68), vec2(0.30, 0.60), 0.08), q.z, 0.028, 0.012), float(M_GLASS_SMOKE)));
  float f1 = frameT(q, vec2(-0.02, 0.70), vec2(0.27, 0.55), 0.07, 0.16);
  float f2 = min(frameT(q, vec2(-0.05, 0.98), vec2(0.23, 0.12), 0.035, 0.31), frameT(q, vec2(-0.16, 0.66), vec2(0.11, 0.09), 0.03, 0.31));
  f2 = min(f2, frameT(q, vec2(0.08, 0.66), vec2(0.11, 0.09), 0.03, 0.31));
  float f3 = min(frameT(q, vec2(-0.08, 0.36), vec2(0.15, 0.035), 0.035, 0.46), length(vec2(length(q.xy - vec2(-0.2, 1.2)) - 0.05, q.z - 0.46)) - 0.0055);
  res = opU(res, vec2(f1, float(M_FRAME)));
  res = opU(res, vec2(min(f2, f3), float(M_FRAME2)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_FRAME){ m = mkMat(vec3(0.02), 0.0, 0.3); m.emit = mix(uAccent, vec3(1.0), 0.45)*2.2; return true; }
  if (id == M_FRAME2){ m = mkMat(vec3(0.02), 0.0, 0.3); m.emit = mix(uAccent, vec3(1.0), 0.5)*4.0; return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Cybersecurity: steel shield with a keyhole, a brass key before it
P("program:cybersecurity", "cybersecurity", `
#define STEP_K 0.8
#define OBJ_C vec3(0.0, 0.66, 0.05)
#define OBJ_R 1.0
#define M_RIM 30
vec3 sSpace(vec3 p){ return rY(p - vec3(0.14, 0.0, -0.12), -0.38); }
float shield2(vec2 p){
  float lens = max(length(p - vec2(-0.6, 0.85)) - 1.0, length(p - vec2(0.6, 0.85)) - 1.0);
  return max(min(lens, sdRect2(p - vec2(0.0, 1.05), vec2(0.4, 0.2), 0.02)), p.y - 1.25);
}
vec2 objMap(vec3 p){
  vec3 q = sSpace(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.04, 0.0), vec3(0.2, 0.04, 0.1), 0.015), float(M_DARKSTEEL));
  vec2 s = q.xy - vec2(0.0, 0.035);
  float s2 = shield2(s);
  float bulge = 0.045*(1.0 - clamp((s.x*s.x)/0.2, 0.0, 1.0));
  float body = extrude(s2, q.z - bulge, 0.03, 0.012);
  float rim = extrude(max(s2, -(s2 + 0.045)), q.z - bulge, 0.048, 0.012);
  float kh = min(length(s - vec2(0.0, 0.74)) - 0.055, sdRect2(s - vec2(0.0, 0.62), vec2(0.024, 0.1), 0.006));
  body = max(body, -kh); rim = max(rim, -kh);
  res = opU(res, vec2(body*0.9, float(M_STEEL_BRUSHED)));
  res = opU(res, vec2(rim*0.9, float(M_RIM)));
  // the key, floating in front of the keyhole, axis along the shield normal
  vec3 k = rZ(q - vec3(0.0, 0.775, 0.0), 0.22); k.z = (k.z - 0.5)/1.45 + 0.5; k.xy /= 1.45;
  float bow = sdTorus(vec3(k.y, k.x, k.z - 0.64), vec2(0.075, 0.018));
  float shaft = sdCyl(vec3(k.x, k.z - 0.46, k.y), 0.017, 0.15);
  float collar = sdCyl(vec3(k.x, k.z - 0.56, k.y), 0.028, 0.012);
  float bit = sdRoundBox(k - vec3(0.0, -0.045, 0.37), vec3(0.008, 0.035, 0.05), 0.004);
  bit = max(bit, -sdBox(k - vec3(0.0, -0.075, 0.37), vec3(0.02, 0.012, 0.012)));
  res = opU(res, vec2(min(min(bow, shaft), min(collar, bit))*1.45, float(M_BRASS)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_RIM){ m = mkMat(vec3(0.70, 0.70, 0.72), 1.0, 0.12); return true; }
  if (id == M_STEEL_BRUSHED){ n = brushN(n, p, vec3(0.0, 1.0, 0.0), 0.05); m = mkMat(vec3(0.62, 0.62, 0.64), 0.5, 0.32); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Data analysis: a magnifying lens over marble columns
P("data-analysis", "data-analytics", `
#define MAX_DEPTH 9
#define OBJ_C vec3(0.0, 0.62, 0.05)
#define OBJ_R 1.1
#define M_HANDLE 30
vec3 dSpace(vec3 p){ return rY(p, -0.30); }
const float BH[5] = float[5](0.36, 0.62, 0.48, 0.84, 1.06);
vec3 lensSpace(vec3 p){ return rX(rY(dSpace(p) - vec3(-0.26, 0.62, 0.42), 0.45), 0.22); }
vec2 objMap(vec3 p){
  vec3 q = dSpace(p);
  vec2 res = vec2(sdRoundBox(q - vec3(0.0, 0.028, 0.0), vec3(0.68, 0.028, 0.18), 0.015), float(M_BRASS_BRUSHED));
  for (int i = 0; i < 5; i++){
    float h = BH[i];
    res = opU(res, vec2(sdRoundBox(q - vec3(-0.52 + 0.26*float(i), 0.056 + h*0.5, 0.0), vec3(0.095, h*0.5, 0.095), 0.03), float(M_MARBLE)));
  }
  vec3 m = lensSpace(p);
  float lens = max(max(length(m - vec3(0.0, 0.0, -0.945)) - 0.975, length(m - vec3(0.0, 0.0, 0.945)) - 0.975), length(m.xy) - 0.245);
  res = opU(res, vec2(lens, float(M_GLASS)));
  float rimD = sdTorus(vec3(m.x, m.z, m.y), vec2(0.255, 0.02));
  vec2 hd = vec2(cos(-1.95), sin(-1.95));
  float fer = sdCapsule(m, vec3(hd*0.27, 0.0), vec3(hd*0.34, 0.0), 0.028);
  res = opU(res, vec2(min(rimD, fer), float(M_BRASS)));
  res = opU(res, vec2(sdCapsule(m, vec3(hd*0.35, 0.0), vec3(hd*0.66, 0.0), 0.033), float(M_HANDLE)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_HANDLE){ m = mkMat(vec3(0.11, 0.055, 0.03)*(0.8 + 0.4*vnoise(p*vec3(9.0, 60.0, 9.0))), 0.0, 0.32); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Content creation: ring light halo around a studio microphone
P("content-creation-mastery", "digital-media-creative", `
#define OBJ_C vec3(0.0, 0.66, -0.05)
#define OBJ_R 1.05
#define M_RING 30
#define M_GRILLE 31
#define M_MICBODY 32
vec3 ringSpace(vec3 p){ return rY(p - vec3(0.18, 0.0, -0.32), -0.45); }
vec3 micSpace(vec3 p){ return rZ(p - vec3(-0.12, 0.0, 0.16), 0.08); }
vec2 objMap(vec3 p){
  vec3 r = ringSpace(p);
  float ring = sdRect2(vec2(length(r.xy - vec2(0.0, 0.86)) - 0.5, r.z), vec2(0.05, 0.03), 0.02);
  vec2 res = vec2(ring, float(M_RING));
  float stand = min(sdCapsule(r, vec3(0.0, 0.02, -0.03), vec3(0.0, 0.33, 0.0), 0.017), sdRoundCyl(r - vec3(0.0, 0.02, -0.03), 0.14, 0.02, 0.01));
  res = opU(res, vec2(stand, float(M_DARKSTEEL)));
  vec3 m = micSpace(p);
  float st = min(sdRoundCyl(m - vec3(0.0, 0.025, 0.0), 0.16, 0.025, 0.01), sdCapsule(m, vec3(0.0, 0.05, 0.0), vec3(0.0, 0.44, 0.0), 0.014));
  st = min(st, sdTorus(m - vec3(0.0, 0.57, 0.0), vec2(0.13, 0.011)));
  vec3 ma = vec3(abs(m.x), m.y, abs(m.z));
  st = min(st, sdCapsule(ma, vec3(0.092, 0.57, 0.0), vec3(0.122, 0.57, 0.0), 0.009));
  st = min(st, sdCapsule(m, vec3(0.0, 0.44, 0.0), vec3(0.0, 0.46, 0.0), 0.03));
  res = opU(res, vec2(st, float(M_DARKSTEEL)));
  res = opU(res, vec2(sdRoundCyl(m - vec3(0.0, 0.58, 0.0), 0.075, 0.13, 0.02), float(M_MICBODY)));
  res = opU(res, vec2(sdTorus(m - vec3(0.0, 0.715, 0.0), vec2(0.077, 0.008)), float(M_GOLD)));
  res = opU(res, vec2(sdCapsule(m, vec3(0.0, 0.81, 0.0), vec3(0.0, 0.90, 0.0), 0.095), float(M_GRILLE)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_RING){
    vec3 nr = rY(n, -0.45);
    m = mkMat(vec3(0.02), 0.0, 0.4);
    if (nr.z > 0.3) m.emit = vec3(1.0, 0.93, 0.86)*3.2*smoothstep(0.3, 0.7, nr.z);
    return true;
  }
  if (id == M_GRILLE){
    vec3 q = micSpace(p); float a = atan(q.z, q.x);
    float mesh = smoothstep(0.2, 0.6, abs(sin(a*28.0))*abs(sin(q.y*190.0)));
    m = mkMat(vec3(0.72, 0.72, 0.74)*(0.3 + 0.7*(1.0 - mesh)), 1.0, 0.28); return true;
  }
  if (id == M_MICBODY){ m = mkMat(vec3(0.05, 0.05, 0.055), 1.0, 0.25); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Video editing: film unspooling into a ribbon across a jog dial
P("video-editing-mastery", "digital-media-creative", `
#define STEP_K 0.8
#define OBJ_C vec3(0.0, 0.42, -0.02)
#define OBJ_R 1.12
#define M_FILM 30
#define M_DIAL 31
#define M_REEL 32
vec3 vSpace(vec3 p){ return rY(p, 0.25); }
vec3 ribbonLocal(vec3 v){
  float x = clamp(v.x, -0.78, 0.55);
  float yc = 0.46 + 0.14*sin(2.3*x + 1.0) - 0.08*(x - 0.55);
  float zc = -0.30 + 0.62*(0.55 - x)/1.33;
  vec2 d = rot(1.7*(x - 0.55))*vec2(v.y - yc, v.z - zc);
  return vec3(v.x, d.x, d.y);          // (along, thickness, across)
}
vec2 objMap(vec3 p){
  vec3 v = vSpace(p);
  vec2 res = vec2(sdRoundBox(v - vec3(-0.02, 0.07, 0.04), vec3(0.6, 0.07, 0.3), 0.03), float(M_ANODIZED));
  vec3 j = v - vec3(0.08, 0.17, 0.06);
  float ja = atan(j.z, j.x);
  float dial = sdRoundCyl(j, 0.25 + 0.003*sin(ja*110.0)*smoothstep(0.2, 0.24, length(j.xz)), 0.03, 0.008);
  dial = max(dial, -(length(j - vec3(0.15, 0.085, 0.05)) - 0.06));
  res = opU(res, vec2(dial*0.9, float(M_DIAL)));
  res = opU(res, vec2(sdRoundCyl(j - vec3(0.0, 0.045, 0.0), 0.05, 0.02, 0.008), float(M_GOLD)));
  vec3 bt = v - vec3(-0.45, 0.15, 0.04); bt.z = abs(bt.z) - 0.1;
  res = opU(res, vec2(min(sdRoundBox(bt, vec3(0.045, 0.012, 0.035), 0.01), sdRoundBox(v - vec3(-0.45, 0.15, 0.04), vec3(0.045, 0.012, 0.035), 0.01)), float(M_STEEL)));
  // reel standing behind, facing left-front
  vec3 r = rY(v - vec3(0.62, 0.31, -0.40), -0.55);
  float plates = sdCyl(vec3(r.x, abs(r.z) - 0.045, r.y), 0.30, 0.007);
  float ra = atan(r.y, r.x); float sec = TAU/3.0; float af = mod(ra + sec*0.5, sec) - sec*0.5;
  vec2 hp = length(r.xy)*vec2(cos(af), sin(af));
  plates = max(plates, -(length(hp - vec2(0.165, 0.0)) - 0.07));
  plates = min(plates, sdCyl(vec3(r.x, r.z, r.y), 0.06, 0.05));
  res = opU(res, vec2(plates, float(M_REEL)));
  res = opU(res, vec2(max(sdCyl(vec3(r.x, r.z, r.y), 0.255, 0.037), -sdCyl(vec3(r.x, r.z, r.y), 0.075, 0.06)), float(M_FILM)));   // wound film pack
  // the ribbon of film
  vec3 f = ribbonLocal(v);
  float band = max(sdRect2(vec2(f.z, f.y), vec2(0.065, 0.0035), 0.002), abs(v.x + 0.115) - 0.665);
  float hole = max(sdRect2(vec2(mod(f.x, 0.034) - 0.017, abs(f.z) - 0.052), vec2(0.007, 0.006), 0.002), abs(f.y) - 0.01);
  band = max(band, -hole);
  res = opU(res, vec2(band*0.55, float(M_FILM)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_FILM){
    vec3 f = ribbonLocal(vSpace(p));
    if (abs(f.y) > 0.02){ m = mkMat(vec3(0.02, 0.016, 0.013), 0.0, 0.2); return true; }   // the wound pack
    float frame = step(abs(f.z), 0.042)*step(0.006, abs(mod(f.x, 0.11) - 0.055));
    m = mkMat(mix(vec3(0.025, 0.018, 0.014), vec3(0.34, 0.16, 0.06), frame*0.8), 0.0, 0.12); return true;
  }
  if (id == M_DIAL){ vec3 j = vSpace(p) - vec3(0.08, 0.17, 0.06); n = brushN(n, p, normalize(cross(vec3(0.0, 1.0, 0.0), vec3(j.x, 0.0, j.z)) + 1e-4), 0.04); m = mkMat(vec3(0.62, 0.62, 0.64), 1.0, 0.22); return true; }
  if (id == M_REEL){ m = mkMat(vec3(0.72, 0.72, 0.74), 0.5, 0.32); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Tech sales & marketing: brass megaphone facing a rising stone staircase
P("tech-sales-digital-marketing", "digital-business-remote-careers", `
#define OBJ_C vec3(0.05, 0.5, 0.0)
#define OBJ_R 1.1
#define M_STONE 30
#define M_GRIP 31
vec3 tSpace(vec3 p){ return rY(p, 0.28); }
vec3 megaSpace(vec3 t){ vec3 m = t - vec3(-0.48, 0.30, 0.06); m.xy = rot(-0.22)*m.xy; return m; }
vec2 objMap(vec3 p){
  vec3 t = tSpace(p);
  vec2 res = vec2(1e5, 0.0);
  for (int i = 0; i < 4; i++){
    float h = 0.2*float(i + 1);
    res = opU(res, vec2(sdRoundBox(t - vec3(0.08 + 0.25*float(i), h*0.5, 0.0), vec3(0.125, h*0.5, 0.22), 0.012), float(M_STONE)));
  }
  vec3 m = megaSpace(t);
  vec3 c = vec3(m.y, m.x, m.z);
  float cone = max(abs(sdCappedCone(c, 0.27, 0.055, 0.22)) - 0.008, m.x - 0.262);
  cone = min(cone, sdTorus(vec3(m.y, m.x - 0.262, m.z), vec2(0.222, 0.012)));
  res = opU(res, vec2(cone, float(M_BRASS)));
  float grip = sdCapsule(m, vec3(-0.08, -0.1, 0.0), vec3(-0.1, -0.30, 0.0), 0.03);
  grip = min(grip, sdCyl(vec3(m.y, m.x + 0.3, m.z), 0.045, 0.035));
  res = opU(res, vec2(grip, float(M_GRIP)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_STONE){ m = travertine(p); return true; }
  if (id == M_GRIP){ m = mkMat(vec3(0.03, 0.025, 0.022), 0.0, 0.45); return true; }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- E-commerce: stone storefront arch, a glowing parcel on its step
P("e-commerce-digital-business", "digital-business-remote-careers", `
#define OBJ_C vec3(0.05, 0.58, 0.0)
#define OBJ_R 1.0
#define M_STONE 30
#define M_PARCEL 31
vec3 eSpace(vec3 p){ return rY(p - vec3(0.12, 0.0, -0.12), -0.35); }
vec2 objMap(vec3 p){
  vec3 e = eSpace(p);
  float step1 = sdRoundBox(e - vec3(0.0, 0.04, 0.08), vec3(0.54, 0.04, 0.3), 0.01);
  float bld = sdRoundBox(e - vec3(0.0, 0.58, -0.02), vec3(0.45, 0.5, 0.16), 0.012);
  float op = min(sdRect2(e.xy - vec2(0.0, 0.36), vec2(0.24, 0.28), 0.0), length(e.xy - vec2(0.0, 0.64)) - 0.24);
  bld = max(bld, -op);
  float cor = sdRoundBox(e - vec3(0.0, 1.11, -0.02), vec3(0.5, 0.035, 0.2), 0.01);
  float key = sdRoundBox(e - vec3(0.0, 0.905, 0.14), vec3(0.04, 0.05, 0.03), 0.006);
  vec2 res = vec2(min(min(step1, bld), min(cor, key)), float(M_STONE));
  res = opU(res, vec2(sdRoundBox(e - vec3(0.02, 0.165, 0.27), vec3(0.11, 0.085, 0.09), 0.012), float(M_PARCEL)));
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_STONE){ m = travertine(p); return true; }
  if (id == M_PARCEL){
    vec3 e = eSpace(p) - vec3(0.02, 0.165, 0.27);
    float tape = max(step(abs(e.x), 0.02), step(abs(e.z), 0.02)*step(abs(e.x), 0.2))*step(-0.07, e.y);
    m = mkMat(mix(vec3(0.45, 0.30, 0.17), vec3(0.8, 0.62, 0.35), tape), 0.0, 0.6);
    m.emit = mix(vec3(1.0, 0.55, 0.28)*0.55, vec3(1.0, 0.78, 0.5)*3.0, tape);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);

// ---------------------------------------------------------------- Virtual assistance: headset on a stack of leather notebooks, a desk clock beside
P("virtual-assistance", "digital-business-remote-careers", `
#define OBJ_C vec3(0.07, 0.5, 0.0)
#define OBJ_R 1.25
#define M_PAGES 30
#define M_LEATHER2 31
#define M_CUP 32
#define M_FACE 33
#define M_HAND 34
#define VA_S 1.3
vec3 vSp(vec3 p){ return rY(p, 0.3)/VA_S; }
const vec3 NB_O[3] = vec3[3](vec3(-0.12, 0.036, 0.0), vec3(-0.09, 0.108, 0.02), vec3(-0.13, 0.180, -0.01));
const float NB_A[3] = float[3](0.0, 0.12, -0.07);
vec3 clockSp(vec3 v){ return rY(v - vec3(0.44, 0.0, 0.14), -0.75); }
vec2 objMap(vec3 p){
  vec3 v = vSp(p);
  vec2 res = vec2(1e5, 0.0);
  for (int k = 0; k < 3; k++){
    vec3 b = rY(v - NB_O[k], NB_A[k]);
    res = opU(res, vec2(sdRoundBox(b - vec3(0.005, 0.0, 0.0), vec3(0.34, 0.027, 0.235), 0.004), float(M_PAGES)));
    vec3 ba = vec3(b.x, abs(b.y) - 0.031, b.z);
    float cov = min(sdRoundBox(ba, vec3(0.36, 0.005, 0.25), 0.004), sdRoundBox(b - vec3(-0.352, 0.0, 0.0), vec3(0.01, 0.035, 0.25), 0.006));
    res = opU(res, vec2(cov, k == 1 ? float(M_LEATHER2) : float(M_LEATHER)));
  }
  // headset lying on the stack
  vec3 h = rY(v - vec3(-0.12, 0.216, 0.0), 0.45);
  float band = h.y > 0.1 ? length(vec2(length(h.xy - vec2(0.0, 0.1)) - 0.215, h.z)) - 0.016 : 1e5;
  float pad = h.y > 0.26 ? length(vec2(length(h.xy - vec2(0.0, 0.1)) - 0.215, h.z)) - 0.027 : 1e5;
  vec3 ha = vec3(abs(h.x), h.y, h.z);
  float cup = sdRoundCyl(vec3(ha.y - 0.09, ha.x - 0.225, ha.z), 0.088, 0.028, 0.012);
  float cush = sdTorus(vec3(ha.y - 0.09, ha.x - 0.19, ha.z), vec2(0.066, 0.02));
  float boom = min(sdCapsule(h, vec3(-0.24, 0.07, 0.04), vec3(-0.22, 0.04, 0.17), 0.007), sdCapsule(h, vec3(-0.22, 0.04, 0.17), vec3(-0.14, 0.035, 0.24), 0.007));
  res = opU(res, vec2(min(band, boom), float(M_STEEL)));
  res = opU(res, vec2(min(pad, min(cush, length(h - vec3(-0.14, 0.035, 0.24)) - 0.018)), float(M_CUP)));
  res = opU(res, vec2(cup, float(M_ANODIZED)));
  // desk clock
  vec3 c = clockSp(v);
  float body = sdRoundCyl(vec3(c.x, c.z, c.y - 0.21), 0.17, 0.035, 0.01);
  float bez = sdTorus(vec3(c.x, c.z - 0.035, c.y - 0.21), vec2(0.165, 0.016));
  vec3 fa = vec3(abs(c.x) - 0.1, c.y - 0.03, c.z); float feet = length(fa) - 0.028;
  res = opU(res, vec2(min(bez, feet), float(M_BRASS)));
  res = opU(res, vec2(body, float(M_FACE)));
  vec2 cf = c.xy - vec2(0.0, 0.21);
  vec2 hm = rot(-0.85)*cf; vec2 hh = rot(0.95)*cf;
  float hands = min(extrude(sdRect2(hm - vec2(0.0, 0.055), vec2(0.004, 0.065), 0.003), c.z - 0.041, 0.003, 0.001),
                    extrude(sdRect2(hh - vec2(0.0, 0.035), vec2(0.006, 0.045), 0.003), c.z - 0.041, 0.003, 0.001));
  hands = min(hands, sdCyl(vec3(c.x, c.z - 0.04, c.y - 0.21), 0.01, 0.006));
  res = opU(res, vec2(hands, float(M_HAND)));
  res.x *= VA_S;
  return res;
}
bool sceneMat(int id, vec3 p, inout vec3 n, inout Mat m){
  if (id == M_PAGES){ m = mkMat(vec3(0.72, 0.66, 0.55)*(0.9 + 0.1*vnoise(p*vec3(3.0, 900.0, 3.0))), 0.0, 0.7); return true; }
  if (id == M_LEATHER2){ m = mkMat(vec3(0.035, 0.05, 0.04)*(0.85 + 0.3*vnoise(p*120.0)), 0.0, 0.45); return true; }
  if (id == M_CUP){ m = mkMat(vec3(0.02, 0.018, 0.017), 0.0, 0.6); return true; }
  if (id == M_HAND){ m = mkMat(vec3(0.03), 1.0, 0.3); return true; }
  if (id == M_FACE){
    vec3 c = clockSp(vSp(p)); vec2 cf = c.xy - vec2(0.0, 0.21); float r = length(cf);
    float a = atan(cf.y, cf.x); float tk = abs(mod(a + PI/12.0, PI/6.0) - PI/12.0)*r;
    float tick = step(tk, 0.006)*step(0.118, r)*step(r, 0.142)*step(0.03, c.z);
    if (c.z > 0.03) m = mkMat(mix(vec3(0.78, 0.74, 0.66), vec3(0.04), tick), 0.0, 0.3);
    else m = mkMat(vec3(0.03), 0.0, 0.4);
    return true;
  }
  return false;
}
float sceneGlassAtten(int id){ return 0.0; }
`);
})();
