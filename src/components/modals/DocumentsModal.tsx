import { X, MoreHorizontal, FileText, Download, Pencil, Trash2, Eye, BookOpen, BarChart3, Target, Loader2 } from 'lucide-react';
import { AGENTS } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import NewDocumentModal from '@/components/documents/NewDocumentModal';
import type { NewDocumentPayload } from '@/components/documents/NewDocumentModal';
import DocumentViewerModal from '@/components/documents/DocumentViewerModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { invokeSupabaseFunctionWithRetry } from '@/services/supabaseFunctionClient';

interface DocItem {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
  type: string;
  icon: string;
  content: string;
  processingStatus: 'pending' | 'processing' | 'ready' | 'error';
  processingError: string | null;
}

const DOC_ICONS: Record<string, ReactNode> = {
  'brand-book': <BookOpen className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
  'market-research': <BarChart3 className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
  'icp-architect': <Target className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
  'voz-de-marca': <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
};

const DB_TYPE_LABELS: Record<string, string> = {
  'brand-book': 'Brand Book',
  'pesquisa': 'Pesquisa',
  'icp': 'ICP',
  'pilares': 'Pilares',
  'matriz': 'Matriz',
  'calendario': 'Calendário',
  'roteiro': 'Roteiro',
  'outro': 'Outro',
};

const UI_TO_DB_TYPE: Record<string, string> = {
  'brand-book': 'brand-book',
  'market-research': 'pesquisa',
  'icp-architect': 'icp',
  'pillar-strategist': 'pilares',
  'matrix-generator': 'matriz',
  'marketing-manager': 'calendario',
  'scriptwriter': 'roteiro',
  'voz-de-marca': 'outro',
  'other': 'outro',
};

const STATUS_LABELS: Record<DocItem['processingStatus'], string> = {
  pending: 'Pendente',
  processing: 'Processando',
  ready: 'Pronto',
  error: 'Erro',
};

const fallbackIcon = <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DocumentsModal({ open, onClose }: Props) {
  const { user, activeTenant } = useAuth();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocItem | null>(null);
  const [viewerMode, setViewerMode] = useState<'view' | 'edit'>('view');

  const getAgentName = (agentId: string) => AGENTS.find(a => a.id === agentId)?.name || agentId || 'Documento';

  const grouped = useMemo(
    () =>
      docs.reduce<Record<string, DocItem[]>>((acc, doc) => {
        (acc[doc.type] = acc[doc.type] || []).push(doc);
        return acc;
      }, {}),
    [docs]
  );

  const fetchDocuments = useCallback(async () => {
    if (!user || !activeTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, type, agent_id, created_at, content, processing_status, processing_error')
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar documentos');
      setLoading(false);
      return;
    }

    const mapped: DocItem[] = (data || []).map((row) => ({
      id: row.id,
      title: row.name,
      agentId: row.agent_id || 'other',
      createdAt: new Date(row.created_at).toLocaleDateString('pt-BR'),
      type: DB_TYPE_LABELS[row.type] || row.type,
      icon: row.agent_id || row.type || 'other',
      content: row.content || '',
      processingStatus: (row.processing_status as DocItem['processingStatus']) || 'ready',
      processingError: row.processing_error || null,
    }));

    setDocs(mapped);
    setLoading(false);
  }, [user, activeTenant?.id]);

  useEffect(() => {
    if (!open) return;
    if (!user || !activeTenant?.id) {
      setDocs([]);
      return;
    }
    void fetchDocuments();
  }, [open, user, activeTenant?.id, fetchDocuments]);

  if (!open) return null;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractDocumentContent = async (file: File): Promise<string> => {
    const fileBase64 = await fileToBase64(file);
    const data = await invokeSupabaseFunctionWithRetry<any>('extract-document-content', {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBase64,
      tenantId: activeTenant.id,
    });
    if (!data?.success || !data?.content) {
      throw new Error(data?.error || 'Não foi possível extrair conteúdo do arquivo');
    }

    return String(data.content);
  };

  const indexDocument = async (params: {
    documentId: string;
    content: string;
    userId: string;
    tenantId: string;
    documentType: string;
    agentDocument: boolean;
    agentId: string | null;
  }) => {
    await invokeSupabaseFunctionWithRetry('process-document', {
      documentId: params.documentId,
      content: params.content,
      userId: params.userId,
      tenantId: params.tenantId,
      documentType: params.documentType,
      agentDocument: params.agentDocument,
      agentId: params.agentId,
    });
  };

  const handleNewDocument = async (doc: NewDocumentPayload) => {
    if (!user || !activeTenant?.id) {
      toast.error('Faça login e selecione um tenant para enviar documentos');
      return;
    }

    const dbType = UI_TO_DB_TYPE[doc.type] || 'outro';
    const agentId = doc.type === 'other' ? null : doc.type;
    const agentDocument = Boolean(agentId);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        tenant_id: activeTenant.id,
        name: doc.name,
        type: dbType,
        agent_id: agentId,
        content: doc.mode === 'paste' ? doc.content : null,
        processing_status: 'processing',
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      toast.error(`Falha ao salvar documento: ${error?.message || 'erro desconhecido'}`);
      return;
    }

    try {
      const content = doc.mode === 'paste'
        ? doc.content
        : await extractDocumentContent(doc.file);

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          content,
          file_type: doc.mode === 'upload' ? doc.file.type || null : null,
          file_size: doc.mode === 'upload' ? doc.file.size : null,
        })
        .eq('id', data.id)
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await indexDocument({
        documentId: data.id,
        content,
        userId: user.id,
        tenantId: activeTenant.id,
        documentType: dbType,
        agentDocument,
        agentId,
      });

      toast.success('Documento salvo e indexado');
    } catch (e: any) {
      const message = e?.message || 'erro desconhecido';
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          processing_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id);
      toast.error(`Documento salvo, mas houve falha no processamento: ${message}`);
    }

    await fetchDocuments();
  };

  const handleDelete = async (id: string) => {
    if (!user || !activeTenant?.id) {
      toast.error('Faça login e selecione um tenant para excluir documentos');
      return;
    }

    const doc = docs.find(d => d.id === id);
    if (!doc || !confirm(`Tem certeza que deseja excluir "${doc.title}"?`)) {
      setMenuOpen(null);
      return;
    }

    let vectorData: any = null;
    let vectorDeleteWarning: string | null = null;
    try {
      vectorData = await invokeSupabaseFunctionWithRetry<any>('delete-document-vectors', {
        documentId: id,
        userId: user.id,
        tenantId: activeTenant.id,
      });
    } catch (error: any) {
      vectorDeleteWarning = error?.message || 'falha desconhecida';
      console.warn('Falha ao remover vetores do Pinecone:', error);
    }

    if ((vectorData as any)?.skipped) {
      vectorDeleteWarning =
        (vectorData as any)?.warning || 'remocao vetorial nao executada';
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id);
    if (error) {
      toast.error(`Erro ao excluir documento: ${error.message}`);
      setMenuOpen(null);
      return;
    }

    if (vectorDeleteWarning) {
      toast.warning(
        `Documento removido, mas os vetores não foram removidos agora: ${vectorDeleteWarning}`,
      );
    } else {
      toast.success('Documento e vetores removidos');
    }
    setMenuOpen(null);
    await fetchDocuments();
  };

  const handleDownloadPDF = async (doc: DocItem) => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(doc.title, 20, 20);
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(doc.content || '', 170);
    pdf.text(lines, 20, 35);
    pdf.save(`${doc.title}.pdf`);
    setMenuOpen(null);
  };

  const handleDownloadDOCX = async (doc: DocItem) => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const docxDoc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: doc.title, bold: true, size: 32 })] }),
          new Paragraph({ children: [new TextRun({ text: doc.content || '', size: 24 })] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(docxDoc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(null);
  };

  const handleSaveContent = async (id: string, content: string) => {
    if (!user || !activeTenant?.id) {
      toast.error('Faça login e selecione um tenant para editar documentos');
      return;
    }

    const { error } = await supabase
      .from('documents')
      .update({
        content,
        processing_status: 'processing',
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id);

    if (error) {
      toast.error(`Erro ao salvar edição: ${error.message}`);
      return;
    }

    const docData = docs.find((d) => d.id === id);
    const typeLabel = docData?.type || 'outro';
    const dbType =
      Object.entries(DB_TYPE_LABELS).find(([, label]) => label === typeLabel)?.[0] || 'outro';
    const agentDocument = Boolean(docData?.agentId && docData.agentId !== 'other');
    const agentId = agentDocument ? docData?.agentId : null;

    try {
      await indexDocument({
        documentId: id,
        content,
        userId: user.id,
        tenantId: activeTenant.id,
        documentType: dbType,
        agentDocument,
        agentId,
      });
      toast.success('Documento atualizado e reindexado');
    } catch (e: any) {
      const message = e?.message || 'erro desconhecido';
      await supabase
        .from('documents')
        .update({
          processing_status: 'error',
          processing_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('tenant_id', activeTenant.id);
      toast.error(`Documento atualizado, mas falhou ao reindexar: ${message}`);
    }

    await fetchDocuments();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-50 bg-background rounded-xl border border-border/40 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Documentos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gerencie os documentos criados pelos agentes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewDocOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/60 text-sm text-foreground hover:bg-secondary/30 transition-colors"
              >
                + Novo documento
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors" aria-label="Fechar">
                <X className="w-5 h-5 text-foreground" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[640px] mx-auto px-6 py-8 space-y-8">
            {(!user || !activeTenant?.id) && (
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-sm text-muted-foreground">
                Faça login e selecione um tenant para visualizar e gerenciar documentos.
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && Object.entries(grouped).map(([type, typeDocs]) => (
              <div key={type}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{type}</p>
                <div className="space-y-0">
                  {typeDocs.map((doc, i) => (
                    <div key={doc.id}>
                      <div className="flex items-center gap-4 py-5 group">
                        <div className="w-9 h-9 rounded-[8px] bg-secondary/60 flex items-center justify-center shrink-0">
                          {DOC_ICONS[doc.icon] || fallbackIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Criado em {doc.createdAt} - {getAgentName(doc.agentId)} - {STATUS_LABELS[doc.processingStatus]}
                          </p>
                          {doc.processingStatus === 'error' && doc.processingError && (
                            <p className="text-[11px] text-destructive mt-1 truncate">{doc.processingError}</p>
                          )}
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                            className="p-2 rounded-lg hover:bg-secondary/60 transition-colors"
                            aria-label="Menu de ações"
                          >
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {menuOpen === doc.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-popover rounded-lg shadow-lg border border-border/40 min-w-[160px] p-1">
                                <MenuItem icon={<Eye className="w-4 h-4" />} label="Abrir" onClick={() => { setViewerDoc(doc); setViewerMode('view'); setMenuOpen(null); }} />
                                <MenuItem icon={<Pencil className="w-4 h-4" />} label="Editar" onClick={() => { setViewerDoc(doc); setViewerMode('edit'); setMenuOpen(null); }} />
                                <MenuItem icon={<Download className="w-4 h-4" />} label="Baixar PDF" onClick={() => handleDownloadPDF(doc)} />
                                <MenuItem icon={<Download className="w-4 h-4" />} label="Baixar DOCX" onClick={() => handleDownloadDOCX(doc)} />
                                <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Excluir" destructive onClick={() => handleDelete(doc.id)} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {i < typeDocs.length - 1 && <div className="border-t border-border/30" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!loading && docs.length === 0 && user && (
              <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground">Nenhum documento ainda</p>
                <p className="text-xs text-muted-foreground">Crie o primeiro documento</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <NewDocumentModal isOpen={newDocOpen} onClose={() => setNewDocOpen(false)} onDocumentCreated={handleNewDocument} />

      {viewerDoc && (
        <DocumentViewerModal
          isOpen={!!viewerDoc}
          onClose={() => setViewerDoc(null)}
          document={viewerDoc}
          mode={viewerMode}
          onSave={handleSaveContent}
        />
      )}
    </>
  );
}

function MenuItem({ icon, label, destructive, onClick }: { icon: ReactNode; label: string; destructive?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary'}`}
    >
      {icon}
      {label}
    </button>
  );
}



