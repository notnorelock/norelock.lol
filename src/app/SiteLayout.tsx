import { lazy, onCleanup, onMount, Suspense, type ParentProps } from 'solid-js';
import { PlayerBar } from '@/components/music/PlayerBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { PointerField } from '@/components/visuals/PointerField';
import { ScrollProgress } from '@/components/visuals/ScrollProgress';
import { player, usePlayerHotkeys } from '@/lib/player';

// three.js is ~466kB and only paints the backdrop, so let the page render first.
const ShaderBackdrop = lazy(() => import('@/components/visuals/ShaderBackdrop'));

export function SiteLayout(props: ParentProps) {
  onMount(() => {
    usePlayerHotkeys();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -48px' },
    );

    const observe = (root: ParentNode) => {
      if (root instanceof Element && root.hasAttribute('data-reveal')) observer.observe(root);
      root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((element) => observer.observe(element));
    };

    observe(document);

    // Route changes and HMR both swap nodes without remounting this layout.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) observe(node as Element);
        }
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    onCleanup(() => {
      observer.disconnect();
      mutations.disconnect();
    });
  });

  return (
    <main class="site-root" classList={{ 'has-player': Boolean(player.current()) }}>
      <Suspense>
        <ShaderBackdrop />
      </Suspense>
      <div class="page-grid" aria-hidden="true" />
      <div class="page-grain" aria-hidden="true" />
      <div class="page-scanlines" aria-hidden="true" />
      <div class="cursor-field" aria-hidden="true" />
      <PointerField />
      <ScrollProgress />
      <SiteHeader />
      {props.children}
      <SiteFooter />
      <PlayerBar />
    </main>
  );
}
