/**
 * Drives the loading screen that lives in index.html.
 *
 * The markup is already on screen before this module parses, so the page never
 * flashes empty. Steps are registered up front and resolved as each lazily
 * loaded piece arrives; the overlay leaves once every one of them is done.
 */

type Step = 'app' | 'fonts' | 'backdrop' | 'portrait';

/** The portrait only exists on the home page, so it is expected per route. */
const steps: Step[] =
  window.location.pathname === '/'
    ? ['app', 'fonts', 'backdrop', 'portrait']
    : ['app', 'fonts', 'backdrop'];

const done = new Set<Step>();

let overlay: HTMLElement | null = null;
let fill: HTMLElement | null = null;
let label: HTMLElement | null = null;
let finished = false;

/** Never let the overlay outlive a stalled chunk. */
const HARD_TIMEOUT = 9000;

function paint() {
  if (!fill || !label) return;
  const ratio = done.size / steps.length;
  fill.style.transform = `scaleX(${ratio})`;
  label.textContent = `${Math.round(ratio * 100)}%`;
}

function finish() {
  if (finished) return;
  finished = true;

  paint();
  // Let the bar reach the end before the overlay fades out.
  window.setTimeout(() => {
    overlay?.classList.add('is-done');
    window.setTimeout(() => overlay?.remove(), 700);
  }, 220);
}

export function initBoot() {
  overlay = document.getElementById('boot');
  fill = document.getElementById('boot-fill');
  label = document.getElementById('boot-label');

  if (!overlay) {
    finished = true;
    return;
  }

  window.setTimeout(finish, HARD_TIMEOUT);

  // Fonts are part of how the page looks settled, so they count as a step.
  const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  if (fontsReady) {
    void fontsReady.then(() => bootStep('fonts'));
  } else {
    bootStep('fonts');
  }
}

/** Marks one step complete; the overlay leaves once all of them are. */
export function bootStep(step: Step) {
  // A step this route never planned for (the portrait on /music) is ignored so
  // the bar cannot run past 100%.
  if (finished || done.has(step) || !steps.includes(step)) return;

  done.add(step);
  paint();

  if (done.size >= steps.length) finish();
}
