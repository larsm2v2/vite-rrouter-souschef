import { Fragment, useState, useEffect, useRef } from "react";
import FocusTrap from "focus-trap-react";
import { RecipeModel } from "../Models/Models"; // Adjust the path as needed
import { Outlet } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import Sidebar from "../Sidebar/Sidebar";
import FloatingActionButton from "../common/FloatingActionButton";
import OCRModal from "../common/OCRModal";
import { useAuth } from "../../contexts/AuthContext";
import "./MainLayout.css";

const MainLayout = () => {
  const [sidebarToggled, setSidebarToggled] = useState(false);
  const [activeContent, setActiveContent] = useState<"recipes" | "sousChef">(
    "sousChef"
  );
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [recipeToDisplay, setRecipeToDisplay] = useState<RecipeModel | null>(
    null
  );
  const [showOcrModal, setShowOcrModal] = useState(false);
  const { user } = useAuth() || { user: null };

  const openOcr = () => setShowOcrModal(true);
  const closeOcr = () => setShowOcrModal(false);

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

  // Mobile detection for overlay behavior
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const prevFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const overlayOpen = sidebarToggled && isMobile;

  // Manage body scroll, aria-hidden, and remember previous focus when overlay opens.
  useEffect(() => {
    const sidebar = document.getElementById("App-sidebar");
    const main = document.getElementById("App-main");

    if (overlayOpen) {
      prevFocused.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      if (main) main.setAttribute("aria-hidden", "true");
    } else {
      document.body.style.overflow = "";
      if (main) main.removeAttribute("aria-hidden");
      if (prevFocused.current) {
        try {
          prevFocused.current.focus();
        } catch {
          console.warn("Failed to restore focus to previous element.");
        }
      }
      try {
        if (sidebar) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          sidebar.style.width = "";
          if (sidebar.hasAttribute("tabindex"))
            sidebar.removeAttribute("tabindex");
        }
      } catch {
        // ignore
      }
    }
  }, [overlayOpen]);

  return (
    <Fragment>
      <div className="app-root">
        <header className="app-header" id="App-navbar">
          <Navbar
            sidebarToggled={sidebarToggled}
            setSidebarToggled={setSidebarToggled}
            setActiveContent={setActiveContent}
            setRecipeToDisplay={setRecipeToDisplay}
          />
        </header>

        <div className={`app-body ${sidebarToggled ? "sidebar-open" : ""}`}>
          <FocusTrap
            active={overlayOpen}
            focusTrapOptions={{
              initialFocus: "#App-sidebar",
              onDeactivate: () => setSidebarToggled(false),
              clickOutsideDeactivates: true,
            }}
          >
            <aside className={`app-sidebar`} id="App-sidebar">
              <Sidebar selectedRecipeIds={selectedRecipeIds} />
            </aside>
          </FocusTrap>

          <main className="app-main" id="App-main" aria-hidden={overlayOpen}>
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
          </main>
        </div>

        {/* Floating action and OCR modal mounted at layout level */}
        {user && <FloatingActionButton onOpen={openOcr} />}
        <OCRModal isOpen={showOcrModal} onClose={closeOcr} />
      </div>
    </Fragment>
  );
};

export default MainLayout;
