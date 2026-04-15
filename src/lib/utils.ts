import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CDN_DOMAINS = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "muscdn.com",
];

function needsProxy(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return CDN_DOMAINS.some((d) => hostname.endsWith(d));
  } catch {
    return false;
  }
}

export function proxyImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!needsProxy(url)) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
