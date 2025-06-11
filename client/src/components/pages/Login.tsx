import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "./Client";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const API_URL =
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://localhost:8000" : window.location.origin);

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
    // Don't create a new controller on every render
    const controller = new AbortController();
    let isActive = true; // Flag to track if effect is still active

    const checkAuth = async () => {
      if (!isActive) return; // Don't proceed if no longer active

      try {
        setLoading(true);
        setError(null); // Clear previous errors

        const { data } = await apiClient.get("/auth/check", {
          signal: controller.signal,
          withCredentials: true,
          // Add a shorter timeout just for the auth check
          timeout: 5000,
        });

        // Only update state if component is still mounted
        if (isActive) {
          if (data.authenticated) {
            navigate("/profile", { replace: true });
          }
          setLoading(false);
          setAuthChecked(true);
        }
      } catch (error: any) {
        // Only update state if component is still mounted and error isn't from cancellation
        if (
          isActive &&
          error.name !== "CanceledError" &&
          error.code !== "ERR_CANCELED"
        ) {
          console.error("Auth check failed:", error);

          // Handle connection errors specially
          if (error.isConnectionError) {
            setError(
              "Cannot connect to server. Please ensure the server is running at http://localhost:8000"
            );
          } else {
            // Handle other errors
            setError(
              "Failed to check authentication status. Please try again later."
            );
          }
          setLoading(false);
          setAuthChecked(true);
        }
      }
    };

    // Only check auth if not already checked
    if (!authChecked) {
      checkAuth();
    }

    // Cleanup function
    return () => {
      isActive = false; // Mark effect as inactive
      controller.abort(); // Abort any in-flight requests
    };
  }, [navigate, authChecked]);

  const handleGoogleLogin = () => {
    setLoading(true);
    // The redirect will happen via the href
  };

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
        navigate("/profile");
      }
    } catch (error: any) {
      console.error("Login failed:", error);

      // More detailed error reporting
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
        setFormError(
          error.response.data.message ||
            "Login failed. Please check your credentials."
        );
      } else if (error.request) {
        console.error("No response received:", error.request);
        setFormError("No response from server. Please try again later.");
      } else {
        console.error("Error during request setup:", error.message);
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
        // No need to login separately - server already logs us in
        navigate("/profile");
      }
    } catch (error: any) {
      console.error("Registration failed:", error);

      // More detailed error reporting
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
        setFormError(
          error.response.data.message ||
            "Registration failed. Please try again."
        );
      } else if (error.request) {
        console.error("No response received:", error.request);
        setFormError("No response from server. Please try again later.");
      } else {
        console.error("Error during request setup:", error.message);
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
          <h1>LightsOut</h1>
        </div>

        <div className="header">
          <h2>Welcome back</h2>
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
          <a
            href={`${API_URL}/auth/google`}
            className="provider-button google"
            onClick={handleGoogleLogin}
            aria-disabled={loading}
          >
            <svg className="provider-icon" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading ? "Please wait..." : "Continue with Google"}
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
