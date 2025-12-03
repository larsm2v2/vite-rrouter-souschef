import React, { useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { RecipeModel } from "../Models/Models";
import "./Navbar.css";
import "../Sidebar/Sidebar.css";

interface NavbarProps {
  sidebarToggled: boolean;
  setSidebarToggled: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveContent?: React.Dispatch<
    React.SetStateAction<"recipes" | "sousChef">
  >;
  setRecipeToDisplay?: React.Dispatch<React.SetStateAction<RecipeModel | null>>;
  displayName?: string;
}

const Navbar: React.FC<NavbarProps> = ({
  sidebarToggled,
  setSidebarToggled,
  displayName,
}) => {
  // Toggle handler is provided by parent via setSidebarToggled; helper removed to avoid unused function

  const navOpenClose = useCallback(
    (openNav: () => void, closeNav: () => void) => {
      if (sidebarToggled) {
        openNav();
      } else {
        closeNav();
      }
    },
    [sidebarToggled]
  );

  useEffect(() => {
    // Call navOpenClose after sidebarToggled has updated and the component re-renders
    navOpenClose(openNav, closeNav);
    // Add `console.log` here to see the updated state value
  }, [sidebarToggled, navOpenClose]); // This useEffect depends on sidebarToggled

  function openNav() {
    const sidebar = document.getElementById("App-sidebar");
    if (sidebar) {
      // Let CSS handle widths via the `.open` class and media queries.
      const navbar = document.getElementById("App-navbar");
      if (navbar) {
        const navbarHeight = navbar.offsetHeight;
        document.documentElement.style.setProperty(
          "--navbar-height",
          `${navbarHeight}px`
        );
      }
      sidebar.classList.add("open");
    }
  }

  function closeNav() {
    const sidebar = document.getElementById("App-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  }

  return (
    <>
      {sidebarToggled && (
        <div
          className="sidebar-backdrop"
          role="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarToggled(false)}
        />
      )}
      <nav className={"nav"}>
        <ul className="nav-links">
          <li>
            <Link to="/recipes" title="My Recipes" aria-label="My Recipes">
              <span className="nav-full">myRecipes</span>
              <span className="nav-compact">R</span>
            </Link>
          </li>
          <li>
            <Link to="/sous-chef" title="My SousChef" aria-label="My SousChef">
              <span className="nav-full">mySousChef</span>
              <span className="nav-compact">SC</span>
            </Link>
          </li>
          {/* <li>
            <Link
              to="/groceryList"
              title="My Grocery List"
              aria-label="My Grocery List"
            >
              <span className="nav-full">myGroceryList</span>
              <span className="nav-compact">List</span>
            </Link>
          </li> */}
          <li>
            <Link to="/profile" title="My Profile" aria-label="My Profile">
              <span className="nav-compact avatar">
                {(displayName?.charAt(0) || "U").toUpperCase()}
              </span>
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
};

export default Navbar;
