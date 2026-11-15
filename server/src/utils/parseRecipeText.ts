import { parseIngredientLine } from "./recipeMath/ingredient";

export interface TextParsedRecipe {
  name?: string;
  ingredients: Record<string, string[]>;
  instructions: { number: number; text: string }[];
  notes: string[];
  servingInfo?: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: number;
  };
}

type Section = "ingredients" | "instructions" | "notes" | null;

const HEADERS: [RegExp, Section][] = [
  [/^(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need)$/i, "ingredients"],
  [/^(?:instructions?|directions?|method|steps?|preparation|procedure)$/i, "instructions"],
  [/^(?:notes?|tips?|cook(?:'|’)?s notes?)$/i, "notes"],
];

const BULLET = /^\s*(?:[-•*·▪●○]|\[\s?[xX]?\s?\]|☐)\s*/;
const STEP_PREFIX = /^\s*(?:step\s*)?\d{1,2}\s*[.):\-]\s+/i;

function sectionOf(line: string): Section {
  const text = line.replace(/[:：]\s*$/, "").trim();
  for (const [pattern, section] of HEADERS) {
    if (pattern.test(text)) return section;
  }
  return null;
}

function timeValue(line: string, label: RegExp): string | undefined {
  const match = new RegExp(`^${label.source}\\s*(?:time)?\\s*[:\\-]?\\s*(.+)$`, "i").exec(line);
  const value = match?.[1]?.trim();
  return value && /\d/.test(value) ? value : undefined;
}

/** Pull serving metadata out of a header line; returns true when consumed. */
function readServingInfo(
  line: string,
  info: NonNullable<TextParsedRecipe["servingInfo"]>,
): boolean {
  const prep = timeValue(line, /prep(?:aration)?/);
  if (prep) return Boolean((info.prepTime = prep));
  const cook = timeValue(line, /cook(?:ing)?/);
  if (cook) return Boolean((info.cookTime = cook));
  const total = timeValue(line, /total/);
  if (total) return Boolean((info.totalTime = total));

  const servings =
    /^(?:serves|servings?|yield|makes)\s*[:\-]?\s*(\d+)/i.exec(line) ??
    /^(\d+)\s+servings?\b/i.exec(line);
  if (servings) {
    info.servings = Number(servings[1]);
    return true;
  }
  return false;
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > 90 || /[.!?]$/.test(line)) return false;
  const parsed = parseIngredientLine(line);
  return parsed.quantity !== null && parsed.name.length > 0;
}

/**
 * Deterministic recipe text parser used when AI parsing is unavailable.
 * Understands common "Ingredients / Instructions / Notes" layouts and falls
 * back to line heuristics when the text has no section headings.
 */
export function parseRecipeText(text: string): TextParsedRecipe {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const servingInfo: NonNullable<TextParsedRecipe["servingInfo"]> = {};
  const ingredients: Record<string, string[]> = {};
  const steps: string[] = [];
  const notes: string[] = [];
  let name: string | undefined;
  let section: Section = null;
  let group = "default";
  const hasHeaders = lines.some((line) => sectionOf(line) !== null);

  for (const line of lines) {
    const header = sectionOf(line);
    if (header) {
      section = header;
      group = "default";
      continue;
    }

    if (readServingInfo(line, servingInfo)) continue;

    const content = line.replace(BULLET, "");

    if (section === "ingredients") {
      // "For the sauce:" style sub-headings start a new ingredient group.
      if (/:$/.test(content) && content.length < 60) {
        group = content.replace(/^for the\s+/i, "").replace(/:$/, "").trim();
        continue;
      }
      (ingredients[group] ??= []).push(content);
    } else if (section === "instructions") {
      steps.push(content.replace(STEP_PREFIX, ""));
    } else if (section === "notes") {
      notes.push(content);
    } else if (!name && (hasHeaders || !looksLikeIngredient(content))) {
      name = content;
    } else if (looksLikeIngredient(content)) {
      (ingredients[group] ??= []).push(content);
    } else {
      steps.push(content.replace(STEP_PREFIX, ""));
    }
  }

  return {
    ...(name ? { name } : {}),
    ingredients: Object.keys(ingredients).length ? ingredients : { default: [] },
    instructions: steps.map((stepText, index) => ({
      number: index + 1,
      text: stepText,
    })),
    notes,
    ...(Object.keys(servingInfo).length ? { servingInfo } : {}),
  };
}
