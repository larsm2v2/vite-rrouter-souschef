import React, { useState, useEffect, useCallback, useRef } from "react";
import "./AlreadyStocked.css";
import { StockedItem } from "../../types";
import apiClient from "../pages/Client";

interface AlreadyStockedProps {
	onAddToGroceryList?: (items: StockedItem[]) => void;
}

const AlreadyStocked: React.FC<AlreadyStockedProps> = ({
	onAddToGroceryList,
}) => {
	const [stocked, setStocked] = useState<StockedItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newItemName, setNewItemName] = useState("");
	const saveTimerRef = useRef<number | null>(null);

	// Fetch already stocked items
	const fetchAlreadyStocked = useCallback(async () => {
		try {
			const response = await apiClient.get<{
				stockedItems?: StockedItem[];
			}>("/api/already-stocked");
			if (response.status === 200) {
				setStocked(response.data.stockedItems || []);
			}
		} catch (err) {
			console.error("Error fetching already stocked items:", err);
			setError("Failed to load already stocked items");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAlreadyStocked();
	}, [fetchAlreadyStocked]);

	// Debounced persist to backend
	useEffect(() => {
		if (loading) return;

		if (saveTimerRef.current) {
			window.clearTimeout(saveTimerRef.current);
		}

		const timerId = window.setTimeout(async () => {
			try {
				await apiClient.post("/api/already-stocked", {
					stockedItems: stocked,
				});
			} catch (err) {
				console.error("Failed to persist already stocked items:", err);
			}
		}, 500);

		saveTimerRef.current = timerId;

		return () => {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
			}
		};
	}, [stocked, loading]);

	const handleAddItem = (e: React.FormEvent) => {
		e.preventDefault();

		if (!newItemName.trim()) {
			setError("Item name cannot be empty");
			return;
		}

		setStocked([...stocked, { name: newItemName.trim() }]);
		setNewItemName("");
		setError(null);
	};

	const handleDeleteItem = (index: number) => {
		setStocked(stocked.filter((_, i) => i !== index));
	};

	const handleUpdateItemName = (index: number, newName: string) => {
		const updated = [...stocked];
		updated[index] = { ...updated[index], name: newName };
		setStocked(updated);
	};

	const handleAddAllToGrocery = () => {
		if (onAddToGroceryList) {
			onAddToGroceryList(stocked);
		}
	};

	if (loading) {
		return (
			<div className="already-stocked-container">
				Loading already stocked items...
			</div>
		);
	}

	return (
		<div className="already-stocked-container">
			<div className="already-stocked-header">
				<h2>Already Stocked</h2>
				<button
					className="add-all-btn"
					onClick={handleAddAllToGrocery}
					disabled={stocked.length === 0}
				>
					Add All to Grocery List
				</button>
			</div>

			{error && <div className="error-message">{error}</div>}

			<form onSubmit={handleAddItem} className="already-stocked-form">
				<div className="form-group">
					<input
						type="text"
						placeholder="Add item name..."
						value={newItemName}
						onChange={(e) => setNewItemName(e.target.value)}
						className="already-stocked-input"
					/>
				</div>
				<button type="submit" className="add-stocked-btn">
					Add
				</button>
			</form>

			<div className="already-stocked-list">
				{stocked.length === 0 ? (
					<p className="no-stocked">
						No items added yet. Add one above!
					</p>
				) : (
					stocked.map((item, index) => (
						<div key={index} className="stocked-item">
							<div className="stocked-details">
								<input
									type="text"
									value={item.name}
									onChange={(e) =>
										handleUpdateItemName(
											index,
											e.target.value
										)
									}
									className="stocked-edit-input"
								/>
							</div>
							<button
								className="delete-stocked-btn"
								onClick={() => handleDeleteItem(index)}
								title="Delete"
							>
								✕
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default AlreadyStocked;
