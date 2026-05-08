import React from 'react';
import './UI.css';

export function Btn({ children, variant='default', size='md', onClick, disabled, type='button', full }) {
  return <button type={type} className={`btn btn-${variant} btn-${size}${full?' btn-full':''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Card({ children, className='', style }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function Badge({ status }) {
  const m = { pending:'amber', approved:'green', denied:'red', expired:'gray', open:'blue', closed:'gray', published:'green', draft:'gray', trial:'amber', starter:'blue', growth:'green', enterprise:'gray' };
  return <span className={`badge badge-${m[status]||'gray'}`}>{status}</span>;
}

export function Avatar({ name='', color='#e8f0fc', textColor='#1a5fb4', size='md' }) {
  const ini = name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  return <div className={`avatar avatar-${size}`} style={{background:color,color:textColor}}>{ini}</div>;
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color?{color}:{}}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function FormRow({ label, hint, children }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type='text', required, disabled, className='' }) {
  return <input className={`form-input ${className}`} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} />;
}

export function Select({ value, onChange, children, required }) {
  return <select className="form-input form-select" value={value} onChange={onChange} required={required}>{children}</select>;
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-msg">{message}</div>
      {action && <div style={{marginTop:16}}>{action}</div>}
    </div>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} onClick={onClose}>{toast.msg}</div>;
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner"></div>;
}

export function LoadingScreen({ message='Loading…' }) {
  return <div className="loading-screen"><Spinner /><span>{message}</span></div>;
}
