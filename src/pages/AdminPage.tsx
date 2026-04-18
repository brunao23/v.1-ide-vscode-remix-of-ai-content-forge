import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
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
type AgentUsageStat = { agent_id: string; docs: number; chats: number };
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

  // ── Detalhe expandido por usuário ──────────────────────────────────────────
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [userCheckedTaskIds, setUserCheckedTaskIds] = useState<Set<string>>(new Set());
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<any[]>([]);
  const [mktResearchCount, setMktResearchCount] = useState(0);
  const [showImplDetail, setShowImplDetail] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);
  const [tokenUsageRows, setTokenUsageRows] = useState<any[]>([]);
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

  const agentUsage = useMemo<AgentUsageStat[]>(() => {
    const map = new Map<string, AgentUsageStat>();
    for (const doc of userDocuments) {
      if (!doc.agent_id) continue;
      const e = map.get(doc.agent_id) || { agent_id: doc.agent_id, docs: 0, chats: 0 };
      e.docs++;
      map.set(doc.agent_id, e);
    }
    for (const msg of (eventsByUser.chats || [])) {
      if (!msg.agent_id) continue;
      const e = map.get(msg.agent_id) || { agent_id: msg.agent_id, docs: 0, chats: 0 };
      e.chats++;
      map.set(msg.agent_id, e);
    }
    return Array.from(map.values()).sort((a, b) => (b.docs + b.chats) - (a.docs + a.chats));
  }, [userDocuments, eventsByUser]);

  // ── Token aggregation ────────────────────────────────────────────────────
  const tokenSummary = useMemo(() => {
    const totalIn = tokenUsageRows.reduce((s: number, r: any) => s + Number(r.input_tokens || 0), 0);
    const totalOut = tokenUsageRows.reduce((s: number, r: any) => s + Number(r.output_tokens || 0), 0);
    const totalCost = tokenUsageRows.reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);
    const totalToolCalls = tokenUsageRows.reduce((s: number, r: any) => s + Number(r.tool_call_count || 0), 0);
    const totalRagDocs = tokenUsageRows.reduce((s: number, r: any) => s + Number(r.rag_docs_retrieved || 0), 0);
    const USD_TO_BRL = 5.75;
    const totalCostBrl = totalCost * USD_TO_BRL;

    const byModel = new Map<string, { input: number; output: number; cost: number; calls: number; toolCalls: number; ragDocs: number }>();
    for (const r of tokenUsageRows) {
      const key = String(r.model_id || "unknown");
      const e = byModel.get(key) || { input: 0, output: 0, cost: 0, calls: 0, toolCalls: 0, ragDocs: 0 };
      e.input += Number(r.input_tokens || 0);
      e.output += Number(r.output_tokens || 0);
      e.cost += Number(r.cost_usd || 0);
      e.toolCalls += Number(r.tool_call_count || 0);
      e.ragDocs += Number(r.rag_docs_retrieved || 0);
      e.calls++;
      byModel.set(key, e);
    }

    const byAgent = new Map<string, { input: number; output: number; cost: number; calls: number; toolCalls: number; ragDocs: number }>();
    for (const r of tokenUsageRows) {
      const key = String(r.agent_id || "(sem agente)");
      const e = byAgent.get(key) || { input: 0, output: 0, cost: 0, calls: 0, toolCalls: 0, ragDocs: 0 };
      e.input += Number(r.input_tokens || 0);
      e.output += Number(r.output_tokens || 0);
      e.cost += Number(r.cost_usd || 0);
      e.toolCalls += Number(r.tool_call_count || 0);
      e.ragDocs += Number(r.rag_docs_retrieved || 0);
      e.calls++;
      byAgent.set(key, e);
    }

    const byProvider = new Map<string, { cost: number; calls: number; input: number; output: number }>();
    for (const r of tokenUsageRows) {
      const key = String(r.provider || "unknown");
      const e = byProvider.get(key) || { cost: 0, calls: 0, input: 0, output: 0 };
      e.cost += Number(r.cost_usd || 0);
      e.calls++;
      e.input += Number(r.input_tokens || 0);
      e.output += Number(r.output_tokens || 0);
      byProvider.set(key, e);
    }

    return {
      totalIn, totalOut, totalCost, totalCostBrl, calls: tokenUsageRows.length,
      totalToolCalls, totalRagDocs,
      byModel: Array.from(byModel.entries()).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.cost - a.cost),
      byAgent: Array.from(byAgent.entries()).map(([agent, v]) => ({ agent, ...v })).sort((a, b) => b.cost - a.cost),
      byProvider: Array.from(byProvider.entries()).map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.cost - a.cost),
    };
  }, [tokenUsageRows]);

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
    if (!targetUser) {
      setEventsByUser({});
      setTaskCount(0);
      setAllTasks([]);
      setUserCheckedTaskIds(new Set());
      setUserDocuments([]);
      setWeeklyHistory([]);
      setMonthlyHistory([]);
      setMktResearchCount(0);
      setTokenUsageRows([]);
      return;
    }
    setLoadingMetrics(true);
    try {
      const minDate90 = daysAgoDate(90);
      const minIso90 = daysAgoIso(90);
      const [
        weeklyRes, monthlyRes, dealsRes, checksRes, chatsRes, lessonsRes,
        allTasksRes, taskChecksRes, docsRes, weeklyHistRes, monthlyHistRes, mktRes, tokenRes,
      ] = await Promise.all([
        // Métricas de janela (90 dias)
        db.from("weekly_wins_submissions").select("tenant_id,user_id,reference_date,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("reference_date", minDate90),
        db.from("monthly_data_submissions").select("tenant_id,user_id,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("created_at", minIso90),
        db.from("new_deal_submissions").select("tenant_id,user_id,deal_date,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).gte("deal_date", minDate90),
        db.from("implementation_task_checks").select("tenant_id,user_id,checked_at,updated_at,is_checked").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("is_checked", true).gte("updated_at", minIso90),
        db.from("chat_messages").select("tenant_id,user_id,created_at,role,agent_id").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("role", "user").gte("created_at", minIso90),
        db.from("user_lesson_progress").select("tenant_id,user_id,completed,completed_at,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("completed", true).gte("created_at", minIso90),
        // Detalhe completo
        db.from("implementation_tasks").select("id,month_title,month_order,week_title,week_order,task_title,task_order").order("month_order", { ascending: true }).order("week_order", { ascending: true }).order("task_order", { ascending: true }),
        db.from("implementation_task_checks").select("task_id").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).eq("is_checked", true),
        db.from("documents").select("id,name,type,agent_id,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).order("created_at", { ascending: false }).limit(300),
        db.from("weekly_wins_submissions").select("*").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).order("reference_date", { ascending: false }).limit(8),
        db.from("monthly_data_submissions").select("*").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).order("created_at", { ascending: false }).limit(6),
        db.from("market_research_saved_posts").select("id", { count: "exact", head: true }).eq("user_id", targetUser.userId),
        // Token usage (todos os registros do usuário neste tenant)
        db.from("token_usage").select("model_id,provider,agent_id,input_tokens,output_tokens,cost_usd,tool_call_count,rag_docs_retrieved,created_at").eq("tenant_id", targetUser.tenantId).eq("user_id", targetUser.userId).order("created_at", { ascending: false }).limit(2000),
      ]);

      const checksIgnorable = checksRes.error && String(checksRes.error.message || "").toLowerCase().includes("implementation_task_checks");
      const err = weeklyRes.error || monthlyRes.error || dealsRes.error || (checksIgnorable ? null : checksRes.error) || chatsRes.error || lessonsRes.error;
      if (err) throw new Error(err.message);

      const tasks = allTasksRes.data || [];
      setEventsByUser({ weekly: weeklyRes.data || [], monthly: monthlyRes.data || [], deals: dealsRes.data || [], checks: checksIgnorable ? [] : (checksRes.data || []), chats: chatsRes.data || [], lessons: lessonsRes.data || [] });
      setTaskCount(tasks.length);
      setAllTasks(tasks);
      setUserCheckedTaskIds(new Set<string>((taskChecksRes.data || []).map((r: any) => String(r.task_id))));
      setUserDocuments(docsRes.data || []);
      setWeeklyHistory(weeklyHistRes.data || []);
      setMonthlyHistory(monthlyHistRes.data || []);
      setMktResearchCount(Number(mktRes.count || 0));
      if (tokenRes.error) console.error("[Admin] token_usage query failed:", tokenRes.error.message);
      setTokenUsageRows(tokenRes.data || []);
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
              {/* Implementação Progress + detalhe por tarefa */}
              {taskCount > 0 && (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Progresso de Implementação</span>
                    <span className="text-sm font-bold text-amber-400">
                      {clamp(Math.round((userCheckedTaskIds.size / taskCount) * 100))}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${clamp(Math.round((userCheckedTaskIds.size / taskCount) * 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {userCheckedTaskIds.size} de {taskCount} tarefas concluídas (total acumulado)
                  </p>
                  {/* Expansor de detalhe por tarefa */}
                  {allTasks.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowImplDetail((p) => !p)}
                        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
                      >
                        {showImplDetail ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <ClipboardList className="w-3.5 h-3.5" />
                        {showImplDetail ? "Ocultar detalhe por tarefa" : "Ver cada tarefa individualmente"}
                      </button>
                      {showImplDetail && (
                        <div className="mt-3">
                          <ImplDetailTable tasks={allTasks} checkedIds={userCheckedTaskIds} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Consumo de Tokens & Custo ───────────────────────────── */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" /> Consumo de Tokens & Custo Estimado
                  </h3>
                  {tokenUsageRows.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Nenhum registro ainda (dados aparecem a partir da próxima conversa)</span>
                  )}
                </div>

                {tokenUsageRows.length > 0 && (
                  <>
                    {/* Totais — linha 1 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricMini title="Chamadas de IA" value={tokenSummary.calls} />
                      <MetricMini title="Tokens de entrada" value={tokenSummary.totalIn.toLocaleString("pt-BR")} />
                      <MetricMini title="Tokens de saída" value={tokenSummary.totalOut.toLocaleString("pt-BR")} />
                      <div className="rounded-lg border border-border p-3 space-y-0.5">
                        <p className="text-xs text-muted-foreground">Custo total</p>
                        <p className="text-base font-bold text-green-400">R$ {tokenSummary.totalCostBrl.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${tokenSummary.totalCost.toFixed(4)} USD</p>
                      </div>
                    </div>
                    {/* Totais — linha 2 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <MetricMini title="Chamadas de ferramentas (agentic)" value={tokenSummary.totalToolCalls} />
                      <MetricMini title="Docs RAG recuperados" value={tokenSummary.totalRagDocs} />
                      <MetricMini title="APIs utilizadas" value={tokenSummary.byProvider.length} />
                    </div>

                    {/* Por API / Provedor */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por API / Provedor</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/40">
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-2 font-medium">Provedor</th>
                              <th className="text-right px-3 py-2 font-medium">Chamadas</th>
                              <th className="text-right px-3 py-2 font-medium">Tokens entrada</th>
                              <th className="text-right px-3 py-2 font-medium">Tokens saída</th>
                              <th className="text-right px-3 py-2 font-medium">Custo (BRL)</th>
                              <th className="text-right px-3 py-2 font-medium">Custo (USD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {tokenSummary.byProvider.map((row) => (
                              <tr key={row.provider} className="hover:bg-secondary/20">
                                <td className="px-3 py-2 font-semibold text-foreground capitalize">{row.provider}</td>
                                <td className="px-3 py-2 text-right">{row.calls}</td>
                                <td className="px-3 py-2 text-right">{row.input.toLocaleString("pt-BR")}</td>
                                <td className="px-3 py-2 text-right">{row.output.toLocaleString("pt-BR")}</td>
                                <td className="px-3 py-2 text-right font-semibold text-green-400">R$ {(row.cost * 5.75).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">${row.cost.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Por modelo */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por Modelo</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/40">
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-2 font-medium">Modelo</th>
                              <th className="text-right px-3 py-2 font-medium">Chamadas</th>
                              <th className="text-right px-3 py-2 font-medium">Tokens entrada</th>
                              <th className="text-right px-3 py-2 font-medium">Tokens saída</th>
                              <th className="text-right px-3 py-2 font-medium">Tools</th>
                              <th className="text-right px-3 py-2 font-medium">RAG docs</th>
                              <th className="text-right px-3 py-2 font-medium">Custo (BRL)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {tokenSummary.byModel.map((row) => (
                              <tr key={row.model} className="hover:bg-secondary/20">
                                <td className="px-3 py-2 font-mono text-foreground max-w-[180px] truncate">{row.model}</td>
                                <td className="px-3 py-2 text-right">{row.calls}</td>
                                <td className="px-3 py-2 text-right">{row.input.toLocaleString("pt-BR")}</td>
                                <td className="px-3 py-2 text-right">{row.output.toLocaleString("pt-BR")}</td>
                                <td className="px-3 py-2 text-right">{row.toolCalls}</td>
                                <td className="px-3 py-2 text-right">{row.ragDocs}</td>
                                <td className="px-3 py-2 text-right font-semibold text-green-400">R$ {(row.cost * 5.75).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Por agente/contexto */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por Agente / Contexto</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/40">
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-2 font-medium">Agente</th>
                              <th className="text-right px-3 py-2 font-medium">Chamadas</th>
                              <th className="text-right px-3 py-2 font-medium">Total tokens</th>
                              <th className="text-right px-3 py-2 font-medium">Tools</th>
                              <th className="text-right px-3 py-2 font-medium">RAG docs</th>
                              <th className="text-right px-3 py-2 font-medium">Custo (BRL)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {tokenSummary.byAgent.map((row) => (
                              <tr key={row.agent} className="hover:bg-secondary/20">
                                <td className="px-3 py-2 font-mono text-foreground">{row.agent}</td>
                                <td className="px-3 py-2 text-right">{row.calls}</td>
                                <td className="px-3 py-2 text-right">{(row.input + row.output).toLocaleString("pt-BR")}</td>
                                <td className="px-3 py-2 text-right">{row.toolCalls}</td>
                                <td className="px-3 py-2 text-right">{row.ragDocs}</td>
                                <td className="px-3 py-2 text-right font-semibold text-green-400">R$ {(row.cost * 5.75).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Últimas chamadas com timestamp */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Últimas Chamadas</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary/40">
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-2 font-medium">Data / Hora</th>
                              <th className="text-left px-3 py-2 font-medium">Agente</th>
                              <th className="text-left px-3 py-2 font-medium">Modelo</th>
                              <th className="text-right px-3 py-2 font-medium">Tokens</th>
                              <th className="text-right px-3 py-2 font-medium">Tools</th>
                              <th className="text-right px-3 py-2 font-medium">RAG</th>
                              <th className="text-right px-3 py-2 font-medium">Custo (BRL)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {tokenUsageRows.slice(0, 20).map((row: any, i: number) => {
                              const dt = row.created_at ? new Date(row.created_at) : null;
                              const fmt = dt
                                ? `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}`
                                : "—";
                              const tokens = Number(row.input_tokens || 0) + Number(row.output_tokens || 0);
                              const cost = Number(row.cost_usd || 0) * 5.75;
                              return (
                                <tr key={i} className="hover:bg-secondary/20">
                                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt}</td>
                                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.agent_id || "—"}</td>
                                  <td className="px-3 py-2 font-mono max-w-[150px] truncate">{row.model_id || "—"}</td>
                                  <td className="px-3 py-2 text-right">{tokens.toLocaleString("pt-BR")}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.tool_call_count || 0)}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.rag_docs_retrieved || 0)}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-green-400">R$ {cost.toFixed(4)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Uso por agente (documentos + chats) */}
              {agentUsage.length > 0 && (
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" /> Uso por Agente
                    <span className="text-xs font-normal text-muted-foreground">(últimos 90 dias)</span>
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40">
                        <tr className="text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Agente (agent_id)</th>
                          <th className="text-right px-3 py-2 font-medium">Docs criados</th>
                          <th className="text-right px-3 py-2 font-medium">Mensagens</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {agentUsage.map((a) => (
                          <tr key={a.agent_id} className="hover:bg-secondary/20">
                            <td className="px-3 py-2 font-mono text-foreground">{a.agent_id || "(sem agente)"}</td>
                            <td className="px-3 py-2 text-right">{a.docs}</td>
                            <td className="px-3 py-2 text-right">{a.chats}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-400">{a.docs + a.chats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Saúde Detalhada */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowHealthDetail((p) => !p)}
                  className="w-full flex items-center justify-between text-sm font-semibold hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Saúde Detalhada — Dados Reais do Usuário
                  </span>
                  {showHealthDetail ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showHealthDetail && (
                  <div className="space-y-5 pt-1">
                    {/* Resumo rápido */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricMini title="Posts salvos (Pesquisa)" value={mktResearchCount} />
                      <MetricMini title="Documentos criados" value={userDocuments.length} />
                      <MetricMini title="Tipos de documento" value={new Set(userDocuments.map((d: any) => d.type).filter(Boolean)).size} />
                      <MetricMini title="Semanas reportadas" value={weeklyHistory.length} />
                    </div>

                    {/* Documentos por tipo */}
                    {userDocuments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5" /> Documentos por Tipo
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(
                            userDocuments.reduce((acc: Record<string, number>, d: any) => {
                              const t = d.type || "sem-tipo";
                              acc[t] = (acc[t] || 0) + 1;
                              return acc;
                            }, {})
                          ).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                            <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs border border-border">
                              <span className="font-mono text-foreground">{type}</span>
                              <span className="font-bold text-amber-400">{count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pesquisa de mercado */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="w-4 h-4" />
                      <span>Posts salvos na Pesquisa de Mercado:</span>
                      <span className="font-bold text-foreground">{mktResearchCount}</span>
                    </div>

                    {/* Últimas semanas reportadas */}
                    {weeklyHistory.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Últimas Semanas Reportadas (Weekly Wins)
                        </h4>
                        <div className="space-y-2">
                          {weeklyHistory.slice(0, 5).map((w: any) => (
                            <div key={w.id} className="rounded-lg border border-border p-3 space-y-1.5 bg-secondary/10">
                              <p className="text-xs font-bold text-amber-400">{w.reference_date}</p>
                              {w.top_win_1 && <p className="text-xs text-foreground flex gap-1.5"><span className="text-emerald-400">✓</span>{w.top_win_1}</p>}
                              {w.top_win_2 && <p className="text-xs text-foreground flex gap-1.5"><span className="text-emerald-400">✓</span>{w.top_win_2}</p>}
                              {w.top_win_3 && <p className="text-xs text-foreground flex gap-1.5"><span className="text-emerald-400">✓</span>{w.top_win_3}</p>}
                              {w.one_focus_this_week && <p className="text-xs text-muted-foreground">Foco: {w.one_focus_this_week}</p>}
                              {w.blocker && <p className="text-xs text-rose-400">Bloqueio: {w.blocker}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dados mensais */}
                    {monthlyHistory.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Dados Mensais (Business Health)
                        </h4>
                        <div className="space-y-3">
                          {monthlyHistory.slice(0, 4).map((m: any) => (
                            <div key={m.id} className="rounded-lg border border-border p-3 bg-secondary/10">
                              <p className="text-xs font-bold text-amber-400 mb-2">{m.period_month}/{m.period_year}</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                                {m.total_cash_collected != null && <div><span className="text-muted-foreground">Cash coletado:</span> <span className="font-semibold ml-1">R$ {Number(m.total_cash_collected).toLocaleString("pt-BR")}</span></div>}
                                {m.total_new_revenue != null && <div><span className="text-muted-foreground">Nova receita:</span> <span className="font-semibold ml-1">R$ {Number(m.total_new_revenue).toLocaleString("pt-BR")}</span></div>}
                                {m.monthly_recurring_revenue != null && <div><span className="text-muted-foreground">MRR:</span> <span className="font-semibold ml-1">R$ {Number(m.monthly_recurring_revenue).toLocaleString("pt-BR")}</span></div>}
                                {m.monthly_expenses != null && <div><span className="text-muted-foreground">Despesas:</span> <span className="font-semibold ml-1">R$ {Number(m.monthly_expenses).toLocaleString("pt-BR")}</span></div>}
                                {m.ad_spend != null && <div><span className="text-muted-foreground">Anúncios:</span> <span className="font-semibold ml-1">R$ {Number(m.ad_spend).toLocaleString("pt-BR")}</span></div>}
                                {m.new_clients_signed != null && <div><span className="text-muted-foreground">Clientes novos:</span> <span className="font-semibold ml-1">{m.new_clients_signed}</span></div>}
                                {m.active_clients != null && <div><span className="text-muted-foreground">Clientes ativos:</span> <span className="font-semibold ml-1">{m.active_clients}</span></div>}
                                {m.booked_calls != null && <div><span className="text-muted-foreground">Calls agendadas:</span> <span className="font-semibold ml-1">{m.booked_calls}</span></div>}
                                {m.calls_showed != null && <div><span className="text-muted-foreground">Calls realizadas:</span> <span className="font-semibold ml-1">{m.calls_showed}</span></div>}
                                {m.offers_made != null && <div><span className="text-muted-foreground">Ofertas feitas:</span> <span className="font-semibold ml-1">{m.offers_made}</span></div>}
                                {m.total_followers != null && <div><span className="text-muted-foreground">Seguidores:</span> <span className="font-semibold ml-1">{Number(m.total_followers).toLocaleString("pt-BR")}</span></div>}
                                {m.posts_made != null && <div><span className="text-muted-foreground">Posts:</span> <span className="font-semibold ml-1">{m.posts_made}</span></div>}
                                {m.reach != null && <div><span className="text-muted-foreground">Alcance:</span> <span className="font-semibold ml-1">{Number(m.reach).toLocaleString("pt-BR")}</span></div>}
                                {m.views != null && <div><span className="text-muted-foreground">Views:</span> <span className="font-semibold ml-1">{Number(m.views).toLocaleString("pt-BR")}</span></div>}
                                {m.inbound_messages != null && <div><span className="text-muted-foreground">Mensagens inbound:</span> <span className="font-semibold ml-1">{m.inbound_messages}</span></div>}
                                {m.confidence_score != null && <div><span className="text-muted-foreground">Confiança:</span> <span className="font-semibold ml-1">{m.confidence_score}/10</span></div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {weeklyHistory.length === 0 && monthlyHistory.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Este usuário ainda não preencheu dados na aba Métricas.</p>
                    )}
                  </div>
                )}
              </div>

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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" />Tenants e Usuários</CardTitle>
              <CardDescription>Clique em um usuário para ver métricas detalhadas. Progresso de implementação baseado em todos os checks registrados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {allUsers.map((u) => (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => { setSelectedUserKey(u.key); setActivePage("admin-insights"); }}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${u.key === selectedUserKey ? "border-primary/60 bg-primary/10" : "border-border hover:bg-secondary/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{u.fullName}</p>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{u.tenantName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email || u.userId} · {u.role}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricMini({ title, value }: { title: string; value: string | number }) {
  return <Card className="bg-secondary/25"><CardHeader className="py-3"><CardDescription>{title}</CardDescription><CardTitle className="text-xl truncate">{value}</CardTitle></CardHeader></Card>;
}

function ImplDetailTable({ tasks, checkedIds }: { tasks: any[]; checkedIds: Set<string> }) {
  const grouped = useMemo(() => {
    const months: Record<string, { title: string; order: number; weeks: Record<string, { title: string; order: number; tasks: any[] }> }> = {};
    for (const task of tasks) {
      if (!months[task.month_title]) months[task.month_title] = { title: task.month_title, order: task.month_order, weeks: {} };
      const wk = task.week_title || "__";
      if (!months[task.month_title].weeks[wk]) months[task.month_title].weeks[wk] = { title: task.week_title || "", order: task.week_order, tasks: [] };
      months[task.month_title].weeks[wk].tasks.push(task);
    }
    return Object.values(months).sort((a, b) => a.order - b.order).map((m) => ({ ...m, weeks: Object.values(m.weeks).sort((a, b) => a.order - b.order) }));
  }, [tasks]);

  return (
    <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
      {grouped.map((month) => {
        const monthTasks = month.weeks.flatMap((w) => w.tasks);
        const done = monthTasks.filter((t) => checkedIds.has(t.id)).length;
        const pct = monthTasks.length > 0 ? Math.round((done / monthTasks.length) * 100) : 0;
        return (
          <details key={month.title} className="rounded-lg border border-border group">
            <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-secondary/30 rounded-lg list-none select-none">
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-open:hidden shrink-0" />
                <ChevronDown className="w-3.5 h-3.5 text-amber-400 hidden group-open:block shrink-0" />
                <span className="text-xs font-semibold truncate">{month.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="w-16 h-1.5 rounded-full bg-background overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-amber-400 font-bold w-8 text-right">{pct}%</span>
                <span className="text-[11px] text-muted-foreground w-10 text-right">{done}/{monthTasks.length}</span>
              </div>
            </summary>
            <div className="border-t border-border px-3 pb-3 pt-1">
              {month.weeks.map((week) => (
                <div key={week.title || "__"} className="mt-2">
                  {week.title && (
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <span className="w-0.5 h-3 bg-amber-400/60 rounded-full inline-block" />
                      {week.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {week.tasks.map((task) => {
                      const checked = checkedIds.has(task.id);
                      return (
                        <div key={task.id} className={`flex items-center gap-2 py-1 px-2 rounded ${checked ? "bg-emerald-500/5" : ""}`}>
                          {checked
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                          <span className={`text-xs leading-snug ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.task_title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
