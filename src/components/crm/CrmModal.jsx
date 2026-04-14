import React from 'react';
import './crmOverlay.css';

const CrmModal = ({ isOpen, title, children, onClose, onConfirm, confirmText = "Confirmar", confirmColor = "#0088cc" }) => {
  if (!isOpen) return null;

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-card" onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <h3>{title}</h3>
          <button className="crm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="crm-modal-body">
          {children}
        </div>
        <div className="crm-modal-footer">
          <button className="crm-btn-secondary" onClick={onClose}>Cancelar</button>
          {onConfirm && (
            <button 
              className="crm-btn-primary" 
              style={{ backgroundColor: confirmColor }} 
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrmModal;
