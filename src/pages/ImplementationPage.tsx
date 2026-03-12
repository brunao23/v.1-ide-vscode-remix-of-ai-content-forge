import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Circle, CheckCircle2, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

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

// Default Google Sheet URL — admin can change this
const SHEET_URL_KEY = 'implementation_sheet_url';

export default function ImplementationPage() {
  const [tasks, setTasks] = useState<ImplementationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || '');
  const [showSettings, setShowSettings] = useState(false);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  // Fetch tasks from DB
  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Sync from Google Sheet
  const handleSync = async () => {
    if (!sheetUrl) {
      setShowSettings(true);
      toast.error('Configure a URL da planilha primeiro');
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-implementation', {
        body: { sheet_url: sheetUrl },
      });
      if (error) throw error;
      toast.success(`Sincronizado! ${data.count} tarefas importadas.`);
      await fetchTasks();
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar com a planilha');
    } finally {
      setSyncing(false);
    }
  };

  const saveSheetUrl = (url: string) => {
    setSheetUrl(url);
    localStorage.setItem(SHEET_URL_KEY, url);
  };

  // Group tasks by month → week
  const grouped = useMemo(() => {
    const months: Record<string, { title: string; order: number; weeks: Record<string, { title: string; order: number; tasks: ImplementationTask[] }> }> = {};
    for (const task of tasks) {
      if (!months[task.month_title]) {
        months[task.month_title] = { title: task.month_title, order: task.month_order, weeks: {} };
      }
      const weekKey = task.week_title || '__no_week__';
      if (!months[task.month_title].weeks[weekKey]) {
        months[task.month_title].weeks[weekKey] = { title: task.week_title || '', order: task.week_order, tasks: [] };
      }
      months[task.month_title].weeks[weekKey].tasks.push(task);
    }
    return Object.values(months)
      .sort((a, b) => a.order - b.order)
      .map(m => ({
        ...m,
        weeks: Object.values(m.weeks).sort((a, b) => a.order - b.order),
      }));
  }, [tasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleMonth = (title: string) => setOpenMonths(prev => ({ ...prev, [title]: !prev[title] }));
  const toggleWeek = (key: string) => setOpenWeeks(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-6 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Implementation Checklist</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-secondary"
              >
                ⚙️ Configurar
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="rounded-xl border border-border bg-card p-5 mb-6 space-y-3">
              <h3 className="text-sm font-medium text-foreground">URL da Planilha (CSV público)</h3>
              <p className="text-xs text-muted-foreground">
                No Google Sheets: Arquivo → Compartilhar → Publicar na Web → selecione a aba → formato CSV → Publicar. Cole a URL abaixo.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={e => saveSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                  className="flex-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => { setShowSettings(false); toast.success('URL salva!'); }}
                  className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  Salvar
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Colunas esperadas na planilha:</p>
                <code className="block bg-secondary rounded px-2 py-1 text-[11px]">
                  month_title | month_order | week_title | week_order | task_title | task_order | status | tags | tag_colors | url
                </code>
                <p>• <strong>tags</strong>: separar por <code>|</code> (ex: <code>Level 3|Scalable Offer</code>)</p>
                <p>• <strong>tag_colors</strong>: separar por <code>|</code> (ex: <code>blue|green</code>). Opções: blue, green, amber, red, purple, cyan, pink</p>
                <p>• <strong>status</strong>: not-started, in-progress, completed</p>
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div className="rounded-xl border border-border bg-card p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className="text-xs text-muted-foreground">{completedTasks} of {totalTasks} tasks completed</span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right">{progressPercent}%</p>
          </div>

          {/* Empty state */}
          {!loading && tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
              <p className="text-xs text-muted-foreground">Configure a URL da planilha e clique em "Sincronizar" para importar as tarefas.</p>
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
            <div className="space-y-2">
              {grouped.map((month) => {
                const isMonthOpen = openMonths[month.title] ?? true;
                const monthTasks = month.weeks.flatMap(w => w.tasks);
                const monthCompleted = monthTasks.filter(t => t.status === 'completed').length;

                return (
                  <div key={month.title} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleMonth(month.title)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isMonthOpen
                          ? <ChevronDown className="w-4 h-4 text-amber-400" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                        <span className="text-sm font-semibold text-foreground">{month.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{monthCompleted}/{monthTasks.length}</span>
                        <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: monthTasks.length > 0 ? `${(monthCompleted / monthTasks.length) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </button>

                    {isMonthOpen && (
                      <div className="border-t border-border">
                        {month.weeks.map((week) => {
                          const weekKey = `${month.title}-${week.title}`;
                          const isWeekOpen = openWeeks[weekKey] ?? true;
                          return (
                            <div key={weekKey}>
                              {week.title && (
                                <button
                                  onClick={() => toggleWeek(weekKey)}
                                  className="w-full flex items-center gap-2 px-8 py-3 hover:bg-secondary/30 transition-colors border-b border-border"
                                >
                                  {isWeekOpen
                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                  }
                                  <span className="text-[13px] font-medium text-foreground flex items-center gap-2">
                                    <span className="w-0.5 h-4 bg-amber-400 rounded-full" />
                                    {week.title}
                                  </span>
                                </button>
                              )}

                              {(isWeekOpen || !week.title) && (
                                <div>
                                  {week.tasks.map((task) => (
                                    <div
                                      key={task.id}
                                      className="flex items-center gap-3 px-12 py-3 border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors"
                                    >
                                      <div className="shrink-0">
                                        {task.status === 'completed' ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <Circle className={`w-4 h-4 ${task.status === 'in-progress' ? 'text-amber-400' : 'text-muted-foreground/40'}`} />
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground w-[70px] shrink-0">
                                        {task.status === 'completed' ? 'Completed' : task.status === 'in-progress' ? 'In progress' : 'Not started'}
                                      </span>
                                      <span className={`text-sm flex-1 ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {task.task_title}
                                      </span>
                                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                        {task.tags?.map((tag, i) => (
                                          <span key={i} className={`${getTagColor(task.tag_colors?.[i])} text-white text-[10px] px-2 py-0.5 rounded-md font-medium`}>
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                      {task.url && (
                                        <a href={task.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
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
