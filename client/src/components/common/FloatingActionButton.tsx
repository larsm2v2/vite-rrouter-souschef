import React from "react";
import "./FloatingActionButton.css";

interface Props {
  onOpen: () => void;
}

export default function FloatingActionButton({ onOpen }: Props) {
  return (
    <button
      aria-label="Create Recipe"
      className="fab-button"
      onClick={onOpen}
      title="Add (Recipe via OCR/Text)"
    >
      <span className="fab-plus">+</span>
    </button>
  );
}
