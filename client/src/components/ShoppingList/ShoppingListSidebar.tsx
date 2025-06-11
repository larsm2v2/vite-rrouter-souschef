import React from "react"
import ShoppingList from "./ShoppingList" // Your existing shopping list component

interface ShoppingListSidebarProps {
	selectedRecipeIds: string[]
	isOpen: boolean
	onClose: () => void
}

const ShoppingListSidebar: React.FC<ShoppingListSidebarProps> = ({
	isOpen,
	onClose,
	selectedRecipeIds,
}) => {
	return (
		<div className={`shopping-list-sidebar ${isOpen ? "open" : ""}`}>
			<div className="sidebar-header">
				<button onClick={onClose}>Close</button>
			</div>
			<div className="sidebar-content">
				<ShoppingList selectedRecipeIds={selectedRecipeIds} />
			</div>
		</div>
	)
}

export default ShoppingListSidebar
