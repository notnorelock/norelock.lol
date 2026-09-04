import { onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import { bootStep } from '@/lib/boot';

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uScroll;
  uniform float uPointerSpeed;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.84, -0.54, 0.54, 0.84);
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p = rot * p * 2.03 + 13.7;
      amp *= 0.48;
    }
    return value;
  }

  float line(float value, float width) {
    return 1.0 - smoothstep(0.0, width, abs(value));
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / uResolution;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect;
    float t = uTime * 0.11;

    p.y += uScroll * 0.000022;

    vec2 mouse = (uMouse - 0.5) * aspect;
    vec2 toMouse = p - mouse;
    float lens = exp(-5.8 * dot(toMouse, toMouse));
    p += normalize(toMouse + 0.0001) * lens * 0.018 * (0.25 + uPointerSpeed * 0.75);

    float fog = fbm(p * 1.18 + vec2(t * 0.72, -t));
    float detail = fbm(p * 3.1 - vec2(t * 0.31, t * 0.44));

    vec2 orbitCenter = vec2(0.31, 0.03);
    float radius = length(p - orbitCenter);
    float ring1 = line(radius - 0.52 - sin(t * 1.3) * 0.010, 0.0045);
    float ring2 = line(radius - 0.74 - cos(t * 0.8) * 0.012, 0.0032);
    float ring3 = line(radius - 0.96, 0.0024);

    vec2 gridUv = p * 7.0;
    float gx = line(fract(gridUv.x) - 0.5, 0.006);
    float gy = line(fract(gridUv.y + t * 0.22) - 0.5, 0.006);
    float grid = (gx + gy) * 0.5;

    float sweepY = p.y + 0.25 + sin(p.x * 2.8 + t * 2.0) * 0.045;
    float beam = exp(-15.0 * abs(sweepY));

    float glitchRow = step(0.989, hash21(vec2(floor(uv.y * 92.0), floor(uTime * 5.0))));
    float glitchShift = (hash21(vec2(floor(uv.y * 92.0), 9.0)) - 0.5) * 0.07 * glitchRow;
    float glitchPulse = glitchRow * (0.35 + uPointerSpeed * 0.65);

    vec3 color = vec3(0.010, 0.009, 0.013);
    color += vec3(0.050, 0.008, 0.068) * pow(max(fog - 0.42, 0.0), 1.8) * 1.35;
    color += vec3(0.11, 0.014, 0.16) * pow(max(detail - 0.58, 0.0), 2.3) * 0.74;
    color += vec3(0.26, 0.035, 0.33) * (ring1 * 0.18 + ring2 * 0.10 + ring3 * 0.055);
    color += vec3(0.15, 0.024, 0.19) * grid * 0.09;
    color += vec3(0.34, 0.036, 0.42) * beam * 0.035;
    color += vec3(0.15, 0.018, 0.18) * lens * 0.18;
    color += vec3(0.18, 0.02, 0.21) * glitchPulse * abs(glitchShift) * 3.0;

    float scan = 0.975 + 0.025 * sin(frag.y * 1.65 + uTime * 2.2);
    color *= scan;

    float grain = hash21(frag + fract(uTime) * 777.0) - 0.5;
    color += grain * 0.011;

    float vignette = smoothstep(1.34, 0.20, length((uv - 0.5) * vec2(0.82, 1.0)));
    color *= 0.48 + vignette * 0.62;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function ShaderBackdrop() {
  let host!: HTMLDivElement;

  onMount(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPointerSpeed: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(plane);

    const targetMouse = new THREE.Vector2(0.5, 0.5);
    let lastX = window.innerWidth * 0.5;
    let lastY = window.innerHeight * 0.5;
    let targetSpeed = 0;

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      uniforms.uResolution.value.set(
        window.innerWidth * renderer.getPixelRatio(),
        window.innerHeight * renderer.getPixelRatio(),
      );
    };

    const pointer = (event: PointerEvent) => {
      targetMouse.set(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      targetSpeed = Math.min(1, Math.hypot(dx, dy) / 46);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const scroll = () => {
      uniforms.uScroll.value = window.scrollY;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    resize();
    scroll();

    const clock = new THREE.Clock();
    let frame = 0;

    const animate = () => {
      uniforms.uTime.value = reducedMotion ? 0.4 : clock.getElapsedTime();
      uniforms.uMouse.value.lerp(targetMouse, 0.045);
      uniforms.uPointerSpeed.value += (targetSpeed - uniforms.uPointerSpeed.value) * 0.09;
      targetSpeed *= 0.91;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    animate();
    bootStep('backdrop');

    onCleanup(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('scroll', scroll);
      plane.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  });

  return <div ref={host} class="shader-backdrop" aria-hidden="true" />;
}
