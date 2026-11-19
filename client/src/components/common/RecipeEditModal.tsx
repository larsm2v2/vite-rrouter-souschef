import { useEffect, useState } from "react";
import type { RecipeModel } from "../../types";
import apiClient from "../pages/Client";
import { useToast } from "./Toast";
import ToastSafeFocusTrap from "./ToastSafeFocusTrap";
import ParsedRecipeEditor, { type ParsedRecipe } from "./ParsedRecipeEditor";
import { useUndoable } from "../../hooks/useUndoable";
import {
  DEFAULT_SECTIONS,
  applySections,
  availableSections,
  type ImportSection,
} from "../../utils/recipeImportApply";
import "./OCRModal.css";

const SECTION_LABELS: Record<ImportSection, string> = {
  details: "Name, cuisine, meal type and times",
  ingredients: "Ingredients",
  instructions: "Instructions",
  notes: "Notes",
};

function countFor(section: ImportSection, recipe: ParsedRecipe): string {
  switch (section) {
    case "ingredients": {
      const total = Object.values(recipe.ingredients ?? {}).reduce(
        (sum, items) => sum + items.length,
        0,
      );
      return `${total} item${total === 1 ? "" : "s"}`;
    }
    case "instructions":
      return `${recipe.instructions.length} step${recipe.instructions.length === 1 ? "" : "s"}`;
    case "notes":
      return `${recipe.notes.length} note${recipe.notes.length === 1 ? "" : "s"}`;
    default:
      return recipe.name ? `"${recipe.name}"` : "";
  }
}

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
  const undoable = useUndoable();
  const [modalEl, setModalEl] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(() => toDraft(recipe));
  const [saving, setSaving] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<ParsedRecipe | null>(null);
  const [picked, setPicked] = useState<ImportSection[]>(DEFAULT_SECTIONS);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const fetchPage = async (event: React.FormEvent) => {
    event.preventDefault();
    setFetchError(null);
    setFetched(null);
    let url: URL;
    try {
      url = new URL(pageUrl.trim());
    } catch {
      setFetchError("Enter a valid recipe URL");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      setFetchError("Recipe URLs must use HTTP or HTTPS");
      return;
    }

    setFetching(true);
    try {
      const response = await apiClient.post<{ parsed?: ParsedRecipe }>(
        "/api/recipes/import-url",
        { url: url.toString() },
        { timeout: 15000 },
      );
      const parsed = response.data.parsed;
      const found = parsed ? availableSections(parsed) : [];
      if (!parsed || found.length === 0) {
        setFetchError("No recipe details were found on that page");
        return;
      }
      setFetched(parsed);
      setPicked(DEFAULT_SECTIONS.filter((section) => found.includes(section)));
    } catch (error) {
      setFetchError(
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "That page could not be read",
      );
    } finally {
      setFetching(false);
    }
  };

  const applyFetched = () => {
    if (!fetched || picked.length === 0) return;
    const before = draft;
    const names = picked.map((section) => SECTION_LABELS[section]);
    undoable({
      message: `Updated from the page: ${names.join(", ").toLowerCase()}`,
      apply: () => setDraft(applySections(before, fetched, picked)),
      revert: () => setDraft(before),
    });
    setFetched(null);
  };

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
          <section className="recipe-fetch">
            <button
              type="button"
              className="recipe-fetch-toggle"
              aria-expanded={fetchOpen}
              onClick={() => setFetchOpen((open) => !open)}
            >
              {fetchOpen ? "Hide web page import" : "Update from a web page"}
            </button>
            {fetchOpen && (
              <>
                <form className="ocr-url-import" onSubmit={fetchPage}>
                  <label htmlFor="recipe-edit-url">Recipe page URL</label>
                  <input
                    id="recipe-edit-url"
                    type="url"
                    value={pageUrl}
                    onChange={(event) => setPageUrl(event.target.value)}
                    placeholder="https://example.com/recipe"
                    required
                  />
                  <button
                    type="submit"
                    disabled={fetching || !pageUrl.trim()}
                  >
                    {fetching ? "Fetching…" : "Fetch"}
                  </button>
                </form>
                {fetchError && (
                  <p className="recipe-fetch-error" role="alert">
                    {fetchError}
                  </p>
                )}
                {fetched && (
                  <fieldset className="recipe-fetch-found">
                    <legend>Use from that page</legend>
                    {availableSections(fetched).map((section) => (
                      <label key={section}>
                        <input
                          type="checkbox"
                          checked={picked.includes(section)}
                          onChange={(event) =>
                            setPicked((current) =>
                              event.target.checked
                                ? [...current, section]
                                : current.filter((item) => item !== section),
                            )
                          }
                        />
                        <span>
                          {SECTION_LABELS[section]}
                          <small> — {countFor(section, fetched)}</small>
                        </span>
                      </label>
                    ))}
                    <p className="recipe-fetch-hint">
                      Chosen sections replace what is in the editor below. You
                      can undo, and nothing is saved until you press Save
                      changes.
                    </p>
                    <div className="recipe-fetch-actions">
                      <button
                        type="button"
                        onClick={applyFetched}
                        disabled={picked.length === 0}
                      >
                        Apply selected
                      </button>
                      <button type="button" onClick={() => setFetched(null)}>
                        Discard
                      </button>
                    </div>
                  </fieldset>
                )}
              </>
            )}
          </section>
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
