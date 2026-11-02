import { useEffect, useState } from "react";
import type { RecipeModel } from "../../types";
import apiClient from "../pages/Client";
import { useToast } from "./Toast";
import ToastSafeFocusTrap from "./ToastSafeFocusTrap";
import ParsedRecipeEditor, { type ParsedRecipe } from "./ParsedRecipeEditor";
import "./OCRModal.css";

interface Props {
  recipe: RecipeModel;
  onClose: () => void;
  onSaved: (recipe: ParsedRecipe) => void;
}

function toDraft(recipe: RecipeModel): ParsedRecipe {
  const servings = Number(recipe.serving_info?.servings ?? 0);
  return {
    name: recipe.name,
    cuisine: recipe.cuisine,
    mealType: recipe.meal_type,
    dietaryRestrictions: recipe.dietary_restrictions ?? [],
    servingInfo: {
      prepTime: recipe.serving_info?.prep_time ?? "",
      cookTime: recipe.serving_info?.cook_time ?? "",
      totalTime: recipe.serving_info?.total_time ?? "",
      servings: Number.isFinite(servings) ? servings : 0,
    },
    ingredients: (recipe.ingredients ?? {}) as ParsedRecipe["ingredients"],
    instructions: (recipe.instructions ?? []).map((step, index) => ({
      number: index + 1,
      text: step.text,
    })),
    notes: recipe.notes ?? [],
  };
}

export default function RecipeEditModal({ recipe, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [modalEl, setModalEl] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(() => toDraft(recipe));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const save = async () => {
    if (!draft.name?.trim()) {
      showToast("Recipe name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/api/recipes/${encodeURIComponent(recipe.id)}`, {
        name: draft.name.trim(),
        cuisine: draft.cuisine ?? "",
        mealType: draft.mealType ?? "",
        dietaryRestrictions: draft.dietaryRestrictions ?? [],
        servingInfo: draft.servingInfo ?? {},
        ingredients: draft.ingredients,
        instructions: draft.instructions,
        notes: draft.notes,
      });
      onSaved(draft);
      showToast("Recipe updated", "success");
      onClose();
    } catch (error) {
      const message =
        (
          error as {
            response?: { data?: { error?: string } };
            message?: string;
          }
        )?.response?.data?.error ?? (error as Error)?.message;
      showToast(message || "Could not update recipe", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="ocr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-edit-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose();
      }}
    >
      <ToastSafeFocusTrap
        active
        container={modalEl}
        focusTrapOptions={{
          initialFocus: "#parsed-recipe-name",
          fallbackFocus: ".ocr-modal",
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          allowOutsideClick: true,
        }}
      />
      <div
        ref={setModalEl}
        className="ocr-modal ocr-modal--review"
        tabIndex={-1}
      >
        <header className="ocr-modal-header">
          <h2 className="ocr-modal-title" id="recipe-edit-title">
            Edit recipe
          </h2>
          <button
            type="button"
            className="ocr-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit recipe"
          >
            ✕
          </button>
        </header>
        <div className="ocr-modal-body recipe-edit-body">
          <ParsedRecipeEditor recipe={draft} onChange={setDraft} />
        </div>
        <div className="ocr-preview-actions">
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
