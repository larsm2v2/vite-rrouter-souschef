import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Dev-only helper to simulate an authenticated user locally.
 * Enable by setting VITE_DEV_BYPASS=true in your local environment.
 */
export default function DevLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDevLogin = () => {
    const fakeUser = {
      id: "dev-user",
      email: "dev@example.com",
      display_name: "Developer",
    };
    const fakeToken = "dev-token-local";

    // Populate AuthContext and localStorage like a real login
    try {
      login(fakeToken, fakeUser);
    } catch (e) {
      console.warn(`DevLogin: AuthContext login failed: ${e}`);
      // Fallback: directly write to localStorage
      localStorage.setItem("accessToken", fakeToken);
      localStorage.setItem("user", JSON.stringify(fakeUser));
    }

    navigate("/profile", { replace: true });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Development Login</h2>
      <p>
        This page simulates a successful sign-in for local development. It
        should never be enabled in production.
      </p>
      <button onClick={handleDevLogin}>Simulate Sign In (Dev)</button>
    </div>
  );
}
