import { Plus, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import { useRef } from 'react';

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
}

interface FileUploadButtonProps {
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
}

export function FileUploadButton({ onFilesChange, files }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selectedFiles.map((file) => {
      const isImage = file.type.startsWith('image/');
      const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text');
      return {
        id: crypto.randomUUID(),
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        type: isImage ? 'image' : isDocument ? 'document' : 'other',
      };
    });
    onFilesChange([...files, ...newFiles]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0 mb-0.5"
        aria-label="Anexar arquivo"
      >
        <Plus className="w-5 h-5 text-muted-foreground" />
      </button>
    </>
  );
}

export function AttachedFiles({ files, onRemove }: { files: UploadedFile[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null;

  const getFileIcon = (type: UploadedFile['type']) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
      case 'document': return <FileText className="w-4 h-4 text-muted-foreground" />;
      default: return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-2 bg-accent rounded-lg px-2 py-1.5 max-w-[200px]">
          {file.preview ? (
            <img src={file.preview} alt={file.file.name} className="w-8 h-8 rounded object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
              {getFileIcon(file.type)}
            </div>
          )}
          <span className="text-xs text-foreground truncate">{file.file.name}</span>
          <button
            onClick={() => onRemove(file.id)}
            className="w-5 h-5 rounded-full hover:bg-secondary flex items-center justify-center shrink-0"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
}
