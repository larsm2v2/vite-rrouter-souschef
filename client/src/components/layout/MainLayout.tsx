import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import FocusTrap from "focus-trap-react";
import { RecipeModel } from "../../types"; // Adjust the path as needed
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import Sidebar from "../Sidebar/Sidebar";
import RecipeIndexSidebar from "../Recipes/Recipe Details/RecipeIndexSidebar";
import FloatingActionButton from "../common/FloatingActionButton";
import OCRModal from "../common/OCRModal";
import { useAuth } from "../../contexts/AuthContext";
import { COPY_GROCERY_EVENT } from "../GroceryList/groceryEvents";
import "./MainLayout.css";

const MOBILE_QUERY = "(max-width: 900px)";

function subscribeToViewport(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

const SWIPE_CLOSE_DISTANCE = 60;

/** Touch handlers that close a drawer when it is swiped toward its own edge. */
function swipeToClose(direction: "left" | "right", onClose: () => void) {
  let start: { x: number; y: number } | null = null;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      const towardEdge = direction === "left" ? -dx : dx;
      if (towardEdge > SWIPE_CLOSE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        onClose();
      }
    },
  };
}

const MainLayout = () => {
  const [sidebarToggled, setSidebarToggled] = useState(false);
  const [indexSidebarToggled, setIndexSidebarToggled] = useState(false);
  const [activeContent, setActiveContent] = useState<"recipes" | "sousChef">(
    "sousChef",
  );
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(() => {
    try {
      const storedSelectedRecipeIds = localStorage.getItem("selectedRecipeIds");
      const parsedIds: unknown = storedSelectedRecipeIds
        ? JSON.parse(storedSelectedRecipeIds)
        : [];
      return Array.isArray(parsedIds)
        ? parsedIds.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [recipeToDisplay, setRecipeToDisplay] = useState<RecipeModel | null>(
    null,
  );
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOcrModal, setShowOcrModal] = useState(false);
  const { user, displayName } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

  const openOcr = () => setShowOcrModal(true);
  const closeOcr = () => setShowOcrModal(false);

  // Save selected recipes to local storage
  useEffect(() => {
    localStorage.setItem(
      "selectedRecipeIds",
      JSON.stringify(selectedRecipeIds),
    );
  }, [selectedRecipeIds]);

  const indexAvailable = Boolean(recipeToDisplay);
  const groceryOpen = sidebarToggled;
  const indexOpen = indexSidebarToggled && indexAvailable;
  const anyDrawerOpen = groceryOpen || indexOpen;
  const overlayOpen = anyDrawerOpen && isMobile;

  const closeDrawers = useCallback(() => {
    setSidebarToggled(false);
    setIndexSidebarToggled(false);
  }, []);

  // On small screens only one drawer may be open at a time.
  const toggleGrocery = (next: boolean) => {
    setSidebarToggled(next);
    if (next && isMobile) setIndexSidebarToggled(false);
  };
  const toggleIndex = (next: boolean) => {
    setIndexSidebarToggled(next);
    if (next && isMobile) setSidebarToggled(false);
  };

  const requestKeepCopy = () => {
    window.dispatchEvent(new Event(COPY_GROCERY_EVENT));
  };

  // Navigating (e.g. picking a recipe from the index) dismisses mobile drawers.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    if (isMobile) closeDrawers();
  }, [location.pathname, isMobile, closeDrawers]);

  // The index drawer has nothing to show once no recipe is displayed.
  useEffect(() => {
    if (!indexAvailable) setIndexSidebarToggled(false);
  }, [indexAvailable]);

  // Escape closes whichever drawer is open (unless the OCR modal is on top).
  useEffect(() => {
    if (!anyDrawerOpen || showOcrModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawers();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anyDrawerOpen, showOcrModal, closeDrawers]);

  // Lock page scroll and restore focus while a modal drawer is open.
  const prevFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!overlayOpen) return;
    prevFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      prevFocused.current?.focus?.();
    };
  }, [overlayOpen]);

  return (
    <Fragment>
      <div className="app-root">
        <header className="app-header" id="App-navbar">
          <Navbar
            setActiveContent={setActiveContent}
            setRecipeToDisplay={setRecipeToDisplay}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            displayName={displayName || undefined}
            onCopyToKeep={requestKeepCopy}
          />
        </header>

        {anyDrawerOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={closeDrawers}
          />
        )}

        <div className={`app-body ${sidebarToggled ? "sidebar-open" : ""}`}>
          <button
            className={`sidebar-toggle-tab left-toggle ${
              sidebarToggled ? "open" : ""
            }`}
            data-action="toggle-grocery"
            onClick={() => toggleGrocery(!sidebarToggled)}
            aria-expanded={sidebarToggled}
            aria-controls="App-sidebar"
            aria-label={
              sidebarToggled ? "Close grocery list" : "Open grocery list"
            }
          >
            <span className="toggle-full">Grocery List</span>
            <span className="toggle-compact">G</span>
          </button>
          <FocusTrap
            active={overlayOpen && groceryOpen}
            focusTrapOptions={{
              initialFocus: "#grocery-drawer-close",
              fallbackFocus: "#App-sidebar",
              escapeDeactivates: false,
              // The scrim and toggle controls have their own click
              // handlers; the trap must let those clicks through.
              clickOutsideDeactivates: false,
              allowOutsideClick: () => true,
              returnFocusOnDeactivate: false,
            }}
          >
            <aside
              className="app-sidebar"
              id="App-sidebar"
              aria-label="Grocery list"
              tabIndex={-1}
              inert={!groceryOpen}
              {...swipeToClose("left", () => toggleGrocery(false))}
            >
              <div className="drawer-header">
                <span className="drawer-title">Grocery list</span>
                <button
                  type="button"
                  id="grocery-drawer-close"
                  className="drawer-close"
                  aria-label="Close panel"
                  onClick={() => toggleGrocery(false)}
                >
                  ✕
                </button>
              </div>
              <Sidebar selectedRecipeIds={selectedRecipeIds} />
            </aside>
          </FocusTrap>

          <main className="app-main" id="App-main" inert={overlayOpen}>
            <Outlet
              context={{
                selectedRecipeIds,
                setSelectedRecipeIds,
                activeContent,
                setActiveContent,
                recipeToDisplay,
                setRecipeToDisplay,
                recipes,
                setRecipes,
                searchQuery,
                setSearchQuery,
              }}
            />
          </main>

          {recipeToDisplay && (
            <>
              <button
                className={`sidebar-toggle-tab right-toggle ${
                  indexSidebarToggled ? "open" : ""
                }`}
                data-action="toggle-index"
                onClick={() => toggleIndex(!indexSidebarToggled)}
                aria-expanded={indexSidebarToggled}
                aria-controls="recipe-index-sidebar"
                aria-label={
                  indexSidebarToggled
                    ? "Close recipe index"
                    : "Open recipe index"
                }
              >
                <span className="toggle-full">Recipe Index</span>
                <span className="toggle-compact">I</span>
              </button>
              <FocusTrap
                active={overlayOpen && indexOpen}
                focusTrapOptions={{
                  initialFocus: "#index-drawer-close",
                  fallbackFocus: "#recipe-index-sidebar",
                  escapeDeactivates: false,
                  clickOutsideDeactivates: false,
                  allowOutsideClick: () => true,
                  returnFocusOnDeactivate: false,
                }}
              >
                <aside
                  className={`recipe-index-sidebar ${
                    indexSidebarToggled ? "open" : ""
                  }`}
                  id="recipe-index-sidebar"
                  aria-label="Recipe index"
                  tabIndex={-1}
                  inert={!indexSidebarToggled}
                  {...swipeToClose("right", () => toggleIndex(false))}
                >
                  <div className="drawer-header">
                    <span className="drawer-title">Recipe index</span>
                    <button
                      type="button"
                      id="index-drawer-close"
                      className="drawer-close"
                      aria-label="Close panel"
                      onClick={() => toggleIndex(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <RecipeIndexSidebar
                    recipe={recipeToDisplay}
                    recipesIndex={recipes}
                    onNavigate={() => {
                      if (isMobile) toggleIndex(false);
                    }}
                  />
                </aside>
              </FocusTrap>
            </>
          )}
        </div>

        <nav className="mobile-dock" aria-label="Quick actions">
          <button
            type="button"
            className="dock-btn"
            data-action="toggle-grocery"
            aria-expanded={sidebarToggled}
            aria-controls="App-sidebar"
            onClick={() => toggleGrocery(!sidebarToggled)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6" />
              <circle cx="10" cy="20" r="1.3" />
              <circle cx="17" cy="20" r="1.3" />
            </svg>
            <span>Grocery list</span>
          </button>
          <button
            type="button"
            className="dock-btn dock-keep"
            onClick={requestKeepCopy}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </svg>
            <span>Copy to Google Keep</span>
          </button>
          {recipeToDisplay && (
            <button
              type="button"
              className="dock-btn"
              data-action="toggle-index"
              aria-expanded={indexSidebarToggled}
              aria-controls="recipe-index-sidebar"
              onClick={() => toggleIndex(!indexSidebarToggled)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              <span>Recipe index</span>
            </button>
          )}
        </nav>

        {/* Floating action and OCR modal mounted at layout level */}
        {user && <FloatingActionButton onOpen={openOcr} />}
        <OCRModal isOpen={showOcrModal} onClose={closeOcr} />
      </div>
    </Fragment>
  );
};

export default MainLayout;
