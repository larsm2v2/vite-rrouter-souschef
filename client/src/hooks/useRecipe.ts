import { useEffect, useState } from "react";
import axios from "axios";
import type { RecipeModel } from "../types";

export default function useRecipe(id?: string, initial?: RecipeModel) {
	const [recipe, setRecipe] = useState<RecipeModel | null>(initial ?? null);
	const [loading, setLoading] = useState<boolean>(!initial && !!id);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!id) return;
		// If we already received initial data, don't re-fetch immediately
		if (initial) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		const base = import.meta.env.VITE_API_URL ?? "";
		axios
			.get<RecipeModel>(`${base}/api/recipes/${id}`)
			.then((resp) => {
				if (!cancelled) {
					setRecipe(resp.data);
					setLoading(false);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err as Error);
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [id, initial]);

	return { recipe, setRecipe, loading, error };
}
