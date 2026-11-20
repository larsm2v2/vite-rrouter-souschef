import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import apiClient, {
  setInMemoryAccessToken,
  abortAllInFlightRequests,
} from "../components/pages/Client";
import {
  onSessionExpired,
  refreshSession,
  restoreSession,
  startSessionKeepAlive,
  subscribeToken,
} from "../utils/authSession";
import { clearAllUserData } from "../utils/userStorage";

interface User {
  id: string;
  email: string;
  display_name: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (accessToken: string, user: User) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  updateUser?: (user: User) => void;
  displayName?: string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setInMemoryAccessToken(null);
    setUser(null);
    // Cancel any requests still in flight so a late response can't
    // repopulate UI state for a user that just logged out.
    abortAllInFlightRequests();
    // One-time cleanup in case an older build persisted a token here.
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedRecipeIds");
  }, []);

  const logout = useCallback(() => {
    clearSession();
    // Deliberate sign-out clears saved data; automatic expiry leaves it resumable.
    clearAllUserData();
    // Notify server (optional, for token allowlist cleanup)
    apiClient
      .post("/auth/logout", {}, { withCredentials: true })
      .catch(console.error);
  }, [clearSession]);

  // Returns true when a fresh token was obtained. Only a server "no" (the refresh
  // token is rejected) ends the session; being offline or hitting a cold server does not.
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const outcome = await refreshSession();
    if (outcome.status === "ok") {
      setAccessToken(outcome.accessToken);
      return true;
    }
    if (outcome.status === "expired") clearSession();
    return false;
  }, [clearSession]);

  // Load user and (re)establish an access token on mount. The access token
  // itself is never persisted, so on every fresh page load we must obtain a
  // new one via a silent refresh against the HttpOnly refresh-token cookie.
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    // Defensive cleanup: older builds persisted the access token here.
    localStorage.removeItem("accessToken");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      restoreSession();
    }
  }, []);

  // Keep the session alive while the app is open: mirror token changes made by
  // the background refresh, renew after sleep or reconnect, and sign out only
  // when the server reports the session is really over.
  useEffect(() => {
    const stopKeepAlive = startSessionKeepAlive();
    const unsubscribe = subscribeToken(setAccessToken);
    const stopExpiry = onSessionExpired(() => {
      clearSession();
      if (!window.location.pathname.includes("/login")) {
        window.location.assign("/login");
      }
    });
    return () => {
      stopKeepAlive();
      unsubscribe();
      stopExpiry();
    };
  }, [clearSession]);

  const formatDisplayName = (user?: User | null) => {
    if (!user) return null;
    if (user.display_name && user.display_name.trim().length > 0)
      return user.display_name;
    if (user.email) {
      const username = user.email.split("@")[0];
      return username
        .replace(/[._\-+]/g, " ")
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return "User";
  };

  const login = (newAccessToken: string, userData: User) => {
    setAccessToken(newAccessToken);
    setInMemoryAccessToken(newAccessToken);
    setUser(userData);
    // Persist the user profile only; the refresh token is stored as an
    // HttpOnly cookie by the server and the access token stays in memory.
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const displayName = formatDisplayName(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        refreshAccessToken,
        updateUser,
        displayName,
        isAuthenticated: !!user && !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
