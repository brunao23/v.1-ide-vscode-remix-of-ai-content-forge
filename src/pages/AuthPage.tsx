import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Lock, Mail, User } from "lucide-react";
import gemzLogo from "@/assets/gemz-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AuthPage() {
  const { signIn, signUp, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isSignUp = mode === "signup";
  const isSignIn = !isSignUp;
  const title = useMemo(() => (isSignUp ? "Criar conta no GEMZ AI" : "Entrar no GEMZ AI"), [isSignUp]);
  const description = useMemo(
    () => (isSignUp ? "Cadastre-se para criar sua conta e workspace automaticamente" : "Use o e-mail e senha da sua conta cadastrada"),
    [isSignUp],
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (isSignUp) {
      if (!fullName.trim()) {
        toast.error("Informe seu nome.");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        toast.error("A senha precisa ter ao menos 8 caracteres.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("A confirmação de senha não confere.");
        setLoading(false);
        return;
      }

      const { error, needsEmailConfirmation } = await signUp({
        fullName,
        email,
        password,
      });

      if (error) {
        toast.error(`Não foi possível criar sua conta: ${error.message || "erro no cadastro"}`);
        setLoading(false);
        return;
      }

      if (needsEmailConfirmation) {
        toast.success("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
      } else {
        toast.success("Conta criada com sucesso. Você já entrou no sistema.");
      }

      setLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      toast.error(`Não foi possível entrar: ${error.message || "credenciais inválidas"}`);
      setLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="border-border/60 shadow-xl bg-card">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={gemzLogo} alt="Gemz AI" className="w-10 h-10 rounded-md" />
              <div>
                <CardTitle className="text-xl text-foreground">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>

            <div className="grid grid-cols-2 rounded-lg border border-border/50 p-1 bg-background/50">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isSignIn ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isSignUp ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar conta
              </button>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nome completo</Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="full-name"
                      type="text"
                      className="pl-10"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="confirm-password"
                      type="password"
                      className="pl-10"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirme sua senha"
                      autoComplete="new-password"
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSignUp ? (
                  "Criar conta"
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground mt-4">
              {isSignUp
                ? "Ao criar a conta, seu tenant/workspace será criado automaticamente."
                : "Se ainda não tem conta, clique em Criar conta."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
