import { formatNumber } from "../../utils/recipeMath";
import { clampScale } from "../../utils/recipeIngredients";

interface Props {
  baseServings: number | null;
  scale: number;
  onChange: (scale: number) => void;
}

const CHIPS: [string, number][] = [
  ["½×", 0.5],
  ["1×", 1],
  ["2×", 2],
  ["3×", 3],
];

export default function ServingScaler({
  baseServings,
  scale,
  onChange,
}: Props) {
  const servings = baseServings !== null ? baseServings * scale : null;
  const step = (delta: number) => {
    if (baseServings === null || servings === null) return;
    const next = Math.max(1, Math.round(servings) + delta);
    onChange(clampScale(next / baseServings));
  };
  const caveat = scale >= 3 || scale < 0.5;

  return (
    <div className="serving-scaler" role="group" aria-label="Scale recipe">
      {servings !== null && (
        <div className="serving-stepper">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Decrease servings"
            disabled={servings <= 1}
          >
            −
          </button>
          <span aria-live="polite">
            <strong>{formatNumber(servings)}</strong> servings
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Increase servings"
          >
            +
          </button>
        </div>
      )}
      <div className="serving-chips">
        {CHIPS.map(([label, value]) => (
          <button
            key={label}
            type="button"
            className={Math.abs(scale - value) < 0.001 ? "active" : ""}
            aria-pressed={Math.abs(scale - value) < 0.001}
            aria-label={`Scale ${label}`}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        ))}
        {scale !== 1 && (
          <button type="button" className="reset" onClick={() => onChange(1)}>
            Reset
          </button>
        )}
      </div>
      {caveat && (
        <p className="scale-caveat">
          Baking times, pan size, and leavening may not scale linearly.
        </p>
      )}
      {scale !== 1 && (
        <p className="scale-caveat">
          Amounts written inside the instructions are not scaled.
        </p>
      )}
    </div>
  );
}
