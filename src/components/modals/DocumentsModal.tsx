import { X, MoreHorizontal, FileText, Download, Pencil, Trash2 } from 'lucide-react';
import { AGENTS } from '@/types';
import { useState } from 'react';

interface DocItem {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
  type: string;
  emoji: string;
}

// Mock documents
const MOCK_DOCS: DocItem[] = [
  { id: '1', title: 'Brand Book - Minha Empresa', agentId: 'brand-book', createdAt: '09/02/2026', type: 'Brand Book', emoji: '📘' },
  { id: '2', title: 'Highcharts - Minha Empresa', agentId: 'market-research', createdAt: '09/02/2026', type: 'Pesquisa', emoji: '📊' },
  { id: '3', title: 'ICP Map - Minha Empresa', agentId: 'icp-architect', createdAt: '09/02/2026', type: 'ICP', emoji: '🎯' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DocumentsModal({ open, onClose }: Props) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  if (!open) return null;

  const getAgentName = (agentId: string) => AGENTS.find(a => a.id === agentId)?.name || agentId;

  // Group by type
  const grouped = MOCK_DOCS.reduce<Record<string, DocItem[]>>((acc, doc) => {
    (acc[doc.type] = acc[doc.type] || []).push(doc);
    return acc;
  }, {});

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-50 bg-card rounded-xl border border-border-secondary shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Documentos</h2>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              + Novo documento
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary" aria-label="Fechar">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {Object.entries(grouped).map(([type, docs]) => (
              <div key={type}>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{type}</h3>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary border border-border-secondary hover:border-[hsl(var(--border-focus))] transition-colors group">
                      <span className="text-2xl">{doc.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Criado em {doc.createdAt} • {getAgentName(doc.agentId)}
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                          className="p-2 rounded-lg hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Menu de ações"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {menuOpen === doc.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 bg-popover rounded-lg shadow-lg border border-border-secondary min-w-[160px] p-1">
                              <MenuItem icon={<FileText className="w-4 h-4" />} label="Abrir" />
                              <MenuItem icon={<Pencil className="w-4 h-4" />} label="Editar" />
                              <MenuItem icon={<Download className="w-4 h-4" />} label="Baixar PDF" />
                              <MenuItem icon={<Download className="w-4 h-4" />} label="Baixar DOCX" />
                              <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Excluir" destructive />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {MOCK_DOCS.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhum documento ainda</p>
                <p className="text-sm mt-1">Complete as etapas dos agentes para gerar documentos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MenuItem({ icon, label, destructive }: { icon: React.ReactNode; label: string; destructive?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary'}`}>
      {icon}
      {label}
    </button>
  );
}
