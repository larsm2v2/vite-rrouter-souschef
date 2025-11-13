import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import apiClient from "../components/pages/Client";

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
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    // Notify server (optional, for token allowlist cleanup)
    apiClient.post("/auth/logout", {}, { withCredentials: true }).catch(console.error);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiClient.post<{ accessToken: string }>("/auth/refresh");
      const { accessToken: newAccessToken } = response.data;
      setAccessToken(newAccessToken);
      // Persist access token so axios interceptor can pick it up
      localStorage.setItem("accessToken", newAccessToken);
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
      return false;
    }
  }, [logout]);

  // Load user and possibly refresh access token on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedAccess = localStorage.getItem("accessToken");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    if (storedAccess) {
      setAccessToken(storedAccess);
    } else if (storedUser) {
      // If no access token but we have a user, try to refresh (cookie may exist)
      refreshAccessToken();
    }
  }, [refreshAccessToken]);

  const login = (newAccessToken: string, userData: User) => {
    setAccessToken(newAccessToken);
    setUser(userData);
    // Persist access token and user; refresh token is stored as HttpOnly cookie by server
    localStorage.setItem("accessToken", newAccessToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        refreshAccessToken,
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
