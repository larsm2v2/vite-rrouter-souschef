import React from "react";

export interface ParsedIngredient {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface ParsedRecipe {
  name?: string;
  cuisine?: string;
  ingredients: { [key: string]: (string | ParsedIngredient)[] };
  instructions: { number: number; text: string }[];
  notes: string[];
  servingInfo?: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: number;
  };
  mealType?: string;
  images?: { imageUrl: string; isPrimary: boolean }[];
}

interface ParsedRecipeEditorProps {
  recipe: ParsedRecipe;
  onChange: (recipe: ParsedRecipe) => void;
}

const ParsedRecipeEditor: React.FC<ParsedRecipeEditorProps> = ({
  recipe,
  onChange,
}) => {
  const updateIngredient = (group: string, index: number, value: string) => {
    const ingredients = [...recipe.ingredients[group]];
    ingredients[index] = value;
    onChange({
      ...recipe,
      ingredients: { ...recipe.ingredients, [group]: ingredients },
    });
  };

  const removeIngredient = (group: string, index: number) => {
    onChange({
      ...recipe,
      ingredients: {
        ...recipe.ingredients,
        [group]: recipe.ingredients[group].filter(
          (_, itemIndex) => itemIndex !== index,
        ),
      },
    });
  };

  const updateInstruction = (index: number, text: string) => {
    onChange({
      ...recipe,
      instructions: recipe.instructions.map((instruction, itemIndex) =>
        itemIndex === index ? { ...instruction, text } : instruction,
      ),
    });
  };

  const removeInstruction = (index: number) => {
    onChange({
      ...recipe,
      instructions: recipe.instructions
        .filter((_, itemIndex) => itemIndex !== index)
        .map((instruction, itemIndex) => ({
          ...instruction,
          number: itemIndex + 1,
        })),
    });
  };

  return (
    <div className="preview-pretty">
      <div className="preview-field">
        <label className="preview-label" htmlFor="parsed-recipe-name">
          Name
        </label>
        <input
          id="parsed-recipe-name"
          className="preview-input"
          value={recipe.name ?? ""}
          onChange={(event) =>
            onChange({ ...recipe, name: event.target.value })
          }
          placeholder="Recipe name"
        />
      </div>

      <div className="preview-field">
        <label className="preview-label" htmlFor="parsed-recipe-cuisine">
          Cuisine
        </label>
        <input
          id="parsed-recipe-cuisine"
          className="preview-input"
          value={recipe.cuisine ?? ""}
          onChange={(event) =>
            onChange({ ...recipe, cuisine: event.target.value })
          }
          placeholder="Cuisine"
        />
      </div>

      <div className="preview-section">
        <strong>Ingredients</strong>
        {Object.keys(recipe.ingredients).length === 0 && (
          <div className="preview-empty">No ingredients parsed.</div>
        )}
        {Object.entries(recipe.ingredients).map(([group, items]) => (
          <div key={group} className="ingredient-group">
            {group !== "default" && (
              <div className="ingredient-group-name">{group}</div>
            )}
            <ul className="ingredient-list">
              {items.map((item, index) => {
                const displayText =
                  typeof item === "string"
                    ? item
                    : `${item.quantity || ""} ${item.unit || ""} ${item.name}`.trim();
                return (
                  <li key={`${group}-${index}`} className="ingredient-item">
                    <input
                      className="preview-input"
                      aria-label={`${group} ingredient ${index + 1}`}
                      value={displayText}
                      onChange={(event) =>
                        updateIngredient(group, index, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="tiny-btn"
                      onClick={() => removeIngredient(group, index)}
                      aria-label={`Remove ingredient ${index + 1} from ${group}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="add-btn"
              onClick={() =>
                onChange({
                  ...recipe,
                  ingredients: {
                    ...recipe.ingredients,
                    [group]: [...items, ""],
                  },
                })
              }
            >
              Add ingredient
            </button>
          </div>
        ))}
      </div>

      <div className="preview-section">
        <strong>Instructions</strong>
        {recipe.instructions.length === 0 && (
          <div className="preview-empty">No instructions parsed.</div>
        )}
        <ol className="instruction-list">
          {recipe.instructions.map((instruction, index) => (
            <li key={index} className="instruction-item">
              <textarea
                className="instruction-textarea"
                aria-label={`Instruction ${index + 1}`}
                value={instruction.text}
                onChange={(event) =>
                  updateInstruction(index, event.target.value)
                }
              />
              <button
                type="button"
                className="tiny-btn"
                onClick={() => removeInstruction(index)}
                aria-label={`Remove instruction step ${index + 1}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="add-btn"
          onClick={() =>
            onChange({
              ...recipe,
              instructions: [
                ...recipe.instructions,
                { number: recipe.instructions.length + 1, text: "" },
              ],
            })
          }
        >
          Add instruction
        </button>
      </div>

      <div className="preview-section">
        <strong>Notes</strong>
        {recipe.notes.map((note, index) => (
          <div className="preview-field" key={index}>
            <input
              className="preview-input"
              aria-label={`Note ${index + 1}`}
              value={note}
              onChange={(event) => {
                const notes = [...recipe.notes];
                notes[index] = event.target.value;
                onChange({ ...recipe, notes });
              }}
            />
            <button
              type="button"
              className="tiny-btn"
              aria-label={`Remove note ${index + 1}`}
              onClick={() =>
                onChange({
                  ...recipe,
                  notes: recipe.notes.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-btn"
          onClick={() => onChange({ ...recipe, notes: [...recipe.notes, ""] })}
        >
          Add note
        </button>
      </div>
    </div>
  );
};

export default ParsedRecipeEditor;
