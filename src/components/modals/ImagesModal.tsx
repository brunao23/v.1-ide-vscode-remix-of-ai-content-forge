import { X, Download, Image as ImageIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImagesModal({ open, onClose }: Props) {
  if (!open) return null;

  // Placeholder images - will be populated when users generate/upload images
  const images: string[] = [];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-12 z-50 bg-card rounded-xl border border-border-secondary shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Imagens</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary" aria-label="Fechar">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma imagem ainda</p>
              <p className="text-sm mt-1">Imagens geradas nas conversas aparecerão aqui</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary border border-border-secondary overflow-hidden group relative cursor-pointer">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button className="p-2 rounded-full bg-secondary/80" aria-label="Download">
                      <Download className="w-4 h-4 text-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
