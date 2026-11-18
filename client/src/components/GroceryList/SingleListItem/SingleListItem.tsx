import React, { useState } from "react";
import { ListItem } from "../../../types";
import { MdEdit, MdDeleteForever, MdDone } from "../../../assets/MdAssets";
import { AISLES, aisleFor, isAisle } from "../../../utils/aisles";
import { formatNumber } from "../../../utils/recipeMath/quantity";
import "../InputField/InputField.css";

interface SingleListItemProps {
  listItem: ListItem;
  onDelete: (id: number) => void;
  onEdit: (id: number, updatedItem: ListItem) => void;
  onDone: (id: number) => void;
  onAddStaple?: (name: string) => void;
}

const SingleListItem: React.FC<SingleListItemProps> = ({
  listItem,
  onDelete,
  onEdit,
  onDone,
  onAddStaple,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(listItem);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEdit(listItem.id, editedItem);
    setIsEditing(false);
  };

  return (
    <form className="grocery-list__item" onSubmit={handleEditSubmit}>
      {isEditing ? (
        <>
          <input
            className="grocery-list__item__box grocery-list__item__box--quantity input__box"
            type="number"
            min="0"
            value={editedItem.quantity}
            onChange={(e) =>
              setEditedItem((prev) => ({
                ...prev,
                quantity: Number(e.target.value),
              }))
            }
          />
          <input
            className="grocery-list__item__box grocery-list__item__box--unit input__box"
            type="text"
            value={editedItem.unit}
            onChange={(e) =>
              setEditedItem((prev) => ({
                ...prev,
                unit: e.target.value,
              }))
            }
          />
          <input
            className="grocery-list__item__box grocery-list__item__box--item input__box"
            type="text"
            value={editedItem.listItem}
            onChange={(e) =>
              setEditedItem((prev) => ({
                ...prev,
                listItem: e.target.value,
              }))
            }
          />
          <select
            className="grocery-list__item__box grocery-list__item__aisle input__box"
            aria-label="Aisle"
            value={
              isAisle(editedItem.aisle)
                ? editedItem.aisle
                : aisleFor(editedItem.listItem)
            }
            onChange={(e) =>
              setEditedItem((prev) => ({ ...prev, aisle: e.target.value }))
            }
          >
            {AISLES.map((aisle) => (
              <option key={aisle} value={aisle}>
                {aisle}
              </option>
            ))}
          </select>
          <button
            className="grocery-list__item__submit input__submit"
            type="submit"
          >
            Go
          </button>
        </>
      ) : (
        <>
          <span
            className={`grocery-list__item__text listItems__single--text ${
              listItem.isDone ? "done" : ""
            }`}
          >
            {[
              listItem.quantity > 0 ? formatNumber(listItem.quantity) : "",
              listItem.unit,
              listItem.listItem,
            ]
              .filter((part) => part !== "")
              .join(" ")}
          </span>
          <div className="grocery-list__item__actions">
            {onAddStaple && (
              <button
                type="button"
                className="grocery-list__item__icon icon"
                onClick={() => onAddStaple(listItem.listItem)}
                aria-label={`Add ${listItem.listItem} to staples`}
                title="Add to staples (Already Stocked)"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  <path d="M12 7v6M9 10h6" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="grocery-list__item__icon icon"
              onClick={handleEditClick}
              aria-label={`Edit ${listItem.listItem}`}
            >
              <MdEdit />
            </button>
            <button
              type="button"
              className="grocery-list__item__icon icon"
              onClick={() => onDelete(listItem.id)}
              aria-label={`Delete ${listItem.listItem}`}
            >
              <MdDeleteForever />
            </button>
            <button
              type="button"
              className="grocery-list__item__icon icon"
              onClick={() => onDone(listItem.id)}
              aria-label={
                listItem.isDone
                  ? `Mark ${listItem.listItem} not done`
                  : `Mark ${listItem.listItem} done`
              }
            >
              <MdDone />
            </button>
          </div>
        </>
      )}
    </form>
  );
};

export default SingleListItem;
