import React from 'react';

interface PlatformIconProps {
  platform: string;
  size?: number;
  className?: string;
}

export function PlatformIcon({ platform, size = 24, className = '' }: PlatformIconProps) {
  const r = size * 0.2;

  switch (platform) {
    case 'instagram':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2" />
            <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" />
            <circle cx="18" cy="6" r="1.5" fill="white" />
          </svg>
        </div>
      );
    case 'tiktok':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
            <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case 'youtube':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="white">
            <polygon points="10,8 16,12 10,16" />
          </svg>
        </div>
      );
    case 'linkedin':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="white">
            <path d="M4 6h3v14H4zM5.5 2A2 2 0 1 1 5.5 6 2 2 0 0 1 5.5 2zM9 10h3v1.5c.5-1 2-2 4-2 3.5 0 4 2 4 5V22h-3v-7c0-1.5 0-3.5-2-3.5s-2.5 2-2.5 3.5V22H9z" />
          </svg>
        </div>
      );
    case 'twitter':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#1D1D1D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="white">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      );
    case 'facebook':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.45} height={size * 0.55} viewBox="0 0 12 20" fill="white">
            <path d="M8 3.5H10.5V0H8C5.5 0 4 1.5 4 4V6H1.5V10H4V20H8V10H10.5L11 6H8V4C8 3.7 8 3.5 8 3.5z" />
          </svg>
        </div>
      );
    case 'pinterest':
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: '#E60023', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.5 2 2 6.5 2 12c0 4 2.5 7.5 6 9-.1-.8-.1-2 0-3l1-4s-.3-.5-.3-1.3c0-1.2.7-2.1 1.6-2.1.8 0 1.1.6 1.1 1.2 0 .8-.5 1.9-.7 3 0 .9.7 1.6 1.6 1.6 1.9 0 3.2-2.4 3.2-5.3 0-2.2-1.6-3.8-4.5-3.8-3.3 0-5.3 2.5-5.3 5.3 0 .9.3 1.6.7 2.1.1.1.1.2.1.3l-.2 1c0 .2-.2.2-.3.1C5.7 15.2 5 13.7 5 12c0-3.5 3-7.8 8.9-7.8 4.8 0 7.9 3.5 7.9 7.2 0 4.9-2.7 8.6-6.7 8.6-1.3 0-2.6-.7-3-1.5l-.8 3.2c-.3 1.1-.9 2.2-1.5 3 1.2.4 2.5.5 3.7.5 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className={className} style={{ width: size, height: size, borderRadius: size * 0.22, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} />
      );
  }
}

export const PLATFORM_LIST = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
] as const;
