const SB_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-blade-proxy`;
const SB_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type SbPlatform = 'instagram' | 'youtube' | 'tiktok';

export interface SbStats {
  platform: SbPlatform;
  username: string;
  displayName: string;
  avatar?: string;
  followers: number;
  following?: number;
  uploads: number;
  totalViews?: number;
  totalLikes?: number;
  grade?: string;
  gradeColor?: string;
  rankSb?: number;
  rankPrimary?: number;
  avgFollowersMonthly?: number;
  avgUploadsMonthly?: number;
  avgViewsMonthly?: number;
}

function safeNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseStats(platform: SbPlatform, json: any): SbStats {
  const d = json?.data ?? json;

  const idBlock = d?.id ?? {};
  const general = d?.general ?? {};
  const branding = general?.branding ?? {};
  const stats = d?.statistics ?? {};
  const total = stats?.total ?? {};
  const growth = stats?.growth ?? {};
  const ranks = d?.ranks ?? {};
  const misc = d?.misc ?? {};
  const gradeObj = misc?.grade ?? stats?.grade ?? {};

  const username = (idBlock?.username ?? d?.username ?? '') as string;
  const displayName = (idBlock?.display_name ?? idBlock?.displayName ?? d?.displayName ?? username) as string;
  const avatar = (branding?.avatar ?? d?.avatar ?? undefined) as string | undefined;

  const grade = (gradeObj?.grade ?? gradeObj?.letter ?? undefined) as string | undefined;
  const gradeColor = (gradeObj?.color ?? undefined) as string | undefined;

  const base = {
    platform,
    username,
    displayName,
    avatar: avatar || undefined,
    grade,
    gradeColor,
    rankSb: safeNum(ranks?.sbrank ?? ranks?.sb_rank),
    avgViewsMonthly: safeNum(growth?.views?.['30'] ?? growth?.views?.['7']),
  };

  if (platform === 'youtube') {
    return {
      ...base,
      followers: safeNum(total?.subscribers ?? total?.followers) ?? 0,
      following: undefined,
      uploads: safeNum(total?.videos ?? total?.media) ?? 0,
      totalViews: safeNum(total?.views),
      rankPrimary: safeNum(ranks?.subscribers ?? ranks?.followers),
      avgFollowersMonthly: safeNum(growth?.subscribers?.['30'] ?? growth?.followers?.['30']),
      avgUploadsMonthly: safeNum(growth?.videos?.['30'] ?? growth?.media?.['30']),
    };
  }

  return {
    ...base,
    followers: safeNum(total?.followers) ?? 0,
    following: safeNum(total?.following),
    uploads: safeNum(total?.media ?? total?.uploads ?? total?.posts) ?? 0,
    totalViews: safeNum(total?.views),
    totalLikes: safeNum(total?.likes),
    rankPrimary: safeNum(ranks?.followers),
    avgFollowersMonthly: safeNum(growth?.followers?.['30']),
    avgUploadsMonthly: safeNum(growth?.media?.['30']),
  };
}

function extractUsername(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  } catch {}
  return trimmed.replace(/^@/, '');
}

export async function fetchSbStats(platform: SbPlatform, username: string): Promise<SbStats> {
  const query = extractUsername(username);
  const url = `${SB_PROXY}?platform=${encodeURIComponent(platform)}&query=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      apikey: SB_ANON_KEY,
      Authorization: `Bearer ${SB_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Erro ${res.status}: ${res.statusText}`);
  }

  const json = await res.json() as any;

  if (json?.status?.code && json.status.code !== 200) {
    throw new Error((json?.status?.error as string | undefined) || `Erro da API: código ${json.status.code}`);
  }

  if (!json?.data) {
    throw new Error('Usuário não encontrado');
  }

  return parseStats(platform, json);
}
