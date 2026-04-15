import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Zap,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useImplementationStore } from '@/stores/implementationStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImplementationTask {
  id: string;
  month_title: string;
  month_order: number;
  week_title: string | null;
  week_order: number;
  task_title: string;
  task_order: number;
  status: string;
  tags: string[];
  tag_colors: string[];
  url: string | null;
  trigger_type: 'manual' | 'document' | 'lesson' | 'agent' | 'metric';
  trigger_value: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_COLOR_MAP: Record<string, string> = {
  blue: 'bg-sky-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-600',
  red: 'bg-rose-600',
  purple: 'bg-violet-600',
  cyan: 'bg-cyan-600',
  pink: 'bg-pink-600',
};

function getTagColor(color: string): string {
  return TAG_COLOR_MAP[color] || color || 'bg-sky-600';
}

// ─── Auto-detection helpers ───────────────────────────────────────────────────

interface UserActivities {
  documentTypes: Set<string>; // 'brand-book', 'icp', etc.
  agentIds: Set<string>;      // agents that produced a saved document
  lessonIds: Set<string>;     // completed lesson IDs
  metrics: Set<string>;       // 'weekly_win' | 'monthly_data' | 'new_deal'
  hasAnyDocument: boolean;
  hasAnyChat: boolean;
}

async function fetchUserActivities(
  userId: string,
  tenantId: string,
): Promise<UserActivities> {
  const [docsRes, lessonsRes, weeklyRes, monthlyRes, dealRes, chatRes] = await Promise.all([
    (supabase as any)
      .from('documents')
      .select('type, agent_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId),
    (supabase as any)
      .from('user_lesson_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('completed', true),
    (supabase as any)
      .from('weekly_wins_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .limit(1),
    (supabase as any)
      .from('monthly_data_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .limit(1),
    (supabase as any)
      .from('new_deal_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .limit(1),
    (supabase as any)
      .from('chat_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('role', 'user')
      .limit(1),
  ]);

  const docs: any[] = docsRes.data || [];
  const documentTypes = new Set<string>(docs.map((d: any) => String(d.type || '')).filter(Boolean));
  const agentIds = new Set<string>(docs.map((d: any) => String(d.agent_id || '')).filter(Boolean));
  const lessonIds = new Set<string>((lessonsRes.data || []).map((r: any) => String(r.lesson_id || '')));

  const metrics = new Set<string>();
  if ((weeklyRes.data || []).length > 0) metrics.add('weekly_win');
  if ((monthlyRes.data || []).length > 0) metrics.add('monthly_data');
  if ((dealRes.data || []).length > 0) metrics.add('new_deal');

  return {
    documentTypes,
    agentIds,
    lessonIds,
    metrics,
    hasAnyDocument: docs.length > 0,
    hasAnyChat: (chatRes.data || []).length > 0,
  };
}

function isTaskAutoCompleted(task: ImplementationTask, activities: UserActivities): boolean {
  switch (task.trigger_type) {
    case 'document':
      if (!task.trigger_value) return activities.hasAnyDocument;
      return activities.documentTypes.has(task.trigger_value);
    case 'agent':
      if (!task.trigger_value) return activities.agentIds.size > 0;
      return activities.agentIds.has(task.trigger_value);
    case 'lesson':
      if (!task.trigger_value) return activities.lessonIds.size > 0;
      return activities.lessonIds.has(task.trigger_value);
    case 'metric':
      if (!task.trigger_value) return activities.metrics.size > 0;
      return activities.metrics.has(task.trigger_value);
    default:
      return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImplementationPage() {
  const { user, activeTenant } = useAuth();
  const [tasks, setTasks] = useState<ImplementationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set());
  const [autoTaskIds, setAutoTaskIds] = useState<Set<string>>(new Set()); // auto-completed
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  const setProgress = useImplementationStore((s) => s.setProgress);

  // ── Fetch tasks from DB ──────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('implementation_tasks')
      .select('*')
      .order('month_order', { ascending: true })
      .order('week_order', { ascending: true })
      .order('task_order', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erro ao carregar tarefas');
    } else {
      setTasks((data as ImplementationTask[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Fetch user's manual checks ───────────────────────────────────────────

  const fetchTaskChecks = useCallback(async () => {
    if (!user?.id || !activeTenant?.id) { setCheckedTaskIds(new Set()); return; }

    const { data, error } = await (supabase as any)
      .from('implementation_task_checks')
      .select('task_id, is_checked')
      .eq('tenant_id', activeTenant.id)
      .eq('user_id', user.id)
      .eq('is_checked', true);

    if (error) {
      console.error('Erro ao carregar checks:', error);
      return;
    }
    setCheckedTaskIds(new Set<string>((data || []).map((row: any) => String(row.task_id))));
  }, [user?.id, activeTenant?.id]);

  useEffect(() => { void fetchTaskChecks(); }, [fetchTaskChecks]);

  // ── Auto-detect system usage ─────────────────────────────────────────────

  const runAutoDetection = useCallback(async () => {
    if (!user?.id || !activeTenant?.id || tasks.length === 0) return;

    const triggerTasks = tasks.filter((t) => t.trigger_type && t.trigger_type !== 'manual');
    if (triggerTasks.length === 0) return;

    setDetecting(true);
    try {
      const activities = await fetchUserActivities(user.id, activeTenant.id);
      const newAutoIds = new Set<string>();
      const toUpsert: any[] = [];

      for (const task of triggerTasks) {
        if (isTaskAutoCompleted(task, activities)) {
          newAutoIds.add(task.id);
          if (!checkedTaskIds.has(task.id)) {
            toUpsert.push({
              tenant_id: activeTenant.id,
              user_id: user.id,
              task_id: task.id,
              is_checked: true,
              checked_at: new Date().toISOString(),
              auto_detected: true,
            });
          }
        }
      }

      setAutoTaskIds(newAutoIds);

      if (toUpsert.length > 0) {
        await (supabase as any)
          .from('implementation_task_checks')
          .upsert(toUpsert, { onConflict: 'task_id,tenant_id,user_id' });

        // merge auto-detected into checked set
        setCheckedTaskIds((prev) => {
          const next = new Set(prev);
          toUpsert.forEach((r) => next.add(r.task_id));
          return next;
        });
      }
    } catch (err) {
      console.error('Auto-detection error:', err);
    } finally {
      setDetecting(false);
    }
  }, [user?.id, activeTenant?.id, tasks, checkedTaskIds]);

  // Run auto-detection once after tasks + initial checks are loaded
  const [didAutoDetect, setDidAutoDetect] = useState(false);
  useEffect(() => {
    if (!loading && tasks.length > 0 && !didAutoDetect) {
      setDidAutoDetect(true);
      void runAutoDetection();
    }
  }, [loading, tasks, didAutoDetect, runAutoDetection]);

  // ── Keep global store in sync ────────────────────────────────────────────

  useEffect(() => {
    const completed = tasks.filter((t) => checkedTaskIds.has(t.id)).length;
    setProgress(completed, tasks.length);
  }, [tasks, checkedTaskIds, setProgress]);

  // ── Manual toggle ────────────────────────────────────────────────────────

  const toggleTaskCheck = async (taskId: string, currentlyAuto: boolean) => {
    if (!user?.id || !activeTenant?.id) {
      toast.error('Faça login para marcar tarefas');
      return;
    }
    if (currentlyAuto) {
      toast.info('Esta tarefa foi concluída automaticamente pelo sistema');
      return;
    }

    const wasChecked = checkedTaskIds.has(taskId);
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (wasChecked) next.delete(taskId); else next.add(taskId);
      return next;
    });

    const { error } = await (supabase as any)
      .from('implementation_task_checks')
      .upsert({
        tenant_id: activeTenant.id,
        user_id: user.id,
        task_id: taskId,
        is_checked: !wasChecked,
        checked_at: !wasChecked ? new Date().toISOString() : null,
        auto_detected: false,
      }, { onConflict: 'task_id,tenant_id,user_id' });

    if (error) {
      console.error('Erro ao atualizar check:', error);
      toast.error('Falha ao atualizar checklist');
      setCheckedTaskIds((prev) => {
        const next = new Set(prev);
        if (wasChecked) next.add(taskId); else next.delete(taskId);
        return next;
      });
    }
  };

  // ── Group tasks ──────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const months: Record<string, {
      title: string; order: number;
      weeks: Record<string, { title: string; order: number; tasks: ImplementationTask[] }>;
    }> = {};

    for (const task of tasks) {
      if (!months[task.month_title]) {
        months[task.month_title] = { title: task.month_title, order: task.month_order, weeks: {} };
      }
      const wk = task.week_title || '__';
      if (!months[task.month_title].weeks[wk]) {
        months[task.month_title].weeks[wk] = { title: task.week_title || '', order: task.week_order, tasks: [] };
      }
      months[task.month_title].weeks[wk].tasks.push(task);
    }

    return Object.values(months)
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ ...m, weeks: Object.values(m.weeks).sort((a, b) => a.order - b.order) }));
  }, [tasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => checkedTaskIds.has(t.id)).length;
  const autoCompleted = tasks.filter((t) => autoTaskIds.has(t.id) && checkedTaskIds.has(t.id)).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleMonth = (title: string) => setOpenMonths((p) => ({ ...p, [title]: !p[title] }));
  const toggleWeek = (key: string) => setOpenWeeks((p) => ({ ...p, [key]: !p[key] }));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-6 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Checklist de Implementação</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Seu guia passo a passo. Tarefas com <Zap className="inline w-3.5 h-3.5 text-amber-400" /> são marcadas automaticamente pelo uso do sistema.
              </p>
            </div>
            <button
              onClick={() => {
                setDidAutoDetect(false);
                void fetchTaskChecks().then(() => void runAutoDetection());
              }}
              disabled={detecting || loading}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
              title="Verificar progresso automático agora"
            >
              <RefreshCw className={`w-4 h-4 ${detecting ? 'animate-spin text-amber-400' : 'text-muted-foreground'}`} />
              {detecting ? 'Verificando...' : 'Atualizar'}
            </button>
          </div>

          {/* Overall Progress */}
          <div className="rounded-xl border border-border bg-card p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Meu Progresso</span>
              <div className="flex items-center gap-3">
                {autoCompleted > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                    <Zap className="w-3 h-3" />
                    {autoCompleted} automáticas
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{completedTasks}/{totalTasks} tarefas</span>
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {progressPercent === 0
                  ? 'Use o sistema para começar a progredir automaticamente!'
                  : progressPercent === 100
                  ? '🎉 Programa completo!'
                  : 'Continue assim — cada ação no sistema conta!'}
              </span>
              <span className="text-sm font-bold text-amber-400">{progressPercent}%</span>
            </div>
          </div>

          {/* Empty state */}
          {!loading && tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
              <p className="text-xs text-muted-foreground">O administrador precisa cadastrar as tarefas do programa.</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
            </div>
          )}

          {/* Months */}
          {!loading && (
            <div className="space-y-3">
              {grouped.map((month) => {
                const isOpen = openMonths[month.title] ?? true;
                const monthTasks = month.weeks.flatMap((w) => w.tasks);
                const monthDone = monthTasks.filter((t) => checkedTaskIds.has(t.id)).length;
                const monthPct = monthTasks.length > 0 ? Math.round((monthDone / monthTasks.length) * 100) : 0;

                return (
                  <div key={month.title} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleMonth(month.title)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-amber-400" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm font-semibold text-foreground">{month.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{monthDone}/{monthTasks.length}</span>
                        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${monthPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-amber-400 w-9 text-right">{monthPct}%</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        {month.weeks.map((week) => {
                          const wKey = `${month.title}-${week.title}`;
                          const isWeekOpen = openWeeks[wKey] ?? true;
                          const weekDone = week.tasks.filter((t) => checkedTaskIds.has(t.id)).length;

                          return (
                            <div key={wKey}>
                              {week.title && (
                                <button
                                  onClick={() => toggleWeek(wKey)}
                                  className="w-full flex items-center justify-between px-8 py-3 hover:bg-secondary/30 transition-colors border-b border-border"
                                >
                                  <div className="flex items-center gap-2">
                                    {isWeekOpen
                                      ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <span className="text-[13px] font-medium text-foreground flex items-center gap-2">
                                      <span className="w-0.5 h-4 bg-amber-400 rounded-full" />
                                      {week.title}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{weekDone}/{week.tasks.length}</span>
                                </button>
                              )}

                              {(isWeekOpen || !week.title) && (
                                <div>
                                  {week.tasks.map((task) => {
                                    const isChecked = checkedTaskIds.has(task.id);
                                    const isAuto = autoTaskIds.has(task.id) && isChecked;
                                    const isAutoTrigger = task.trigger_type && task.trigger_type !== 'manual';

                                    return (
                                      <div
                                        key={task.id}
                                        className={`flex items-center gap-3 px-12 py-3 border-b border-border last:border-b-0 transition-colors ${
                                          isAuto
                                            ? 'bg-amber-400/5'
                                            : isChecked
                                            ? 'bg-emerald-500/5'
                                            : 'hover:bg-secondary/20'
                                        }`}
                                      >
                                        {/* Checkbox */}
                                        <button
                                          type="button"
                                          className="shrink-0"
                                          onClick={() => void toggleTaskCheck(task.id, isAuto)}
                                          title={
                                            isAuto
                                              ? 'Concluída automaticamente pelo sistema'
                                              : isChecked
                                              ? 'Desmarcar'
                                              : 'Marcar como concluída'
                                          }
                                        >
                                          {isChecked ? (
                                            <CheckCircle2
                                              className={`w-4 h-4 ${isAuto ? 'text-amber-400' : 'text-emerald-500'}`}
                                            />
                                          ) : (
                                            <Circle
                                              className={`w-4 h-4 ${
                                                task.status === 'in-progress'
                                                  ? 'text-amber-400'
                                                  : 'text-muted-foreground/40'
                                              }`}
                                            />
                                          )}
                                        </button>

                                        {/* Status label */}
                                        <span
                                          className={`text-[11px] w-[90px] shrink-0 font-medium ${
                                            isAuto
                                              ? 'text-amber-400'
                                              : isChecked
                                              ? 'text-emerald-500'
                                              : task.status === 'in-progress'
                                              ? 'text-amber-400'
                                              : 'text-muted-foreground'
                                          }`}
                                        >
                                          {isAuto ? 'Auto ✓' : isChecked ? 'Concluída' : task.status === 'in-progress' ? 'Em progresso' : 'Não iniciada'}
                                        </span>

                                        {/* Title */}
                                        <span
                                          className={`text-sm flex-1 leading-snug ${
                                            isChecked ? 'line-through text-muted-foreground' : 'text-foreground'
                                          }`}
                                        >
                                          {task.task_title}
                                        </span>

                                        {/* Auto trigger icon */}
                                        {isAutoTrigger && !isAuto && (
                                          <Zap
                                            className="w-3.5 h-3.5 text-amber-400/50 shrink-0"
                                            title={`Será marcada automaticamente ao: ${
                                              task.trigger_type === 'document'
                                                ? `criar documento ${task.trigger_value || ''}`
                                                : task.trigger_type === 'agent'
                                                ? `usar agente ${task.trigger_value || ''}`
                                                : task.trigger_type === 'lesson'
                                                ? 'concluir aula'
                                                : 'registrar métrica'
                                            }`}
                                          />
                                        )}

                                        {/* Tags */}
                                        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                          {task.tags?.map((tag, i) => (
                                            <span
                                              key={i}
                                              className={`${getTagColor(task.tag_colors?.[i])} text-white text-[10px] px-2 py-0.5 rounded-md font-medium`}
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>

                                        {/* Link */}
                                        {task.url && (
                                          <a
                                            href={task.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
