import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/Dashboard';
import { SupervisorView } from './components/Supervisor';
import { Login } from './components/Login';
import { seedInitialData } from './db/indexedDB';
import type { UserAccount } from './db/indexedDB';

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeView, setActiveView] = useState<'admin' | 'supervisor'>('supervisor');
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function setupDB() {
      try {
        await seedInitialData();
        setDbReady(true);

        // Check if user session exists in localStorage
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const user = JSON.parse(storedUser) as UserAccount;
          setCurrentUser(user);
          setActiveView(user.role === 'admin' ? 'admin' : 'supervisor');
        }
      } catch (err) {
        console.error('Error seeding IndexedDB:', err);
      }
    }
    setupDB();
  }, []);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    // Default admin to Admin Dashboard, supervisor to Check-in Portal
    setActiveView(user.role === 'admin' ? 'admin' : 'supervisor');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setActiveView('supervisor');
  };

  if (!dbReady) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(0,0,0,0.08)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Initializing Database Ledger...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If no user is logged in, show the Login screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />
      
      <main className="main-content">
        {activeView === 'admin' && currentUser.role === 'admin' ? (
          <DashboardView />
        ) : (
          <SupervisorView currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default App;
