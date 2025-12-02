import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "./Client";
import "./Profile.css";

interface User {
  id: number;
  display_name: string;
  email?: string;
  avatar?: string | null;
}

interface RecipeIndexItem {
  id: number;
  title: string;
  created_at?: string;
}

const Profile: React.FC = () => {
  const { user: authUser, logout: authLogout, updateUser, displayName: contextDisplayName } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<RecipeIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // First, try to use AuthContext user if available
        if (authUser) {
          // console.log("Using AuthContext user:", authUser);
          setUser({
            id: parseInt(authUser.id),
            display_name: authUser.display_name,
            email: authUser.email,
          });
        } else {
          // Fallback to fetching from server
          console.log("Fetching user from /profile endpoint");
          const profileResp = await apiClient.get<{ user?: User }>("/profile");
          if (!mounted) return;
          if (profileResp.data?.user) setUser(profileResp.data.user);
        }

        try {
          const r = await apiClient.get<{ items: RecipeIndexItem[] }>(
            "/api/recipes?owned=true&limit=100"
          );
          if (mounted && Array.isArray(r.data?.items)) setRecipes(r.data.items);
        } catch (err) {
          console.debug("Profile: unable to fetch recipes index:", err);
          if (mounted) setRecipes([]);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [authUser]);

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      authLogout(); // Clear AuthContext
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      authLogout(); // Clear AuthContext even if server call fails
      navigate("/login");
    }
  };

  const displayName = contextDisplayName || "User";
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep the input in sync when the user object changes
  useEffect(() => {
    setNameInput(displayName || "");
  }, [displayName, contextDisplayName]);

  if (loading) return <div className="loading">Loading profile...</div>;

  return (
    <div className="profile-container simple">
      <div className="profile-card">
        <div className="profile-header">
          <div className="avatar large">
            {user?.avatar ? (
              <img src={user.avatar} alt="User avatar" />
            ) : (
              <span className="initial">
                {(displayName?.charAt(0) || "U").toUpperCase()}
              </span>
            )}
          </div>

          <div className="profile-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isEditing ? (
                <>
                  <h1 style={{ margin: 0 }}>{displayName}</h1>
                  <button
                    className="btn"
                    onClick={() => setIsEditing(true)}
                    aria-label="Edit display name"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.9rem" }}
                  >
                    Edit
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    aria-label="Display name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={{ padding: "0.35rem 0.5rem", borderRadius: 6 }}
                    disabled={saving}
                  />
                  <button
                    className="btn"
                    onClick={async () => {
                      setSaving(true);
                      setSaveError(null);
                      try {
                        // Persist to server; backend should accept PUT /profile { display_name }
                        await apiClient.put("/profile", {
                          display_name: nameInput,
                        });
                        // Update local user state and AuthContext so Navbar updates
                        const updatedUser = user ? { ...user, display_name: nameInput } : null;
                        setUser(updatedUser);
                        if (updatedUser && updateUser) updateUser({
                          id: String(updatedUser.id),
                          display_name: updatedUser.display_name,
                          email: updatedUser.email || "",
                        });
                        setIsEditing(false);
                      } catch (err: unknown) {
                        console.error("Failed to save display name:", err);
                        const maybeErr = err as
                          | { message?: unknown }
                          | undefined;
                        const msg =
                          maybeErr && typeof maybeErr.message === "string"
                            ? maybeErr.message
                            : String(err ?? "Save failed");
                        setSaveError(msg);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setIsEditing(false);
                      setNameInput(displayName || "");
                      setSaveError(null);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {user?.email && <p className="email">{user.email}</p>}
            {saveError && (
              <p style={{ color: "#ffb4b4", marginTop: 6 }}>{saveError}</p>
            )}
          </div>

          <div className="profile-actions">
            {/* <button className="btn" onClick={() => navigate("/settings")}>
              Settings
            </button> */}
            <button className="btn danger" onClick={handleLogout}>
              Sign out
            </button>
          </div>
          <div className="profile-actions">
            <button className="btn" onClick={() => navigate("/recipes")}>
              My Recipes
            </button>
            <button className="btn" onClick={() => navigate("/favorites")}>
              Favorites
            </button>
          </div>
        </div>

        <div className="profile-body">
          <div className="recipes-summary">
            <h2>My Recipes</h2>
            <p className="count">Total: {recipes.length}</p>
          </div>

          <div className="recipe-grid">
            {recipes.length === 0 ? (
              <div className="empty">No recipes found.</div>
            ) : (
              recipes.map((r) => (
                <button
                  key={r.id}
                  className="recipe-tile"
                  onClick={() => navigate(`/recipes/${r.id}`)}
                >
                  <div className="title">{r.title}</div>
                  <div className="meta">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString()
                      : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
