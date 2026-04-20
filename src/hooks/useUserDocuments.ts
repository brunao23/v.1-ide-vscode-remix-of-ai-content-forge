import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserDocuments() {
  const { user, activeTenant } = useAuth();
  const [existingTypes, setExistingTypes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !activeTenant?.id) {
      setExistingTypes(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .from('documents')
      .select('type')
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .then(({ data }) => {
        setExistingTypes(new Set((data || []).map(d => d.type as string)));
        setIsLoading(false);
      });
  }, [user?.id, activeTenant?.id]);

  return { existingTypes, isLoading };
}
