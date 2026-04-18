import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onSubmitted?: () => void;
};

const monthOptions = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

function toNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MetricsSubmissionActions({ onSubmitted }: Props) {
  const { user, activeTenant } = useAuth();
  const now = new Date();

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return [current - 1, current, current + 1];
  }, [now]);

  const [openWeekly, setOpenWeekly] = useState(false);
  const [openMonthly, setOpenMonthly] = useState(false);
  const [openDeal, setOpenDeal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weeklyForm, setWeeklyForm] = useState({
    reference_date: now.toISOString().slice(0, 10),
    top_win_1: "",
    top_win_2: "",
    top_win_3: "",
    one_focus_this_week: "",
    blocker: "",
  });

  const [monthlyForm, setMonthlyForm] = useState({
    period_month: String(now.getMonth() + 1),
    period_year: String(now.getFullYear()),
    total_cash_collected: "",
    total_new_revenue: "",
    monthly_recurring_revenue: "",
    monthly_expenses: "",
    ad_spend: "",
    new_clients_signed: "",
    active_clients: "",
    confidence_score: "",
    booked_calls: "",
    calls_showed: "",
    triage_calls: "",
    strategy_calls: "",
    offers_made: "",
    inbound_messages: "",
    total_followers: "",
    reach: "",
    views: "",
    posts_made: "",
  });

  const [dealForm, setDealForm] = useState({
    deal_date: now.toISOString().slice(0, 10),
    client_name: "",
    offer_name: "",
    deal_value: "",
    cash_collected: "",
    payment_type: "one-time",
    source_channel: "",
    notes: "",
  });

  const requireUser = () => {
    if (!user) {
      toast.error("Faça login para enviar dados.");
      return false;
    }
    if (!activeTenant?.id) {
      toast.error("Selecione um tenant antes de enviar dados.");
      return false;
    }
    return true;
  };

  const handleSubmitWeekly = async () => {
    if (!requireUser()) return;
    if (!weeklyForm.top_win_1.trim()) {
      toast.error("Preencha pelo menos a principal vitória da semana.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("weekly_wins_submissions")
        .insert({
          user_id: user!.id,
          tenant_id: activeTenant!.id,
          reference_date: weeklyForm.reference_date,
          top_win_1: weeklyForm.top_win_1.trim(),
          top_win_2: weeklyForm.top_win_2.trim() || null,
          top_win_3: weeklyForm.top_win_3.trim() || null,
          one_focus_this_week: weeklyForm.one_focus_this_week.trim() || null,
          blocker: weeklyForm.blocker.trim() || null,
        });

      if (error) throw error;

      toast.success("Vitórias da semana enviadas com sucesso.");
      setOpenWeekly(false);
      setWeeklyForm({
        reference_date: now.toISOString().slice(0, 10),
        top_win_1: "",
        top_win_2: "",
        top_win_3: "",
        one_focus_this_week: "",
        blocker: "",
      });
      onSubmitted?.();
    } catch (err: any) {
      toast.error(`Erro ao enviar vitórias da semana: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitDeal = async () => {
    if (!requireUser()) return;
    if (!dealForm.client_name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("new_deal_submissions")
        .insert({
          user_id: user!.id,
          tenant_id: activeTenant!.id,
          deal_date: dealForm.deal_date,
          client_name: dealForm.client_name.trim(),
          offer_name: dealForm.offer_name.trim() || null,
          deal_value: toNumber(dealForm.deal_value),
          cash_collected: toNumber(dealForm.cash_collected),
          payment_type: dealForm.payment_type,
          source_channel: dealForm.source_channel.trim() || null,
          notes: dealForm.notes.trim() || null,
        });

      if (error) throw error;

      toast.success("Novo negócio salvo com sucesso.");
      setOpenDeal(false);
      setDealForm({
        deal_date: now.toISOString().slice(0, 10),
        client_name: "",
        offer_name: "",
        deal_value: "",
        cash_collected: "",
        payment_type: "one-time",
        source_channel: "",
        notes: "",
      });
      onSubmitted?.();
    } catch (err: any) {
      toast.error(`Erro ao salvar novo negócio: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMonthly = async () => {
    if (!requireUser()) return;

    const periodMonth = toInt(monthlyForm.period_month);
    const periodYear = toInt(monthlyForm.period_year);
    if (!periodMonth || !periodYear) {
      toast.error("Mês e ano são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const totalCashCollected = toNumber(monthlyForm.total_cash_collected);
      const totalNewRevenue = toNumber(monthlyForm.total_new_revenue);
      const monthlyRecurringRevenue = toNumber(monthlyForm.monthly_recurring_revenue);
      const monthlyExpenses = toNumber(monthlyForm.monthly_expenses);
      const adSpend = toNumber(monthlyForm.ad_spend);
      const newClientsSigned = toInt(monthlyForm.new_clients_signed);
      const activeClients = toInt(monthlyForm.active_clients);
      const confidenceScore = toNumber(monthlyForm.confidence_score);
      const bookedCalls = toInt(monthlyForm.booked_calls);
      const callsShowed = toInt(monthlyForm.calls_showed);
      const triageCalls = toInt(monthlyForm.triage_calls);
      const strategyCalls = toInt(monthlyForm.strategy_calls);
      const offersMade = toInt(monthlyForm.offers_made);
      const inboundMessages = toInt(monthlyForm.inbound_messages);
      const totalFollowers = toInt(monthlyForm.total_followers);
      const reach = toInt(monthlyForm.reach);
      const views = toInt(monthlyForm.views);
      const postsMade = toInt(monthlyForm.posts_made);

      const { error: monthlyError } = await (supabase as any)
        .from("monthly_data_submissions")
        .upsert(
          {
            user_id: user!.id,
            tenant_id: activeTenant!.id,
            period_month: periodMonth,
            period_year: periodYear,
            total_cash_collected: totalCashCollected,
            total_new_revenue: totalNewRevenue,
            monthly_recurring_revenue: monthlyRecurringRevenue,
            monthly_expenses: monthlyExpenses,
            ad_spend: adSpend,
            new_clients_signed: newClientsSigned,
            active_clients: activeClients,
            confidence_score: confidenceScore,
            booked_calls: bookedCalls,
            calls_showed: callsShowed,
            triage_calls: triageCalls,
            strategy_calls: strategyCalls,
            offers_made: offersMade,
            inbound_messages: inboundMessages,
            total_followers: totalFollowers,
            reach,
            views,
            posts_made: postsMade,
          },
          { onConflict: "tenant_id,user_id,period_month,period_year" },
        );

      if (monthlyError) throw monthlyError;

      const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
      const dailyAdSpend =
        adSpend != null && daysInMonth > 0 ? Number((adSpend / daysInMonth).toFixed(2)) : null;
      const cpm =
        adSpend != null && reach != null && reach > 0
          ? Number((adSpend / (reach / 1000)).toFixed(2))
          : null;
      const roas =
        adSpend != null &&
        adSpend > 0 &&
        totalCashCollected != null
          ? Number((totalCashCollected / adSpend).toFixed(2))
          : null;
      const profit =
        totalCashCollected != null
          ? Number(
              (
                totalCashCollected -
                (monthlyExpenses ?? 0) -
                (adSpend ?? 0)
              ).toFixed(2),
            )
          : null;

      const { error: metricsError } = await supabase
        .from("client_metrics")
        .upsert(
          {
            user_id: user!.id,
            tenant_id: activeTenant!.id,
            period_month: periodMonth,
            period_year: periodYear,
            total_cash_collected: totalCashCollected,
            total_new_revenue: totalNewRevenue,
            monthly_recurring_revenue: monthlyRecurringRevenue,
            expenses: monthlyExpenses,
            ad_spend: adSpend,
            daily_ad_spend: dailyAdSpend,
            cpm,
            roas,
            profit,
            new_clients: newClientsSigned,
            active_clients: activeClients,
            short_form_channel_size: totalFollowers,
            total_reach_ig_impressions_li: reach,
            advertising_impressions_ig: views,
            total_posts_made: postsMade,
          },
          { onConflict: "tenant_id,user_id,period_month,period_year" },
        );

      if (metricsError) throw metricsError;

      toast.success("Dados mensais enviados com sucesso.");
      setOpenMonthly(false);
      setMonthlyForm({
        period_month: String(now.getMonth() + 1),
        period_year: String(now.getFullYear()),
        total_cash_collected: "",
        total_new_revenue: "",
        monthly_recurring_revenue: "",
        monthly_expenses: "",
        ad_spend: "",
        new_clients_signed: "",
        active_clients: "",
        confidence_score: "",
        booked_calls: "",
        calls_showed: "",
        triage_calls: "",
        strategy_calls: "",
        offers_made: "",
        inbound_messages: "",
        total_followers: "",
        reach: "",
        views: "",
        posts_made: "",
      });
      onSubmitted?.();
    } catch (err: any) {
      toast.error(`Erro ao enviar dados mensais: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => setOpenMonthly(true)}
          className="h-9 px-4 text-xs font-semibold tracking-wide"
        >
          Enviar dados mensais
        </Button>
        <Button
          type="button"
          onClick={() => setOpenWeekly(true)}
          className="h-9 px-4 text-xs font-semibold tracking-wide"
        >
          Enviar vitórias da semana
        </Button>
        <Button
          type="button"
          onClick={() => setOpenDeal(true)}
          className="h-9 px-4 text-xs font-semibold tracking-wide"
        >
          Enviar novo negócio
        </Button>
      </div>

      <Dialog open={openWeekly} onOpenChange={setOpenWeekly}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vitórias da semana</DialogTitle>
            <DialogDescription>
              Compartilhe suas 3 maiores vitórias da semana e o foco da próxima.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="weekly-date">Data</Label>
              <Input
                id="weekly-date"
                type="date"
                value={weeklyForm.reference_date}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, reference_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekly-win-1">Top 1 vitória da última semana</Label>
              <Input
                id="weekly-win-1"
                value={weeklyForm.top_win_1}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, top_win_1: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekly-win-2">Top 2 vitória da última semana</Label>
              <Input
                id="weekly-win-2"
                value={weeklyForm.top_win_2}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, top_win_2: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekly-win-3">Top 3 vitória da última semana</Label>
              <Input
                id="weekly-win-3"
                value={weeklyForm.top_win_3}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, top_win_3: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekly-focus">Uma coisa principal para esta semana</Label>
              <Input
                id="weekly-focus"
                value={weeklyForm.one_focus_this_week}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, one_focus_this_week: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekly-blocker">Existe algum bloqueio?</Label>
              <Textarea
                id="weekly-blocker"
                value={weeklyForm.blocker}
                onChange={(e) => setWeeklyForm((p) => ({ ...p, blocker: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmitWeekly} disabled={saving}>
              {saving ? "Enviando..." : "Salvar vitórias da semana"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openMonthly} onOpenChange={setOpenMonthly}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar dados mensais</DialogTitle>
            <DialogDescription>
              Envie os dados do mês para atualizar histórico e dashboard de métricas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Mês</Label>
                <Select
                  value={monthlyForm.period_month}
                  onValueChange={(value) => setMonthlyForm((p) => ({ ...p, period_month: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ano</Label>
                <Select
                  value={monthlyForm.period_year}
                  onValueChange={(value) => setMonthlyForm((p) => ({ ...p, period_year: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Métricas de negócio</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Caixa total recebido</Label>
                  <Input value={monthlyForm.total_cash_collected} onChange={(e) => setMonthlyForm((p) => ({ ...p, total_cash_collected: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Novo valor de negócios</Label>
                  <Input value={monthlyForm.total_new_revenue} onChange={(e) => setMonthlyForm((p) => ({ ...p, total_new_revenue: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Receita recorrente mensal</Label>
                  <Input value={monthlyForm.monthly_recurring_revenue} onChange={(e) => setMonthlyForm((p) => ({ ...p, monthly_recurring_revenue: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Despesas mensais</Label>
                  <Input value={monthlyForm.monthly_expenses} onChange={(e) => setMonthlyForm((p) => ({ ...p, monthly_expenses: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Investimento em anúncios</Label>
                  <Input value={monthlyForm.ad_spend} onChange={(e) => setMonthlyForm((p) => ({ ...p, ad_spend: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Novos clientes fechados</Label>
                  <Input value={monthlyForm.new_clients_signed} onChange={(e) => setMonthlyForm((p) => ({ ...p, new_clients_signed: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Clientes ativos</Label>
                  <Input value={monthlyForm.active_clients} onChange={(e) => setMonthlyForm((p) => ({ ...p, active_clients: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nível de confiança (1-10)</Label>
                  <Input value={monthlyForm.confidence_score} onChange={(e) => setMonthlyForm((p) => ({ ...p, confidence_score: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Ligações e vendas</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Ligações agendadas</Label>
                  <Input value={monthlyForm.booked_calls} onChange={(e) => setMonthlyForm((p) => ({ ...p, booked_calls: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Ligações comparecidas</Label>
                  <Input value={monthlyForm.calls_showed} onChange={(e) => setMonthlyForm((p) => ({ ...p, calls_showed: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Ligações de triagem</Label>
                  <Input value={monthlyForm.triage_calls} onChange={(e) => setMonthlyForm((p) => ({ ...p, triage_calls: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Ligações estratégicas</Label>
                  <Input value={monthlyForm.strategy_calls} onChange={(e) => setMonthlyForm((p) => ({ ...p, strategy_calls: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Ofertas enviadas</Label>
                  <Input value={monthlyForm.offers_made} onChange={(e) => setMonthlyForm((p) => ({ ...p, offers_made: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Mensagens de entrada</Label>
                  <Input value={monthlyForm.inbound_messages} onChange={(e) => setMonthlyForm((p) => ({ ...p, inbound_messages: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Conteúdo curto</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>Total de seguidores</Label>
                  <Input value={monthlyForm.total_followers} onChange={(e) => setMonthlyForm((p) => ({ ...p, total_followers: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Alcance</Label>
                  <Input value={monthlyForm.reach} onChange={(e) => setMonthlyForm((p) => ({ ...p, reach: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Visualizações</Label>
                  <Input value={monthlyForm.views} onChange={(e) => setMonthlyForm((p) => ({ ...p, views: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Posts publicados</Label>
                  <Input value={monthlyForm.posts_made} onChange={(e) => setMonthlyForm((p) => ({ ...p, posts_made: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmitMonthly} disabled={saving}>
              {saving ? "Enviando..." : "Salvar dados mensais"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDeal} onOpenChange={setOpenDeal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar novo negócio</DialogTitle>
            <DialogDescription>
              Registre novos contratos fechados para histórico comercial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="deal-date">Data</Label>
                <Input
                  id="deal-date"
                  type="date"
                  value={dealForm.deal_date}
                  onChange={(e) => setDealForm((p) => ({ ...p, deal_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-payment-type">Forma de pagamento</Label>
                <Select
                  value={dealForm.payment_type}
                  onValueChange={(value) => setDealForm((p) => ({ ...p, payment_type: value }))}
                >
                  <SelectTrigger id="deal-payment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">À vista</SelectItem>
                    <SelectItem value="installments">Parcelado</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-client">Cliente</Label>
              <Input
                id="deal-client"
                value={dealForm.client_name}
                onChange={(e) => setDealForm((p) => ({ ...p, client_name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-offer">Oferta / Produto</Label>
              <Input
                id="deal-offer"
                value={dealForm.offer_name}
                onChange={(e) => setDealForm((p) => ({ ...p, offer_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="deal-value">Valor do contrato</Label>
                <Input
                  id="deal-value"
                  value={dealForm.deal_value}
                  onChange={(e) => setDealForm((p) => ({ ...p, deal_value: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-cash">Caixa recebido</Label>
                <Input
                  id="deal-cash"
                  value={dealForm.cash_collected}
                  onChange={(e) => setDealForm((p) => ({ ...p, cash_collected: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-source">Canal de origem</Label>
              <Input
                id="deal-source"
                value={dealForm.source_channel}
                onChange={(e) => setDealForm((p) => ({ ...p, source_channel: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-notes">Observações</Label>
              <Textarea
                id="deal-notes"
                value={dealForm.notes}
                onChange={(e) => setDealForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmitDeal} disabled={saving}>
              {saving ? "Salvando..." : "Salvar novo negócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


