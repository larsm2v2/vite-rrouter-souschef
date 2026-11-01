import { useUserStorage } from "./useUserStorage";
import { clampScale } from "../utils/recipeIngredients";

export interface CookState {
  started: boolean;
  stepIndex: number;
  checked: string[];
  scale: number;
  fontScale: number;
}

export const DEFAULT_COOK_STATE: CookState = {
  started: false,
  stepIndex: 0,
  checked: [],
  scale: 1,
  fontScale: 1,
};

const COOK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Cooking progress, scale and checked ingredients for one recipe; expires after 12 hours. */
export function useCookState(recipeId: string | undefined) {
  const [raw, setState, clear] = useUserStorage<CookState>(
    "cook",
    recipeId,
    DEFAULT_COOK_STATE,
    {
      maxAgeMs: COOK_MAX_AGE_MS,
    },
  );
  const state: CookState = {
    ...DEFAULT_COOK_STATE,
    ...raw,
    scale: clampScale(raw.scale),
    checked: Array.isArray(raw.checked) ? raw.checked : [],
  };
  const patch = (
    changes: Partial<CookState> | ((prev: CookState) => Partial<CookState>),
  ) =>
    setState((prev) => ({
      ...DEFAULT_COOK_STATE,
      ...prev,
      ...(typeof changes === "function"
        ? changes({ ...DEFAULT_COOK_STATE, ...prev })
        : changes),
    }));
  return { state, patch, clear };
}
