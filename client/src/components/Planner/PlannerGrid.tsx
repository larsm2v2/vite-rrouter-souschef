import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { RecipeModel } from "../../types";
import {
  addDays,
  daysBetween,
  localToday,
  type MealType,
} from "../../utils/mealPlanWeeks";
import {
  servingsOf,
  slotsAfter,
  suggestLeftoverCount,
  type SlotRef,
} from "../../utils/leftovers";
import {
  MULTIPLIERS,
  SLOT_LABELS,
  formatDay,
  rankRecipes,
  type MealPlanEntry,
} from "./plannerTypes";

interface Actions {
  onAdd: (recipeId: number, date: string, slot: MealType) => void;
  onToggleCooked: (id: number) => void;
  onRemove: (id: number) => void;
  onSetMultiplier: (id: number, multiplier: number) => void;
  onAddLeftovers: (id: number, slots: SlotRef[]) => Promise<boolean>;
  onAddToGrocery: (id: number) => void;
}

interface GridProps extends Actions {
  start: string;
  end: string;
  slots: MealType[];
  entries: MealPlanEntry[];
  recipes: RecipeModel[];
  householdSize: number;
}

const slotKey = (slot: SlotRef) => `${slot.plannedDate}|${slot.mealType}`;
const slotLabel = (slot: SlotRef) =>
  `${formatDay(slot.plannedDate)} ${SLOT_LABELS[slot.mealType]}`;

function MealOptions({
  entry,
  recipe,
  slots,
  householdSize,
  onSetMultiplier,
  onAddLeftovers,
  onAddToGrocery,
}: {
  entry: MealPlanEntry;
  recipe: RecipeModel | undefined;
  slots: MealType[];
  householdSize: number;
} & Pick<Actions, "onSetMultiplier" | "onAddLeftovers" | "onAddToGrocery">) {
  const servings = servingsOf(recipe?.serving_info?.servings);
  const suggested = suggestLeftoverCount(
    servings,
    entry.multiplier,
    householdSize,
  );
  const candidates = useMemo(
    () =>
      slotsAfter(
        {
          plannedDate: entry.plannedDate,
          mealType: entry.mealType ?? "dinner",
        },
        slots,
        8,
      ),
    [entry.plannedDate, entry.mealType, slots],
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Preselect as many slots as the batch is expected to cover; any change to the
  // batch size or the candidate slots re-suggests.
  useEffect(() => {
    setPicked(new Set(candidates.slice(0, suggested).map(slotKey)));
  }, [candidates, suggested]);

  const toggle = (key: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const name = entry.recipeName ?? "this recipe";
  const portions = servings ? servings * entry.multiplier : null;

  return (
    <div className="meal-options">
      <label className="meal-options-row">
        Amount
        <select
          value={entry.multiplier}
          aria-label={`Recipe multiplier for ${name}`}
          onChange={(e) => onSetMultiplier(entry.id, Number(e.target.value))}
        >
          {MULTIPLIERS.map((value) => (
            <option key={value} value={value}>
              {value === 1 ? "1× (as written)" : `${value}×`}
            </option>
          ))}
        </select>
      </label>
      <p className="planner-hint">
        {portions
          ? `Makes about ${portions} servings for ${householdSize} ${
              householdSize === 1 ? "person" : "people"
            }${suggested > 0 ? ` — roughly ${suggested} leftover meal${suggested === 1 ? "" : "s"}.` : "."}`
          : "This recipe has no serving count, so leftovers are not suggested."}
      </p>
      <fieldset className="meal-options-leftovers">
        <legend>Make leftovers</legend>
        {candidates.map((candidate) => {
          const key = slotKey(candidate);
          return (
            <label key={key}>
              <input
                type="checkbox"
                checked={picked.has(key)}
                onChange={() => toggle(key)}
              />
              {slotLabel(candidate)}
            </label>
          );
        })}
        <button
          type="button"
          disabled={picked.size === 0 || saving}
          onClick={async () => {
            setSaving(true);
            const chosen = candidates.filter((c) => picked.has(slotKey(c)));
            await onAddLeftovers(entry.id, chosen);
            setSaving(false);
          }}
        >
          Add leftovers
        </button>
      </fieldset>
      <button type="button" onClick={() => onAddToGrocery(entry.id)}>
        Add ingredients to grocery list
        {entry.multiplier !== 1 ? ` (×${entry.multiplier})` : ""}
      </button>
    </div>
  );
}

function PlannedMeal({
  entry,
  recipe,
  slots,
  householdSize,
  actions,
}: {
  entry: MealPlanEntry;
  recipe: RecipeModel | undefined;
  slots: MealType[];
  householdSize: number;
  actions: Actions;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    data: { type: "entry", entryId: entry.id, name: entry.recipeName },
    disabled: entry.id < 0,
  });
  const [open, setOpen] = useState(false);
  const isLeftover = entry.kind === "leftover";
  const name = entry.recipeName ?? "Deleted recipe";
  const saved = entry.id > 0;

  return (
    <li
      ref={setNodeRef}
      className={`planned-meal ${isLeftover ? "leftover" : ""} ${
        entry.isCooked ? "cooked" : ""
      } ${isDragging ? "dragging" : ""}`}
    >
      <div className="planned-row">
        <button
          type="button"
          className="planned-handle"
          aria-label={`Drag ${isLeftover ? "leftover " : ""}${name} to another slot`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <input
          type="checkbox"
          checked={entry.isCooked}
          onChange={() => actions.onToggleCooked(entry.id)}
          aria-label={
            isLeftover
              ? `Mark leftover ${name} as eaten`
              : `Mark ${name} as cooked`
          }
          disabled={!saved || entry.recipeId === null}
        />
        <span className="planned-name">
          {isLeftover && (
            <span className="planned-tag" title="Leftovers">
              ↻
            </span>
          )}
          {entry.recipeId ? (
            <Link to={`/recipes/${entry.recipeId}`}>{name}</Link>
          ) : (
            name
          )}
        </span>
        {!isLeftover && entry.multiplier !== 1 && (
          <span
            className="planner-badge"
            title={`Cooking ${entry.multiplier}× the recipe`}
          >
            ×{entry.multiplier}
          </span>
        )}
        {!isLeftover && entry.leftoverCount > 0 && (
          <span
            className="planner-badge muted"
            title={`${entry.leftoverCount} leftover meals planned`}
          >
            +{entry.leftoverCount}
          </span>
        )}
        {!isLeftover && entry.recipeId !== null && (
          <button
            type="button"
            className="planned-options"
            aria-label={`Options for ${name}`}
            aria-expanded={open}
            disabled={!saved}
            onClick={() => setOpen((value) => !value)}
          >
            ⋯
          </button>
        )}
        <button
          type="button"
          className="planned-remove"
          aria-label={`Remove ${isLeftover ? "leftover " : ""}${name}`}
          onClick={() => actions.onRemove(entry.id)}
          disabled={!saved}
        >
          ✕
        </button>
      </div>
      {open && !isLeftover && (
        <MealOptions
          entry={entry}
          recipe={recipe}
          slots={slots}
          householdSize={householdSize}
          onSetMultiplier={actions.onSetMultiplier}
          onAddLeftovers={actions.onAddLeftovers}
          onAddToGrocery={actions.onAddToGrocery}
        />
      )}
    </li>
  );
}

function Slot({
  date,
  slot,
  entries,
  recipes,
  slots,
  householdSize,
  actions,
}: {
  date: string;
  slot: MealType;
  entries: MealPlanEntry[];
  recipes: RecipeModel[];
  slots: MealType[];
  householdSize: number;
  actions: Actions;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${date}:${slot}`,
    data: { date, slot },
  });
  const [picking, setPicking] = useState(false);
  const ranked = useMemo(() => (picking ? rankRecipes(recipes) : []), [
    picking,
    recipes,
  ]);

  return (
    <div
      ref={setNodeRef}
      className={`planner-slot ${isOver ? "over" : ""}`}
      data-slot={slot}
    >
      <div className="planner-slot-head">
        <span>{SLOT_LABELS[slot]}</span>
        <button
          type="button"
          className="planner-add"
          aria-label={`Add a recipe to ${SLOT_LABELS[slot]} on ${formatDay(date)}`}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
        >
          {picking ? "–" : "+"}
        </button>
      </div>
      {picking && (
        <select
          className="planner-picker"
          aria-label={`Recipe for ${SLOT_LABELS[slot]} on ${formatDay(date)}`}
          defaultValue=""
          autoFocus
          onChange={(e) => {
            if (!e.target.value) return;
            actions.onAdd(Number(e.target.value), date, slot);
            setPicking(false);
          }}
        >
          <option value="">Choose a recipe…</option>
          {ranked.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.is_favorite ? "★ " : ""}
              {recipe.name}
            </option>
          ))}
        </select>
      )}
      <ul className="planner-slot-entries">
        {entries.map((entry) => (
          <PlannedMeal
            key={entry.clientKey ?? entry.id}
            entry={entry}
            recipe={recipes.find((r) => r.id === String(entry.recipeId))}
            slots={slots}
            householdSize={householdSize}
            actions={actions}
          />
        ))}
      </ul>
    </div>
  );
}

export default function PlannerGrid({
  start,
  end,
  slots,
  entries,
  recipes,
  householdSize,
  ...actions
}: GridProps) {
  const today = localToday();
  const days = useMemo(
    () =>
      Array.from({ length: daysBetween(start, end) + 1 }, (_, i) =>
        addDays(start, i),
      ),
    [start, end],
  );
  const bySlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>();
    for (const entry of entries) {
      const key = `${entry.plannedDate}|${entry.mealType ?? "dinner"}`;
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  return (
    <div className="planner-grid">
      {days.map((date) => (
        <section
          key={date}
          className={`planner-day ${date === today ? "today" : ""}`}
          aria-label={formatDay(date)}
        >
          <h3>
            {formatDay(date)}
            {date === today && <span className="planner-today">Today</span>}
          </h3>
          {slots.map((slot) => (
            <Slot
              key={slot}
              date={date}
              slot={slot}
              entries={bySlot.get(`${date}|${slot}`) ?? []}
              recipes={recipes}
              slots={slots}
              householdSize={householdSize}
              actions={actions}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
