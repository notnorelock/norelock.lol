import { onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import { bootStep } from '@/lib/boot';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uTextureResolution;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uActivity;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 coverUv(vec2 uv, vec2 canvas, vec2 image) {
    float rs = canvas.x / canvas.y;
    float ri = image.x / image.y;
    vec2 scale = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
    return (uv - 0.5) * scale + 0.5;
  }

  float line(float value, float width) {
    return 1.0 - smoothstep(0.0, width, abs(value));
  }

  void main() {
    vec2 uv = coverUv(vUv, uResolution, uTextureResolution);
    vec2 center = vUv - 0.5;

    float hoverField = smoothstep(0.72, 0.0, distance(vUv, uMouse));
    uv += center * hoverField * 0.010 * uActivity;

    float row = floor(vUv.y * 58.0);
    float rowNoise = hash21(vec2(row, floor(uTime * 7.0)));
    float hardBand = step(0.91, rowNoise) * uActivity;
    float bandDirection = hash21(vec2(row, 19.2)) > 0.5 ? 1.0 : -1.0;
    uv.x += hardBand * bandDirection * (0.006 + rowNoise * 0.025);

    float micro = step(0.978, hash21(vec2(floor(vUv.y * 210.0), floor(uTime * 19.0)))) * uActivity;
    uv.x += micro * (hash21(vec2(row, 3.2)) - 0.5) * 0.026;

    float aberration = 0.0011 + uActivity * 0.0016 + hardBand * 0.0065;
    vec3 source;
    source.r = texture2D(uTexture, uv + vec2(aberration, 0.0)).r;
    source.g = texture2D(uTexture, uv).g;
    source.b = texture2D(uTexture, uv - vec2(aberration, 0.0)).b;

    source = pow(max(source, 0.0), vec3(1.08));
    float luma = dot(source, vec3(0.299, 0.587, 0.114));

    vec3 darkBase = source * vec3(0.52, 0.42, 0.60);
    darkBase *= 0.74;
    vec3 duotone = mix(vec3(0.012, 0.006, 0.018), vec3(0.39, 0.085, 0.47), smoothstep(0.12, 0.90, luma));
    vec3 color = mix(darkBase, duotone, 0.42);

    float slice = step(0.987, hash21(vec2(floor(vUv.y * 96.0), floor(uTime * 9.0)))) * uActivity;
    vec3 negative = 1.0 - source;
    vec3 negativeTint = negative * vec3(0.82, 0.31, 0.92);
    color = mix(color, negativeTint, slice * 0.48 + hardBand * 0.15);

    float mouseFlash = hoverField * uActivity * 0.11;
    color += vec3(0.22, 0.04, 0.29) * mouseFlash;

    float scan = 0.92 + 0.08 * sin(vUv.y * uResolution.y * 1.35);
    color *= scan;

    float grain = hash21(gl_FragCoord.xy + fract(uTime) * 911.0) - 0.5;
    color += grain * (0.025 + uActivity * 0.025);

    float vignette = smoothstep(0.77, 0.20, length(center * vec2(0.88, 1.0)));
    color *= 0.46 + vignette * 0.72;

    float edgeSignal = line(vUv.y - fract(uTime * 0.09), 0.0015);
    color += vec3(0.42, 0.06, 0.49) * edgeSignal * 0.13;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function GlitchPortrait() {
  let host!: HTMLDivElement;

  onMount(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const uniforms = {
      uTexture: { value: new THREE.Texture() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTextureResolution: { value: new THREE.Vector2(750, 750) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uActivity: { value: 0.16 },
    };

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthWrite: false, depthTest: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(plane);

    new THREE.TextureLoader().load(
      '/assets/portrait.png',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        uniforms.uTexture.value = texture;
        uniforms.uTextureResolution.value.set(texture.image.width, texture.image.height);
        bootStep('portrait');
      },
      undefined,
      // A missing portrait must not hold the loading screen hostage.
      () => bootStep('portrait'),
    );

    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
      uniforms.uResolution.value.set(rect.width * renderer.getPixelRatio(), rect.height * renderer.getPixelRatio());
    };

    let hover = 0;
    const pointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      uniforms.uMouse.value.set(
        THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1),
        THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
      );
      hover = 1;
    };
    const leave = () => { hover = 0; };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener('pointermove', pointer, { passive: true });
    host.addEventListener('pointerleave', leave, { passive: true });
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = reduced ? 0.0 : t;
      const pulse = !reduced && Math.sin(t * 1.71) * Math.sin(t * 4.37) > 0.91 ? 0.52 : 0;
      const target = reduced ? 0.06 : 0.10 + hover * 0.42 + pulse;
      uniforms.uActivity.value += (target - uniforms.uActivity.value) * 0.075;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', pointer);
      host.removeEventListener('pointerleave', leave);
      const texture = uniforms.uTexture.value;
      if (texture instanceof THREE.Texture) texture.dispose();
      plane.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  });

  return (
    <div ref={host} class="glitch-portrait" aria-label="Norelock portrait with realtime WebGL glitch processing">
      <img src="/assets/portrait.png" class="glitch-portrait__fallback" />
    </div>
  );
}
