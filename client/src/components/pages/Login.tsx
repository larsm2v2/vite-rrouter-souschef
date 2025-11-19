import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "./Client";
import GoogleLoginButton from "../auth/GoogleLoginButton";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Handle OAuth callback (extract tokens from URL fragment)
  useEffect(() => {
    const handleOAuth = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get("access_token");
      const userStr = params.get("user");

      if (accessToken && userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          login(accessToken, user);
          // Clear hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          navigate("/profile", { replace: true });
        } catch (err) {
          console.error("Failed to parse OAuth response:", err);
          setError("Authentication failed. Please try again.");
        }
      } else if (accessToken && !userStr) {
        // If server returned tokens but not user data, try to fetch the user profile
        try {
          // Persist the access token immediately so apiClient will include it
          localStorage.setItem("accessToken", accessToken);

          const resp = await apiClient.get<{
            authenticated: boolean;
            user?: { id: string; email: string; display_name: string };
          }>("/auth/check");

          if (resp.data && resp.data.authenticated && resp.data.user) {
            login(accessToken, resp.data.user);
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/profile", { replace: true });
          } else {
            setError("Authentication failed. Please try again.");
          }
        } catch (err) {
          console.error("Failed to fetch user after OAuth:", err);
          setError("Authentication failed. Please try again.");
        }
      }
    };

    handleOAuth();
  }, [login, navigate]);

  // Check URL parameters for error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setError(
        errorParam === "auth_failed"
          ? "Authentication failed. Please try again."
          : `Login error: ${errorParam}`
      );
    }
  }, []);

  // Check if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/profile", { replace: true });
    }
    setLoading(false);
  }, [isAuthenticated, navigate]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    if (!email) {
      setFormError("Email is required");
      setLoading(false);
      return;
    }

    if (!password) {
      setFormError("Password is required");
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.post("/auth/login", {
        email,
        password,
      });

      if (response.status === 200) {
        const { accessToken, user } = response.data as {
          accessToken: string;
          user: { id: string; email: string; display_name: string };
        };
        login(accessToken, user);
        navigate("/profile");
      }
    } catch (error: unknown) {
      console.error("Login failed:", error);

      const axiosError = error as {
        response?: {
          data?: { message?: string };
          status?: number;
          headers?: unknown;
        };
        request?: unknown;
        message?: string;
      };

      // More detailed error reporting
      if (axiosError.response) {
        console.error("Response data:", axiosError.response.data);
        console.error("Response status:", axiosError.response.status);
        console.error("Response headers:", axiosError.response.headers);
        setFormError(
          axiosError.response.data?.message ||
            "Login failed. Please check your credentials."
        );
      } else if (axiosError.request) {
        console.error("No response received:", axiosError.request);
        setFormError("No response from server. Please try again later.");
      } else {
        console.error("Error during request setup:", axiosError.message);
        setFormError("Error setting up request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email) {
      setFormError("Email is required");
      return;
    }

    if (!password) {
      setFormError("Password is required");
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Create registration payload
      const payload = {
        email: email,
        password: password,
        display_name: email.split("@")[0],
      };

      console.log("Sending registration payload:", JSON.stringify(payload));

      const response = await apiClient.post("/auth/register", payload);

      console.log("Registration response:", response);

      if (response.status === 201) {
        const { accessToken, user } = response.data as {
          accessToken: string;
          user: { id: string; email: string; display_name: string };
        };
        login(accessToken, user);
        navigate("/profile");
      }
    } catch (error: unknown) {
      console.error("Registration failed:", error);

      const axiosError = error as {
        response?: {
          data?: { message?: string };
          status?: number;
          headers?: unknown;
        };
        request?: unknown;
        message?: string;
      };

      // More detailed error reporting
      if (axiosError.response) {
        console.error("Response data:", axiosError.response.data);
        console.error("Response status:", axiosError.response.status);
        console.error("Response headers:", axiosError.response.headers);
        setFormError(
          axiosError.response.data?.message ||
            "Registration failed. Please try again."
        );
      } else if (axiosError.request) {
        console.error("No response received:", axiosError.request);
        setFormError("No response from server. Please try again later.");
      } else {
        console.error("Error during request setup:", axiosError.message);
        setFormError("Error setting up request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-container">
          <h1>Souschef</h1>
        </div>

        <div className="header">
          <h2>Welcome!</h2>
          <p className="subtext">Please sign in to continue</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Tab navigation */}
        <div className="auth-tabs">
          <button
            className={`tab-button ${activeTab === "login" ? "active" : ""}`}
            onClick={() => setActiveTab("login")}
          >
            Login
          </button>
          <button
            className={`tab-button ${activeTab === "register" ? "active" : ""}`}
            onClick={() => setActiveTab("register")}
          >
            Register
          </button>
        </div>

        {/* Form error message */}
        {formError && <div className="error-message">{formError}</div>}

        {/* Login Form */}
        {activeTab === "login" && (
          <form onSubmit={handleLocalLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === "register" && (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label htmlFor="reg-email">Email</label>
              <input
                type="email"
                id="reg-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                type="password"
                id="reg-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        )}

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="oauth-providers">
          <GoogleLoginButton />
        </div>
        {import.meta.env.VITE_DEV_BYPASS === "true" && (
          <div style={{ marginTop: 12 }}>
            <a href="/dev-login" className="dev-login-link">
              Dev: Simulate Sign In
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
