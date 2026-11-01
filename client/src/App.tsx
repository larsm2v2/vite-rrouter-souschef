import "./App.css";
import { Route, Routes } from "react-router-dom";
import Login from "./components/pages/Login";
import Profile from "./components/pages/Profile";
import GoogleCallback from "./components/auth/GoogleCallback";

import SousChefPage from "./components/pages/SousChefPage";
import RecipesPage from "./components/pages/RecipesPage";
import RecipeDetailPage from "./components/pages/RecipeDetailPage";
import SharedRecipePreview from "./components/pages/SharedRecipePreview";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import CookMode from "./components/Cook/CookMode";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<GoogleCallback />} />

      {/* Dev login removed */}

      {/* Cook mode is full-screen: no dock, drawers or FAB */}
      <Route
        path="/recipes/:id/cook"
        element={
          <ProtectedRoute>
            <CookMode />
          </ProtectedRoute>
        }
      />

      {/* Protected routes with shared layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/profile" element={<Profile />} />
        <Route path="/sous-chef" element={<SousChefPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route
          path="/recipes/shared/:token"
          element={<SharedRecipePreview />}
        />
      </Route>
    </Routes>
  );
}

export default App;
