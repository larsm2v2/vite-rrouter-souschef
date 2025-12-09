import React, { useState, useEffect } from "react";
import { RecipeModel } from "../../../types";
import { useNavigate } from "react-router-dom";
import "./RecipeIndexSidebar.css";

interface RecipeIndexSidebarProps {
	recipe: RecipeModel;
	recipesIndex?: RecipeModel[];
}

const RecipeIndexSidebar: React.FC<RecipeIndexSidebarProps> = ({
	recipe,
	recipesIndex = [],
}) => {
	const navigate = useNavigate();
	const [activeSection, setActiveSection] = useState<string>("ingredients");

	// Track which section is in viewport
	useEffect(() => {
		// Read configured header height so the observer accounts for the sticky navbar
		const headerRaw = getComputedStyle(document.documentElement).getPropertyValue(
			"--header-height"
		);
		const headerPx = headerRaw ? parseInt(headerRaw.trim().replace("px", ""), 10) : 80;
		const observerOptions = {
			root: null,
			// offset the top by the header height so the 'active' section matches visible content
			rootMargin: `-${headerPx + 12}px 0px -66%`,
			threshold: 0,
		};

		const observerCallback: IntersectionObserverCallback = (entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					setActiveSection(entry.target.id);
				}
			});
		};

		const observer = new IntersectionObserver(
			observerCallback,
			observerOptions
		);

		// Observe all major sections
		const sections = ["ingredients", "instructions", "notes"];
		sections.forEach((sectionId) => {
			const element = document.getElementById(sectionId);
			if (element) {
				observer.observe(element);
			}
		});

		return () => {
			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				if (element) {
					observer.unobserve(element);
				}
			});
		};
	}, [recipe]);

	// Group recipes by meal type
	const recipesByMealType = recipesIndex.reduce((acc, r) => {
		if (r.id === recipe.id) return acc; // Exclude current recipe
		const mealType = r.meal_type || "Other";
		if (!acc[mealType]) {
			acc[mealType] = [];
		}
		acc[mealType].push(r);
		return acc;
	}, {} as Record<string, RecipeModel[]>);

	const handleRecipeClick = (recipeId: string) => {
		navigate(`/recipes/${recipeId}`);
	};

	const handleNavClick = (
		e: React.MouseEvent<HTMLAnchorElement>,
		sectionId: string
	) => {
		e.preventDefault();
		const element = document.getElementById(sectionId);
		if (element) {
			// prefer native scroll-margin-top set on the section for correct offset
			element.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	return (
		<div className="recipe-index-inner">
			{/* In-page navigation */}
			<nav className="in-page-nav" aria-label="Recipe sections">
				<h3>On This Page</h3>
				<ul>
					<li>
						<a
							href="#ingredients"
							onClick={(e) => handleNavClick(e, "ingredients")}
							className={
								activeSection === "ingredients" ? "active" : ""
							}
						>
							Ingredients
						</a>
					</li>
					<li>
						<a
							href="#instructions"
							onClick={(e) => handleNavClick(e, "instructions")}
							className={
								activeSection === "instructions" ? "active" : ""
							}
						>
							Instructions
						</a>
					</li>
					{recipe.notes && recipe.notes.length > 0 && (
						<li>
							<a
								href="#notes"
								onClick={(e) => handleNavClick(e, "notes")}
								className={
									activeSection === "notes" ? "active" : ""
								}
							>
								Notes
							</a>
						</li>
					)}
				</ul>
			</nav>

			{/* Recipe index */}
			{recipesIndex.length > 1 && (
				<nav className="recipe-index" aria-label="Other recipes">
					<h3>Other Recipes</h3>
					{Object.entries(recipesByMealType).map(
						([mealType, recipes]) => (
							<div key={mealType} className="recipe-group">
								<h4>{mealType}</h4>
								<ul>
									{recipes.map((r) => (
										<li key={r.id}>
											<button
												onClick={() =>
													handleRecipeClick(r.id)
												}
												className="recipe-link"
											>
												{r.name}
											</button>
										</li>
									))}
								</ul>
							</div>
						)
					)}
				</nav>
			)}
		</div>
	);
};

export default RecipeIndexSidebar;
