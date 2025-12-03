import React from "react";
import GroceryList from "./GroceryList"; // Your existing grocery list component

interface GroceryListSidebarProps {
  selectedRecipeIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

const GroceryListSidebar: React.FC<GroceryListSidebarProps> = ({
  isOpen,
  onClose,
  selectedRecipeIds,
}) => {
  return (
    <div className={`grocery-list-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <button onClick={onClose}>Close</button>
      </div>
      <div className="sidebar-content">
        <GroceryList selectedRecipeIds={selectedRecipeIds} />
      </div>
    </div>
  );
};

export default GroceryListSidebar;
