import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api, login as apiLogin, logout as apiLogout, onSessionLost, refreshSession, type UserDto } from "./api/client";
import type { User } from "./types";

// The session: on start it is renewed from the HttpOnly cookie (so opening the
// app within 90 days needs no login), and it ends on logout or when the API
// says it cannot be renewed.

type Auth =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User };

type AuthContextValue = Auth & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const toUser = (dto: UserDto): User => ({ id: dto.id, username: dto.username, displayName: dto.display_name });

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<Auth>({ status: "loading", user: null });

  const signOut = useCallback(() => {
    queryClient.clear();
    setAuth({ status: "anonymous", user: null });
  }, [queryClient]);

  useEffect(() => {
    onSessionLost(signOut);
    let cancelled = false;
    (async () => {
      try {
        if (await refreshSession()) {
          const user = toUser(await api<UserDto>("/me"));
          if (!cancelled) setAuth({ status: "authenticated", user });
          return;
        }
      } catch {
        // Offline or the API is down: the login screen explains on submit.
      }
      if (!cancelled) setAuth({ status: "anonymous", user: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      async login(username, password) {
        const user = await apiLogin(username, password);
        queryClient.clear();
        setAuth({ status: "authenticated", user: toUser(user) });
      },
      async logout() {
        await apiLogout();
        signOut();
      },
    }),
    [auth, queryClient, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}

/** The signed-in user; only for screens behind the login. */
export function useUser(): User {
  const auth = useAuth();
  if (auth.status !== "authenticated") throw new Error("useUser needs a session");
  return auth.user;
}
