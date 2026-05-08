import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useData';
import { Avatar } from './UI';

const EMP_NAV = [
  { to: '/dashboard',      label: 'Dashboard',       icon: '▦' },
  { to: '/schedule',       label: 'My Schedule',      icon: '📅' },
  { to: '/available',      label: 'Available Shifts', icon: '🔓' },
  { to: '/requests',       label: 'My Requests',      icon: '📋' },
  { to: '/notifications',  label: 'Notifications',    icon: '🔔', notif: true },
];

const MGR_NAV = [
  { to: '/manager/dashboard',     label: 'Dashboard',        icon: '▦' },
  { to: '/manager/schedule',      label: 'Schedule Builder',  icon: '📅' },
  { to: '/manager/requests',      label: 'Shift Requests',    icon: '📋' },
  { to: '/manager/employees',     label: 'Employees',         icon: '👥' },
  { to: '/manager/notifications', label: 'Notifications',     icon: '🔔', notif: true },
  { to: '/billing',               label: 'Billing',           icon: '💳' },
];

export default function Sidebar() {
  const { profile, org, signOut, isManager } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const nav = isManager ? MGR_NAV : EMP_NAV;

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function handleSignOut() { await signOut(); navigate('/login'); }

  return (
    <>
      <div className="mobile-topbar">
        <div className="mobile-logo">Schedu<span>Forge</span></div>
        <button className="hamburger" onClick={() => setOpen(o => !o)}>{open ? '✕' : '☰'}</button>
      </div>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-text">Schedu<span className="logo-accent">Forge</span></span>
          <span className="logo-badge">{isManager ? 'manager' : 'employee'}</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          {nav.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.notif && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-row">
            <Avatar name={profile?.name} color={profile?.avatar_color} textColor={profile?.avatar_text_color} size="md" />
            <div className="user-info">
              <div className="user-name">{profile?.name}</div>
              <div className="user-dept">{org?.name}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>
    </>
  );
}
