import { useEffect, useState } from "react";
import { useToast } from "../common/Toast";
import { MEAL_TYPES, type MealType } from "../../utils/mealPlanWeeks";
import {
  SLOT_LABELS,
  SLOT_PRESETS,
  WEEKDAYS,
  type PlannerSettingsData,
} from "./plannerTypes";

interface Props {
  settings: PlannerSettingsData;
  onSave: (patch: Partial<PlannerSettingsData>) => Promise<boolean>;
}

const sameSlots = (a: MealType[], b: MealType[]) =>
  a.length === b.length && a.every((slot) => b.includes(slot));

export default function PlannerSettingsPanel({ settings, onSave }: Props) {
  const { showToast } = useToast();
  const [weekStartDay, setWeekStartDay] = useState(settings.weekStartDay);
  const [slots, setSlots] = useState<MealType[]>(settings.visibleSlots);
  const [household, setHousehold] = useState(String(settings.householdSize));
  const [threshold, setThreshold] = useState(String(settings.favoriteThreshold));
  const [saving, setSaving] = useState(false);

  // Follow the saved values (e.g. after a save or a reload).
  useEffect(() => {
    setWeekStartDay(settings.weekStartDay);
    setSlots(settings.visibleSlots);
    setHousehold(String(settings.householdSize));
    setThreshold(String(settings.favoriteThreshold));
  }, [settings]);

  const householdNumber = Number(household);
  const thresholdNumber = Number(threshold);
  const householdValid =
    household.trim() !== "" &&
    Number.isInteger(householdNumber) &&
    householdNumber >= 1 &&
    householdNumber <= 20;
  const thresholdValid =
    threshold.trim() !== "" &&
    Number.isInteger(thresholdNumber) &&
    thresholdNumber >= 0 &&
    thresholdNumber <= 50;
  const slotsValid = slots.length > 0;
  const valid = householdValid && thresholdValid && slotsValid;

  const dirty =
    weekStartDay !== settings.weekStartDay ||
    !sameSlots(slots, settings.visibleSlots) ||
    householdNumber !== settings.householdSize ||
    thresholdNumber !== settings.favoriteThreshold;

  const toggleSlot = (slot: MealType) =>
    setSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : MEAL_TYPES.filter((item) => item === slot || current.includes(item)),
    );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !dirty) return;
    setSaving(true);
    const ok = await onSave({
      weekStartDay,
      visibleSlots: slots,
      householdSize: householdNumber,
      favoriteThreshold: thresholdNumber,
    });
    setSaving(false);
    if (ok) showToast("Planner settings saved", "success");
  };

  return (
    <form className="planner-settings-panel" onSubmit={save}>
      <fieldset>
        <legend>Meals to show</legend>
        <div className="planner-presets" role="group" aria-label="Quick presets">
          {SLOT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={sameSlots(slots, preset.slots)}
              className={sameSlots(slots, preset.slots) ? "active" : ""}
              onClick={() => setSlots(preset.slots)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="planner-slot-checks">
          {MEAL_TYPES.map((slot) => (
            <label key={slot}>
              <input
                type="checkbox"
                checked={slots.includes(slot)}
                onChange={() => toggleSlot(slot)}
              />
              {SLOT_LABELS[slot]}
            </label>
          ))}
        </div>
        {!slotsValid && (
          <small className="planner-error" role="alert">
            Choose at least one meal.
          </small>
        )}
        <small>
          A hidden slot still appears on days where it already has meals, so
          nothing gets lost.
        </small>
      </fieldset>

      <label>
        Week starts on
        <select
          value={weekStartDay}
          onChange={(e) => setWeekStartDay(Number(e.target.value))}
        >
          {WEEKDAYS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label>
        People in your household
        <input
          type="number"
          min={1}
          max={20}
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          aria-describedby="household-help"
          aria-invalid={!householdValid}
        />
      </label>
      <small id="household-help">
        Used to suggest how many leftover meals a recipe makes.
      </small>

      <label>
        Auto-favorite after cooking a recipe
        <input
          type="number"
          min={0}
          max={50}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          aria-describedby="favorite-threshold-help"
          aria-invalid={!thresholdValid}
        />
        times
      </label>
      <small id="favorite-threshold-help">
        Set to 0 to turn this off. Recipes you unfavorite yourself are never
        re-favorited automatically, and eating leftovers does not count as
        cooking.
      </small>

      <button type="submit" disabled={!valid || !dirty || saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
