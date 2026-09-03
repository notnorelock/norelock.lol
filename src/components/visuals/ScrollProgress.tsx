import { onCleanup, onMount } from 'solid-js';

export function ScrollProgress() {
  let bar!: HTMLDivElement;

  onMount(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    onCleanup(() => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    });
  });

  return <div ref={bar} class="scroll-progress" aria-hidden="true" />;
}
