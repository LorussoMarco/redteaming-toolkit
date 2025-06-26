import React from 'react';
import { Link } from 'react-router-dom';
import '../assets/css/ToolCard.css';

const ToolCard = ({ name, description, phaseId, icon }) => {
  // Valori predefiniti per evitare errori se le props sono null o undefined
  const safeName = name || 'Unknown Tool';
  const safeDescription = description || 'No description available';
  const safePhaseId = phaseId || 'unknown';

  return (
    <div className="tool-card">
      <div className="tool-card-icon">
        {icon || <i className="fas fa-tools"></i>}
      </div>
      <div className="tool-card-content">
        <h3 className="tool-card-title">{safeName}</h3>
        <p className="tool-card-description">{safeDescription}</p>
        <Link to={`/${safePhaseId}/${safeName.toLowerCase()}`} className="tool-card-button">
          Open Tool
        </Link>
      </div>
    </div>
  );
};

export default ToolCard; 