import { useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { preprompt } from "../Models/Prompts";
import axios from "axios";
import "./RecipeGenerator.css";
import FormInput from "../FormInputs/FormInput";

type GeneratedRecipe = {
  name?: string;
  cuisine?: string;
  ingredients: Record<string, Array<Record<string, unknown>>>;
  instructions: Array<{ number?: number; text?: string }>;
  notes?: string[];
  [k: string]: unknown;
};

export type PrefillHandle = {
  prefillRecipe: (parsed: GeneratedRecipe) => void;
};

const RecipeGenerator = forwardRef<PrefillHandle | null>((_props, ref) => {
  const [cuisine, setCuisine] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [knownIngredients, setKnownIngredients] = useState("");
  const [avoidIngredients, setAvoidIngredients] = useState("");
  const [otherInfo, setOtherInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] =
    useState<GeneratedRecipe | null>(null);
  const [error, setError] = useState("");

  // Expose an imperative handle to allow modal/import to prefill
  useImperativeHandle(ref, () => ({
    prefillRecipe(parsed: GeneratedRecipe) {
      setGeneratedRecipe(parsed);
      if (parsed.cuisine && typeof parsed.cuisine === "string")
        setCuisine(parsed.cuisine);
      // Simple heuristic: flatten ingredient names into knownIngredients textarea
      try {
        const ingLines: string[] = [];
        Object.values(parsed.ingredients || {}).forEach(
          (arr: Array<Record<string, unknown>>) => {
            (arr || []).forEach((it: Record<string, unknown>) => {
              if (it && it.name) ingLines.push(String(it.name));
            });
          }
        );
        if (ingLines.length) setKnownIngredients(ingLines.join("\n"));
      } catch {
        console.warn("Failed to prefill ingredients from parsed recipe");
      }
    },
  }));

  // Also listen for global OCR import events (dispatched by OCRModal)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const parsed = ce.detail as GeneratedRecipe;
      if (!parsed) return;
      setGeneratedRecipe(parsed);
      if (parsed.cuisine && typeof parsed.cuisine === "string")
        setCuisine(parsed.cuisine);
      try {
        const ingLines: string[] = [];
        Object.values(parsed.ingredients || {}).forEach(
          (arr: Array<Record<string, unknown>>) => {
            (arr || []).forEach((it: Record<string, unknown>) => {
              if (it && it.name) ingLines.push(String(it.name));
            });
          }
        );
        if (ingLines.length) setKnownIngredients(ingLines.join("\n"));
      } catch {
        console.warn("Failed to prefill ingredients from parsed recipe");
      }
    };
    window.addEventListener("ocr:import", handler as EventListener);
    return () =>
      window.removeEventListener("ocr:import", handler as EventListener);
  }, []);

  const generateRecipe = async () => {
    setLoading(true);
    setError("");

    try {
      const prompt = preprompt(
        cuisine,
        dietaryRestrictions,
        knownIngredients,
        avoidIngredients,
        otherInfo,
        ""
      );

      const response = await axios.post("/recipes/generate", {
        message: prompt,
        history: [],
      });

      // Extract JSON from the response text
      const jsonMatch = (response.data as string).match(
        /```json\s*([\s\S]*?)\s*```/
      );
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1].trim());
          setGeneratedRecipe(jsonData);
        } catch {
          setError("Error parsing the recipe JSON. Please try again.");
        }
      } else {
        setError(
          "No valid recipe format found in the response. Please try again."
        );
      }
    } catch (err) {
      setError("Failed to generate recipe. Please try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveRecipe = async () => {
    if (!generatedRecipe) return;

    try {
      setLoading(true);
      await axios.post("/recipes", generatedRecipe);
      alert("Recipe saved successfully!");
      // Optionally navigate to view the saved recipe
      // navigate(`/recipes/${response.data.id}`);
    } catch (err) {
      setError("Failed to save recipe");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recipe-generator">
      <h2>Recipe Generator</h2>

      <FormInput
        label="Cuisine"
        value={cuisine}
        onChange={(e) => setCuisine(e.target.value)}
        placeholder="e.g., Italian, Mexican, Chinese"
      />

      <FormInput
        label="Dietary Restrictions"
        value={dietaryRestrictions}
        onChange={(e) => setDietaryRestrictions(e.target.value)}
        placeholder="e.g., vegetarian, gluten-free, dairy-free"
        type="textarea"
      />

      <FormInput
        label="Include These Ingredients"
        value={knownIngredients}
        onChange={(e) => setKnownIngredients(e.target.value)}
        placeholder="e.g., chicken, rice, garlic"
        type="textarea"
      />

      <FormInput
        label="Avoid These Ingredients"
        value={avoidIngredients}
        onChange={(e) => setAvoidIngredients(e.target.value)}
        placeholder="e.g., peanuts, shellfish"
        type="textarea"
      />

      <FormInput
        label="Additional Information (optional)"
        value={otherInfo}
        onChange={(e) => setOtherInfo(e.target.value)}
        placeholder="e.g., quick meal, holiday dish, high protein"
        type="textarea"
      />

      <div className="form-actions">
        <button
          onClick={generateRecipe}
          disabled={loading || (!knownIngredients && !cuisine)}
        >
          {loading ? "Generating..." : "Generate Recipe"}
        </button>

        {generatedRecipe && (
          <button
            onClick={saveRecipe}
            disabled={loading}
            className="save-button"
          >
            Save Recipe
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {generatedRecipe && (
        <div className="generated-recipe">
          <h3>{generatedRecipe.name}</h3>
          <div className="recipe-details">
            <p>
              <strong>Cuisine:</strong> {String(generatedRecipe.cuisine ?? "")}
            </p>
            <p>
              <strong>Meal Type:</strong>{" "}
              {String(generatedRecipe["meal type"] ?? "")}
            </p>
            {(() => {
              const serving = generatedRecipe["serving info"] as
                | Record<string, unknown>
                | undefined;
              return (
                <>
                  <p>
                    <strong>Prep Time:</strong>{" "}
                    {String(serving?.["prep time"] ?? "")}
                  </p>
                  <p>
                    <strong>Cook Time:</strong>{" "}
                    {String(serving?.["cook time"] ?? "")}
                  </p>
                  <p>
                    <strong>Servings:</strong>{" "}
                    {String(serving?.["number of people served"] ?? "")}
                  </p>
                </>
              );
            })()}
          </div>

          <h4>Ingredients</h4>
          {Object.entries(generatedRecipe.ingredients).map(
            ([category, items]) => (
              <div key={category} className="ingredient-category">
                <h5>{category}</h5>
                <ul>
                  {items.map((item) => {
                    const it = item as Record<string, unknown>;
                    return (
                      <li key={String(it.id ?? `${category}-${Math.random()}`)}>
                        {String(it.quantity ?? "")} {String(it.unit ?? "")}{" "}
                        {String(it.name ?? "")}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          )}

          <h4>Instructions</h4>
          <ol>
            {generatedRecipe.instructions.map((instruction) => (
              <li key={String(instruction.number ?? Math.random())}>
                {String(instruction.text ?? "")}
              </li>
            ))}
          </ol>

          {generatedRecipe.notes && generatedRecipe.notes.length > 0 && (
            <>
              <h4>Notes</h4>
              <ul>
                {generatedRecipe.notes?.map((note: string, index: number) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default RecipeGenerator;
