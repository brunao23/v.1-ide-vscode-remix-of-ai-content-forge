import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Module {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  loom_id: string;
  duration: string | null;
  order_index: number;
}

export function useLessons() {
  const { user, activeTenant } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [modulesRes, lessonsRes] = await Promise.all([
      supabase.from("lesson_modules").select("*").order("order_index"),
      supabase.from("lessons").select("*").order("order_index"),
    ]);

    if (modulesRes.error) console.error("Error fetching modules:", modulesRes.error);
    if (lessonsRes.error) console.error("Error fetching lessons:", lessonsRes.error);
    if (modulesRes.data) setModules(modulesRes.data);
    if (lessonsRes.data) setLessons(lessonsRes.data);

    if (user && activeTenant?.id) {
      const { data: progress } = await supabase
        .from("user_lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("tenant_id", activeTenant.id)
        .eq("completed", true);

      if (progress) {
        setCompletedLessons(new Set(progress.map((p) => p.lesson_id)));
      }
    } else {
      setCompletedLessons(new Set());
    }

    setLoading(false);
  }, [user, activeTenant?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const getLessonsByModule = useCallback(
    (moduleId: string) =>
      lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.order_index - b.order_index),
    [lessons],
  );

  const toggleCompleted = useCallback(
    async (lessonId: string) => {
      if (!user || !activeTenant?.id) {
        console.warn("User or tenant not available - cannot track progress");
        return;
      }

      const isCompleted = completedLessons.has(lessonId);

      setCompletedLessons((prev) => {
        const next = new Set(prev);
        if (isCompleted) next.delete(lessonId);
        else next.add(lessonId);
        return next;
      });

      if (isCompleted) {
        await supabase
          .from("user_lesson_progress")
          .update({ completed: false, completed_at: null })
          .eq("user_id", user.id)
          .eq("tenant_id", activeTenant.id)
          .eq("lesson_id", lessonId);
        return;
      }

      await supabase.from("user_lesson_progress").upsert(
        {
          user_id: user.id,
          tenant_id: activeTenant.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id,lesson_id" },
      );
    },
    [user, activeTenant?.id, completedLessons],
  );

  return {
    modules,
    lessons,
    completedLessons,
    loading,
    getLessonsByModule,
    toggleCompleted,
    refetch: fetchData,
  };
}

