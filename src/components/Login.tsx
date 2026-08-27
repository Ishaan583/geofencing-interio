import React, { useState, useEffect } from 'react';
import { Shield, Lock, User, UserPlus, LogIn } from 'lucide-react';
import { addUser, getUser, getUsers, addSupervisor, seedPastLogsForSupervisor } from '../db/indexedDB';
import type { UserAccount } from '../db/indexedDB';
import { CameraFeed } from './CameraFeed';

interface LoginProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Supervisor Face ID registration states during Sign Up
  const [willBeSupervisor, setWillBeSupervisor] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[]>([]);
  const [cameraStatusText, setCameraStatusText] = useState<string>('Ready to scan');

  // Check if registrant will be supervisor when opening Sign Up
  useEffect(() => {
    async function checkNextUserRole() {
      try {
        const allUsers = await getUsers();
        const hasAdmin = allUsers.some(u => u.role === 'admin');
        setWillBeSupervisor(hasAdmin);
      } catch (err) {
        console.error(err);
      }
    }
    if (isSignUp) {
      checkNextUserRole();
      // Reset camera states
      setCapturedPhoto(null);
      setFaceDescriptor([]);
    }
  }, [isSignUp]);

  const handleSelfieCaptured = (imageSrc: string, descriptor: number[]) => {
    setCapturedPhoto(imageSrc);
    setFaceDescriptor(descriptor);
    setCameraStatusText(descriptor.length > 0 ? 'Face scan successful!' : 'Face captured with warning (low lighting).');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const formattedUsername = username.trim().toLowerCase();
    const formattedName = name.trim();

    if (!formattedUsername || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up Flow
        if (!formattedName) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        if (password.length < 4) {
          setError('Password must be at least 4 characters long.');
          setLoading(false);
          return;
        }

        // Force face profile capture for supervisors
        if (willBeSupervisor) {
          if (!capturedPhoto) {
            setError('Please capture your Face ID profile photo to register.');
            setLoading(false);
            return;
          }
          if (faceDescriptor.length === 0) {
            setError('No face detected in the photo. Please align your face clearly in the camera frame.');
            setLoading(false);
            return;
          }
        }

        const existingUser = await getUser(formattedUsername);
        if (existingUser) {
          setError('Username is already taken.');
          setLoading(false);
          return;
        }

        // Determine role: If there is no admin in the database, this user becomes Admin. Otherwise, Supervisor.
        const allUsers = await getUsers();
        const hasAdmin = allUsers.some(u => u.role === 'admin');
        const role = !hasAdmin ? 'admin' : 'supervisor';
        let supervisorId: string | undefined = undefined;

        if (role === 'supervisor') {
          // Register as supervisor in IndexedDB supervisors list with face profile
          supervisorId = `sup-${Date.now()}`;
          await addSupervisor({
            id: supervisorId,
            name: formattedName,
            referenceFaceDescriptor: faceDescriptor.length > 0 ? faceDescriptor : null,
            referenceImage: capturedPhoto,
          });
          
          // Seed past logs for calendar testing!
          await seedPastLogsForSupervisor(supervisorId, formattedName, capturedPhoto);
        }

        const newUser: UserAccount = {
          username: formattedUsername,
          name: formattedName,
          password,
          role,
          supervisorId,
        };

        await addUser(newUser);
        
        // Log in automatically after registration
        onLoginSuccess(newUser);
      } else {
        // Sign In Flow
        const user = await getUser(formattedUsername);
        if (!user || user.password !== password) {
          setError('Invalid username or password.');
          setLoading(false);
          return;
        }

        onLoginSuccess(user);
      }
    } catch (err) {
      console.error(err);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      padding: '1.5rem'
    }}>
      <div className="glass-card animate-fade-in" style={{
        width: '100%',
        maxWidth: isSignUp && willBeSupervisor ? '480px' : '400px', // Expand box if camera is active
        padding: '2rem 1.75rem',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        transition: 'max-width 0.3s ease-in-out'
      }}>
        
        {/* Brand Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #4f46e5 100%)',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem auto',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
          }}>
            <Shield style={{ color: '#ffffff' }} size={22} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-heading)', color: '#0f172a' }}>SiteShield AI</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Biometric Location Verification & Attendance Portal
          </p>
        </div>

        {/* Auth Mode Switch Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.03)',
          padding: '0.25rem',
          borderRadius: '8px',
          marginBottom: '1.25rem'
        }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: !isSignUp ? '#ffffff' : 'transparent',
              color: !isSignUp ? 'var(--color-primary)' : 'var(--text-secondary)',
              boxShadow: !isSignUp ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: isSignUp ? '#ffffff' : 'transparent',
              color: isSignUp ? 'var(--color-primary)' : 'var(--text-secondary)',
              boxShadow: isSignUp ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Roles Hint Banner */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.05)',
          border: '1px solid rgba(99, 102, 241, 0.1)',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          textAlign: 'center',
          marginBottom: '1.25rem'
        }}>
          {isSignUp ? (
            willBeSupervisor ? (
              <span>📷 Sign up as **Supervisor** (Face profile setup required)</span>
            ) : (
              <span>💡 Registering first user: **Company Admin** account</span>
            )
          ) : (
            <span>🔑 Log in to access your dashboard or mobile attendance feed</span>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          
          {isSignUp && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <User size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="e.g. ramesh"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
              <User size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
              />
              <Lock size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {isSignUp && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <Lock size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
          )}

          {/* Supervisor Camera Profile Capture Block */}
          {isSignUp && willBeSupervisor && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                Face Scan Enrolment (Required)
              </label>
              {!capturedPhoto ? (
                <CameraFeed
                  onCapture={handleSelfieCaptured}
                  statusText={cameraStatusText}
                  setStatusText={setCameraStatusText}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', background: 'rgba(16, 185, 129, 0.04)', border: '1px dashed var(--color-emerald)', padding: '0.75rem', borderRadius: '12px' }}>
                  <div style={{ width: '140px', height: '105px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--color-emerald)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Enrolled profile photo" />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ✓ Facial Scan Saved
                  </span>
                  <button type="button" onClick={() => setCapturedPhoto(null)} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem' }}>
                    Retake Scan
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--color-rose)', fontSize: '0.75rem', margin: '0.25rem 0 0 0', textAlign: 'center' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary pulse-primary"
            style={{ width: '100%', padding: '0.7rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}
            disabled={loading}
          >
            {isSignUp ? <UserPlus size={15} /> : <LogIn size={15} />}
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
