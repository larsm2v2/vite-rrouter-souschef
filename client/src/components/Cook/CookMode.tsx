import { useEffect, useMemo, useState } from "react";
import ToastSafeFocusTrap from "../common/ToastSafeFocusTrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import useRecipe from "../../hooks/useRecipe";
import { useCookState } from "../../hooks/useCookState";
import { useTimers } from "../../hooks/useTimers";
import { useWakeLock } from "../../hooks/useWakeLock";
import {
  displayIngredient,
  parseServings,
  toIngredientGroups,
} from "../../utils/recipeIngredients";
import InstructionText from "./InstructionText";
import ServingScaler from "./ServingScaler";
import TimerTray from "./TimerTray";
import "./Cook.css";

const SWIPE_DISTANCE = 60;
const FONT_MIN = 0.8;
const FONT_MAX = 1.8;

export default function CookMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, loading, error } = useRecipe(id);
  const { state, patch, clear } = useCookState(id);
  const timers = useTimers(id);
  const wake = useWakeLock(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const steps = useMemo(() => recipe?.instructions ?? [], [recipe]);
  const groups = useMemo(
    () => toIngredientGroups(recipe?.ingredients),
    [recipe],
  );
  const last = Math.max(0, steps.length - 1);
  const index = Math.min(Math.max(0, state.stepIndex), last);
  const atEnd = index >= last;

  useEffect(() => {
    if (recipe && !state.started) patch({ started: true });
  }, [recipe, state.started, patch]);

  const go = (next: number) =>
    patch({ stepIndex: Math.min(last, Math.max(0, next)) });
  const finish = () => {
    clear();
    navigate(`/recipes/${id}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheetOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading && !recipe)
    return <div className="cook-root cook-message">Loading recipe…</div>;
  if (error || !recipe) {
    return (
      <div className="cook-root cook-message">
        <p>We couldn’t load this recipe.</p>
        <Link to="/recipes">Back to recipes</Link>
      </div>
    );
  }
  if (steps.length === 0) {
    return (
      <div className="cook-root cook-message">
        <p>This recipe has no instructions to cook from.</p>
        <Link to={`/recipes/${id}`}>Back to recipe</Link>
      </div>
    );
  }

  const step = steps[index];
  const baseServings = parseServings(recipe.serving_info?.servings);
  const checkedCount = state.checked.length;
  const totalIngredients = groups.reduce((n, g) => n + g.items.length, 0);

  const toggle = (key: string) =>
    patch((prev) => ({
      checked: prev.checked.includes(key)
        ? prev.checked.filter((k) => k !== key)
        : [...prev.checked, key],
    }));

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy))
      go(index + (dx < 0 ? 1 : -1));
  };

  const wakeLabel = !wake.supported
    ? "Screen lock unavailable"
    : wake.enabled
      ? wake.active
        ? "Screen stays on"
        : "Screen may sleep"
      : "Screen lock off";

  return (
    <div className="cook-root">
      <header className="cook-top">
        <Link
          to={`/recipes/${id}`}
          className="cook-exit"
          aria-label="Exit cooking mode"
        >
          ✕
        </Link>
        <div className="cook-title">
          <h1>{recipe.name}</h1>
          <span>
            Step {index + 1} of {steps.length}
          </span>
        </div>
        <button
          type="button"
          className="cook-wake"
          aria-pressed={wake.enabled && wake.supported}
          disabled={!wake.supported}
          onClick={() => wake.setEnabled(!wake.enabled)}
        >
          {wakeLabel}
        </button>
      </header>
      <div
        className="cook-progress"
        role="progressbar"
        aria-label="Cooking progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
      >
        <div style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <main
        className="cook-step"
        onTouchStart={(e) =>
          setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
        }
        onTouchEnd={onTouchEnd}
      >
        <div aria-live="polite" aria-atomic="true">
          <h2 className="cook-step-heading" tabIndex={-1}>
            Step {index + 1}
          </h2>
          <p
            className="cook-step-text"
            style={{ fontSize: `${1.375 * state.fontScale}rem` }}
          >
            <InstructionText
              text={step.text}
              stepLabel={`Step ${index + 1}`}
              onStartTimer={timers.start}
            />
          </p>
        </div>
        <div className="cook-font">
          <button
            type="button"
            aria-label="Smaller text"
            disabled={state.fontScale <= FONT_MIN}
            onClick={() =>
              patch({
                fontScale: Math.max(
                  FONT_MIN,
                  Math.round((state.fontScale - 0.2) * 10) / 10,
                ),
              })
            }
          >
            A−
          </button>
          <button
            type="button"
            aria-label="Larger text"
            disabled={state.fontScale >= FONT_MAX}
            onClick={() =>
              patch({
                fontScale: Math.min(
                  FONT_MAX,
                  Math.round((state.fontScale + 0.2) * 10) / 10,
                ),
              })
            }
          >
            A+
          </button>
        </div>
      </main>

      <TimerTray
        timers={timers.timers}
        now={timers.now}
        onPause={timers.pause}
        onResume={timers.resume}
        onAddMinute={timers.addMinute}
        onDismiss={timers.dismiss}
      />

      <nav className="cook-controls" aria-label="Cooking controls">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className="cook-ingredients"
          onClick={() => setSheetOpen(true)}
        >
          Ingredients
          {totalIngredients > 0 ? ` (${checkedCount}/${totalIngredients})` : ""}
        </button>
        {atEnd ? (
          <button type="button" className="primary" onClick={finish}>
            Finish
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => go(index + 1)}
          >
            Next
          </button>
        )}
      </nav>

      {sheetOpen && (
        <div
          className="cook-sheet-backdrop"
          onClick={() => setSheetOpen(false)}
        >
          <ToastSafeFocusTrap
            active
            container={sheetEl}
            focusTrapOptions={{
              escapeDeactivates: false,
              allowOutsideClick: true,
              fallbackFocus: ".cook-sheet",
            }}
          />
          <div
            ref={setSheetEl}
            className="cook-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Ingredients"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setSheetOpen(false)}
          >
            <div className="cook-sheet-head">
              <h2>Ingredients</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close ingredients"
              >
                ✕
              </button>
            </div>
            <ServingScaler
              baseServings={baseServings}
              scale={state.scale}
              onChange={(scale) => patch({ scale })}
            />
            {groups.map((group) => (
              <div key={group.name} className="cook-group">
                {groups.length > 1 || group.name !== "default" ? (
                  <h3>{group.name}</h3>
                ) : null}
                <ul>
                  {group.items.map((entry) => {
                    const checked = state.checked.includes(entry.key);
                    return (
                      <li key={entry.key}>
                        <label className={checked ? "checked" : ""}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(entry.key)}
                          />
                          <span>{displayIngredient(entry, state.scale)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {checkedCount > 0 && (
              <button
                type="button"
                className="cook-reset"
                onClick={() => patch({ checked: [] })}
              >
                Reset checks
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
