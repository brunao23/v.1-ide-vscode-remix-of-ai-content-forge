import type { IncomingMessage, ServerResponse } from 'node:http';

const ALLOWED_DOMAINS = [
  'cdninstagram.com',
  'fbcdn.net',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokv.com',
  'muscdn.com',
];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some((d) => hostname.endsWith(d));
  } catch {
    return false;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const raw = req.url ?? '';
  const qs = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qs);
  const url = params.get('url') ?? '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!url || !isAllowed(url)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'video/mp4,video/*,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      Referer: 'https://www.instagram.com/',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    // Forward Range header for video seeking/streaming
    const rangeHeader = (req.headers as Record<string, string | string[] | undefined>)['range'];
    if (rangeHeader) {
      upstreamHeaders['Range'] = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
    }

    const upstream = await fetch(url, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      res.statusCode = upstream.status;
      res.end(`Upstream ${upstream.status}`);
      return;
    }

    const ct = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges');

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    else res.setHeader('Accept-Ranges', 'bytes');

    res.statusCode = upstream.status; // 200 or 206 (partial content)

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 502;
    res.end(`Proxy error: ${err}`);
  }
}
