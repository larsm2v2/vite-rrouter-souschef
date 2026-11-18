import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useToast } from "../common/Toast";
import type { MealType } from "../../utils/mealPlanWeeks";
import { MAX_CUSTOM_DAYS, usePlanner } from "./usePlanner";
import PlannerGrid from "./PlannerGrid";
import PlannerHistory from "./PlannerHistory";
import PlannerSettingsPanel from "./PlannerSettingsPanel";
import RecipePalette from "./RecipePalette";
import { formatRange } from "./plannerTypes";
import "./Planner.css";

type View = "plan" | "history" | "settings";
const TABS: { id: View; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export default function PlannerPage() {
  const planner = usePlanner();
  const { showToast } = useToast();
  const [view, setView] = useState<View>("plan");
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Touch needs a short press so the page can still scroll; the mouse needs a small drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const name = event.active.data.current?.name;
    setDragLabel(typeof name === "string" ? name : "Meal");
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = event;
    const drop = over?.data.current as
      | { date: string; slot: MealType }
      | undefined;
    const item = active.data.current as
      | { type: "recipe"; recipeId: number }
      | { type: "entry"; entryId: number }
      | undefined;
    if (!drop?.date || !item) return;

    if (item.type === "recipe") {
      void planner.addEntry(item.recipeId, drop.date, drop.slot);
    } else {
      void planner.moveEntry(item.entryId, drop.date, drop.slot);
    }
  };

  const submitCustom = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customStart || !customEnd) {
      showToast("Choose a start and end date", "error");
      return;
    }
    const problem = planner.applyCustomRange(customStart, customEnd);
    if (problem) showToast(problem, "error");
    else setCustomOpen(false);
  };

  const openHistoryWeek = (weekStart: string) => {
    planner.showWeekOf(weekStart);
    setView("plan");
  };

  return (
    <div className="planner">
      <header className="planner-header">
        <h1>Meal planner</h1>
        <div className="planner-tabs" role="tablist" aria-label="Planner view">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              className={view === tab.id ? "active" : ""}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {view === "settings" ? (
        <PlannerSettingsPanel
          settings={planner.settings}
          onSave={planner.saveSettings}
        />
      ) : view === "history" ? (
        <PlannerHistory
          weekStartDay={planner.settings.weekStartDay}
          onViewWeek={openHistoryWeek}
          onCopyWeek={planner.copyWeekInto}
        />
      ) : (
        <>
          <div className="planner-toolbar">
            <button type="button" onClick={planner.goPrev} aria-label="Previous">
              ←
            </button>
            <button type="button" onClick={planner.goToday}>
              Today
            </button>
            <button type="button" onClick={planner.goNext} aria-label="Next">
              →
            </button>
            <span className="planner-range" aria-live="polite">
              {formatRange(planner.range.start, planner.range.end)}
              {planner.isCustom && " (custom)"}
            </span>
            <button
              type="button"
              className="planner-setting"
              onClick={() => setView("settings")}
            >
              Meals shown & settings
            </button>
            <button
              type="button"
              aria-expanded={customOpen}
              onClick={() => setCustomOpen((open) => !open)}
            >
              Custom range
            </button>
          </div>

          {customOpen && (
            <form className="planner-custom" onSubmit={submitCustom}>
              <label>
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  required
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  required
                />
              </label>
              <button type="submit">Show</button>
              <small>Up to {MAX_CUSTOM_DAYS} days.</small>
            </form>
          )}

          {planner.error && (
            <p className="planner-error" role="alert">
              {planner.error}{" "}
              <button type="button" onClick={() => void planner.reload()}>
                Retry
              </button>
            </p>
          )}

          <DndContext
            sensors={sensors}
            // Drop where the pointer is, not where the (wider) dragged card overlaps most.
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragLabel(null)}
          >
            <div className="planner-layout">
              <RecipePalette recipes={planner.recipes} />
              <div
                className={`planner-main ${planner.loading ? "loading" : ""}`}
                aria-busy={planner.loading}
              >
                <PlannerGrid
                  start={planner.range.start}
                  end={planner.range.end}
                  slots={planner.slots}
                  entries={planner.entries}
                  recipes={planner.recipes}
                  householdSize={planner.settings.householdSize}
                  onAdd={(recipeId, date, slot) =>
                    void planner.addEntry(recipeId, date, slot)
                  }
                  onToggleCooked={(id) => void planner.toggleCooked(id)}
                  onRemove={planner.removeEntry}
                  onSetMultiplier={(id, value) =>
                    void planner.setMultiplier(id, value)
                  }
                  onAddLeftovers={planner.addLeftovers}
                  onAddToGrocery={(id) => void planner.addToGroceryList(id)}
                />
              </div>
            </div>
            <DragOverlay>
              {dragLabel ? (
                <div className="planner-drag-overlay">{dragLabel}</div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}
