import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { RecipeModel } from "../Models/Models";
import apiClient from "./Client";
import "./Profile.css";

interface User {
  id: number;
  display_name: string;
  email?: string;
  avatar?: string | null;
}

const Profile: React.FC = () => {
  const {
    user: authUser,
    logout: authLogout,
    updateUser,
    displayName: contextDisplayName,
  } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"all" | "favorites">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Get setRecipeToDisplay from outlet context if available
  const outletContext = useOutletContext<{
    setRecipeToDisplay?: React.Dispatch<
      React.SetStateAction<RecipeModel | null>
    >;
  }>();
  const setRecipeToDisplay = outletContext?.setRecipeToDisplay;

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
          const r = await apiClient.get<RecipeModel[]>("/api/recipes");
          if (mounted && Array.isArray(r.data)) setRecipes(r.data);
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
                        const updatedUser = user
                          ? { ...user, display_name: nameInput }
                          : null;
                        setUser(updatedUser);
                        if (updatedUser && updateUser)
                          updateUser({
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
        </div>

        <div className="profile-body">
          <div className="recipe-index-header">
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="view-toggle">
              <button
                className={`toggle-btn ${activeView === "all" ? "active" : ""}`}
                onClick={() => setActiveView("all")}
              >
                My Recipes
              </button>
              <button
                className={`toggle-btn ${
                  activeView === "favorites" ? "active" : ""
                }`}
                onClick={() => setActiveView("favorites")}
              >
                Favorites
              </button>
            </div>
          </div>

          <div className="recipe-index">
            <h2 className="index-title">Index</h2>
            {(() => {
              // Filter recipes based on view and search
              const filteredRecipes = recipes.filter((recipe) => {
                const matchesView =
                  activeView === "all" ||
                  (activeView === "favorites" && recipe.is_favorite);
                const matchesSearch =
                  searchQuery === "" ||
                  recipe.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  recipe.cuisine
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  recipe.meal_type
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());
                return matchesView && matchesSearch;
              });

              // Group by meal type
              const mealTypeOrder = [
                "Breakfast",
                "Lunch",
                "Appetizer",
                "Dinner",
                "Dessert",
                "Spice blend",
              ];
              const recipesByMealType = filteredRecipes.reduce(
                (acc, recipe) => {
                  const mealTypeRaw = recipe.meal_type || "Other";
                  const mealType =
                    mealTypeRaw.charAt(0).toUpperCase() + mealTypeRaw.slice(1);
                  if (!acc[mealType]) acc[mealType] = [];
                  acc[mealType].push(recipe);
                  return acc;
                },
                {} as { [key: string]: RecipeModel[] }
              );

              // Sort recipes within each meal type
              Object.keys(recipesByMealType).forEach((mealType) => {
                recipesByMealType[mealType].sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
              });

              // Order meal types
              const preferred = mealTypeOrder.filter(
                (mt) => recipesByMealType[mt]
              );
              const remaining = Object.keys(recipesByMealType)
                .filter((mt) => !preferred.includes(mt))
                .sort();
              const orderedMealTypes = [...preferred, ...remaining];

              if (filteredRecipes.length === 0) {
                return <div className="empty">No recipes found.</div>;
              }

              return orderedMealTypes.map((mealType) => (
                <div key={mealType} className="meal-type-section">
                  <h3 className="meal-type-heading">{mealType}</h3>
                  <ul className="recipe-links">
                    {recipesByMealType[mealType].map((recipe) => (
                      <li key={recipe.id}>
                        <button
                          className="recipe-link"
                          onClick={() => {
                            // Set the recipe to display in the context
                            if (setRecipeToDisplay) {
                              setRecipeToDisplay(recipe);
                            }
                            // Navigate to recipes page
                            navigate("/recipes");
                          }}
                        >
                          {recipe.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
