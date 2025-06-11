import { Fragment, useState, useEffect } from "react";
import { RecipeModel } from "../Models/Models"; // Adjust the path as needed
import { Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import Sidebar from "../Sidebar/Sidebar";

const MainLayout = () => {
  const [sidebarToggled, setSidebarToggled] = useState(false);
  const [activeContent, setActiveContent] = useState<"recipes" | "sousChef">(
    "sousChef"
  );
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [recipeToDisplay, setRecipeToDisplay] = useState<RecipeModel | null>(
    null
  );

  // Load selected recipes from local storage
  useEffect(() => {
    const storedSelectedRecipeIds = localStorage.getItem("selectedRecipeIds");
    if (storedSelectedRecipeIds) {
      setSelectedRecipeIds(JSON.parse(storedSelectedRecipeIds));
    }
  }, []);

  // Save selected recipes to local storage
  useEffect(() => {
    localStorage.setItem(
      "selectedRecipeIds",
      JSON.stringify(selectedRecipeIds)
    );
  }, [selectedRecipeIds]);

  // Navbar fixed top functionality
  const navbarFixedTop = () => {
    const navbar = document.getElementById("App-navbar");
    if (navbar) {
      const sticky = navbar.offsetTop;
      if (window.scrollY >= sticky) {
        navbar.classList.add("sticky");
      } else {
        navbar.classList.remove("sticky");
      }
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", navbarFixedTop);
    return () => window.removeEventListener("scroll", navbarFixedTop);
  }, []);

  return (
    <Fragment>
      <nav className="nav-items" id="App-navbar">
        <Navbar
          sidebarToggled={sidebarToggled}
          setSidebarToggled={setSidebarToggled}
          setActiveContent={setActiveContent}
          setRecipeToDisplay={setRecipeToDisplay}
        />
      </nav>
      <div className="App_with_sidebar">
        <div className="sidebar-items" id="App-sidebar">
          <Sidebar selectedRecipeIds={selectedRecipeIds} />
        </div>
        <div className="App" id="App-main">
          <Outlet
            context={{
              selectedRecipeIds,
              setSelectedRecipeIds,
              activeContent,
              setActiveContent,
              recipeToDisplay,
              setRecipeToDisplay,
            }}
          />
        </div>
      </div>
    </Fragment>
  );
};

export default MainLayout;
