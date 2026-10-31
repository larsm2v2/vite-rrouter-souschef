import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { RecipeModel } from "../../types";
import "./Navbar.css";

interface NavbarProps {
	sidebarToggled: boolean;
	setSidebarToggled: React.Dispatch<React.SetStateAction<boolean>>;
	setRecipeToDisplay?: React.Dispatch<
		React.SetStateAction<RecipeModel | null>
	>;
	searchQuery?: string;
	setSearchQuery?: React.Dispatch<React.SetStateAction<string>>;
	setActiveContent?: React.Dispatch<
		React.SetStateAction<"recipes" | "sousChef">
	>;
	displayName?: string;
}

const Navbar: React.FC<NavbarProps> = ({
	sidebarToggled,
	setSidebarToggled,
	displayName,
	searchQuery: searchQueryProp,
	setActiveContent,
	setSearchQuery,
}) => {
	// Toggle handler is provided by parent via setSidebarToggled; helper removed to avoid unused function

	const navigate = useNavigate();
	const [localQuery, setLocalQuery] = useState<string>(searchQueryProp ?? "");
	const [mobileOpen, setMobileOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);

	// keep localQuery in sync with prop
	useEffect(() => setLocalQuery(searchQueryProp ?? ""), [searchQueryProp]);

	const doSearch = (q: string) => {
		if (setSearchQuery) setSearchQuery(q);
		if (setActiveContent) setActiveContent("recipes");
		// ensure we navigate to the canonical recipes page
		navigate("/recipes");
	};

	const handleSubmit = (e?: React.FormEvent) => {
		e?.preventDefault();
		doSearch(localQuery.trim());
	};

	return (
		<>
			{sidebarToggled && (
				<button
					type="button"
					className="sidebar-backdrop"
					aria-label="Close sidebar"
					onClick={() => setSidebarToggled(false)}
				/>
			)}
			<nav className={"nav"}>
				{/* Search form: desktop visible, mobile condensed to icon */}
				<form
					className={`nav-search ${mobileOpen ? "open" : ""}`}
					onSubmit={handleSubmit}
					role="search"
				>
					<input
						ref={inputRef}
						className="nav-search-input"
						value={localQuery}
						onChange={(e) => setLocalQuery(e.target.value)}
						placeholder="Search recipes..."
						aria-label="Search recipes"
					/>
					<button className="nav-search-btn" aria-label="Search">
						🔍
					</button>
				</form>
				{/* Mobile icon that toggles search input */}
				<button
					className={`nav-search-icon ${mobileOpen ? "open" : ""}`}
					onClick={() => {
						setMobileOpen((s) => !s);
						setTimeout(() => {
							if (inputRef.current) inputRef.current.focus();
						}, 60);
					}}
					aria-label="Open search"
				>
					🔍
				</button>
				<ul className="nav-links">
					<li>
						<Link
							to="/recipes"
							title="My Recipes"
							aria-label="My Recipes"
						>
							<span className="nav-full">myRecipes</span>
							<span className="nav-compact">R</span>
						</Link>
					</li>
					<li>
						<Link
							to="/sous-chef"
							title="My SousChef"
							aria-label="My SousChef"
						>
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
						<Link
							to="/profile"
							title="My Profile"
							aria-label="My Profile"
						>
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
