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
  console.log('[SocialBlade raw data]', JSON.stringify(d).slice(0, 1000));

  const stats = d?.statistics ?? d?.stats ?? {};
  const total = stats?.total ?? stats ?? {};
  const avg = stats?.avg_last_30_days ?? stats?.averages ?? stats?.average ?? {};
  const ranks = d?.ranks ?? d?.rank ?? {};
  const gradeObj = stats?.grade ?? d?.grade ?? {};

  const grade: string | undefined =
    typeof gradeObj === 'string' ? gradeObj : (gradeObj?.letter as string | undefined);
  const gradeColor: string | undefined = gradeObj?.color as string | undefined;

  const username =
    (d?.username ?? d?.user_name ?? d?.handle ?? d?.channelName ?? '') as string;
  const displayName =
    (d?.displayName ?? d?.display_name ?? d?.channelName ?? d?.title ?? d?.name ?? d?.fullName ?? username) as string;
  const avatar =
    (d?.avatar ?? d?.avatar_url ?? d?.profile_image ?? d?.profile_image_url ?? d?.thumbnail ?? undefined) as string | undefined;

  const base = {
    platform,
    username,
    displayName,
    avatar: avatar || undefined,
    grade,
    gradeColor,
    rankSb: safeNum(ranks?.sbrank ?? ranks?.sb_rank),
    avgUploadsMonthly: safeNum(avg?.uploads ?? avg?.videos ?? avg?.media),
    avgViewsMonthly: safeNum(avg?.views),
  };

  if (platform === 'youtube') {
    return {
      ...base,
      followers: safeNum(total?.subscribers) ?? 0,
      following: undefined,
      uploads: safeNum(total?.videos) ?? 0,
      totalViews: safeNum(total?.views),
      rankPrimary: safeNum(ranks?.subscribers),
      avgFollowersMonthly: safeNum(avg?.subscribers),
    };
  }

  return {
    ...base,
    followers: safeNum(total?.followers) ?? 0,
    following: safeNum(total?.following),
    uploads: safeNum(total?.uploads ?? total?.media ?? total?.posts) ?? 0,
    totalViews: safeNum(total?.views),
    totalLikes: safeNum(total?.likes),
    rankPrimary: safeNum(ranks?.followers),
    avgFollowersMonthly: safeNum(avg?.followers),
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
