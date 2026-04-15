import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, User, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfileSettingsModal({ open, onClose }: Props) {
  const { user, session, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(user?.name || "");
    setAvatarUrl(user?.avatarUrl || null);
  }, [open, user?.name, user?.avatarUrl]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Imagem muito grande. Use no máximo 2MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      toast.error("Não foi possível carregar a imagem.");
    }
  };

  const handleSave = async () => {
    if (!session?.user) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    const safeName = fullName.trim();
    if (!safeName) {
      toast.error("Informe seu nome.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("user_profiles")
        .upsert(
          {
            user_id: session.user.id,
            full_name: safeName,
            avatar_url: avatarUrl,
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;

      await refreshProfile();
      toast.success("Perfil atualizado com sucesso.");
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Perfil</DialogTitle>
          <DialogDescription>
            Altere seu nome e foto exibidos no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || "Avatar"}
                className="w-16 h-16 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xl font-semibold">
                  {(fullName || user?.name || "U").slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleAvatarFile(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                Trocar foto
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => setAvatarUrl(null)}
                >
                  <X className="w-4 h-4" />
                  Remover foto
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-full-name">Nome</Label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="profile-full-name"
                className="pl-10"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Seu nome"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
