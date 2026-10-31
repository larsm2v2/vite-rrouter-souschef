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

  const logout = useCallback(() => {
    setAccessToken(null);
    setInMemoryAccessToken(null);
    setUser(null);
    // Cancel any requests still in flight so a late response can't
    // repopulate UI state for a user that just logged out.
    abortAllInFlightRequests();
    // One-time cleanup in case an older build persisted a token here.
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    // Notify server (optional, for token allowlist cleanup)
    apiClient
      .post("/auth/logout", {}, { withCredentials: true })
      .catch(console.error);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.post<{ accessToken: string }>(
        "/auth/refresh",
      );
      const { accessToken: newAccessToken } = response.data;
      setAccessToken(newAccessToken);
      // Keep the token in memory only -- never persist it to localStorage.
      setInMemoryAccessToken(newAccessToken);
      return true;
    } catch (error) {
      console.error(
        "Token refresh failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      logout();
      return false;
    }
  }, [logout]);

  // Load user and (re)establish an access token on mount. The access token
  // itself is never persisted, so on every fresh page load we must obtain a
  // new one via a silent refresh against the HttpOnly refresh-token cookie.
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    // Defensive cleanup: older builds persisted the access token here.
    localStorage.removeItem("accessToken");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      refreshAccessToken();
    }
  }, [refreshAccessToken]);

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
