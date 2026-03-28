import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientMetrics {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  total_new_revenue: number | null;
  total_cash_collected: number | null;
  monthly_recurring_revenue: number | null;
  expenses: number | null;
  profit: number | null;
  ad_spend: number | null;
  daily_ad_spend: number | null;
  advertising_reach_ig: number | null;
  advertising_impressions_ig: number | null;
  cpm: number | null;
  roas: number | null;
  short_form_channel_size: number | null;
  total_reach_ig_impressions_li: number | null;
  total_posts_made: number | null;
  long_form_channel_size: number | null;
  long_form_monthly_audience: number | null;
  youtube_total_views: number | null;
  youtube_total_hours: number | null;
  total_videos_podcasts_made: number | null;
  email_list_size: number | null;
  new_subscribers: number | null;
  net_new_subscribers: number | null;
  new_clients: number | null;
}

interface PeriodRange {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  aggregate: boolean;
}

function parsePeriod(period: string): PeriodRange {
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // "2025-10" → specific month
  const monthMatch = period.match(/^(\d{4})-(\d{1,2})$/);
  if (monthMatch) {
    const y = parseInt(monthMatch[1]);
    const m = parseInt(monthMatch[2]);
    return { startMonth: m, startYear: y, endMonth: m, endYear: y, aggregate: false };
  }

  // "last-3", "last-6", "last-12"
  const lastMatch = period.match(/^last-(\d+)$/);
  if (lastMatch) {
    const n = parseInt(lastMatch[1]);
    let sm = curMonth - n + 1;
    let sy = curYear;
    while (sm <= 0) { sm += 12; sy--; }
    return { startMonth: sm, startYear: sy, endMonth: curMonth, endYear: curYear, aggregate: true };
  }

  // "2025-Q1"
  const qMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (qMatch) {
    const y = parseInt(qMatch[1]);
    const q = parseInt(qMatch[2]);
    const sm = (q - 1) * 3 + 1;
    return { startMonth: sm, startYear: y, endMonth: sm + 2, endYear: y, aggregate: true };
  }

  // "2025" → full year
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1]);
    return { startMonth: 1, startYear: y, endMonth: 12, endYear: y, aggregate: true };
  }

  // default: current month
  return { startMonth: curMonth, startYear: curYear, endMonth: curMonth, endYear: curYear, aggregate: false };
}

function aggregateMetrics(data: ClientMetrics[]): ClientMetrics | null {
  if (!data.length) return null;
  const base = { ...data[data.length - 1] };

  // Sum fields
  const sumFields: (keyof ClientMetrics)[] = [
    'total_new_revenue', 'total_cash_collected', 'expenses', 'profit',
    'ad_spend', 'new_subscribers', 'net_new_subscribers', 'new_clients',
    'total_posts_made', 'total_videos_podcasts_made',
    'youtube_total_views', 'youtube_total_hours',
  ];

  for (const f of sumFields) {
    (base as any)[f] = data.reduce((s, d) => s + ((d as any)[f] || 0), 0);
  }

  // Average fields
  const avgFields: (keyof ClientMetrics)[] = ['cpm', 'roas', 'daily_ad_spend'];
  for (const f of avgFields) {
    const vals = data.map(d => (d as any)[f]).filter((v: any) => v != null);
    (base as any)[f] = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
  }

  // Last value fields (channel sizes, MRR, etc.) — already from base (last entry)
  return base;
}

export function useMetrics(period: string, targetUserId?: string) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<ClientMetrics | null>(null);
  const [history, setHistory] = useState<ClientMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    const uid = targetUserId || user?.id;

    setLoading(true);
    const range = parsePeriod(period);

    // Build query
    let query = supabase
      .from('client_metrics')
      .select('*')
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true });

    // Filter by user if available
    if (uid) {
      query = query.eq('user_id', uid);
    }

    // Filter: rows where (year > startYear) OR (year == startYear AND month >= startMonth)
    // AND (year < endYear) OR (year == endYear AND month <= endMonth)
    // Simplified: fetch all for the user and filter client-side for accuracy
    const { data, error } = await query;

    if (error || !data) {
      setLoading(false);
      return;
    }

    const allData = data as unknown as ClientMetrics[];

    // Filter by range
    const inRange = allData.filter(d => {
      const v = d.period_year * 100 + d.period_month;
      const s = range.startYear * 100 + range.startMonth;
      const e = range.endYear * 100 + range.endMonth;
      return v >= s && v <= e;
    });

    if (range.aggregate) {
      setMetrics(aggregateMetrics(inRange));
    } else {
      setMetrics(inRange[0] || null);
    }

    // Previous period for comparison
    if (!range.aggregate && inRange.length > 0) {
      const cur = inRange[0];
      let pm = cur.period_month - 1;
      let py = cur.period_year;
      if (pm <= 0) { pm = 12; py--; }
      const prev = allData.find(d => d.period_month === pm && d.period_year === py);
      setPreviousMetrics(prev || null);
    } else {
      setPreviousMetrics(null);
    }

    // History for charts (last 12 entries)
    setHistory(allData.slice(-12));
    setLoading(false);
  }, [period, user?.id, targetUserId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const calculateChange = (current: number | null, previous: number | null): number | undefined => {
    if (current == null || previous == null || previous === 0) return undefined;
    return Math.round(((current - previous) / previous) * 100);
  };

  return { metrics, previousMetrics, history, loading, calculateChange, refetch: fetchMetrics };
}
