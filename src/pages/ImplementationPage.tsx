import { useState } from 'react';
import { ChevronDown, ChevronRight, Circle, CheckCircle2, ExternalLink } from 'lucide-react';
import Header from '@/components/layout/Header';

interface Task {
  id: string;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed';
  tags?: { label: string; color: string }[];
  url?: string;
}

interface Week {
  id: string;
  title: string;
  tasks: Task[];
}

interface Month {
  id: string;
  title: string;
  weeks: Week[];
}

const IMPLEMENTATION_DATA: Month[] = [
  {
    id: 'month-1',
    title: 'Month 1 – Orientação, Visão + Modelo',
    weeks: [
      {
        id: 'w1-1',
        title: 'Week 1 – One Simple Offer™',
        tasks: [
          { id: 't1', title: 'One Simple Offer™ Builder', status: 'not-started', tags: [{ label: 'Level 3 – Transform', color: 'bg-sky-600' }, { label: 'Scalable Offer', color: 'bg-emerald-600' }] },
          { id: 't2', title: 'The Roadmap Builder™', status: 'not-started', tags: [{ label: 'Level 3 – Transform', color: 'bg-sky-600' }, { label: 'Scalable Offer', color: 'bg-emerald-600' }] },
          { id: 't3', title: 'Client CRM Setup', status: 'not-started', tags: [{ label: 'Level 3 – Transform', color: 'bg-sky-600' }, { label: 'Scalable Offer', color: 'bg-emerald-600' }] },
        ],
      },
      {
        id: 'w1-2',
        title: 'Week 2 – V1 Offer Doc',
        tasks: [
          { id: 't4', title: 'Create V1 Offer Doc', status: 'not-started', tags: [{ label: 'Level 3 – Transform', color: 'bg-sky-600' }, { label: 'Scalable Offer', color: 'bg-emerald-600' }] },
          { id: 't5', title: 'POSI – Level 3 – Transform', status: 'not-started', tags: [{ label: 'Level 3 – Transform', color: 'bg-sky-600' }, { label: 'Scalable Offer', color: 'bg-emerald-600' }] },
        ],
      },
      {
        id: 'w1-3',
        title: 'Week 3 – The $20k Sprint 🏁',
        tasks: [
          { id: 't6', title: 'Choose Sprint Play 🎯', status: 'not-started', tags: [{ label: '🏁 The 20k Sprint', color: 'bg-sky-600' }, { label: 'Cash In Bank 💰', color: 'bg-emerald-600' }] },
        ],
      },
    ],
  },
  {
    id: 'month-2',
    title: 'Month 2 – Transform',
    weeks: [
      {
        id: 'w2-1',
        title: 'Week 1 – Conteúdo & Marca',
        tasks: [
          { id: 't7', title: 'Brand Book Builder', status: 'not-started', tags: [{ label: 'Conteúdo', color: 'bg-amber-600' }] },
          { id: 't8', title: 'Pilares de Conteúdo', status: 'not-started', tags: [{ label: 'Conteúdo', color: 'bg-amber-600' }] },
        ],
      },
    ],
  },
];

export default function ImplementationPage() {
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({ 'month-1': false, 'month-2': true });
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({ 'w2-1': true });
  const [taskStatus, setTaskStatus] = useState<Record<string, Task['status']>>({});

  const toggleMonth = (id: string) => setOpenMonths(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleWeek = (id: string) => setOpenWeeks(prev => ({ ...prev, [id]: !prev[id] }));

  const getStatus = (taskId: string, defaultStatus: Task['status']) => taskStatus[taskId] ?? defaultStatus;
  const cycleStatus = (taskId: string, current: Task['status']) => {
    const next: Record<Task['status'], Task['status']> = { 'not-started': 'in-progress', 'in-progress': 'completed', 'completed': 'not-started' };
    setTaskStatus(prev => ({ ...prev, [taskId]: next[current] }));
  };

  const totalTasks = IMPLEMENTATION_DATA.flatMap(m => m.weeks.flatMap(w => w.tasks)).length;
  const completedTasks = IMPLEMENTATION_DATA.flatMap(m => m.weeks.flatMap(w => w.tasks)).filter(t => getStatus(t.id, t.status) === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-6 py-10">
          <h1 className="text-2xl font-semibold text-foreground mb-6">Implementation Checklist</h1>

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

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
            <span>Implementation Milestone</span>
            <span className="w-[200px] text-center">Tags</span>
            <span className="w-[60px] text-center">Progress</span>
          </div>

          {/* Months */}
          <div className="space-y-2">
            {IMPLEMENTATION_DATA.map((month) => {
              const isMonthOpen = openMonths[month.id] ?? false;
              const monthTasks = month.weeks.flatMap(w => w.tasks);
              const monthCompleted = monthTasks.filter(t => getStatus(t.id, t.status) === 'completed').length;

              return (
                <div key={month.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Month header */}
                  <button
                    onClick={() => toggleMonth(month.id)}
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

                  {/* Weeks */}
                  {isMonthOpen && (
                    <div className="border-t border-border">
                      {month.weeks.map((week) => {
                        const isWeekOpen = openWeeks[week.id] ?? false;
                        return (
                          <div key={week.id}>
                            <button
                              onClick={() => toggleWeek(week.id)}
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

                            {isWeekOpen && (
                              <div>
                                {week.tasks.map((task) => {
                                  const status = getStatus(task.id, task.status);
                                  return (
                                    <div
                                      key={task.id}
                                      className="flex items-center gap-3 px-12 py-3 border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors"
                                    >
                                      <button onClick={() => cycleStatus(task.id, status)} className="shrink-0">
                                        {status === 'completed' ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <Circle className={`w-4 h-4 ${status === 'in-progress' ? 'text-amber-400' : 'text-muted-foreground/40'}`} />
                                        )}
                                      </button>
                                      <span className="text-xs text-muted-foreground w-[70px] shrink-0">
                                        {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Not started'}
                                      </span>
                                      <span className={`text-sm flex-1 ${status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {task.title}
                                      </span>
                                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                        {task.tags?.map((tag, i) => (
                                          <span key={i} className={`${tag.color} text-white text-[10px] px-2 py-0.5 rounded-md font-medium`}>
                                            {tag.label}
                                          </span>
                                        ))}
                                      </div>
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
        </div>
      </div>
    </div>
  );
}
