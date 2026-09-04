import { IconBrandGithub, IconMenu2 } from '@tabler/icons-solidjs';
import { A, useLocation } from '@solidjs/router';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Anchors only resolve on the home page, so prefix them when we're elsewhere.
const nav = [
  ['about', '#about'],
  ['work', '#work'],
  ['music', '/music'],
  ['links', '#links'],
] as const;

export function SiteHeader() {
  let navElement!: HTMLElement;
  const location = useLocation();
  const resolve = (href: string) =>
    href.startsWith('#') && location.pathname !== '/' ? `/${href}` : href;

  const toggleMobileNav = () => navElement.classList.toggle('mobile-nav-open');
  const closeMobileNav = () => navElement.classList.remove('mobile-nav-open');

  return (
    <header class="site-header">
      <div class="site-shell header-inner">
        <A href="/" class="header-brand" aria-label="norelock.lol home">
          <img src="/assets/norelock-logo-white.svg" alt="Norelock" />
          <span>norelock.lol</span>
        </A>

        <nav ref={navElement} class="site-nav" aria-label="Main navigation">
          {nav.map(([label, href]) => (
            <a href={resolve(href)} onClick={closeMobileNav}>{label}</a>
          ))}
        </nav>

        <div class="header-actions">
          <Tooltip openDelay={250}>
            <TooltipTrigger
              as="a"
              href="https://github.com/notnorelock"
              target="_blank"
              rel="noreferrer"
              class="header-icon-link"
              aria-label="Open GitHub"
            >
              <IconBrandGithub size={18} stroke={1.55} />
            </TooltipTrigger>
            <TooltipContent>github.com/notnorelock</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" class="mobile-menu-button md:hidden" onClick={toggleMobileNav} aria-label="Toggle navigation">
            <IconMenu2 size={20} stroke={1.55} />
          </Button>
        </div>
      </div>
    </header>
  );
}
