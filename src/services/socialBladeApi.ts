const SB_CLIENT_ID = 'cli_69150c2fcfb9eaa7420d6388';
const SB_TOKEN = 'c10994b1bc9685545c0ec2908d36f09c5a25a8a8807ab26a3d621dc8c83c2ac7';
const SB_BASE = 'https://matrix.sbapis.com/b';

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
  const stats = d?.statistics ?? {};
  const total = stats?.total ?? {};
  const avg = stats?.avg_last_30_days ?? {};
  const ranks = d?.ranks ?? {};
  const gradeObj = stats?.grade ?? {};

  const grade: string | undefined =
    typeof gradeObj === 'string' ? gradeObj : (gradeObj?.letter as string | undefined);
  const gradeColor: string | undefined = gradeObj?.color as string | undefined;

  const base = {
    platform,
    username: (d?.username as string) || '',
    displayName: (d?.displayName ?? d?.channelName ?? d?.username ?? '') as string,
    avatar: (d?.avatar as string | undefined) || undefined,
    grade,
    gradeColor,
    rankSb: safeNum(ranks?.sbrank),
    avgUploadsMonthly: safeNum(avg?.uploads ?? avg?.videos),
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
    uploads: safeNum(total?.uploads) ?? 0,
    totalViews: safeNum(total?.views),
    totalLikes: safeNum(total?.likes),
    rankPrimary: safeNum(ranks?.followers),
    avgFollowersMonthly: safeNum(avg?.followers),
  };
}

export async function fetchSbStats(platform: SbPlatform, username: string): Promise<SbStats> {
  const query = username.replace(/^@/, '').trim();
  const url = `${SB_BASE}/${platform}/statistics?query=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      clientid: SB_CLIENT_ID,
      token: SB_TOKEN,
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
