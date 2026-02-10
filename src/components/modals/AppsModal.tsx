import { X, ExternalLink, CheckCircle, Circle } from 'lucide-react';

interface Integration {
  name: string;
  icon: string;
  description: string;
  connected: boolean;
}

const INTEGRATIONS: Integration[] = [
  { name: 'Google Drive', icon: '📁', description: 'Salve documentos no Google Drive', connected: false },
  { name: 'Notion', icon: '📝', description: 'Exporte para páginas do Notion', connected: false },
  { name: 'Zapier', icon: '⚡', description: 'Automatize workflows com Zapier', connected: false },
  { name: 'n8n', icon: '🔗', description: 'Conecte via webhooks n8n', connected: true },
  { name: 'Calendário', icon: '📅', description: 'Sincronize calendários de conteúdo', connected: false },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AppsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-50 bg-card rounded-xl border border-border-secondary shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Aplicativos</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary" aria-label="Fechar">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-3">
            {INTEGRATIONS.map((app) => (
              <div key={app.name} className="flex items-center gap-4 p-4 rounded-xl bg-secondary border border-border-secondary hover:border-[hsl(var(--border-focus))] transition-colors">
                <span className="text-2xl w-10 h-10 flex items-center justify-center">{app.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{app.name}</p>
                  <p className="text-sm text-muted-foreground">{app.description}</p>
                </div>
                {app.connected ? (
                  <div className="flex items-center gap-1.5 text-primary text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Conectado</span>
                  </div>
                ) : (
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-secondary text-sm text-foreground hover:bg-accent transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
