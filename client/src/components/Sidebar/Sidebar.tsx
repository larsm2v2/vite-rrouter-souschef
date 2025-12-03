import React from "react";
import "./Sidebar.css";
import GroceryList from "../GroceryList/GroceryList";

interface SidebarProps {
  selectedRecipeIds: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ selectedRecipeIds }) => {
  return (
    <div className="sidebar-content">
      <GroceryList selectedRecipeIds={selectedRecipeIds} />
    </div>
  );
};

export default Sidebar;
