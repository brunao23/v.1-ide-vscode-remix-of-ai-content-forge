import { useState } from "react";
import { Play, Clock, CheckCircle, Lock, ChevronRight, ChevronDown, GraduationCap } from "lucide-react";
import { LoomEmbed } from "@/components/video/LoomEmbed";

interface Aula {
  id: string;
  title: string;
  description: string;
  duration: string;
  loomId: string;
  moduleId: string;
  order: number;
  completed?: boolean;
  locked?: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
}

const modules: Module[] = [
  { id: "mod-1", title: "Módulo 1: Fundamentos", description: "Aprenda os conceitos básicos da plataforma", order: 1 },
  { id: "mod-2", title: "Módulo 2: Brand Book", description: "Como criar seu Brand Book completo", order: 2 },
  { id: "mod-3", title: "Módulo 3: Pesquisa de Mercado", description: "Técnicas de pesquisa e análise", order: 3 },
];

const aulasData: Aula[] = [
  { id: "aula-1", title: "Bem-vindo à plataforma", description: "Visão geral de todas as funcionalidades", duration: "8:45", loomId: "8a2a4f16118f4ce88b1f3c596a95ee5b", moduleId: "mod-1", order: 1, completed: true },
  { id: "aula-2", title: "Como navegar pelo dashboard", description: "Tour completo pela interface", duration: "12:30", loomId: "1ede5af31710469fb89e8f89bd0160fa", moduleId: "mod-1", order: 2 },
];

export default function AulasPage() {
  const [selectedAula, setSelectedAula] = useState<Aula | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>(["mod-1"]);
  const [completedAulas, setCompletedAulas] = useState<Set<string>>(
    new Set(aulasData.filter(a => a.completed).map(a => a.id))
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const getAulasByModule = (moduleId: string) =>
    aulasData.filter(a => a.moduleId === moduleId).sort((a, b) => a.order - b.order);

  const toggleCompleted = (aulaId: string) => {
    setCompletedAulas(prev => {
      const next = new Set(prev);
      if (next.has(aulaId)) next.delete(aulaId);
      else next.add(aulaId);
      return next;
    });
  };

  const getNextAula = () => {
    if (!selectedAula) return null;
    const allAulas = modules.flatMap(m => getAulasByModule(m.id));
    const idx = allAulas.findIndex(a => a.id === selectedAula.id);
    return idx >= 0 && idx < allAulas.length - 1 ? allAulas[idx + 1] : null;
  };

  const nextAula = getNextAula();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Lista de aulas (sidebar esquerda) */}
      <div className="w-[320px] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Aulas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Aprenda a usar a plataforma</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {modules.map(module => (
            <div key={module.id}>
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{module.order}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{module.title}</p>
                    <p className="text-xs text-muted-foreground">{getAulasByModule(module.id).length} aulas</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedModules.includes(module.id) ? "rotate-180" : ""}`} />
              </button>

              {expandedModules.includes(module.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {getAulasByModule(module.id).map(aula => (
                    <button
                      key={aula.id}
                      onClick={() => !aula.locked && setSelectedAula(aula)}
                      disabled={aula.locked}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedAula?.id === aula.id
                          ? "bg-primary/10 border border-primary/30"
                          : aula.locked
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-secondary"
                      }`}
                    >
                      <div className="shrink-0">
                        {completedAulas.has(aula.id) ? (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        ) : aula.locked ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Play className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm text-foreground truncate">{aula.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {aula.duration}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Player de vídeo */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-background">
        {selectedAula ? (
          <>
            <div className="p-6">
              <LoomEmbed videoId={selectedAula.loomId} title={selectedAula.title} />
            </div>

            <div className="px-6 pb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">{selectedAula.title}</h2>
              <p className="text-muted-foreground">{selectedAula.description}</p>

              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={() => toggleCompleted(selectedAula.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    completedAulas.has(selectedAula.id)
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-foreground hover:bg-accent"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {completedAulas.has(selectedAula.id) ? "Concluída" : "Marcar como concluída"}
                </button>

                {nextAula && (
                  <button
                    onClick={() => setSelectedAula(nextAula)}
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
