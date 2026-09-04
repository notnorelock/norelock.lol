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

/**
 * Headers a plain browser request does not carry.
 *
 * Note that the platform itself is a proxy: Vercel adds its own `via` and puts
 * its edge address in `x-forwarded-for`. Only hops beyond that are a signal,
 * otherwise every single request would look relayed.
 */
function looksProxied(request: Request) {
  const headers = request.headers;

  // Vercel's own via header names its infrastructure; anything else in front
  // of it is somebody else's proxy.
  const via = headers.get('via');
  if (via && !/vercel/i.test(via)) return true;

  // `forwarded` is set by Vercel itself on every request (it carries the
  // signed client address), so its mere presence proves nothing. Only a chain
  // of several hops suggests a relay in front of the platform.
  const forwarded = headers.get('forwarded');
  if (forwarded && forwarded.split(',').length > 1) return true;

  // The visitor plus Vercel's edge already accounts for two entries.
  const chain = headers.get('x-forwarded-for');
  if (chain && chain.split(',').length > 3) return true;

  return false;
}

/**
 * Why a request was rejected, or null when it should be counted. Returning the
 * reason makes a miscounted download debuggable instead of a silent zero.
 */
export async function screenRequest(request: Request, ip: string) {
  const agent = request.headers.get('user-agent') ?? '';
  if (!agent) return 'no-user-agent';
  if (BOT.test(agent)) return 'bot-user-agent';

  // A download started from the site carries this; a bare script does not.
  // 'none' is a direct navigation, 'same-site' covers a subdomain.
  const site = request.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'same-site', 'none'].includes(site)) {
    return `sec-fetch-site:${site}`;
  }

  const proxied = looksProxied(request);
  if (proxied) return 'proxy-headers';

  if (ip && (await isVpn(ip))) return 'vpn';

  return null;
}

/** True when the request should not be counted. */
export async function isSuspicious(request: Request, ip: string) {
  return (await screenRequest(request, ip)) !== null;
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
