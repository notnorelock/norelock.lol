/**
 * VPN / proxy screening.
 *
 * Two layers: cheap header and user-agent checks that cost nothing, then an
 * external lookup. Both fail open — a download is never blocked because a
 * check could not run, only the counter is skipped.
 */

const LOOKUP = 'https://www.rayzs.de/provpn/api/proxy.php/?a=';
const TIMEOUT_MS = 1200;

/** Results are reused across requests so a busy track hits the API once. */
const cache = new Map<string, { flagged: boolean; at: number }>();
const CACHE_MS = 30 * 60 * 1000;

/** Obvious automation. Real browsers do not announce themselves like this. */
const BOT = /(bot|crawler|spider|curl|wget|python-requests|axios|httpie|libwww|scrapy|headless)/i;

/** Headers a plain browser request does not carry. */
function looksProxied(request: Request) {
  const headers = request.headers;
  if (headers.get('via') || headers.get('forwarded')) return true;

  // More than one hop in x-forwarded-for means something relayed the request
  // before it reached the edge.
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded && forwarded.split(',').length > 2) return true;

  return false;
}

/** True when the request should not be counted. */
export async function isSuspicious(request: Request, ip: string) {
  const agent = request.headers.get('user-agent') ?? '';
  if (!agent || BOT.test(agent)) return true;

  // A download started from the site carries these; a bare curl does not.
  const dest = request.headers.get('sec-fetch-site');
  if (dest && dest !== 'same-origin' && dest !== 'none') return true;

  if (looksProxied(request)) return true;

  return ip ? await isVpn(ip) : false;
}

/** Asks the external service whether the address is a VPN or proxy. */
export async function isVpn(ip: string) {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.flagged;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(LOOKUP + encodeURIComponent(ip), {
      signal: controller.signal,
      headers: { accept: 'text/plain' },
    });
    clearTimeout(timer);

    if (!response.ok) return false;

    // The service answers with a bare "true" / "false".
    const body = (await response.text()).trim().toLowerCase();
    const flagged = body === 'true' || body === '1';

    cache.set(ip, { flagged, at: Date.now() });
    return flagged;
  } catch {
    // Timeout or network error: let the download through and count it.
    return false;
  }
}
