import React from 'react';
import { Shield, LayoutDashboard, UserCheck, LogOut, User } from 'lucide-react';
import type { UserAccount } from '../db/indexedDB';

interface SidebarProps {
  activeView: 'admin' | 'supervisor';
  onViewChange: (view: 'admin' | 'supervisor') => void;
  currentUser: UserAccount;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  currentUser,
  onSignOut,
}) => {
  const isAdmin = currentUser.role === 'admin';

  return (
    <div
      style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.75rem 1.25rem',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--color-primary-glow)',
          }}
        >
          <Shield size={22} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', lineHeight: '1.1' }}>
            SiteShield
          </h1>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            AI Geofence GPS
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {isAdmin && (
          <button
            onClick={() => onViewChange('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              background: activeView === 'admin' ? 'var(--color-primary)' : 'transparent',
              color: activeView === 'admin' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeView === 'admin' ? '0 4px 12px var(--color-primary-glow)' : 'none',
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'admin') {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'admin') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <LayoutDashboard size={18} />
            Admin Dashboard
          </button>
        )}

        {!isAdmin && (
          <button
            onClick={() => onViewChange('supervisor')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              background: activeView === 'supervisor' ? 'var(--color-primary)' : 'transparent',
              color: activeView === 'supervisor' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeView === 'supervisor' ? '0 4px 12px var(--color-primary-glow)' : 'none',
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'supervisor') {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'supervisor') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <UserCheck size={18} />
            Check-in Portal
          </button>
        )}
      </div>

      {/* User Session Profile widget */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: 'rgba(0,0,0,0.04)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={16} className="text-secondary" />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {currentUser.role}
            </div>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            border: '1px solid var(--border-color)',
            borderRadius: '8px'
          }}
        >
          <LogOut size={12} />
          Sign Out
        </button>
      </div>

      {/* Footer Branding */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        v1.0.0 • Client AI Face
      </div>
    </div>
  );
};
