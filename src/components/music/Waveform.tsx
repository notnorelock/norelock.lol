import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';

interface Props {
  peaks: number[];
  /** 0..1 played portion. */
  progress: number;
  onSeek?: (ratio: number) => void;
  active?: boolean;
  /** Draws a muted shimmering bar field instead of the real peaks. */
  pending?: boolean;
}

const PLAYED = '#dc7be7';
const PENDING = 'rgba(255,255,255,0.09)';
const PENDING_SWEEP = 'rgba(220,123,231,0.30)';

/** Frames the canvas keeps drawing after everything settles, so eases finish. */
const SETTLE_FRAMES = 4;

/** Blends two rgb/rgba colours; `t` of 0 returns `a`. */
function mix(a: number[], b: number[], t: number) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  const al = a[3] + (b[3] - a[3]) * t;
  return `rgba(${r},${g},${bl},${al})`;
}

const RGB = {
  played: [220, 123, 231, 1],
  playedHover: [233, 163, 242, 1],
  remaining: [255, 255, 255, 0.17],
  remainingActive: [255, 255, 255, 0.26],
};

export function Waveform(props: Props) {
  let canvas!: HTMLCanvasElement;
  let host!: HTMLDivElement;
  const [hover, setHover] = createSignal<number | undefined>();
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const [phase, setPhase] = createSignal(0);

  // Values the canvas eases toward, kept outside the reactive graph so the
  // animation loop can mutate them every frame without re-running effects.
  let drawnProgress = 0;
  let drawnHover = 0;
  let drawnActive = 0;
  let reduceMotion = false;
  let frame = 0;
  let idleFrames = 0;

  const draw = () => {
    const { width, height } = size();
    if (!width || !height) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const peaks = props.peaks;
    if (!peaks.length) return;

    // Keep bars ~3px wide regardless of container size.
    const barWidth = 3;
    const gap = 1;
    const slots = Math.max(1, Math.floor(width / (barWidth + gap)));
    const playedSlots = drawnProgress * slots;
    const hoverSlots = drawnHover * slots;

    const pending = props.pending;
    const sweep = phase();

    for (let i = 0; i < slots; i += 1) {
      const peak = peaks[Math.floor((i / slots) * peaks.length)] ?? 0;

      // Bars just behind the playhead lift slightly, so the head reads as a
      // soft crest rather than a hard colour boundary.
      let lift = 0;
      if (!pending && drawnActive > 0) {
        const distance = Math.abs(i - playedSlots);
        lift = Math.max(0, 1 - distance / 5) * 0.14 * drawnActive;
      }

      const barHeight = Math.max(2, peak * height * (1 + lift));
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      if (pending) {
        const distance = Math.abs(i / slots - sweep);
        const glow = Math.max(0, 1 - distance * 7);
        context.fillStyle = glow > 0 ? PENDING_SWEEP : PENDING;
        context.globalAlpha = glow > 0 ? 0.35 + glow * 0.65 : 1;
      } else {
        const base = mix(RGB.remaining, RGB.remainingActive, drawnActive);
        const rest = i < hoverSlots ? mix(RGB.remaining, RGB.playedHover, 0.55) : base;

        // Feather the played edge across one bar so it slides instead of steps.
        const edge = Math.min(1, Math.max(0, playedSlots - i));
        context.fillStyle = edge <= 0 ? rest : edge >= 1 ? PLAYED : mix(RGB.played, RGB.remaining, 1 - edge);
        context.globalAlpha = 1;
      }

      context.fillRect(x, y, barWidth, barHeight);
    }

    context.globalAlpha = 1;
  };

  onMount(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    observer.observe(host);
    onCleanup(() => observer.disconnect());
  });

  /**
   * One loop drives both the pending shimmer and the eased progress/hover.
   * It parks itself once every value has caught up and nothing is animating.
   */
  createEffect(() => {
    const targetProgress = props.progress;
    const targetHover = props.pending ? 0 : (hover() ?? 0);
    const targetActive = props.active ? 1 : 0;
    const pending = props.pending;
    const { width } = size();

    if (!width) return;

    if (reduceMotion) {
      drawnProgress = targetProgress;
      drawnHover = targetHover;
      drawnActive = targetActive;
      draw();
      return;
    }

    const start = performance.now();
    let last = start;
    idleFrames = 0;

    const tick = (now: number) => {
      // Ease each value toward its target; the rates below are tuned for 60fps
      // and scaled by frame time so a dropped frame does not slow the motion.
      const step = Math.min(3, Math.max(0.2, (now - last) / 16.7));
      last = now;

      const before = [drawnProgress, drawnHover, drawnActive];

      // Seeking jumps a long way; snap rather than crawl across the bar.
      const distance = Math.abs(targetProgress - drawnProgress);
      const rate = distance > 0.12 ? 0.28 : 0.12;
      drawnProgress += (targetProgress - drawnProgress) * Math.min(1, rate * step);
      drawnHover += (targetHover - drawnHover) * Math.min(1, 0.22 * step);
      drawnActive += (targetActive - drawnActive) * Math.min(1, 0.1 * step);

      if (pending) setPhase((((now - start) / 1400) % 1.35) - 0.175);

      const settled =
        Math.abs(before[0] - drawnProgress) < 0.0002 &&
        Math.abs(before[1] - drawnHover) < 0.0002 &&
        Math.abs(before[2] - drawnActive) < 0.0002;

      if (settled && !pending) {
        idleFrames += 1;
      } else {
        idleFrames = 0;
      }

      draw();

      if (idleFrames < SETTLE_FRAMES || pending) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(frame));
  });

  const ratioFromEvent = (event: { clientX: number }) => {
    const rect = host.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };

  return (
    <div
      ref={host}
      class="waveform"
      classList={{ 'is-active': props.active, 'is-pending': props.pending }}
      onPointerMove={(event) => !props.pending && setHover(ratioFromEvent(event))}
      onPointerLeave={() => setHover(undefined)}
      onClick={(event) => !props.pending && props.onSeek?.(ratioFromEvent(event))}
      role={props.onSeek && !props.pending ? 'slider' : undefined}
      aria-label={props.onSeek && !props.pending ? 'Seek' : undefined}
      aria-busy={props.pending}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.progress * 100)}
    >
      <canvas ref={canvas} />
    </div>
  );
}
