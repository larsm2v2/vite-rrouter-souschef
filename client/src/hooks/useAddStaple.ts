import { useCallback } from "react";
import apiClient from "../components/pages/Client";
import { useToast } from "../components/common/Toast";
import type { StockedItem } from "../types";

/** One-tap "I always have this" from any screen; merges server-side so it can't clobber the Already Stocked list. */
export function useAddStaple() {
  const { showToast } = useToast();

  return useCallback(
    async (name: string, category?: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        await apiClient.post<{ stockedItems: StockedItem[] }>(
          "/api/already-stocked/items",
          { name: trimmed, ...(category ? { category } : {}) },
        );
        showToast(`Added ${trimmed} to your staples`, "success");
        return true;
      } catch {
        showToast(`Couldn't add ${trimmed} to your staples`, "error");
        return false;
      }
    },
    [showToast],
  );
}
