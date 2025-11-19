import "./App.css";
import React from "react";
import { Route, Routes } from "react-router-dom";
import Login from "./components/pages/Login";
import Profile from "./components/pages/Profile";
import GoogleCallback from "./components/auth/GoogleCallback";
// Dev bypass component mounted only when VITE_DEV_BYPASS=true
const devBypassEnabled = import.meta.env.VITE_DEV_BYPASS === "true";
let DevLogin: React.LazyExoticComponent<() => React.ReactElement> | null = null;
if (devBypassEnabled) {
  DevLogin = React.lazy(() => import("./components/auth/DevLogin"));
}

import SousChefPage from "./components/pages/SousChefPage";
import RecipesPage from "./components/pages/RecipesPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<GoogleCallback />} />

      {devBypassEnabled && DevLogin && (
        <Route path="/dev-login" element={<DevLogin />} />
      )}

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
      </Route>
    </Routes>
  );
}

export default App;
