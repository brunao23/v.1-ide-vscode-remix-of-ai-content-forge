import { Upload, FileText, X } from 'lucide-react';
import { useState, useRef } from 'react';

interface NewDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (doc: { name: string; type: string; content: string }) => void;
}

const DOC_TYPES = [
  { value: 'brand-book', label: 'Brand Book' },
  { value: 'market-research', label: 'Pesquisa de Mercado' },
  { value: 'icp-architect', label: 'Mapa do ICP' },
  { value: 'pillar-strategist', label: 'Pilares de Conteúdo' },
  { value: 'matrix-generator', label: 'Matriz de Conteúdo' },
  { value: 'other', label: 'Outro' },
];

export default function NewDocumentModal({ isOpen, onClose, onDocumentCreated }: NewDocumentModalProps) {
  const [mode, setMode] = useState<'select' | 'upload' | 'paste'>('select');
  const [pastedText, setPastedText] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('brand-book');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setMode('select');
    setPastedText('');
    setDocumentName('');
    setDocumentType('brand-book');
    setSelectedFile(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSave = async () => {
    if (mode === 'upload' && selectedFile) {
      const text = await selectedFile.text();
      onDocumentCreated({ name: documentName, type: documentType, content: text });
    } else if (mode === 'paste' && pastedText) {
      onDocumentCreated({ name: documentName, type: documentType, content: pastedText });
    }
    resetAndClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={resetAndClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {mode === 'select' ? 'Novo documento' : mode === 'upload' ? 'Upload de arquivo' : 'Colar texto'}
          </h2>
          <button onClick={resetAndClose} className="p-2 rounded-lg hover:bg-secondary" aria-label="Fechar">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'select' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('upload')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Upload de arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">.doc, .docx, .pdf, .md</p>
                </div>
              </button>

              <button
                onClick={() => setMode('paste')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Colar texto</p>
                  <p className="text-xs text-muted-foreground mt-1">Cole o conteúdo diretamente</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo de documento</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-primary"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <input ref={fileInputRef} type="file" accept=".doc,.docx,.pdf,.md,.txt" className="hidden" onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-primary" />
                    <p className="text-sm text-foreground font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">Clique para trocar</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Arraste um arquivo ou clique para selecionar</p>
                    <p className="text-xs text-muted-foreground">.doc, .docx, .pdf, .md</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do documento</label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-primary"
                    placeholder="Ex: Brand Book - Minha Empresa"
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo de documento</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-primary"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do documento</label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-primary"
                  placeholder="Ex: Brand Book - Minha Empresa"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Conteúdo</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full h-48 px-4 py-3 bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-primary resize-none"
                  placeholder="Cole o conteúdo do documento aqui..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode !== 'select' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <button onClick={() => setMode('select')} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Voltar
            </button>
            <button
              onClick={handleSave}
              disabled={mode === 'upload' ? !selectedFile : !pastedText || !documentName}
              className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg font-medium transition-colors"
            >
              Salvar documento
            </button>
          </div>
        )}
      </div>
    </>
  );
}
