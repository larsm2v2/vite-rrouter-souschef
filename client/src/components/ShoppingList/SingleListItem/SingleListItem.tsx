import React, { useState } from "react"
import { ListItem } from "../../Models/Models"
import { MdEdit, MdDeleteForever, MdDone } from "../../../assets/MdAssets"
import "../InputField/InputField.css"

interface SingleListItemProps {
	listItem: ListItem
	onDelete: (id: number) => void
	onEdit: (id: number, updatedItem: ListItem) => void
	onDone: (id: number) => void
}

const SingleListItem: React.FC<SingleListItemProps> = ({
	listItem,
	onDelete,
	onEdit,
	onDone,
}) => {
	const [isEditing, setIsEditing] = useState(false)
	const [editedItem, setEditedItem] = useState(listItem)

	const handleEditClick = () => {
		setIsEditing(true)
	}

	const handleEditSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onEdit(listItem.id, editedItem)
		setIsEditing(false)
	}

	return (
		<form className="input" onSubmit={handleEditSubmit}>
			{isEditing ? (
				<>
					<input
						className="input__box"
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
						className="input__box"
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
						className="input__box"
						type="text"
						value={editedItem.listItem}
						onChange={(e) =>
							setEditedItem((prev) => ({
								...prev,
								listItem: e.target.value,
							}))
						}
					/>
					<button className="input__submit" type="submit">
						Go
					</button>
				</>
			) : (
				<>
					<span
						className={`listItems__single--text ${
							listItem.isDone ? "done" : ""
						}`}
					>
						{listItem.quantity} {listItem.unit} {listItem.listItem}
					</span>
					<div>
						<span className="icon" onClick={handleEditClick}>
							<MdEdit />
						</span>
						<span
							className="icon"
							onClick={() => onDelete(listItem.id)}
						>
							<MdDeleteForever />
						</span>
						<span
							className="icon"
							onClick={() => onDone(listItem.id)}
						>
							<MdDone />
						</span>
					</div>
				</>
			)}
		</form>
	)
}

export default SingleListItem
