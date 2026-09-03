import { onCleanup, onMount } from 'solid-js';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { AboutSection } from '@/components/sections/AboutSection';
import { HeroSection } from '@/components/sections/HeroSection';
import { LinksSection } from '@/components/sections/LinksSection';
import { WorkSection } from '@/components/sections/WorkSection';
import { PointerField } from '@/components/visuals/PointerField';
import { ScrollProgress } from '@/components/visuals/ScrollProgress';
import ShaderBackdrop from '@/components/visuals/ShaderBackdrop';

export default function App() {
  onMount(() => {
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

    // HMR swaps section nodes without remounting App, so pick up anything added later.
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
    <main class="site-root">
      <ShaderBackdrop />
      <div class="page-grid" aria-hidden="true" />
      <div class="page-grain" aria-hidden="true" />
      <div class="page-scanlines" aria-hidden="true" />
      <div class="cursor-field" aria-hidden="true" />
      <PointerField />
      <ScrollProgress />
      <SiteHeader />
      <HeroSection />
      <AboutSection />
      <WorkSection />
      <LinksSection />
      <SiteFooter />
    </main>
  );
}
