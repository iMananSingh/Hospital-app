import React from 'react';
import { FakeBillDialogProps } from '../types';

export function FakeBillDialog({ isOpen, onClose }: FakeBillDialogProps) {
  return (
    <>
      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Fake Bill Dialog</h2>
            <p>This is a placeholder for the actual bill dialog.</p>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}