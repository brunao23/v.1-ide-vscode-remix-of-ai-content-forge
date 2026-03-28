import { useState } from "react";
import { Play, Clock, CheckCircle, Lock, ChevronRight, ChevronDown, GraduationCap, Loader2 } from "lucide-react";
import { LoomEmbed } from "@/components/video/LoomEmbed";
import { useLessons } from "@/hooks/useLessons";

export default function AulasPage() {
  const { modules, completedLessons, loading, getLessonsByModule, toggleCompleted } = useLessons();
  const [selectedLesson, setSelectedLesson] = useState<{ id: string; title: string; description: string | null; loom_id: string; duration: string | null; module_id: string; order_index: number } | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  // Auto-expand first module when data loads
  if (modules.length > 0 && expandedModules.length === 0) {
    setExpandedModules([modules[0].id]);
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const getNextLesson = () => {
    if (!selectedLesson) return null;
    const allLessons = modules.flatMap(m => getLessonsByModule(m.id));
    const idx = allLessons.findIndex(l => l.id === selectedLesson.id);
    return idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;
  };

  const nextLesson = getNextLesson();

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Lista de aulas */}
      <div className="w-[320px] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Aulas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Aprenda a usar a plataforma</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {modules.map(module => {
            const moduleLessons = getLessonsByModule(module.id);
            return (
              <div key={module.id}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary-foreground">{module.order_index}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{module.title}</p>
                      <p className="text-xs text-muted-foreground">{moduleLessons.length} aulas</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedModules.includes(module.id) ? "rotate-180" : ""}`} />
                </button>

                {expandedModules.includes(module.id) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {moduleLessons.map(lesson => (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLesson(lesson)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          selectedLesson?.id === lesson.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-secondary"
                        }`}
                      >
                        <div className="shrink-0">
                          {completedLessons.has(lesson.id) ? (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          ) : (
                            <Play className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm text-foreground truncate">{lesson.title}</p>
                          {lesson.duration && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {lesson.duration}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player de vídeo */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-background">
        {selectedLesson ? (
          <>
            <div className="p-6">
              <LoomEmbed videoId={selectedLesson.loom_id} title={selectedLesson.title} />
            </div>

            <div className="px-6 pb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">{selectedLesson.title}</h2>
              {selectedLesson.description && (
                <p className="text-muted-foreground">{selectedLesson.description}</p>
              )}

              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={() => toggleCompleted(selectedLesson.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    completedLessons.has(selectedLesson.id)
                      ? "bg-primary/10 text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-accent"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {completedLessons.has(selectedLesson.id) ? "Concluída" : "Marcar como concluída"}
                </button>

                {nextLesson && (
                  <button
                    onClick={() => setSelectedLesson(nextLesson)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                  >
                    Próxima aula
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Selecione uma aula</h2>
            <p className="text-muted-foreground max-w-md">
              Escolha uma aula no menu lateral para começar a assistir
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
