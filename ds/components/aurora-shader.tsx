'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { useEffect, useRef, type MutableRefObject } from 'react';

/*
 * A real aurora on the GPU: three curtains of light, each with a sharp bright
 * lower edge and a long fade upward, striated by fine vertical rays. Curtains
 * are shaped by fbm noise, bend toward the cursor, and brighten with scroll.
 * One full-screen triangle, one draw call. Tone-mapped (no clipped highlights)
 * and dithered (no banding) so every gradient stays soft.
 */
const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec2 u_mouse;     // 0..1, smoothed
uniform float u_power;    // scroll-driven intensity
uniform float u_light;    // 0 dark theme, 1 light theme
uniform vec3 u_core;      // curtain colours by height: core -> mid -> edge
uniform vec3 u_mid;
uniform vec3 u_edge;
uniform vec3 u_haze;      // horizon haze
uniform vec3 u_paper;     // light-theme ground
uniform float u_gain;     // overall brightness for this palette

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

vec3 curtain(vec2 uv, float asp, float seed, float height, float t){
  float x = uv.x * asp;
  // where the curtain's lower edge sits: slow noise + a drift + a pull toward the cursor
  float edge = height
    + (fbm(vec2(x * 0.55 + seed, t * 0.06 + seed)) - 0.5) * 0.42
    + sin(x * 1.3 + t * 0.25 + seed * 2.0) * 0.03;
  float mx = u_mouse.x * asp;
  edge += exp(-pow((x - mx) * 1.6, 2.0)) * (u_mouse.y - 0.5) * 0.14;

  float d = uv.y - edge;                                 // >0 above the edge
  float base = smoothstep(-0.018, 0.004, d);             // crisp bottom edge
  float body = exp(-max(d, 0.0) * (3.2 + seed * 0.4));   // long upward fade
  // vertical rays: high frequency across x, slow shimmer in time, sharpened
  float rays = noise(vec2(x * 38.0 + seed * 9.0, t * 0.35 + d * 1.5));
  rays = 0.35 + 0.9 * pow(rays, 2.2);
  float glow = base * body * rays;

  // colour by height above the edge: peach-white core -> amber -> ember -> gone
  vec3 col = mix(u_core, u_mid, smoothstep(0.0, 0.10, d));
  col = mix(col, u_edge, smoothstep(0.10, 0.34, d));
  return col * glow;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float asp = u_res.x / u_res.y;
  float t = u_t;

  vec3 light = vec3(0.0);
  light += curtain(uv, asp, 0.0, 0.22, t) * 1.0;
  light += curtain(uv, asp, 3.7, 0.34, t * 0.85) * 0.6;
  light += curtain(uv, asp, 7.3, 0.13, t * 1.15) * 0.45;
  // low haze along the horizon so the curtains sit in atmosphere, not on black glass
  light += u_haze * exp(-uv.y * 5.0) * 0.35;
  light *= u_power * u_gain;

  // soft tone-map: highlights roll off instead of clipping
  vec3 dark = 1.0 - exp(-light * 1.35);
  vec3 paper = u_paper;
  // light theme: keep the aurora's own hue (peach -> amber -> ember) and lay it on paper
  float peak = max(max(light.r, light.g), max(light.b, 1e-3));
  vec3 hue = light / peak;
  float amt = 1.0 - exp(-peak * 0.85);
  vec3 lit = mix(paper, hue * vec3(0.98, 0.72, 0.62), amt * 0.8);
  vec3 col = mix(dark, lit, u_light);

  // vignette + dither
  vec2 v = uv - vec2(0.5, 0.45);
  col *= mix(1.0 - dot(v, v) * 0.6, 1.0, u_light * 0.7);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`;

export type AuroraPalette = { core: RGB; mid: RGB; edge: RGB; haze: RGB; paper: RGB; gain: number };
type RGB = [number, number, number];

/** Cryonix: peach-white cores, amber, ember. */
export const CRYONIX_AURORA: AuroraPalette = {
  core: [1.0, 0.8, 0.7],
  mid: [0.99, 0.43, 0.02],
  edge: [0.83, 0.16, 0.0],
  haze: [0.55, 0.12, 0.02],
  paper: [0.98, 0.969, 0.961],
  gain: 1,
};

export type AuroraShaderProps = {
  palette?: AuroraPalette;
  /** Scroll-driven intensity, written by the page's scroll timeline (1 = default). */
  power?: MutableRefObject<number>;
  className?: string;
};

export function AuroraShader({ power, palette = CRYONIX_AURORA, className }: AuroraShaderProps) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    // Each run draws on a canvas of its own. Cleanup loses the GL context for
    // good, and a canvas hands back that same lost context forever, so reusing
    // one (React Strict Mode runs effects twice in dev) painted a dead, white
    // canvas.
    const cv = document.createElement('canvas');
    cv.style.cssText = 'display:block;width:100%;height:100%';
    box.appendChild(cv);
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', premultipliedAlpha: false });
    if (!gl) {
      box.dataset.fallback = 'true'; // CSS shows the static aurora instead
      return () => {
        cv.remove();
        delete box.dataset.fallback;
      };
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // full-screen triangle, no seam
    const aP = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('u_res'), uT = u('u_t'), uMouse = u('u_mouse'), uPower = u('u_power'), uLight = u('u_light');
    gl.uniform3fv(u('u_core'), palette.core);
    gl.uniform3fv(u('u_mid'), palette.mid);
    gl.uniform3fv(u('u_edge'), palette.edge);
    gl.uniform3fv(u('u_haze'), palette.haze);
    gl.uniform3fv(u('u_paper'), palette.paper);
    gl.uniform1f(u('u_gain'), palette.gain);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = { x: 0.5, y: 0.45 };
    const mouse = { x: 0.5, y: 0.45 };
    let light = document.documentElement.dataset.theme === 'light' ? 1 : 0;
    let visible = true;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75); // fill-rate bound: cap DPR
      const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, cv.width, cv.height);
    };
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = 1 - (e.clientY - r.top) / r.height;
    };
    const draw = (now: number) => {
      resize();
      // ease everything: mouse and theme glide rather than jump
      mouse.x += (target.x - mouse.x) * 0.045;
      mouse.y += (target.y - mouse.y) * 0.045;
      const wantLight = document.documentElement.dataset.theme === 'light' ? 1 : 0;
      light += (wantLight - light) * 0.08;
      gl.uniform1f(uT, reduced ? 18 : (now - t0) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uPower, power?.current ?? 1);
      gl.uniform1f(uLight, light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      draw(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced) draw(performance.now());
      else raf = requestAnimationFrame(loop);
    };

    // pause when off-screen or the tab is hidden
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(cv);
    const onVis = () => !document.hidden && visible && start();
    document.addEventListener('visibilitychange', onVis);
    // reduced motion: still redraw once when the theme changes
    const mo = new MutationObserver(() => reduced && setTimeout(() => draw(performance.now()), 30));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', start);
    start();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', start);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      cv.remove();
    };
  }, [power, palette]);

  return <div ref={host} className={className} aria-hidden="true" />;
}
