import React from "react"
import "./Sidebar.css"
import ShoppingList from "../ShoppingList/ShoppingList"

interface SidebarProps {
	selectedRecipeIds: string[]
}

const Sidebar: React.FC<SidebarProps> = ({ selectedRecipeIds }) => {
	return (
		<div className="sidebar-content">
			<ShoppingList selectedRecipeIds={selectedRecipeIds} />
		</div>
	)
}

export default Sidebar
