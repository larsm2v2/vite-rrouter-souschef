import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { RecipeModel } from "../../types";
import { rankRecipes } from "./plannerTypes";

function PaletteItem({ recipe }: { recipe: RecipeModel }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe:${recipe.id}`,
    data: { type: "recipe", recipeId: Number(recipe.id), name: recipe.name },
  });
  return (
    <li
      ref={setNodeRef}
      className={`planner-recipe ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="planner-recipe-name">{recipe.name}</span>
      {recipe.is_favorite && (
        <span className="planner-badge" title="Favorite">
          ★
        </span>
      )}
      {(recipe.cook_count ?? 0) > 0 && (
        <span
          className="planner-badge muted"
          title={`Cooked ${recipe.cook_count} times`}
        >
          ×{recipe.cook_count}
        </span>
      )}
    </li>
  );
}

export default function RecipePalette({ recipes }: { recipes: RecipeModel[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ranked = rankRecipes(recipes);
    return needle
      ? ranked.filter(
          (recipe) =>
            recipe.name.toLowerCase().includes(needle) ||
            (recipe.cuisine ?? "").toLowerCase().includes(needle),
        )
      : ranked;
  }, [recipes, query]);

  return (
    <aside className="planner-palette" aria-label="Your recipes">
      <h2>Recipes</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search recipes…"
        aria-label="Search recipes"
      />
      <p className="planner-hint">
        Drag a recipe onto a day, or use the + on a slot.
      </p>
      {visible.length === 0 ? (
        <p className="planner-empty">No recipes found.</p>
      ) : (
        <ul className="planner-recipe-list">
          {visible.map((recipe) => (
            <PaletteItem key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      )}
    </aside>
  );
}
