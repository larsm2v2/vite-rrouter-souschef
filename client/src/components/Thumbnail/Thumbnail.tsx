import React from 'react';
import './Thumbnail.css';

interface ThumbnailProps {
  pattern: number[];
  onClick?: () => void;
  gridSize?: number;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ pattern, onClick, gridSize = 5 }) => {
  const cells = [];
  for (let i = 1; i <= gridSize * gridSize; i++) {
    const isOn = pattern.includes(i);
    cells.push(
      <div key={i} className={`thumbnail-cell ${isOn ? 'on' : 'off'}`} />
    );
  }

  return (
    <div className="thumbnail-container" onClick={onClick}>
      <div className="thumbnail-grid">{cells}</div>
    </div>
  );
};

export default Thumbnail; 