import { X, MoreHorizontal, FileText, Download, Pencil, Trash2, Eye, BookOpen, BarChart3, Target } from 'lucide-react';
import { AGENTS } from '@/types';
import { useState } from 'react';
import NewDocumentModal from '@/components/documents/NewDocumentModal';
import DocumentViewerModal from '@/components/documents/DocumentViewerModal';

interface DocItem {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
  type: string;
  icon: string;
  content: string;
}

const DOC_ICONS: Record<string, React.ReactNode> = {
  'brand-book': <BookOpen className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
  'market-research': <BarChart3 className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
  'icp-architect': <Target className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />,
};

const fallbackIcon = <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />;

const INITIAL_DOCS: DocItem[] = [
  { id: '1', title: 'Brand Book - Minha Empresa', agentId: 'brand-book', createdAt: '09/02/2026', type: 'Brand Book', icon: 'brand-book', content: 'Conteúdo do Brand Book...' },
  { id: '2', title: 'Highcharts - Minha Empresa', agentId: 'market-research', createdAt: '09/02/2026', type: 'Pesquisa', icon: 'market-research', content: 'Conteúdo da pesquisa de mercado...' },
  { id: '3', title: 'ICP Map - Minha Empresa', agentId: 'icp-architect', createdAt: '09/02/2026', type: 'ICP', icon: 'icp-architect', content: 'Conteúdo do mapa do ICP...' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DocumentsModal({ open, onClose }: Props) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocItem | null>(null);
  const [viewerMode, setViewerMode] = useState<'view' | 'edit'>('view');

  if (!open) return null;

  const getAgentName = (agentId: string) => AGENTS.find(a => a.id === agentId)?.name || agentId;

  const grouped = docs.reduce<Record<string, DocItem[]>>((acc, doc) => {
    (acc[doc.type] = acc[doc.type] || []).push(doc);
    return acc;
  }, {});

  const handleNewDocument = (doc: { name: string; type: string; content: string }) => {
    const typeLabel = AGENTS.find(a => a.id === doc.type)?.outputDocument || doc.type;
    const newDoc: DocItem = {
      id: crypto.randomUUID(),
      title: doc.name,
      agentId: doc.type,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      type: typeLabel,
      emoji: AGENTS.find(a => a.id === doc.type)?.emoji || '📄',
      content: doc.content,
    };
    setDocs(prev => [newDoc, ...prev]);
  };

  const handleDelete = (id: string) => {
    const doc = docs.find(d => d.id === id);
    if (doc && confirm(`Tem certeza que deseja excluir "${doc.title}"?`)) {
      setDocs(prev => prev.filter(d => d.id !== id));
    }
    setMenuOpen(null);
  };

  const handleDownloadPDF = async (doc: DocItem) => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(doc.title, 20, 20);
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(doc.content, 170);
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
          new Paragraph({ children: [new TextRun({ text: doc.content, size: 24 })] }),
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

  const handleSaveContent = (id: string, content: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, content } : d));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-50 bg-background rounded-xl border border-border/40 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Documentos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie os documentos criados pelos agentes</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[640px] mx-auto px-6 py-8 space-y-8">
            {Object.entries(grouped).map(([type, typeDocs]) => (
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
                            Criado em {doc.createdAt} • {getAgentName(doc.agentId)}
                          </p>
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                            className="p-2 rounded-lg hover:bg-secondary/60 opacity-0 group-hover:opacity-100 transition-opacity"
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

            {docs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground">Nenhum documento ainda</p>
                <p className="text-xs text-muted-foreground">Complete as etapas dos agentes para gerar documentos</p>
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

function MenuItem({ icon, label, destructive, onClick }: { icon: React.ReactNode; label: string; destructive?: boolean; onClick?: () => void }) {
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
