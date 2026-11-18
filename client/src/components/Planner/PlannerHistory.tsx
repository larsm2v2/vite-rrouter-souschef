import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../pages/Client";
import { useToast } from "../common/Toast";
import { MEAL_TYPES, addDays, localToday, weekStartFor } from "../../utils/mealPlanWeeks";
import {
  SLOT_LABELS,
  formatDay,
  formatRange,
  type HistoryWeek,
} from "./plannerTypes";

const PAGE_WEEKS = 8;

interface Props {
  weekStartDay: number;
  onViewWeek: (weekStart: string) => void;
  onCopyWeek: (fromStart: string, toStart: string) => Promise<number>;
}

export default function PlannerHistory({
  weekStartDay,
  onViewWeek,
  onCopyWeek,
}: Props) {
  const { showToast } = useToast();
  const [weeks, setWeeks] = useState<HistoryWeek[]>([]);
  const [requested, setRequested] = useState(PAGE_WEEKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  const load = useCallback(async (count: number) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get<HistoryWeek[]>("/api/meal-plan/history", {
        params: { today: localToday(), weeks: count },
      });
      setWeeks(resp.data);
    } catch {
      setError("Could not load your past weeks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(requested);
  }, [load, requested, weekStartDay]);

  const copy = async (week: HistoryWeek, target: "this" | "next") => {
    const thisWeek = weekStartFor(localToday(), weekStartDay);
    const toStart = target === "this" ? thisWeek : addDays(thisWeek, 7);
    setCopying(week.weekStart);
    try {
      const count = await onCopyWeek(week.weekStart, toStart);
      showToast(
        count > 0
          ? `Copied ${count} meals to the week of ${formatDay(toStart)}`
          : "That week had no recipes to copy",
        count > 0 ? "success" : "info",
      );
      if (count > 0) onViewWeek(toStart);
    } catch {
      showToast("Could not copy that week", "error");
    } finally {
      setCopying(null);
    }
  };

  if (loading && weeks.length === 0)
    return <p className="planner-empty">Loading past weeks…</p>;
  if (error)
    return (
      <p className="planner-error" role="alert">
        {error}{" "}
        <button type="button" onClick={() => void load(requested)}>
          Retry
        </button>
      </p>
    );
  if (weeks.length === 0)
    return (
      <p className="planner-empty">
        No past weeks yet. Plan some meals and they will show up here.
      </p>
    );

  return (
    <div className="planner-history">
      {weeks.map((week) => {
        const dates = [...new Set(week.entries.map((e) => e.plannedDate))];
        return (
          <article key={week.weekStart} className="history-week">
            <header>
              <h3>{formatRange(week.weekStart, week.weekEnd)}</h3>
              <span className="planner-badge muted">
                {week.cookedCount}/{week.plannedCount} cooked
              </span>
            </header>
            <ul className="history-days">
              {dates.map((date) => (
                <li key={date}>
                  <strong>{formatDay(date)}</strong>
                  <ul>
                    {week.entries
                      .filter((entry) => entry.plannedDate === date)
                      .sort(
                        (a, b) =>
                          MEAL_TYPES.indexOf(a.mealType ?? "dinner") -
                          MEAL_TYPES.indexOf(b.mealType ?? "dinner"),
                      )
                      .map((entry) => (
                        <li
                          key={entry.id}
                          className={entry.isCooked ? "cooked" : ""}
                        >
                          <span className="history-slot">
                            {SLOT_LABELS[entry.mealType ?? "dinner"]}
                          </span>
                          {entry.kind === "leftover" && (
                            <span title="Leftovers" aria-label="Leftovers">
                              ↻
                            </span>
                          )}
                          {entry.recipeId ? (
                            <Link to={`/recipes/${entry.recipeId}`}>
                              {entry.recipeName}
                            </Link>
                          ) : (
                            <span>{entry.recipeName ?? "Deleted recipe"}</span>
                          )}
                          {entry.isCooked && (
                            <span aria-label="Cooked"> ✓</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
            <footer>
              <button type="button" onClick={() => onViewWeek(week.weekStart)}>
                Open in planner
              </button>
              <button
                type="button"
                disabled={copying === week.weekStart}
                onClick={() => void copy(week, "this")}
              >
                Reuse for this week
              </button>
              <button
                type="button"
                disabled={copying === week.weekStart}
                onClick={() => void copy(week, "next")}
              >
                Reuse for next week
              </button>
            </footer>
          </article>
        );
      })}
      {weeks.length >= requested && (
        <button
          type="button"
          className="planner-more"
          disabled={loading}
          onClick={() => setRequested(requested + PAGE_WEEKS)}
        >
          {loading ? "Loading…" : "Show older weeks"}
        </button>
      )}
    </div>
  );
}
