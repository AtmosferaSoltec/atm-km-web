import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { Eye, EyeOff } from "lucide-react";

import { KmMark } from "../components/km-mark";
import { Spinner } from "../components/states";
import { Button, Field, Input } from "../components/ui";
import { ApiError } from "../lib/api/client";
import { errorMessage } from "../lib/api/errors";
import { useAuth } from "../lib/auth";
import { ROUTES } from "../lib/routes";

/**
 * There is no sign-up nor "forgot password": the owner creates accounts on the
 * server. So the screen is just the two fields, big, for a phone.
 */
export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const next = (location.state as { from?: string } | null)?.from ?? ROUTES.home;
  if (auth.status === "authenticated") return <Navigate to={next} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      await auth.login(username, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOO_MANY_REQUESTS") {
        setError("Demasiados intentos. Espera unos minutos y vuelve a probar.");
      } else {
        setError(errorMessage(err));
      }
      setPassword("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 text-center">
        <KmMark size={64} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KM</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">El préstamo de tu auto, por kilómetro</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Usuario">
          <Input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario o DNI"
          />
        </Field>
        <Field label="Contraseña">
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute inset-y-0 right-1 grid w-11 place-items-center text-zinc-400"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </Field>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" variant="brand" size="lg" disabled={sending || !username || !password} className="mt-2">
          {sending ? <Spinner /> : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-xs text-zinc-400">Tu sesión se mantiene abierta mientras uses la app.</p>
    </div>
  );
}
