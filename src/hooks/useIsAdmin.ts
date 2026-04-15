import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin;
}

