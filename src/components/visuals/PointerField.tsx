import { onCleanup, onMount } from 'solid-js';

export function PointerField() {
  let ring!: HTMLDivElement;
  let dot!: HTMLDivElement;

  onMount(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let frame = 0;

    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      document.documentElement.style.setProperty('--mouse-x', `${x}px`);
      document.documentElement.style.setProperty('--mouse-y', `${y}px`);
    };

    const animate = () => {
      rx += (x - rx) * 0.13;
      ry += (y - ry) * 0.13;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      frame = requestAnimationFrame(animate);
    };

    window.addEventListener('pointermove', move, { passive: true });
    animate();

    onCleanup(() => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
    });
  });

  return (
    <>
      <div ref={ring} class="pointer-ring" aria-hidden="true" />
      <div ref={dot} class="pointer-dot" aria-hidden="true" />
    </>
  );
}
