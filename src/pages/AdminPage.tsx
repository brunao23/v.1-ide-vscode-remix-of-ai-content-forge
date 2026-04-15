import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/stores/chatStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type TenantOverview = { id: string; slug: string; name: string; is_active: boolean; active_users_count: number };
type TenantUser = { user_id: string; email: string | null; full_name: string | null; role: "owner" | "admin" | "member" | "viewer"; is_active: boolean; default_tenant_id: string | null };
type AdminUser = { key: string; tenantId: string; tenantName: string; tenantSlug: string; userId: string; fullName: string; email: string | null; role: TenantUser["role"]; isActive: boolean; defaultTenantId: string | null };
type SystemDocumentRow = { id: string; name: string; content: string; applies_to_agents: string[]; is_mandatory: boolean; is_active: boolean };
type AgentPromptRow = { id: string; agent_id: string; name: string; description: string | null; recommended_model: string | null; requires_documents: string[] | null; uses_documents_context: boolean; system_prompt: string };
type InsightWindow = 7 | 15 | 30;
type UserMetrics = { submissions: number; checks: number; chats: number; lessons: number; engagement: number; commitment: number; health: number };
type Props = { tab?: "insights" | "global" | "access" };
type DocumentForm = { id: string | null; name: string; content: string; appliesToAgentsText: string; isMandatory: boolean; isActive: boolean };
type PromptForm = { id: string | null; agentId: string; name: string; description: string; recommendedModel: string; requiresDocumentsText: string; usesDocumentsContext: boolean; systemPrompt: string };

const TECH_PATTERNS = [/\bexample\.com\b/i, /\brag[\s_-]?/i, /\bretry(chat)?\b/i, /\bproviderroute\b/i, /\bthink-gemini\b/i, /\bnullcontent\b/i, /\bpinecone\b/i, /\bcheck user\b/i, /[+_-]\d{8,}/i, /-\d{10,}/];
const WINDOWS: InsightWindow[] = [7, 15, 30];
const emptyMetrics: UserMetrics = { submissions: 0, checks: 0, chats: 0, lessons: 0, engagement: 0, commitment: 0, health: 0 };
const initialDocument: DocumentForm = { id: null, name: "", content: "", appliesToAgentsText: "", isMandatory: false, isActive: true };
const initialPrompt: PromptForm = { id: null, agentId: "", name: "", description: "", recommendedModel: "", requiresDocumentsText: "", usesDocumentsContext: false, systemPrompt: "" };

const pct = (n: number) => `${Math.round(n)}%`;
const clamp = (n: number) => Math.max(0, Math.min(100, Number.isNaN(n) ? 0 : n));
const daysAgoIso = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };
const daysAgoDate = (days: number) => daysAgoIso(days).slice(0, 10);
const parseCsv = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
const csv = (v?: string[] | null) => (v || []).join(", ");

const isTechnical = (u: AdminUser) => TECH_PATTERNS.some((p) => p.test(`${u.fullName} ${u.email || ""} ${u.tenantName} ${u.tenantSlug}`.toLowerCase()));

const preferUser = (current: AdminUser, candidate: AdminUser, activeTenantId?: string) => {
  const candDefault = !!candidate.defaultTenantId && candidate.defaultTenantId === candidate.tenantId;
  const currDefault = !!current.defaultTenantId && current.defaultTenantId === current.tenantId;
  if (candDefault !== currDefault) return candDefault;
  const candTenant = !!activeTenantId && candidate.tenantId === activeTenantId;
  const currTenant = !!activeTenantId && current.tenantId === activeTenantId;
  if (candTenant !== currTenant) return candTenant;
  if (candidate.role === "owner" && current.role !== "owner") return true;
  if (candidate.role === "admin" && current.role === "member") return true;
  return false;
};

async function adminAction(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-tenants-users", { body: { action, ...payload } });
  if (error) throw new Error(error.message || "Erro na funcao admin-tenants-users");
  if (!data?.success) throw new Error(data?.error || "Falha na operacao administrativa");
  return data.data;
}

function metrics(windowDays: InsightWindow, events: any, totalTasks: number): UserMetrics {
  const minDate = daysAgoDate(windowDays);
  const minIso = daysAgoIso(windowDays);
  const weekly = (events.weekly || []).filter((r: any) => String(r.reference_date) >= minDate);
  const monthly = (events.monthly || []).filter((r: any) => String(r.created_at) >= minIso);
  const deals = (events.deals || []).filter((r: any) => String(r.deal_date) >= minDate);
  const checks = (events.checks || []).filter((r: any) => String(r.checked_at || r.updated_at) >= minIso);
  const chats = (events.chats || []).filter((r: any) => String(r.created_at) >= minIso);
  const lessons = (events.lessons || []).filter((r: any) => String(r.completed_at || r.created_at) >= minIso);
  const submissions = weekly.length + monthly.length + deals.length;
  const checksCount = checks.length;
  const chatsCount = chats.length;
  const lessonsCount = lessons.length;
  const submissionRate = submissions > 0 ? 100 : 0;
  const completionRate = totalTasks > 0 ? clamp((checksCount / totalTasks) * 100) : checksCount > 0 ? 100 : 0;
  const engagement = clamp(((chatsCount + lessonsCount * 2 + checksCount) / Math.max(5, totalTasks || 5)) * 100);
  const commitment = clamp(completionRate * 0.7 + submissionRate * 0.3);
  const health = clamp(engagement * 0.5 + commitment * 0.5);
  return { submissions, checks: checksCount, chats: chatsCount, lessons: lessonsCount, engagement, commitment, health };
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export default function AdminPage({ tab = "insights" }: Props) {
  const { user, isAdmin, signOut, activeTenant } = useAuth();
  const { setActivePage } = useChatStore();
  const db = supabase as any;

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [scopeCurrentTenantOnly, setScopeCurrentTenantOnly] = useState(true);
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [insightWindow, setInsightWindow] = useState<InsightWindow>(30);
  const [taskCount, setTaskCount] = useState(0);
  const [eventsByUser, setEventsByUser] = useState<any>({});

  const [systemDocuments, setSystemDocuments] = useState<SystemDocumentRow[]>([]);
  const [agentPrompts, setAgentPrompts] = useState<AgentPromptRow[]>([]);
  const [docForm, setDocForm] = useState<DocumentForm>(initialDocument);
  const [promptForm, setPromptForm] = useState<PromptForm>(initialPrompt);

  const selectedUser = useMemo(() => allUsers.find((u) => u.key === selectedUserKey) || null, [allUsers, selectedUserKey]);
  const uniqueUsersCount = useMemo(() => new Set(allUsers.map((u) => u.userId)).size, [allUsers]);
  const byWindow = useMemo<Record<InsightWindow, UserMetrics>>(() => ({ 7: metrics(7, eventsByUser, taskCount), 15: metrics(15, eventsByUser, taskCount), 30: metrics(30, eventsByUser, taskCount) }), [eventsByUser, taskCount]);
  const currentMetrics = byWindow[insightWindow] || emptyMetrics;

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const overview = (await adminAction("listOverview")) as TenantOverview[];
      let globalAdminIds: string[] = [];
      try { globalAdminIds = (await adminAction("listGlobalAdmins")) as string[]; } catch { globalAdminIds = user?.id ? [String(user.id)] : []; }
      const globalAdminSet = new Set(globalAdminIds.map(String));

      const scopedTenants = scopeCurrentTenantOnly && activeTenant?.id
        ? (overview || []).filter((t) => t.id === activeTenant.id)
        : (overview || []);

      const usersByTenant = await Promise.all(scopedTenants.map(async (tenant) => {
        const users = (await adminAction("listTenantUsers", { tenantId: tenant.id })) as TenantUser[];
        return (users || [])
          .filter((u) => !globalAdminSet.has(String(u.user_id)))
          .map((u) => ({
            key: u.user_id,
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            userId: u.user_id,
            fullName: u.full_name || u.email || u.user_id,
            email: u.email,
            role: u.role,
            isActive: Boolean(u.is_active),
            defaultTenantId: u.default_tenant_id || null,
          } as AdminUser));
      }));

      const deduped = new Map<string, AdminUser>();
      usersByTenant.flat().filter((u) => u.isActive).filter((u) => !isTechnical(u)).forEach((candidate) => {
        const current = deduped.get(candidate.userId);
        if (!current || preferUser(current, candidate, activeTenant?.id)) deduped.set(candidate.userId, candidate);
      });

      const users = Array.from(deduped.values()).sort((a, b) => {
        const aIsBruno = a.fullName.toLowerCase() === "bruno costa";
        const bIsBruno = b.fullName.toLowerCase() === "bruno costa";
        if (aIsBruno && !bIsBruno) return -1;
        if (!aIsBruno && bIsBruno) return 1;
        return a.fullName.localeCompare(b.fullName, "pt-BR");
      });

      setAllUsers(users);
      if (!selectedUserKey || !users.some((u) => u.key === selectedUserKey)) {
        const bruno = users.find((u) => u.fullName.toLowerCase() === "bruno costa");
        setSelectedUserKey((bruno || users[0] || null)?.key || "");
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar dados de administracao");
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadGlobal = async () => {
    setLoadingGlobal(true);
    try {
      const [docsRes, promptsRes] = await Promise.all([
        db.from("system_documents").select("id,name,content,applies_to_agents,is_mandatory,is_active").order("updated_at", { ascending: false }),
        db.from("agent_prompts").select("id,agent_id,name,description,recommended_model,requires_documents,uses_documents_context,system_prompt").order("updated_at", { ascending: false }),
      ]);
      const err = docsRes.error || promptsRes.error;
      if (err) throw new Error(err.message);
      setSystemDocuments((docsRes.data || []) as SystemDocumentRow[]);
      setAgentPrompts((promptsRes.data || []) as AgentPromptRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar dados da Gestao Global");
    } finally {
      setLoadingGlobal(false);
    }
  };

  const loadUserMetrics = async (targetUser: AdminUser | null) => {
    if (!targetUser) { setEventsByUser({}); setTaskCount(0); return; }
    setLoadingMetrics(true);
    try {
      const minDate90 = daysAgoDate(90);
      const minIso90 = daysAgoIso(90);
      const [weeklyRes, monthlyRes, dealsRes, checksRes, chatsRes, lessonsRes, tasksRes] = await Promise.all([
        db.from("weekly_wins_submissions").select("tenant_id,user_id,reference_date,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("reference_date", minDate90),
        db.from("monthly_data_submissions").select("tenant_id,user_id,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("created_at", minIso90),
        db.from("new_deal_submissions").select("tenant_id,user_id,deal_date,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("deal_date", minDate90),
        db.from("implementation_task_checks").select("tenant_id,user_id,checked_at,updated_at,is_checked").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("is_checked", true).gte("updated_at", minIso90),
        db.from("chat_messages").select("tenant_id,user_id,created_at,role").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("role", "user").gte("created_at", minIso90),
        db.from("user_lesson_progress").select("tenant_id,user_id,completed,completed_at,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("completed", true).gte("created_at", minIso90),
        db.from("implementation_tasks").select("id", { count: "exact", head: true }),
      ]);

      const checksIgnorable = checksRes.error && String(checksRes.error.message || "").toLowerCase().includes("implementation_task_checks");
      const tasksIgnorable = tasksRes.error && String(tasksRes.error.message || "").toLowerCase().includes("implementation_tasks");
      const err = weeklyRes.error || monthlyRes.error || dealsRes.error || (checksIgnorable ? null : checksRes.error) || chatsRes.error || lessonsRes.error || (tasksIgnorable ? null : tasksRes.error);
      if (err) throw new Error(err.message);

      setEventsByUser({ weekly: weeklyRes.data || [], monthly: monthlyRes.data || [], deals: dealsRes.data || [], checks: checksIgnorable ? [] : (checksRes.data || []), chats: chatsRes.data || [], lessons: lessonsRes.data || [] });
      setTaskCount(tasksIgnorable ? 0 : Number(tasksRes.count || 0));
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar metricas do usuario");
    } finally {
      setLoadingMetrics(false);
    }
  };

  const saveDocument = async () => {
    const name = docForm.name.trim();
    const content = docForm.content.trim();
    if (!name) { toast.error("Informe o nome do documento."); return; }
    if (!content) { toast.error("Informe o conteudo do documento."); return; }

    setSavingDoc(true);
    try {
      const payload = { name, content, applies_to_agents: parseCsv(docForm.appliesToAgentsText), is_mandatory: docForm.isMandatory, is_active: docForm.isActive };
      if (docForm.id) {
        const { error } = await db.from("system_documents").update(payload).eq("id", docForm.id);
        if (error) throw new Error(error.message);
        toast.success("Documento atualizado.");
      } else {
        const { error } = await db.from("system_documents").insert(payload);
        if (error) throw new Error(error.message);
        toast.success("Documento criado.");
      }
      await loadGlobal();
      setDocForm(initialDocument);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar documento");
    } finally {
      setSavingDoc(false);
    }
  };

  const removeDocument = async (id: string) => {
    if (!window.confirm("Deseja excluir este documento global?")) return;
    setDeletingDocId(id);
    try {
      const { error } = await db.from("system_documents").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await loadGlobal();
      if (docForm.id === id) setDocForm(initialDocument);
      toast.success("Documento removido.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao excluir documento");
    } finally {
      setDeletingDocId(null);
    }
  };

  const uploadDocFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingFile(true);
    try {
      const fileBase64 = await toBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-document-content", {
        body: { tenantId: activeTenant?.id || null, fileName: file.name, mimeType: file.type || "application/octet-stream", fileBase64 },
      });
      if (error) throw new Error(error.message || "Falha ao extrair conteudo");
      if (!data?.success || !data?.content) throw new Error(data?.error || "Falha ao extrair conteudo");
      setDocForm((prev) => ({ ...prev, name: prev.name.trim() || file.name.replace(/\.[^/.]+$/, ""), content: data.content }));
      toast.success("Conteudo do arquivo carregado.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao processar arquivo");
    } finally {
      setUploadingFile(false);
    }
  };

  const savePrompt = async () => {
    const agentId = promptForm.agentId.trim();
    const name = promptForm.name.trim();
    const systemPrompt = promptForm.systemPrompt.trim();
    if (!agentId) { toast.error("Informe o agent_id."); return; }
    if (!name) { toast.error("Informe o nome do prompt."); return; }
    if (!systemPrompt) { toast.error("Informe o system prompt."); return; }

    setSavingPrompt(true);
    try {
      const payload = { agent_id: agentId, name, description: promptForm.description.trim() || null, recommended_model: promptForm.recommendedModel.trim() || null, requires_documents: parseCsv(promptForm.requiresDocumentsText), uses_documents_context: promptForm.usesDocumentsContext, system_prompt: systemPrompt };
      if (promptForm.id) {
        const { error } = await db.from("agent_prompts").update(payload).eq("id", promptForm.id);
        if (error) throw new Error(error.message);
        toast.success("Prompt atualizado.");
      } else {
        const { error } = await db.from("agent_prompts").insert(payload);
        if (error) throw new Error(error.message);
        toast.success("Prompt criado.");
      }
      await loadGlobal();
      setPromptForm(initialPrompt);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar prompt");
    } finally {
      setSavingPrompt(false);
    }
  };

  const removePrompt = async (id: string) => {
    if (!window.confirm("Deseja excluir este prompt?")) return;
    setDeletingPromptId(id);
    try {
      const { error } = await db.from("agent_prompts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await loadGlobal();
      if (promptForm.id === id) setPromptForm(initialPrompt);
      toast.success("Prompt removido.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao excluir prompt");
    } finally {
      setDeletingPromptId(null);
    }
  };

  useEffect(() => { void loadOverview(); void loadGlobal(); }, []);
  useEffect(() => { void loadOverview(); }, [scopeCurrentTenantOnly]);
  useEffect(() => { void loadUserMetrics(selectedUser); }, [selectedUserKey, allUsers.length]);

  if (!isAdmin || !user) return <div className="flex-1 flex items-center justify-center">Acesso restrito.</div>;

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-background">
      <div className="max-w-[1240px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground mt-1">Visao exclusivamente administrativa com dados por usuario.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadOverview()} className="gap-2" disabled={loadingOverview}>
              {loadingOverview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
            </Button>
            <Button variant="outline" onClick={() => void signOut()} className="gap-2"><LogOut className="w-4 h-4" />Sair</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Administrador logado</CardDescription><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />{user.name}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><p>{user.email}</p><p className="mt-1">Perfil: administrador global</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Usuario em foco</CardDescription><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />{selectedUser?.fullName || "Nenhum usuario"}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><p>{selectedUser?.email || selectedUser?.userId || "-"}</p><p className="mt-1">Tenant: {selectedUser?.tenantName || "-"}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Status</CardDescription><CardTitle className="text-base flex items-center gap-2">{loadingMetrics ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-4 h-4 text-primary" />} Online</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><p>Escopo: usuario selecionado</p><p className="mt-1">Usuarios filtrados (sem admin): {uniqueUsersCount}</p></CardContent></Card>
        </div>

        {tab === "insights" && (
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" />Metricas do usuario</CardTitle><CardDescription>Dados reais somente do usuario selecionado.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <div><Label className="text-xs text-muted-foreground">Janela</Label><Select value={String(insightWindow)} onValueChange={(v) => setInsightWindow(Number(v) as InsightWindow)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Ultimos 7 dias</SelectItem><SelectItem value="15">Ultimos 15 dias</SelectItem><SelectItem value="30">Ultimos 30 dias</SelectItem></SelectContent></Select></div>
                <div className="lg:col-span-2"><Label className="text-xs text-muted-foreground">Usuario</Label><Select value={selectedUserKey} onValueChange={setSelectedUserKey}><SelectTrigger><SelectValue placeholder="Selecione o usuario" /></SelectTrigger><SelectContent>{allUsers.map((u) => <SelectItem key={u.key} value={u.key}>{u.fullName}</SelectItem>)}</SelectContent></Select><div className="flex items-center gap-2 mt-3"><Switch checked={scopeCurrentTenantOnly} onCheckedChange={setScopeCurrentTenantOnly} /><Label className="text-xs text-muted-foreground">Escopo: somente tenant atual</Label></div></div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6"><MetricMini title="Submissoes" value={currentMetrics.submissions} /><MetricMini title="Checks" value={currentMetrics.checks} /><MetricMini title="Mensagens" value={currentMetrics.chats} /><MetricMini title="Aulas concluidas" value={currentMetrics.lessons} /><MetricMini title="Engajamento" value={pct(currentMetrics.engagement)} /><MetricMini title="Saude" value={pct(currentMetrics.health)} /></div>
              <div className="grid gap-3 md:grid-cols-3">{WINDOWS.map((w) => <MetricMini key={w} title={`Submissoes em ${w} dias`} value={byWindow[w].submissions} />)}</div>
            </CardContent>
          </Card>
        )}

        {tab === "global" && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Gestao Global</CardTitle><CardDescription>Gerencie documentos globais e prompts dos agentes.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><div className="text-sm text-muted-foreground">Documentos: {systemDocuments.length} • Prompts: {agentPrompts.length}</div><Button variant="outline" size="sm" onClick={() => void loadGlobal()} disabled={loadingGlobal} className="gap-2">{loadingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Recarregar</Button></div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Documentos de sistema</h3><Button type="button" variant="outline" size="sm" onClick={() => setDocForm(initialDocument)} className="gap-1"><Plus className="w-4 h-4" />Novo</Button></div>
                  <div className="space-y-3"><div><Label className="text-xs text-muted-foreground">Nome</Label><Input value={docForm.name} onChange={(e) => setDocForm((p) => ({ ...p, name: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Aplica aos agentes (csv)</Label><Input value={docForm.appliesToAgentsText} onChange={(e) => setDocForm((p) => ({ ...p, appliesToAgentsText: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Conteudo</Label><Textarea value={docForm.content} onChange={(e) => setDocForm((p) => ({ ...p, content: e.target.value }))} className="min-h-[220px]" /></div><div className="flex items-center gap-2"><Label htmlFor="admin-doc-file" className="inline-flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-md border border-border hover:bg-secondary/40">{uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir arquivo (.pdf .docx .md .txt)</Label><input id="admin-doc-file" type="file" accept=".pdf,.docx,.md,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={uploadDocFile} className="hidden" /></div><div className="grid grid-cols-2 gap-4"><div className="flex items-center gap-2"><Switch checked={docForm.isMandatory} onCheckedChange={(checked) => setDocForm((p) => ({ ...p, isMandatory: checked }))} /><Label className="text-xs text-muted-foreground">Obrigatorio</Label></div><div className="flex items-center gap-2"><Switch checked={docForm.isActive} onCheckedChange={(checked) => setDocForm((p) => ({ ...p, isActive: checked }))} /><Label className="text-xs text-muted-foreground">Ativo</Label></div></div><div className="flex items-center gap-2"><Button onClick={() => void saveDocument()} disabled={savingDoc} className="gap-2">{savingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {docForm.id ? "Salvar alteracoes" : "Criar documento"}</Button>{docForm.id && <Button type="button" variant="outline" onClick={() => setDocForm(initialDocument)}>Cancelar edicao</Button>}</div></div>
                  <div className="rounded-lg border border-border"><div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">Lista de documentos</div><div className="max-h-[320px] overflow-y-auto">{systemDocuments.map((doc) => <div key={doc.id} className="px-3 py-3 border-b border-border last:border-b-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium truncate">{doc.name}</p><p className="text-xs text-muted-foreground mt-1">{doc.is_active ? "Ativo" : "Inativo"} • {doc.is_mandatory ? "Obrigatorio" : "Opcional"}</p></div><div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setDocForm({ id: doc.id, name: doc.name, content: doc.content, appliesToAgentsText: csv(doc.applies_to_agents), isMandatory: doc.is_mandatory, isActive: doc.is_active })}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => void removeDocument(doc.id)} disabled={deletingDocId === doc.id}>{deletingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button></div></div></div>)}</div></div>
                </div>

                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Prompts de agentes</h3><Button type="button" variant="outline" size="sm" onClick={() => setPromptForm(initialPrompt)} className="gap-1"><Plus className="w-4 h-4" />Novo</Button></div>
                  <div className="space-y-3"><div><Label className="text-xs text-muted-foreground">agent_id</Label><Input value={promptForm.agentId} onChange={(e) => setPromptForm((p) => ({ ...p, agentId: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Nome</Label><Input value={promptForm.name} onChange={(e) => setPromptForm((p) => ({ ...p, name: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Modelo recomendado</Label><Input value={promptForm.recommendedModel} onChange={(e) => setPromptForm((p) => ({ ...p, recommendedModel: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Documentos requeridos (csv)</Label><Input value={promptForm.requiresDocumentsText} onChange={(e) => setPromptForm((p) => ({ ...p, requiresDocumentsText: e.target.value }))} /></div><div><Label className="text-xs text-muted-foreground">Descricao</Label><Textarea value={promptForm.description} onChange={(e) => setPromptForm((p) => ({ ...p, description: e.target.value }))} className="min-h-[80px]" /></div><div><Label className="text-xs text-muted-foreground">System prompt</Label><Textarea value={promptForm.systemPrompt} onChange={(e) => setPromptForm((p) => ({ ...p, systemPrompt: e.target.value }))} className="min-h-[200px]" /></div><div className="flex items-center gap-2"><Switch checked={promptForm.usesDocumentsContext} onCheckedChange={(checked) => setPromptForm((p) => ({ ...p, usesDocumentsContext: checked }))} /><Label className="text-xs text-muted-foreground">Usa contexto de documentos</Label></div><div className="flex items-center gap-2"><Button onClick={() => void savePrompt()} disabled={savingPrompt} className="gap-2">{savingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {promptForm.id ? "Salvar alteracoes" : "Criar prompt"}</Button>{promptForm.id && <Button type="button" variant="outline" onClick={() => setPromptForm(initialPrompt)}>Cancelar edicao</Button>}</div></div>
                  <div className="rounded-lg border border-border"><div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">Lista de prompts</div><div className="max-h-[320px] overflow-y-auto">{agentPrompts.map((prompt) => <div key={prompt.id} className="px-3 py-3 border-b border-border last:border-b-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium truncate">{prompt.name}</p><p className="text-xs text-muted-foreground mt-1 truncate">{prompt.agent_id} • {prompt.recommended_model || "modelo nao definido"} • {prompt.uses_documents_context ? "usa documentos" : "sem documentos"}</p></div><div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setPromptForm({ id: prompt.id, agentId: prompt.agent_id, name: prompt.name, description: prompt.description || "", recommendedModel: prompt.recommended_model || "", requiresDocumentsText: csv(prompt.requires_documents), usesDocumentsContext: prompt.uses_documents_context, systemPrompt: prompt.system_prompt })}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => void removePrompt(prompt.id)} disabled={deletingPromptId === prompt.id}>{deletingPromptId === prompt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button></div></div></div>)}</div></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "access" && (
          <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" />Tenants e Usuarios</CardTitle><CardDescription>Lista de usuarios com tenant de origem.</CardDescription></CardHeader><CardContent className="space-y-2">{allUsers.map((u) => <button key={u.key} type="button" onClick={() => { setSelectedUserKey(u.key); setActivePage("admin-insights"); }} className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${u.key === selectedUserKey ? "border-primary/60 bg-primary/10" : "border-border hover:bg-secondary/40"}`}><p className="text-sm font-medium truncate">{u.fullName}</p><p className="text-xs text-muted-foreground truncate">{u.email || u.userId} - {u.tenantName} - {u.role}</p></button>)}</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function MetricMini({ title, value }: { title: string; value: string | number }) {
  return <Card className="bg-secondary/25"><CardHeader className="py-3"><CardDescription>{title}</CardDescription><CardTitle className="text-xl truncate">{value}</CardTitle></CardHeader></Card>;
}
