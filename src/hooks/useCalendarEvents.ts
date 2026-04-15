import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end?: string | null;
  location?: string | null;
  url?: string | null;
}

export function useCalendarEvents() {
  const { activeTenant } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('calendar-events', {
        body: { tenantId: activeTenant?.id },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erro ao buscar eventos:', err);
      setError(err.message || 'Erro ao buscar eventos');
    } finally {
      setLoading(false);
    }
  }, [activeTenant?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
