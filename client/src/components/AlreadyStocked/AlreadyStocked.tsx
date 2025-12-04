import React, { useState, useEffect, useCallback, useRef } from "react";
import "./AlreadyStocked.css";
import { StockedItem } from "../Models/Models";
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
  const [newItem, setNewItem] = useState<StockedItem>({
    name: "",
    quantity: 0,
    unit: "",
  });
  const saveTimerRef = useRef<number | null>(null);

  // Fetch already stocked items
  const fetchAlreadyStocked = useCallback(async () => {
    try {
      const response = await apiClient.get<{ stockedItems?: StockedItem[] }>(
        "/api/already-stocked"
      );
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

    if (!newItem.name.trim()) {
      setError("Item name cannot be empty");
      return;
    }

    if (newItem.quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    if (!newItem.unit.trim()) {
      setError("Unit cannot be empty");
      return;
    }

    setStocked([...stocked, newItem]);
    setNewItem({ name: "", quantity: 0, unit: "" });
    setError(null);
  };

  const handleDeleteItem = (index: number) => {
    setStocked(stocked.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: keyof StockedItem,
    value: any
  ) => {
    const updated = [...stocked];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? parseFloat(value) || 0 : value,
    };
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
            placeholder="Item name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="already-stocked-input"
          />
        </div>
        <div className="form-group">
          <input
            type="number"
            placeholder="Qty"
            value={newItem.quantity || ""}
            onChange={(e) =>
              setNewItem({
                ...newItem,
                quantity: parseFloat(e.target.value) || 0,
              })
            }
            className="already-stocked-input quantity"
            step="0.1"
          />
        </div>
        <div className="form-group">
          <input
            type="text"
            placeholder="Unit (cups, tbsp, etc)"
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
            className="already-stocked-input"
          />
        </div>
        <button type="submit" className="add-stocked-btn">
          Add
        </button>
      </form>

      <div className="already-stocked-list">
        {stocked.length === 0 ? (
          <p className="no-stocked">No items added yet. Add one above!</p>
        ) : (
          stocked.map((item, index) => (
            <div key={index} className="stocked-item">
              <div className="stocked-details">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    handleUpdateItem(index, "name", e.target.value)
                  }
                  className="stocked-edit-input"
                />
                <div className="stocked-qty-unit">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateItem(
                        index,
                        "quantity",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="stocked-edit-input qty"
                    step="0.1"
                  />
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) =>
                      handleUpdateItem(index, "unit", e.target.value)
                    }
                    className="stocked-edit-input unit"
                  />
                </div>
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
