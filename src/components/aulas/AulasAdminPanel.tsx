import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, GripVertical, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface Props {
  modules: Module[];
  getLessonsByModule: (moduleId: string) => Lesson[];
  onDataChanged: () => void;
}

export default function AulasAdminPanel({ modules, getLessonsByModule, onDataChanged }: Props) {
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [newModule, setNewModule] = useState(false);
  const [newLessonForModule, setNewLessonForModule] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", loom_id: "", duration: "" });

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Module CRUD
  const handleSaveModule = async (id?: string) => {
    if (!moduleForm.title.trim()) { toast.error("Título é obrigatório"); return; }

    if (id) {
      const { error } = await supabase.from("lesson_modules").update({
        title: moduleForm.title,
        description: moduleForm.description || null,
      }).eq("id", id);
      if (error) { console.error("Erro ao atualizar módulo:", error); toast.error("Erro ao atualizar módulo: " + error.message); return; }
      toast.success("Módulo atualizado");
    } else {
      const maxOrder = modules.length > 0 ? Math.max(...modules.map(m => m.order_index)) + 1 : 1;
      const { error } = await supabase.from("lesson_modules").insert({
        title: moduleForm.title,
        description: moduleForm.description || null,
        order_index: maxOrder,
      });
      if (error) { console.error("Erro ao criar módulo:", error); toast.error("Erro ao criar módulo: " + error.message); return; }
      toast.success("Módulo criado");
    }

    setEditingModule(null);
    setNewModule(false);
    setModuleForm({ title: "", description: "" });
    onDataChanged();
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Excluir este módulo e todas as suas aulas?")) return;
    // Delete lessons first
    await supabase.from("lessons").delete().eq("module_id", id);
    const { error } = await supabase.from("lesson_modules").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir módulo"); return; }
    toast.success("Módulo excluído");
    onDataChanged();
  };

  // Lesson CRUD
  const handleSaveLesson = async (moduleId: string, id?: string) => {
    if (!lessonForm.title.trim() || !lessonForm.loom_id.trim()) {
      toast.error("Título e Loom ID são obrigatórios");
      return;
    }

    if (id) {
      const { error } = await supabase.from("lessons").update({
        title: lessonForm.title,
        description: lessonForm.description || null,
        loom_id: lessonForm.loom_id,
        duration: lessonForm.duration || null,
      }).eq("id", id);
      if (error) { console.error("Erro ao atualizar aula:", error); toast.error("Erro ao atualizar aula: " + error.message); return; }
      toast.success("Aula atualizada");
    } else {
      const moduleLessons = getLessonsByModule(moduleId);
      const maxOrder = moduleLessons.length > 0 ? Math.max(...moduleLessons.map(l => l.order_index)) + 1 : 1;
      const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title: lessonForm.title,
        description: lessonForm.description || null,
        loom_id: lessonForm.loom_id,
        duration: lessonForm.duration || null,
        order_index: maxOrder,
      });
      if (error) { console.error("Erro ao criar aula:", error); toast.error("Erro ao criar aula: " + error.message); return; }
      toast.success("Aula criada");
    }

    setEditingLesson(null);
    setNewLessonForModule(null);
    setLessonForm({ title: "", description: "", loom_id: "", duration: "" });
    onDataChanged();
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir aula"); return; }
    toast.success("Aula excluída");
    onDataChanged();
  };

  const startEditModule = (m: Module) => {
    setEditingModule(m.id);
    setModuleForm({ title: m.title, description: m.description || "" });
  };

  const startEditLesson = (l: Lesson) => {
    setEditingLesson(l.id);
    setLessonForm({ title: l.title, description: l.description || "", loom_id: l.loom_id, duration: l.duration || "" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Gerenciar Aulas
        </h2>
        <Button size="sm" onClick={() => { setNewModule(true); setModuleForm({ title: "", description: "" }); }}>
          <Plus className="w-4 h-4 mr-1" /> Módulo
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* New module form */}
        {newModule && (
          <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
            <Input placeholder="Título do módulo" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Descrição (opcional)" value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveModule()}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setNewModule(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {modules.map(module => {
          const moduleLessons = getLessonsByModule(module.id);
          const isExpanded = expandedModules.includes(module.id);

          return (
            <div key={module.id} className="border border-border rounded-lg overflow-hidden">
              {/* Module header */}
              {editingModule === module.id ? (
                <div className="p-4 space-y-3 bg-secondary/30">
                  <Input placeholder="Título" value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} />
                  <Textarea placeholder="Descrição" value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px]" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveModule(module.id)}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingModule(null)}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 hover:bg-secondary/30 cursor-pointer" onClick={() => toggleExpand(module.id)}>
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{module.title}</p>
                      <p className="text-xs text-muted-foreground">{moduleLessons.length} aulas · Ordem: {module.order_index}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditModule(module)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteModule(module.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
              )}

              {/* Lessons list */}
              {isExpanded && (
                <div className="border-t border-border bg-background">
                  {moduleLessons.map(lesson => (
                    <div key={lesson.id} className="border-b border-border last:border-0">
                      {editingLesson === lesson.id ? (
                        <div className="p-3 space-y-2 bg-secondary/20">
                          <Input placeholder="Título da aula" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                          <Textarea placeholder="Descrição" value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px]" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Loom ID ou URL" value={lessonForm.loom_id} onChange={e => setLessonForm(f => ({ ...f, loom_id: e.target.value }))} />
                            <Input placeholder="Duração (ex: 5min)" value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveLesson(module.id, lesson.id)}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingLesson(null)}><X className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 hover:bg-secondary/20">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">Loom: {lesson.loom_id.substring(0, 20)}... · {lesson.duration || "sem duração"}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditLesson(lesson)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLesson(lesson.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* New lesson form */}
                  {newLessonForModule === module.id ? (
                    <div className="p-3 space-y-2 bg-primary/5 border-t border-border">
                      <Input placeholder="Título da aula" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                      <Textarea placeholder="Descrição" value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} className="min-h-[60px]" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Loom ID ou URL" value={lessonForm.loom_id} onChange={e => setLessonForm(f => ({ ...f, loom_id: e.target.value }))} />
                        <Input placeholder="Duração (ex: 5min)" value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveLesson(module.id)}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setNewLessonForModule(null); setLessonForm({ title: "", description: "", loom_id: "", duration: "" }); }}><X className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNewLessonForModule(module.id); setLessonForm({ title: "", description: "", loom_id: "", duration: "" }); }}
                      className="w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/20 flex items-center justify-center gap-1 border-t border-border"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar aula
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
