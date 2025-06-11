import React, { useState } from "react"
import "../InputField/InputField.css"
import { ListItem } from "../../Models/Models"
import SingleListItem from "../SingleListItem/SingleListItem"

interface Props {
	listItems: ListItem[]
	setListItems: React.Dispatch<React.SetStateAction<ListItem[]>>
}

const EditableList: React.FC<Props> = ({ listItems, setListItems }: Props) => {
	// State to manage the new list item being added
	const [newItem, setNewItem] = useState<ListItem>({
		id: Date.now(),
		quantity: 0,
		unit: "",
		listItem: "",
		isDone: false,
		toTransfer: false,
	})

	const handleDelete = (id: number) => {
		setListItems(listItems.filter((item) => item.id !== id))
	}

	const handleEdit = (id: number, updatedItem: ListItem) => {
		setListItems(
			listItems.map((item) => (item.id === id ? updatedItem : item))
		)
	}

	const handleDone = (id: number) => {
		setListItems((prevListItems) =>
			prevListItems.map((item) =>
				item.id === id ? { ...item, isDone: !item.isDone } : item
			)
		)
	}

	const handleAddAndConsolidate = (e: React.FormEvent) => {
		e.preventDefault()
		// Form validation: Ensure quantity is a positive number
		if (newItem.listItem.trim() !== "" && newItem.quantity > 0) {
			const normalizedNewItemUnit = newItem.unit.endsWith("s")
				? newItem.unit.slice(0, -1)
				: newItem.unit

			const existingItemIndex = listItems.findIndex(
				(item) =>
					item.listItem === newItem.listItem &&
					item.unit.replace(/s$/, "") === normalizedNewItemUnit
			)

			if (existingItemIndex !== -1) {
				setListItems((prevItems) => {
					const updatedItems = [...prevItems]
					updatedItems[existingItemIndex].quantity += newItem.quantity
					return updatedItems
				})
			} else {
				setListItems((prevItems) => [...prevItems, newItem])
			}
			setNewItem({
				id: Date.now(),
				quantity: 0,
				unit: "",
				listItem: "",
				isDone: false,
				toTransfer: false,
			})
		} else {
			// Handle invalid input (e.g., show an error message)
			alert("Please enter a valid quantity and item name.")
		}
	}

	return (
		<div className="todos">
			{/* Input field (always visible) */}
			<form className="input" onSubmit={handleAddAndConsolidate}>
				<input
					className="input__box"
					type="number"
					min="0"
					placeholder="Quantity"
					value={newItem.quantity}
					onChange={(e) =>
						setNewItem((prev) => ({
							...prev,
							quantity: Number(e.target.value),
						}))
					}
				/>
				<input
					className="input__box"
					type="text"
					placeholder="Unit"
					value={newItem.unit}
					onChange={(e) =>
						setNewItem((prev) => ({
							...prev,
							unit: e.target.value,
						}))
					}
				/>
				<input
					className="input__box"
					type="text"
					placeholder="Item Name"
					value={newItem.listItem}
					onChange={(e) =>
						setNewItem((prev) => ({
							...prev,
							listItem: e.target.value,
						}))
					}
				/>
				<button className="input__submit" type="submit">
					Go
				</button>
			</form>

			{/* Display the list items */}
			{listItems.map((listItem) => (
				<SingleListItem
					listItem={listItem}
					key={listItem.id}
					onDelete={handleDelete}
					onEdit={handleEdit}
					onDone={handleDone}
				/>
			))}
		</div>
	)
}

export default EditableList
