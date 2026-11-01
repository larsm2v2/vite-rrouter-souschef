import React, { useMemo, useState } from "react";
import "../InputField/InputField.css";
import { ListItem } from "../../../types";
import SingleListItem from "../SingleListItem/SingleListItem";
import { useToast } from "../../common/Toast";
import { useUndoable } from "../../../hooks/useUndoable";
import { AISLES, aisleFor, isAisle } from "../../../utils/aisles";
import { mergeIntoList } from "../../../utils/groceryAdapter";

interface Props {
  listItems: ListItem[];
  setListItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
}

const IN_CART = "In cart";

const emptyItem = (): ListItem => ({
  id: Date.now(),
  quantity: 0,
  unit: "",
  listItem: "",
  isDone: false,
  toTransfer: false,
});

const EditableList: React.FC<Props> = ({ listItems, setListItems }: Props) => {
  const { showToast } = useToast();
  const undoable = useUndoable();
  const [newItem, setNewItem] = useState<ListItem>(emptyItem);

  const handleDelete = (id: number) => {
    const index = listItems.findIndex((item) => item.id === id);
    const removed = listItems[index];
    if (!removed) return;
    undoable({
      message: `Removed ${removed.listItem}`,
      apply: () =>
        setListItems((prev) => prev.filter((item) => item.id !== id)),
      revert: () =>
        setListItems((prev) => {
          if (prev.some((item) => item.id === id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        }),
    });
  };

  const handleEdit = (id: number, updatedItem: ListItem) => {
    setListItems((prev) =>
      prev.map((item) => (item.id === id ? updatedItem : item)),
    );
  };

  const handleDone = (id: number) => {
    setListItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDone: !item.isDone } : item,
      ),
    );
  };

  const handleAddAndConsolidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.listItem.trim() !== "" && newItem.quantity > 0) {
      const { listItem, quantity, unit } = newItem;
      setListItems((prev) =>
        mergeIntoList(prev, [{ name: listItem, quantity, unit }]),
      );
      setNewItem(emptyItem());
    } else {
      showToast("Please enter a valid quantity and item name.", "error");
    }
  };

  const sections = useMemo(() => {
    const open = new Map<string, ListItem[]>();
    const done: ListItem[] = [];
    for (const item of listItems) {
      if (item.isDone) {
        done.push(item);
        continue;
      }
      const aisle = isAisle(item.aisle) ? item.aisle : aisleFor(item.listItem);
      open.set(aisle, [...(open.get(aisle) ?? []), item]);
    }
    const ordered = AISLES.filter((a) => open.has(a)).map(
      (a) => [a as string, open.get(a)!] as const,
    );
    return done.length > 0 ? [...ordered, [IN_CART, done] as const] : ordered;
  }, [listItems]);

  return (
    <div className="todos">
      <form className="grocery-list__add" onSubmit={handleAddAndConsolidate}>
        <input
          className="grocery-list__add__box grocery-list__add__box--quantity input__box input__box--quantity"
          type="number"
          min="0"
          step="any"
          placeholder="Quantity"
          aria-label="Quantity"
          value={newItem.quantity}
          onChange={(e) =>
            setNewItem((prev) => ({
              ...prev,
              quantity: Number(e.target.value),
            }))
          }
        />
        <input
          className="grocery-list__add__box grocery-list__add__box--unit input__box input__box--unit"
          type="text"
          placeholder="Unit"
          aria-label="Unit"
          value={newItem.unit}
          onChange={(e) =>
            setNewItem((prev) => ({ ...prev, unit: e.target.value }))
          }
        />
        <input
          className="grocery-list__add__box grocery-list__add__box--item input__box input__box--item"
          type="text"
          placeholder="Item Name"
          aria-label="Grocery item"
          value={newItem.listItem}
          onChange={(e) =>
            setNewItem((prev) => ({ ...prev, listItem: e.target.value }))
          }
        />
        <button
          className="grocery-list__add__submit input__submit"
          type="submit"
        >
          Go
        </button>
      </form>

      {sections.map(([title, items]) => (
        <section key={title} className="grocery-aisle" aria-label={title}>
          <h3 className="grocery-aisle__title">
            {title} <span className="grocery-aisle__count">{items.length}</span>
          </h3>
          {items.map((listItem) => (
            <SingleListItem
              listItem={listItem}
              key={listItem.id}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDone={handleDone}
            />
          ))}
        </section>
      ))}
    </div>
  );
};

export default EditableList;
