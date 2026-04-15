import { X, Pencil, Check } from 'lucide-react';
import { useState } from 'react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: { id: string; title: string; content: string; type: string };
  mode: 'view' | 'edit';
  onSave: (id: string, content: string) => void | Promise<void>;
}

export default function DocumentViewerModal({ isOpen, onClose, document, mode, onSave }: DocumentViewerModalProps) {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [content, setContent] = useState(document.content);

  if (!isOpen) return null;

  const handleSave = async () => {
    await onSave(document.id, content);
    setIsEditing(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-8 md:inset-16 z-50 bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{document.title}</h2>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                Salvar
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isEditing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full bg-secondary border border-border rounded-lg p-4 text-foreground text-sm leading-relaxed outline-none focus:border-primary resize-none font-mono"
            />
          ) : (
            <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
