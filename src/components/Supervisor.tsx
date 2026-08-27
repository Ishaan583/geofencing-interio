import React, { useState, useEffect } from 'react';
import { User, MapPin, Shield, CheckCircle, AlertTriangle, Clock, RefreshCcw } from 'lucide-react';
import { getSupervisors, updateSupervisorFace, addCheckIn, getCheckIns } from '../db/indexedDB';
import type { Supervisor, UserAccount, CheckInLog } from '../db/indexedDB';
import { CITY_PRESETS, getDistanceInMeters, reverseGeocode } from '../services/geoService';
import { compareFaceDescriptors } from '../services/faceService';
import { CameraFeed } from './CameraFeed';
import { AttendanceCalendar } from './AttendanceCalendar';

interface SupervisorViewProps {
  currentUser: UserAccount;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({ currentUser }) => {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  
  // Selection
  const [selectedSupId, setSelectedSupId] = useState<string>('');
  const [selectedSup, setSelectedSup] = useState<Supervisor | null>(null);

  // Geolocation state (defaults to Bhopal city center coordinates)
  const [simLat, setSimLat] = useState<number>(23.2599);
  const [simLng, setSimLng] = useState<number>(77.4126);
  const [locationPreset, setLocationPreset] = useState<string>('Bhopal (MP)');

  // Time simulation state (for testing attendance windows)
  const [simTimeOffset, setSimTimeOffset] = useState<string>('real');

  // Capture & face matching state
  const [statusText, setStatusText] = useState<string>('Select your profile to begin');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceScore, setFaceScore] = useState<number | null>(null);
  const [faceVerified, setFaceVerified] = useState<'matched' | 'mismatched' | 'not_verified'>('not_verified');

  // Interactive flow states
  const [checkInSuccess, setCheckInSuccess] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(7200); // 2 hours in seconds
  const [isFaceRegistered, setIsFaceRegistered] = useState<boolean>(false);

  // Fetch initial data
  const loadLogs = async () => {
    try {
      const lgs = await getCheckIns();
      setLogs(lgs);
    } catch (err) {
      console.error('Failed to load checkins in supervisor view:', err);
    }
  };

  useEffect(() => {
    async function loadData() {
      const sups = await getSupervisors();
      setSupervisors(sups);
      
      // Auto select supervisor profile based on login
      if (currentUser.role === 'supervisor' && currentUser.supervisorId) {
        setSelectedSupId(currentUser.supervisorId);
      } else if (sups.length > 0) {
        setSelectedSupId(sups[0].id);
      }
      
      await loadLogs();
    }
    loadData();
  }, [currentUser]);

  // Update selected supervisor
  useEffect(() => {
    if (!selectedSupId) return;
    const sup = supervisors.find(s => s.id === selectedSupId) || null;
    setSelectedSup(sup);
    
    if (sup) {
      setIsFaceRegistered(!!sup.referenceFaceDescriptor);
      
      // Default to their assigned site coordinates on profile select
      setSimLat(sup.assignedLatitude || 23.2300);
      setSimLng(sup.assignedLongitude || 77.4300);
      setLocationPreset('My Assigned Work Site');

      // Reset capture and check-in success states when changing supervisor
      setCapturedPhoto(null);
      setFaceScore(null);
      setFaceVerified('not_verified');
      setCheckInSuccess(false);
      setStatusText(sup.referenceFaceDescriptor ? 'Face ID enrolled. Ready for selfie check-in.' : 'No Face ID profile. Enroll your face.');
    }
  }, [selectedSupId, supervisors]);

  // Attempt to acquire actual GPS coordinates on supervisor load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSimLat(position.coords.latitude);
          setSimLng(position.coords.longitude);
          setLocationPreset('My Actual GPS Location');
        },
        () => {
          console.log('Location access declined, keeping default Bhopal presets.');
        }
      );
    }
  }, [selectedSupId]);

  // Enforce periodic timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLocationPresetChange = (name: string) => {
    setLocationPreset(name);
    if (name === 'My Assigned Work Site' && selectedSup) {
      setSimLat(selectedSup.assignedLatitude || 23.2300);
      setSimLng(selectedSup.assignedLongitude || 77.4300);
      return;
    }
    const preset = CITY_PRESETS.find(p => p.name === name);
    if (preset) {
      setSimLat(preset.latitude);
      setSimLng(preset.longitude);
    }
  };

  const fetchActualLocation = () => {
    setStatusText('Acquiring actual GPS coordinates...');
    if (!navigator.geolocation) {
      setStatusText('Geolocation is not supported by your browser.');
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setSimLat(lat);
        setSimLng(lng);
        setLocationPreset('Actual Live Coordinates');
        setStatusText(`GPS acquired: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      },
      (error) => {
        console.error(error);
        setStatusText(`GPS Error: ${error.message}`);
        alert(`Could not acquire GPS: ${error.message}. Please enable location access in browser settings.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleSelfieCaptured = async (imageSrc: string, descriptor: number[]) => {
    if (!selectedSup) return;

    setCapturedPhoto(imageSrc);

    // If no face was detected (descriptor is empty)
    if (descriptor.length === 0) {
      setFaceScore(null);
      setFaceVerified('not_verified');
      setStatusText('No face detected in photo. Biometric check-in is blocked.');
      return;
    }

    // Case 1: First-time face registration
    if (!isFaceRegistered) {
      try {
        await updateSupervisorFace(selectedSup.id, descriptor, imageSrc);
        setIsFaceRegistered(true);
        // Update local state supervisor object
        setSupervisors(prev => prev.map(s => s.id === selectedSup.id ? { ...s, referenceFaceDescriptor: descriptor, referenceImage: imageSrc } : s));
        setFaceVerified('matched');
        setStatusText('Reference Face Profile Saved! You can now check in.');
      } catch (err) {
        console.error(err);
        setStatusText('Failed to save face profile.');
      }
    } 
    // Case 2: Subsequent face verification
    else if (selectedSup.referenceFaceDescriptor) {
      const matchResult = compareFaceDescriptors(descriptor, selectedSup.referenceFaceDescriptor);
      
      setFaceScore(matchResult.confidence);
      
      if (matchResult.isMatch) {
        setFaceVerified('matched');
        setStatusText(`Verified! Face matched (${matchResult.confidence}% confidence).`);
      } else {
        setFaceVerified('mismatched');
        setStatusText(`Face MISMATCH (${matchResult.confidence}% similarity). Try again.`);
      }
    }
  };

  // Helper to compute a simulated check-in timestamp based on selected offset
  const getSimulatedTimestamp = () => {
    if (simTimeOffset === 'real') return Date.now();
    
    const date = new Date();
    if (simTimeOffset === 'morning') {
      date.setHours(10, 15, 0, 0); // 10:15 AM
    } else if (simTimeOffset === 'lunch') {
      date.setHours(14, 15, 0, 0); // 2:15 PM (Half Day Window)
    } else if (simTimeOffset === 'evening') {
      date.setHours(19, 15, 0, 0); // 7:15 PM
    }
    return date.getTime();
  };

  const submitCheckInLog = async () => {
    if (!selectedSup || !capturedPhoto) return;

    // Retrieve assigned site coordinates
    const targetLat = selectedSup.assignedLatitude || 23.2300;
    const targetLng = selectedSup.assignedLongitude || 77.4300;
    const targetSiteName = selectedSup.assignedSiteName || 'Bhopal Metro Project (Site-A)';

    // Verify distance matches geofenced area (within 200m)
    const distanceMeters = getDistanceInMeters(simLat, simLng, targetLat, targetLng);
    const isOutOfSite = distanceMeters > 200;
    const locationStatus: 'verified' | 'flagged' = isOutOfSite ? 'flagged' : 'verified';

    setStatusText('Resolving location address...');
    
    let resolvedLocation = '';
    if (isOutOfSite) {
      try {
        // Resolve actual address name
        const geocoded = await reverseGeocode(simLat, simLng);
        resolvedLocation = `⚠️ ${geocoded} (${Math.round(distanceMeters)}m OUT OF SITE)`;
      } catch {
        resolvedLocation = `⚠️ Custom (${Math.round(distanceMeters)}m OUT OF SITE)`;
      }
    } else {
      resolvedLocation = `${targetSiteName} (Verified)`;
    }

    const checkInLog = {
      supervisorId: selectedSup.id,
      supervisorName: selectedSup.name,
      timestamp: getSimulatedTimestamp(), // Simulated or real timestamp
      latitude: simLat,
      longitude: simLng,
      image: capturedPhoto,
      similarityScore: faceScore,
      faceMatchStatus: faceVerified,
      locationName: resolvedLocation,
      locationStatus: locationStatus
    };

    try {
      await addCheckIn(checkInLog);
      setCheckInSuccess(true);
      setTimeLeft(7200); // reset countdown timer
      await loadLogs(); // Refresh local logs list to update calendar instantly!
    } catch (err) {
      console.error(err);
      setStatusText('Database error logging attendance.');
    }
  };

  const resetVerification = () => {
    setCapturedPhoto(null);
    setFaceScore(null);
    setFaceVerified('not_verified');
    setCheckInSuccess(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
      
      {/* Smartphone simulator frame wrapper */}
      <div className="mobile-wrapper animate-fade-in">
        <div className="mobile-notch"></div>
        <div className="mobile-screen">
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield className="text-primary-color animate-pulse" size={20} />
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>SiteShield Mobile</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <Clock size={12} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Supervisor Selection */}
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Active Supervisor</label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedSupId}
                onChange={(e) => setSelectedSupId(e.target.value)}
                className="form-select"
                style={{ paddingLeft: '2.5rem' }}
                disabled={currentUser.role === 'supervisor'}
              >
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
              <User size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {!selectedSup && (
            <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.8rem', margin: '1rem 0' }}>
              <strong style={{ fontWeight: 600 }}>Biometric Profile Syncing...</strong><br />
              <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span>• Name: {currentUser.name}</span>
                <span>• Role: {currentUser.role}</span>
                <span>• Supervisor ID: {currentUser.supervisorId || 'Not Set'}</span>
                <span>• Registered supervisors count: {supervisors.length}</span>
                <span>• DB ID list: {JSON.stringify(supervisors.map(s => s.id))}</span>
              </div>
            </div>
          )}

          {selectedSup && (
            <>
              {/* Geolocation Stamp Card */}
              <div className="glass-card border-primary" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    Telemetry Location & Geofence
                  </span>
                  <span className="badge badge-primary">
                    Live GPS
                  </span>
                </div>

                <div style={{ marginBottom: '0.5rem', background: 'rgba(79, 70, 229, 0.05)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase' }}>Assigned Site Geofence</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.1rem' }}>
                    <MapPin size={12} className="text-primary-color" />
                    {selectedSup.assignedSiteName || 'Bhopal Metro Project (Site-A)'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Coordinates: {(selectedSup.assignedLatitude || 23.2300).toFixed(4)}, {(selectedSup.assignedLongitude || 77.4300).toFixed(4)} (Radius: 200 meters)
                  </div>
                </div>
                
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {locationPreset === 'Actual Live Coordinates' || locationPreset === 'My Actual GPS Location'
                    ? 'Actual Location Captured'
                    : `Simulating ${locationPreset}`
                  }
                </h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  <MapPin size={12} className="text-primary-color" />
                  <span>
                    Lat: {simLat.toFixed(5)}, Lng: {simLng.toFixed(5)}
                  </span>
                </div>
              </div>

              {/* Attendance Check-in UI */}
              {!checkInSuccess ? (
                <>
                  {/* Phase Check: Enrollment vs Verification */}
                  <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                      {isFaceRegistered ? 'AI Facial Verification' : 'AI Face Profile Setup'}
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                      {isFaceRegistered 
                        ? 'Submit a selfie to match against your registered face ID.'
                        : 'First check-in. Registering face ID profile.'
                      }
                    </p>
                  </div>

                  {/* Camera module display */}
                  {!capturedPhoto ? (
                    <CameraFeed
                      onCapture={handleSelfieCaptured}
                      statusText={statusText}
                      setStatusText={setStatusText}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="camera-container" style={{ borderColor: faceVerified === 'matched' ? 'var(--color-emerald)' : faceVerified === 'mismatched' ? 'var(--color-rose)' : 'var(--border-color)' }}>
                        <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Selfie preview" />
                        
                        {/* Status Stamp Overlay */}
                        <div style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '85%',
                          textAlign: 'center',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                          {faceVerified === 'matched' ? (
                            <>
                              <CheckCircle className="text-emerald" size={14} />
                              <span className="text-emerald" style={{ fontWeight: 600 }}>Face Verified {faceScore ? `(${faceScore}%)` : ''}</span>
                            </>
                          ) : faceVerified === 'mismatched' ? (
                            <>
                              <AlertTriangle className="text-rose" size={14} />
                              <span className="text-rose" style={{ fontWeight: 600 }}>Face Mismatch {faceScore ? `(${faceScore}%)` : ''}</span>
                            </>
                          ) : (
                            <span style={{ fontWeight: 600 }}>Profile Captured</span>
                          )}
                        </div>
                      </div>

                      {/* Submit Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={resetVerification}
                          className="btn btn-secondary"
                          style={{ flex: 1 }}
                        >
                          <RefreshCcw size={14} />
                          Retake
                        </button>
                        
                        <button
                          onClick={submitCheckInLog}
                          className="btn btn-primary pulse-primary"
                          disabled={
                            faceVerified !== 'matched'
                          }
                          style={{ flex: 2 }}
                        >
                          Submit Check-in
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Success Checked-In UI Screen */
                <div className="glass-card border-emerald animate-fade-in" style={{ padding: '2rem 1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <CheckCircle className="text-emerald" size={28} style={{ margin: 'auto' }} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', color: '#047857' }}>Attendance Logged!</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Your selfie check-in has been logged to the daily calendar.
                  </p>
                  
                  <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.7rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Time Logged:</span>
                      <span style={{ fontWeight: 600 }}>
                        {simTimeOffset === 'real' 
                          ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : simTimeOffset === 'morning' ? '10:15 AM'
                          : simTimeOffset === 'lunch' ? '2:15 PM (Half Day)'
                          : '7:15 PM'
                        }
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                      <span style={{ fontWeight: 600 }}>{simLat.toFixed(4)}, {simLng.toFixed(4)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Facial Match:</span>
                      <span style={{ fontWeight: 600 }}>{faceScore ? `${faceScore}% Similarity` : 'Profile Registered'}</span>
                    </div>
                  </div>

                  <button
                    onClick={resetVerification}
                    className="btn btn-primary"
                    style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  >
                    Done (New Check-in)
                  </button>
                </div>
              )}

              {/* Personal Attendance Calendar */}
              <div style={{ marginTop: '1.25rem' }}>
                <AttendanceCalendar 
                  logs={logs.filter(l => l.supervisorId === selectedSup.id)} 
                  supervisorName={selectedSup.name} 
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Simulator Control Panel (Desktop Helper Widget) */}
      {selectedSup && (
        <div className="glass-card" style={{ border: '1px dashed var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <RefreshCcw className="text-amber" size={16} />
            <h4 style={{ fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>GPS & Time Simulator (Testing Panel)</h4>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Use the controls below to mock the supervisor's physical location and simulated check-in shifts. This lets you test color-coded calendar rules instantly.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            {/* GPS Preset selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Simulate Location</label>
              <select
                value={locationPreset}
                onChange={(e) => handleLocationPresetChange(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="My Assigned Work Site">My Assigned Work Site (Geofenced)</option>
                {CITY_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
                {locationPreset === 'Actual Live Coordinates' && (
                  <option value="Actual Live Coordinates">Actual Live Coordinates</option>
                )}
                {locationPreset === 'My Actual GPS Location' && (
                  <option value="My Actual GPS Location">My Actual GPS Location</option>
                )}
                {(!CITY_PRESETS.find(p => p.name === locationPreset) && locationPreset !== 'Actual Live Coordinates' && locationPreset !== 'My Actual GPS Location') && (
                  <option value="Custom">Custom Coordinates</option>
                )}
              </select>
            </div>

            {/* Time Preset Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Simulate Check-in Time</label>
              <select
                value={simTimeOffset}
                onChange={(e) => setSimTimeOffset(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="real">Real System Time</option>
                <option value="morning">Morning Shift (10:15 AM)</option>
                <option value="lunch">Midday Shift / Half-Day (2:15 PM)</option>
                <option value="evening">Evening Shift (7:15 PM)</option>
              </select>
            </div>
          </div>

          <div style={{ margin: '0.5rem 0 1rem 0' }}>
            <button
              onClick={fetchActualLocation}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', padding: '0.5rem 1rem' }}
            >
              <MapPin size={14} className="text-primary-color" />
              Use My Actual GPS Location
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Latitude</label>
              <input
                type="number"
                step="0.00001"
                value={simLat}
                onChange={(e) => {
                  setSimLat(parseFloat(e.target.value) || 0);
                  setLocationPreset('Custom');
                }}
                className="form-input"
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Longitude</label>
              <input
                type="number"
                step="0.00001"
                value={simLng}
                onChange={(e) => {
                  setSimLng(parseFloat(e.target.value) || 0);
                  setLocationPreset('Custom');
                }}
                className="form-input"
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
