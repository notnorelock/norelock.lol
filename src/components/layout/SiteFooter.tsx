import { IconHeart, IconPointFilled } from '@tabler/icons-solidjs';

export function SiteFooter() {
  return (
    <footer class="site-footer">
      <div class="site-shell footer-inner">
        <div class="footer-brand">
          <img src="/assets/norelock-logo-white.svg" alt="Norelock" />
          <span>© {new Date().getFullYear()}</span>
        </div>
        <p class="footer-copy">
          built with solidjs, three.js and too much shader code
          <IconHeart size={13} />
        </p>
        <span class="footer-status"><IconPointFilled size={10} /> online somewhere</span>
      </div>
    </footer>
  );
}
