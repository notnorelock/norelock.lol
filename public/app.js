// The whole site's behaviour. Plain DOM, no framework, no build step.

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const icon = (id, size, stroke = 2, cls = 'i') =>
  `<svg class="${cls}" width="${size}" height="${size}" stroke-width="${stroke}"><use href="#${id}"/></svg>`;

/* ---------- shared chrome ---------- */

$$('.year').forEach((el) => (el.textContent = new Date().getFullYear()));

const nav = $('.site-nav');
$('.mobile-menu-button')?.addEventListener('click', () => nav.classList.toggle('mobile-nav-open'));
nav?.addEventListener('click', (e) => e.target.closest('a') && nav.classList.remove('mobile-nav-open'));

const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    }
  },
  { threshold: 0.08, rootMargin: '0px 0px -48px' },
);
const observeReveal = (root = document) => $$('[data-reveal]:not(.is-visible)', root).forEach((el) => reveal.observe(el));
observeReveal();

document.addEventListener('pointermove', (e) => {
  const card = e.target.closest?.('.spotlight-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
}, { passive: true });

if (!matchMedia('(pointer: coarse)').matches) {
  const ring = $('.pointer-ring');
  const dot = $('.pointer-dot');
  const root = document.documentElement.style;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    root.setProperty('--mouse-x', `${x}px`);
    root.setProperty('--mouse-y', `${y}px`);
  }, { passive: true });
  const follow = () => {
    rx += (x - rx) * 0.13;
    ry += (y - ry) * 0.13;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(follow);
  };
  follow();
}

const progressBar = $('.scroll-progress');
const updateProgress = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.transform = `scaleX(${clamp(max > 0 ? scrollY / max : 0)})`;
};
updateProgress();
addEventListener('scroll', updateProgress, { passive: true });
addEventListener('resize', updateProgress, { passive: true });

/* ---------- WebGL: one fullscreen triangle per canvas ---------- */

function glProgram(host, frag, pixelRatio) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  host.appendChild(canvas);

  const cache = {};
  const u = (name) => (cache[name] ??= gl.getUniformLocation(prog, name));
  return {
    gl,
    canvas,
    u,
    resize(w, h) {
      canvas.width = Math.max(1, w * pixelRatio);
      canvas.height = Math.max(1, h * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uResolution'), canvas.width, canvas.height);
    },
    draw: () => gl.drawArrays(gl.TRIANGLES, 0, 3),
  };
}

const HASH = `float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float line(float v,float w){return 1.0-smoothstep(0.0,w,abs(v));}`;

const BACKDROP_FRAG = `precision highp float;
uniform vec2 uResolution;uniform vec2 uMouse;uniform float uTime;uniform float uScroll;uniform float uPointerSpeed;uniform float uAudio;
${HASH}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float v=0.0;float a=0.5;mat2 r=mat2(0.84,-0.54,0.54,0.84);
for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.03+13.7;a*=0.48;}return v;}
void main(){
vec2 frag=gl_FragCoord.xy;vec2 uv=frag/uResolution;vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);
vec2 p=(uv-0.5)*aspect;float t=uTime*0.11;p.y+=uScroll*0.000022;
vec2 mouse=(uMouse-0.5)*aspect;vec2 toMouse=p-mouse;float lens=exp(-5.8*dot(toMouse,toMouse));
p+=normalize(toMouse+0.0001)*lens*0.018*(0.25+uPointerSpeed*0.75);
float fog=fbm(p*1.18+vec2(t*0.72,-t));float detail=fbm(p*3.1-vec2(t*0.31,t*0.44));
vec2 oc=vec2(0.31,0.03);vec2 tc=p-oc;float radius=length(tc);float angle=atan(tc.y,tc.x);
vec2 md=mouse-oc;float ma=atan(md.y,md.x);float gap=abs(atan(sin(angle-ma),cos(angle-ma)));
float wake=exp(-3.4*gap*gap)*(0.35+uPointerSpeed*0.9);float pulse=uAudio;
float w1=sin(angle*5.0-t*2.4)*0.5+sin(angle*9.0+t*1.7)*0.28;
float w2=sin(angle*7.0+t*1.9)*0.5+sin(angle*3.0-t*2.8)*0.34;
float w3=sin(angle*4.0-t*1.5)*0.5+sin(angle*11.0+t*2.2)*0.22;
vec2 dir=tc/max(radius,0.0001);float drift=(fbm(dir*1.9+vec2(t*0.5,-t*0.35))-0.5)*2.0;
float amp=0.006+pulse*0.030;
float r1=radius-0.52-sin(t*1.3)*0.010-pulse*0.045-w1*amp-drift*0.010-wake*0.055;
float r2=radius-0.74-cos(t*0.8)*0.012-pulse*0.065-w2*amp*1.2-drift*0.013-wake*0.072;
float r3=radius-0.96-pulse*0.085-w3*amp*1.45-drift*0.016-wake*0.090;
float ring1=line(r1,0.0045+pulse*0.0055);float ring2=line(r2,0.0032+pulse*0.0042);float ring3=line(r3,0.0024+pulse*0.0030);
vec2 g=p*7.0;float grid=(line(fract(g.x)-0.5,0.006)+line(fract(g.y+t*0.22)-0.5,0.006))*0.5;
float sweepY=p.y+0.25+sin(p.x*2.8+t*2.0)*0.045;float beam=exp(-15.0*abs(sweepY));
float gr=step(0.989,hash21(vec2(floor(uv.y*92.0),floor(uTime*5.0))));
float gs=(hash21(vec2(floor(uv.y*92.0),9.0))-0.5)*0.07*gr;float gp=gr*(0.35+uPointerSpeed*0.65);
vec3 c=vec3(0.010,0.009,0.013);
c+=vec3(0.050,0.008,0.068)*pow(max(fog-0.42,0.0),1.8)*(1.35+pulse*0.5);
c+=vec3(0.11,0.014,0.16)*pow(max(detail-0.58,0.0),2.3)*0.74;
c+=vec3(0.26,0.035,0.33)*(1.0+pulse*1.5)*(ring1*0.18+ring2*0.10+ring3*0.055);
c+=vec3(0.15,0.024,0.19)*grid*0.09;c+=vec3(0.34,0.036,0.42)*beam*0.035;
c+=vec3(0.15,0.018,0.18)*lens*0.18;c+=vec3(0.18,0.02,0.21)*gp*abs(gs)*3.0;
c*=0.975+0.025*sin(frag.y*1.65+uTime*2.2);
c+=(hash21(frag+fract(uTime)*777.0)-0.5)*0.011;
float vig=smoothstep(1.34,0.20,length((uv-0.5)*vec2(0.82,1.0)));c*=0.48+vig*0.62;
gl_FragColor=vec4(c,1.0);}`;

const PORTRAIT_FRAG = `precision highp float;
uniform sampler2D uTexture;uniform vec2 uResolution;uniform vec2 uTextureResolution;uniform vec2 uMouse;uniform float uTime;uniform float uActivity;
varying vec2 vUv;
${HASH}
// The texture is sRGB; decode it so the grade matches the original linear pipeline.
vec3 tex(vec2 uv){return pow(texture2D(uTexture,uv).rgb,vec3(2.2));}
vec2 coverUv(vec2 uv,vec2 c,vec2 i){float rs=c.x/c.y;float ri=i.x/i.y;vec2 s=rs<ri?vec2(rs/ri,1.0):vec2(1.0,ri/rs);return (uv-0.5)*s+0.5;}
void main(){
vec2 uv=coverUv(vUv,uResolution,uTextureResolution);vec2 center=vUv-0.5;
float hf=smoothstep(0.72,0.0,distance(vUv,uMouse));uv+=center*hf*0.010*uActivity;
float row=floor(vUv.y*58.0);float rn=hash21(vec2(row,floor(uTime*7.0)));float hb=step(0.91,rn)*uActivity;
float bd=hash21(vec2(row,19.2))>0.5?1.0:-1.0;uv.x+=hb*bd*(0.006+rn*0.025);
float micro=step(0.978,hash21(vec2(floor(vUv.y*210.0),floor(uTime*19.0))))*uActivity;
uv.x+=micro*(hash21(vec2(row,3.2))-0.5)*0.026;
float ab=0.0011+uActivity*0.0016+hb*0.0065;
vec3 s=vec3(tex(uv+vec2(ab,0.0)).r,tex(uv).g,tex(uv-vec2(ab,0.0)).b);
s=pow(max(s,0.0),vec3(1.08));float luma=dot(s,vec3(0.299,0.587,0.114));
vec3 dark=s*vec3(0.52,0.42,0.60)*0.74;
vec3 duo=mix(vec3(0.012,0.006,0.018),vec3(0.39,0.085,0.47),smoothstep(0.12,0.90,luma));
vec3 c=mix(dark,duo,0.42);
float slice=step(0.987,hash21(vec2(floor(vUv.y*96.0),floor(uTime*9.0))))*uActivity;
c=mix(c,(1.0-s)*vec3(0.82,0.31,0.92),slice*0.48+hb*0.15);
c+=vec3(0.22,0.04,0.29)*hf*uActivity*0.11;
c*=0.92+0.08*sin(vUv.y*uResolution.y*1.35);
c+=(hash21(gl_FragCoord.xy+fract(uTime)*911.0)-0.5)*(0.025+uActivity*0.025);
float vig=smoothstep(0.77,0.20,length(center*vec2(0.88,1.0)));c*=0.46+vig*0.72;
c+=vec3(0.42,0.06,0.49)*line(vUv.y-fract(uTime*0.09),0.0015)*0.13;
gl_FragColor=vec4(c,1.0);}`;

/* ---------- audio level, read by the backdrop ---------- */

let analyser, freqData, audioContext;

function audioLevel() {
  if (!analyser || !player.playing) return 0;
  analyser.getByteFrequencyData(freqData);
  // Bass and low mids carry the pulse; the top end just adds noise here.
  let sum = 0;
  const bins = Math.min(24, freqData.length);
  for (let i = 0; i < bins; i += 1) sum += freqData[i];
  return Math.min(1, (sum / (bins * 255)) * 1.6);
}

/* ---------- backdrop ---------- */

const backdropHost = $('.shader-backdrop');
const backdrop = backdropHost && glProgram(backdropHost, BACKDROP_FRAG, Math.min(devicePixelRatio, 1.5));
if (backdrop) {
  const { gl, u } = backdrop;
  const mouse = [0.5, 0.5], target = [0.5, 0.5];
  let lastX = innerWidth / 2, lastY = innerHeight / 2, targetSpeed = 0, speed = 0, level = 0;
  const resize = () => backdrop.resize(innerWidth, innerHeight);
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', (e) => {
    target[0] = e.clientX / innerWidth;
    target[1] = 1 - e.clientY / innerHeight;
    targetSpeed = Math.min(1, Math.hypot(e.clientX - lastX, e.clientY - lastY) / 46);
    lastX = e.clientX;
    lastY = e.clientY;
  }, { passive: true });
  resize();
  const start = performance.now();
  const frame = (now) => {
    mouse[0] += (target[0] - mouse[0]) * 0.045;
    mouse[1] += (target[1] - mouse[1]) * 0.045;
    speed += (targetSpeed - speed) * 0.09;
    targetSpeed *= 0.91;
    // Rise fast on a transient, fall slowly, so the rings punch and settle.
    const l = reduced ? 0 : audioLevel();
    level += (l - level) * (l > level ? 0.35 : 0.06);
    gl.uniform1f(u('uTime'), reduced ? 0.4 : (now - start) / 1000);
    gl.uniform2f(u('uMouse'), mouse[0], mouse[1]);
    gl.uniform1f(u('uPointerSpeed'), speed);
    gl.uniform1f(u('uScroll'), scrollY);
    gl.uniform1f(u('uAudio'), level);
    backdrop.draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ---------- home page ---------- */

const ageEl = $('#age');
if (ageEl) {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 1, 18);
  const before = now < thisYear;
  const next = before ? thisYear : new Date(now.getFullYear() + 1, 1, 18);
  ageEl.textContent = now.getFullYear() - 2002 - (before ? 1 : 0);
  $('#days').textContent = Math.ceil((next - now) / 86_400_000);
}

const tabs = $$('[role="tab"]');
const selectTab = (tab) => {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  tab.focus();
};
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) selectTab(tabs[(i + step + tabs.length) % tabs.length]);
  });
});

const portraitHost = $('.glitch-portrait');
const portrait = portraitHost && glProgram(portraitHost, PORTRAIT_FRAG, Math.min(devicePixelRatio, 1.7));
if (portrait) {
  const { gl, u, canvas } = portrait;
  // Stays transparent over the fallback <img> until the texture is ready.
  canvas.style.opacity = 0;
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform2f(u('uTextureResolution'), img.width, img.height);
    canvas.style.opacity = 1;
  };
  img.src = '/assets/portrait.png';

  const resize = () => {
    const r = portraitHost.getBoundingClientRect();
    portrait.resize(r.width, r.height);
  };
  new ResizeObserver(resize).observe(portraitHost);
  resize();

  let hover = 0, activity = 0.16, visible = true, running = false;
  gl.uniform2f(u('uMouse'), 0.5, 0.5);
  portraitHost.addEventListener('pointermove', (e) => {
    const r = portraitHost.getBoundingClientRect();
    gl.uniform2f(u('uMouse'), clamp((e.clientX - r.left) / r.width), clamp(1 - (e.clientY - r.top) / r.height));
    hover = 1;
  }, { passive: true });
  portraitHost.addEventListener('pointerleave', () => (hover = 0), { passive: true });

  const start = performance.now();
  const frame = (now) => {
    if (!visible) return void (running = false);
    const t = (now - start) / 1000;
    const pulse = !reduced && Math.sin(t * 1.71) * Math.sin(t * 4.37) > 0.91 ? 0.52 : 0;
    activity += ((reduced ? 0.06 : 0.1 + hover * 0.42 + pulse) - activity) * 0.075;
    gl.uniform1f(u('uTime'), reduced ? 0 : t);
    gl.uniform1f(u('uActivity'), activity);
    portrait.draw();
    requestAnimationFrame(frame);
  };
  // No point shading a portrait nobody can see.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }).observe(portraitHost);
}

/* ---------- music page ---------- */

const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const formatCount = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));
const downloadHref = (track) => `/api/download?id=${encodeURIComponent(track.id)}`;

// Cover images swap their shimmer for the picture, or a fallback tile on error.
document.addEventListener('load', (e) => e.target.closest?.('.cover-art')?.setAttribute('data-state', 'ready'), true);
document.addEventListener('error', (e) => e.target.closest?.('.cover-art')?.setAttribute('data-state', 'error'), true);

const coverArt = (src, size, cls = '') =>
  `<div class="cover-art ${cls}" data-state="loading"><div class="cover-skeleton skeleton" aria-hidden="true"></div>` +
  `<div class="cover-fallback" aria-hidden="true">${icon('music', Math.round(size * 0.34), 1.3)}</div>` +
  `<img src="${esc(src)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async"></div>`;

/** Canvas waveform; eases toward its targets and parks once settled. */
class Waveform {
  constructor(host, peaks, onSeek) {
    this.peaks = peaks;
    this.pending = !peaks.length;
    this.progress = this.drawnProgress = this.drawnHover = this.drawnActive = 0;
    this.hover = 0;
    this.active = false;
    this.width = this.height = 0;
    this.frame = 0;

    const el = (this.el = document.createElement('div'));
    el.className = `waveform${this.pending ? ' is-pending' : ''}`;
    if (this.pending) el.setAttribute('aria-busy', 'true');
    else {
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', 'Seek');
    }
    el.setAttribute('aria-valuemin', 0);
    el.setAttribute('aria-valuemax', 100);
    el.setAttribute('aria-valuenow', 0);
    this.canvas = el.appendChild(document.createElement('canvas'));
    host.appendChild(el);

    const ratio = (e) => {
      const r = el.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width);
    };
    if (!this.pending) {
      el.addEventListener('pointermove', (e) => { this.hover = ratio(e); this.animate(); });
      el.addEventListener('pointerleave', () => { this.hover = 0; this.animate(); });
      el.addEventListener('click', (e) => onSeek(ratio(e)));
    }
    new ResizeObserver(([entry]) => {
      ({ width: this.width, height: this.height } = entry.contentRect);
      this.animate();
    }).observe(el);
  }

  set(progress, active) {
    if (progress === this.progress && active === this.active) return;
    this.progress = progress;
    this.active = active;
    this.el.classList.toggle('is-active', active);
    this.el.setAttribute('aria-valuenow', Math.round(progress * 100));
    this.animate();
  }

  animate() {
    // Tracks without peaks get an empty, inert waveform, as before.
    if (!this.width || this.pending) return;
    if (reduced) {
      this.drawnProgress = this.progress;
      this.drawnHover = this.hover;
      this.drawnActive = +this.active;
      return this.draw();
    }
    if (this.frame) return;
    let last = performance.now(), idle = 0;
    const tick = (now) => {
      // Rates are tuned for 60fps and scaled by frame time.
      const step = clamp((now - last) / 16.7, 0.2, 3);
      last = now;
      const before = this.drawnProgress + this.drawnHover + this.drawnActive;
      const gap = Math.abs(this.progress - this.drawnProgress);
      this.drawnProgress += (this.progress - this.drawnProgress) * Math.min(1, (gap > 0.12 ? 0.28 : 0.12) * step);
      this.drawnHover += (this.hover - this.drawnHover) * Math.min(1, 0.22 * step);
      this.drawnActive += (+this.active - this.drawnActive) * Math.min(1, 0.1 * step);
      const settled = Math.abs(before - (this.drawnProgress + this.drawnHover + this.drawnActive)) < 0.0006;
      idle = settled ? idle + 1 : 0;
      this.draw();
      this.frame = idle < 4 ? requestAnimationFrame(tick) : 0;
    };
    this.frame = requestAnimationFrame(tick);
  }

  draw() {
    const { width, height, canvas, peaks } = this;
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const slots = Math.max(1, Math.floor(width / 4));
    const played = this.drawnProgress * slots;
    const hovered = this.drawnHover * slots;
    const mix = (a, b, t) => `rgba(${a.map((v, k) => (k < 3 ? Math.round(v + (b[k] - v) * t) : v + (b[k] - v) * t)).join(',')})`;
    const PLAYED = [220, 123, 231, 1], HOVER = [233, 163, 242, 1], REST = [255, 255, 255, 0.17], REST_ON = [255, 255, 255, 0.26];
    const base = mix(REST, REST_ON, this.drawnActive);
    const hoverFill = mix(REST, HOVER, 0.55);

    for (let i = 0; i < slots; i += 1) {
      const peak = peaks[Math.floor((i / slots) * peaks.length)] ?? 0;
      // Bars around the playhead lift slightly, so it reads as a soft crest.
      const lift = Math.max(0, 1 - Math.abs(i - played) / 5) * 0.14 * this.drawnActive;
      const h = Math.max(2, peak * height * (1 + lift));
      // Feather the played edge across one bar so it slides instead of steps.
      const edge = clamp(played - i);
      ctx.fillStyle = edge >= 1 ? '#dc7be7' : edge > 0 ? mix(PLAYED, REST, 1 - edge) : i < hovered ? hoverFill : base;
      ctx.fillRect(i * 4, (height - h) / 2, 3, h);
    }
  }
}

/* ---------- player: one <audio> drives every row and the docked bar ---------- */

const player = {
  current: undefined,
  queue: [],
  playing: false,
  loading: false,
  failed: false,
  position: 0,
  duration: 0,
};
let audio, hls, consecutiveErrors = 0, tracking = 0;
const rows = new Map();

const queueIndex = () => (player.current ? player.queue.findIndex((t) => t.id === player.current.id) : -1);
const hasNext = () => queueIndex() >= 0 && queueIndex() + 1 < player.queue.length;

function playNext() {
  const next = player.queue[queueIndex() + 1];
  if (queueIndex() < 0 || !next) return false;
  play(next, player.queue);
  return true;
}

function element() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = 0.8;
  const set = (patch) => (Object.assign(player, patch), sync());
  // timeupdate fires ~4x a second, which stutters; poll on rAF while playing.
  const track = () => {
    player.position = audio.currentTime;
    syncPosition();
    tracking = requestAnimationFrame(track);
  };
  const stopTracking = () => (cancelAnimationFrame(tracking), (tracking = 0));
  audio.addEventListener('durationchange', () => Number.isFinite(audio.duration) && set({ duration: audio.duration }));
  audio.addEventListener('playing', () => {
    consecutiveErrors = 0;
    set({ playing: true, loading: false, failed: false });
    if (!tracking) track();
  });
  audio.addEventListener('pause', () => (stopTracking(), set({ playing: false })));
  audio.addEventListener('waiting', () => set({ loading: true }));
  audio.addEventListener('ended', () => {
    stopTracking();
    player.position = 0;
    if (!playNext()) set({ playing: false });
  });
  audio.addEventListener('error', () => {
    stopTracking();
    set({ loading: false, failed: true });
    // Skip a file that will not load, but stop if the whole queue is bad.
    consecutiveErrors += 1;
    if (consecutiveErrors > 3 || !playNext()) {
      consecutiveErrors = 0;
      set({ playing: false });
    }
  });
  return audio;
}

/** Prefers the HLS stream the build cut; falls back to the mp3 endpoint. */
async function attach(el, track) {
  hls?.destroy();
  hls = undefined;
  const playlist = ['/music', ...(track.album ? [track.album] : []), `${track.id}.m3u8`].join('/');
  const file = `/api/download?id=${encodeURIComponent(track.id)}&inline=1`;
  if (el.canPlayType('application/vnd.apple.mpegurl')) return void (el.src = playlist);
  try {
    // shortcut: hls.js is copied in at build time and only loaded on first play without native HLS.
    window.Hls ?? await new Promise((ok, fail) => document.head.append(Object.assign(document.createElement('script'), { src: '/hls.js', onload: ok, onerror: fail })));
    const Hls = window.Hls;
    if (!Hls.isSupported()) return void (el.src = file);
    const instance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, enableWorker: true });
    instance.on(Hls.Events.ERROR, (_e, data) => {
      // A missing playlist means the build did not segment this track.
      if (!data.fatal) return;
      instance.destroy();
      hls = undefined;
      el.src = file;
    });
    instance.loadSource(playlist);
    instance.attachMedia(el);
    hls = instance;
  } catch {
    el.src = file;
  }
}

async function play(track, list) {
  const el = element();
  if (list) player.queue = list;
  else if (queueIndex() < 0) player.queue = [track];

  if (player.current?.id !== track.id) {
    Object.assign(player, { current: track, position: 0, failed: false, duration: track.duration, loading: true });
    syncBarTrack();
    sync();
    await attach(el, track);
  }

  // Created on the first play: an AudioContext made before a gesture starts suspended.
  if (!analyser && window.AudioContext) {
    try {
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(el);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    } catch {
      analyser = undefined;
    }
  }
  audioContext?.resume();

  try {
    await el.play();
  } catch {
    Object.assign(player, { loading: false, playing: false });
    sync();
  }
}

const toggle = (track, list) => (player.current?.id === track.id && player.playing ? element().pause() : play(track, list));

function seek(seconds) {
  if (!player.duration) return;
  const el = element();
  el.currentTime = clamp(seconds, 0, player.duration);
  player.position = el.currentTime;
  syncPosition();
}

function previous() {
  // Restart the track first, the way every other player behaves.
  const prev = player.queue[queueIndex() - 1];
  if (player.position > 3 || queueIndex() <= 0) seek(0);
  else play(prev, player.queue);
}

function stop() {
  const el = element();
  hls?.destroy();
  hls = undefined;
  el.pause();
  el.removeAttribute('src');
  el.load();
  Object.assign(player, { current: undefined, queue: [], playing: false, position: 0 });
  sync();
}

/* ---------- player UI ---------- */

const bar = $('.player-bar');
let barWave;

function syncBarTrack() {
  const track = player.current;
  if (!bar || !track) return;
  const cover = $('.cover-art', bar);
  cover.dataset.state = 'loading';
  $('img', cover).src = track.cover;
  $('.player-title strong', bar).textContent = track.title;
  $('.player-download', bar).href = downloadHref(track);
  const host = $('.player-wave', bar);
  host.textContent = '';
  barWave = new Waveform(host, track.peaks, (r) => seek(r * player.duration));
}

const total = () => player.duration || player.current?.duration || 0;

function syncPosition() {
  const cur = player.current && rows.get(player.current.id);
  const progress = total() ? player.position / total() : 0;
  if (cur) {
    cur.time.textContent = `${formatTime(player.position)} / ${formatTime(total())}`;
    cur.wave.set(progress, true);
  }
  if (bar && player.current) {
    $('[data-pos]', bar).textContent = formatTime(player.position);
    $('[data-total]', bar).textContent = formatTime(total());
    $('[data-act="prev"]', bar).disabled = queueIndex() <= 0 && player.position < 3;
    barWave?.set(progress, true);
  }
}

function sync() {
  for (const [id, row] of rows) {
    const isCurrent = player.current?.id === id;
    const isPlaying = isCurrent && player.playing;
    row.el.classList.toggle('is-current', isCurrent);
    row.btn.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} ${row.track.title}`);
    row.btn.innerHTML = isCurrent && player.loading
      ? icon('loader-2', 20, 2, 'i track-spin')
      : icon(isPlaying ? 'player-pause' : 'player-play', 19);
    row.error.hidden = !(isCurrent && player.failed);
    if (!isCurrent) {
      row.time.textContent = `0:00 / ${formatTime(row.track.duration)}`;
      row.wave.set(0, false);
    }
  }
  document.querySelector('.site-root').classList.toggle('has-player', !!player.current);
  if (bar) {
    bar.hidden = !player.current;
    const btn = $('[data-act="toggle"]', bar);
    btn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
    $('use', btn).setAttribute('href', player.playing ? '#player-pause' : '#player-play');
    $('[data-act="next"]', bar).disabled = !hasNext();
  }
  syncPosition();
}

bar?.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'prev') previous();
  else if (act === 'toggle') toggle(player.current);
  else if (act === 'next') playNext();
  else if (act === 'close') stop();
  else if (e.target.closest('.player-download')) noteDownload(player.current);
});
bar && $('input[type="range"]', bar).addEventListener('input', (e) => (element().volume = clamp(+e.target.value)));

addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !player.current) return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggle(player.current);
  } else if (e.code === 'ArrowRight') {
    // Shift jumps tracks; plain arrows scrub.
    e.shiftKey ? playNext() : seek(player.position + 5);
  } else if (e.code === 'ArrowLeft') {
    e.shiftKey ? previous() : seek(player.position - 5);
  }
});

/* ---------- downloads ---------- */

let counts = {};
const paintCounts = () =>
  $$('.track-downloads').forEach((el) => (el.textContent = formatCount(counts[el.dataset.id] ?? 0)));

async function loadCounts() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
    const body = await res.json();
    if (body.status && body.status !== 'ok') console.warn(`[downloads] stats unavailable: ${body.status}`, body.message ?? '');
    if (body.counts) counts = body.counts;
    paintCounts();
  } catch {
    // No backend; counts stay at zero.
  }
}

/** Optimistic bump, then re-read: the server may reject the hit (cooldown, VPN). */
function noteDownload(track) {
  counts[track.id] = (counts[track.id] ?? 0) + 1;
  paintCounts();
  setTimeout(loadCounts, 1500);
}

/* ---------- catalogue ---------- */

/** Albums first, newest to oldest, then the leftovers as singles. */
function groupReleases(list) {
  const albums = new Map();
  const singles = [];
  for (const track of list) {
    if (!track.album) {
      singles.push(track);
      continue;
    }
    const album = albums.get(track.album);
    if (album) {
      album.tracks.push(track);
      album.year = Math.max(album.year, track.year);
    } else {
      albums.set(track.album, { album: track.album, title: track.albumTitle ?? track.album, year: track.year, cover: track.cover, tracks: [track] });
    }
  }
  const grouped = [...albums.values()].sort((a, b) => b.year - a.year);
  for (const album of grouped) album.tracks.sort((a, b) => (a.trackNo ?? 99) - (b.trackNo ?? 99));
  if (singles.length) {
    grouped.push({
      title: singles.length === list.length ? 'tracks' : 'singles',
      year: Math.max(...singles.map((t) => t.year)),
      cover: singles[0].cover,
      tracks: singles,
    });
  }
  return grouped;
}

function renderRelease(release) {
  const isAlbum = !!release.album;
  const runtime = release.tracks.reduce((sum, t) => sum + t.duration, 0);
  const n = release.tracks.length;
  const section = document.createElement('section');
  section.className = 'release';
  section.dataset.reveal = '';
  section.innerHTML =
    `<header class="release-head">${isAlbum ? `<div class="release-cover">${coverArt(release.cover, 112)}</div>` : ''}` +
    `<div class="release-meta"><span class="release-kind">${isAlbum ? 'album' : 'singles'}</span><h2>${esc(release.title)}</h2>` +
    `<p>${release.year} · ${n} ${n === 1 ? 'track' : 'tracks'} · ${formatTime(runtime)}</p></div>` +
    `<button type="button" class="release-play">${icon('player-play', 15)} play ${isAlbum ? 'album' : 'all'}</button></header>` +
    `<div class="track-list"></div>`;
  $('.release-play', section).onclick = () => play(release.tracks[0], release.tracks);

  const list = $('.track-list', section);
  for (const track of release.tracks) {
    const el = document.createElement('article');
    el.className = 'track-row';
    el.innerHTML =
      `<div class="track-cover">${coverArt(track.cover, 72)}<button type="button" class="track-play"></button></div>` +
      `<div class="track-body"><div class="track-head"><div class="track-title"><h3>${esc(track.title)}</h3>` +
      (track.subtitle ? `<span>${esc(track.subtitle)}</span>` : '') +
      `</div><div class="track-meta"><span>${track.year}</span><span class="track-time"></span></div></div>` +
      `<p class="track-error" hidden>couldn't load this one. the file might not be uploaded yet.</p></div>` +
      (track.downloadable !== false
        ? `<a class="track-download" href="${downloadHref(track)}" aria-label="Download ${esc(track.title)} as MP3" target="_self" rel="external">${icon('download', 17, 1.6)}<span class="track-downloads" data-id="${esc(track.id)}">0</span></a>`
        : '');
    const body = $('.track-body', el);
    const wave = new Waveform(body, track.peaks, async (ratio) => {
      if (player.current?.id !== track.id) await play(track, release.tracks);
      seek(ratio * player.duration);
    });
    body.insertBefore(wave.el, $('.track-error', el));
    const btn = $('.track-play', el);
    btn.onclick = () => toggle(track, release.tracks);
    $('.track-download', el)?.addEventListener('click', () => noteDownload(track));
    rows.set(track.id, { el, track, btn, wave, time: $('.track-time', el), error: $('.track-error', el) });
    list.append(el);
  }
  return section;
}

const releasesHost = $('#releases');
if (releasesHost) {
  loadCounts();
  (async () => {
    let tracks = [], failed = false;
    try {
      const res = await fetch('/api/tracks');
      // Without Vercel routing in front, this can fall through to HTML.
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) failed = true;
      else tracks = (await res.json()).tracks ?? [];
    } catch {
      failed = true;
    }
    const releases = groupReleases(tracks);
    if (!releases.length) {
      releasesHost.innerHTML = `<p class="music-empty">${failed ? "couldn't load the tracks. try a refresh?" : 'nothing here yet.'}</p>`;
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'release-list';
    wrap.append(...releases.map(renderRelease));
    releasesHost.replaceChildren(wrap);
    paintCounts();
    sync();
    observeReveal(releasesHost);
  })();
}
