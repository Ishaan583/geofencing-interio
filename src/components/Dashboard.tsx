import React, { useState, useEffect } from 'react';
import { Shield, Users, CheckCircle, RefreshCcw, Plus, Trash2, Globe, Search, UserMinus, MapPin, Download, UserCog } from 'lucide-react';
import { getCheckIns, getSupervisors, addSupervisor, deleteSupervisor, clearCheckIns, getUsers, addUser } from '../db/indexedDB';
import type { CheckInLog, Supervisor, UserAccount } from '../db/indexedDB';
import { MapView } from './MapView';
import { AttendanceCalendar, getDayAttendanceStatus } from './AttendanceCalendar';
import { WORK_SITES } from '../services/geoService';
import { isSupabaseConfigured } from '../services/supabase';

export const DashboardView: React.FC = () => {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Map view positioning states (Default centered on India)
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState<number>(5);

  // New supervisor form states
  const [newSupName, setNewSupName] = useState<string>('');
  const [newSupSiteId, setNewSupSiteId] = useState<string>(WORK_SITES[0].id);
  const [supFormError, setSupFormError] = useState<string>('');
  const [hasCenteredMap, setHasCenteredMap] = useState<boolean>(false);

  // Search filter and photo modal states
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFilterSupId, setSelectedFilterSupId] = useState<string>('all');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());

  // Metrics summary states
  const [metrics, setMetrics] = useState({
    card1Title: 'Active Supervisors',
    card1Value: '0',
    card1Sub: 'Staff in database registry',
    totalCheckIns: 0,
    card3Title: 'Enrolled Face Profiles',
    card3Value: '0',
    card3Sub: 'Supervisors with Face ID',
    avgFaceScore: 0,
  });

  const loadAllData = async () => {
    const sups = await getSupervisors();
    const lgs = await getCheckIns();
    const usrs = await getUsers();
    
    setSupervisors(sups);
    setLogs(lgs);
    setUsers(usrs);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Center map on last check-in log on load (if logs exist), otherwise get admin coordinates
  useEffect(() => {
    if (hasCenteredMap) return;
    if (logs.length > 0) {
      setMapCenter([logs[0].latitude, logs[0].longitude]);
      setMapZoom(11);
      setHasCenteredMap(true);
    } else if (navigator.geolocation && !hasCenteredMap) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setMapZoom(11);
          setHasCenteredMap(true);
        },
        () => {
          console.log('Centering map on India.');
        }
      );
    }
  }, [logs, hasCenteredMap]);

  // Compute Metrics whenever lists change or filter changes
  useEffect(() => {
    const targetLogs = selectedFilterSupId === 'all' 
      ? logs 
      : logs.filter(l => l.supervisorId === selectedFilterSupId);

    const totalCheckIns = targetLogs.length;

    let card1Title = 'Active Supervisors';
    let card1Value = String(supervisors.length);
    let card1Sub = 'Staff in database registry';

    let card3Title = 'Enrolled Face Profiles';
    let card3Value = String(supervisors.filter((s) => !!s.referenceFaceDescriptor).length);
    let card3Sub = 'Supervisors with Face ID';

    if (selectedFilterSupId !== 'all') {
      const selectedSup = supervisors.find(s => s.id === selectedFilterSupId);
      if (selectedSup) {
        card1Title = 'Selected Profile';
        card1Value = selectedSup.name;
        card1Sub = 'Filtered active supervisor';

        const hasFace = !!selectedSup.referenceFaceDescriptor;
        card3Title = 'Face ID Status';
        card3Value = hasFace ? 'Configured' : 'Missing';
        card3Sub = hasFace ? 'Biometrics verified' : 'Requires enrollment';
      }
    }

    const scores = targetLogs
      .map((l) => l.similarityScore)
      .filter((s): s is number => s !== null && s > 0);
    const avgFaceScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
      : 0;

    setMetrics({
      card1Title,
      card1Value,
      card1Sub,
      totalCheckIns,
      card3Title,
      card3Value,
      card3Sub,
      avgFaceScore,
    });
  }, [logs, supervisors, selectedFilterSupId]);

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupFormError('');

    if (!newSupName.trim()) {
      setSupFormError('Please enter a supervisor name.');
      return;
    }

    const site = WORK_SITES.find(s => s.id === newSupSiteId) || WORK_SITES[0];

    const newSupervisor: Supervisor = {
      id: `sup-${Date.now()}`,
      name: newSupName.trim(),
      referenceFaceDescriptor: null,
      referenceImage: null,
      assignedSiteId: site.id,
      assignedSiteName: site.name,
      assignedLatitude: site.latitude,
      assignedLongitude: site.longitude
    };

    await addSupervisor(newSupervisor);
    setNewSupName('');
    await loadAllData();
  };

  const handleDeleteSupervisor = async (id: string) => {
    if (confirm('Are you sure you want to delete this supervisor? This will also remove their check-in logs.')) {
      await deleteSupervisor(id);
      if (selectedFilterSupId === id) {
        setSelectedFilterSupId('all');
      }
      await loadAllData();
    }
  };

  const toggleUserRole = async (username: string) => {
    const user = users.find(u => u.username === username);
    if (!user) return;

    // Prevent self-demotion
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser.username === username && user.role === 'admin') {
          alert("You cannot demote your own active Admin account!");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const nextRole: 'admin' | 'supervisor' = user.role === 'admin' ? 'supervisor' : 'admin';
    const updatedUser: UserAccount = { ...user, role: nextRole };

    await addUser(updatedUser);
    await loadAllData();
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all supervisor check-in logs? This action is irreversible.')) {
      await clearCheckIns();
      await loadAllData();
    }
  };

  const handleExportCSV = () => {
    const supsToExport = selectedFilterSupId === 'all'
      ? supervisors
      : supervisors.filter(s => s.id === selectedFilterSupId);

    if (supsToExport.length === 0) {
      alert('No supervisor data available to export.');
      return;
    }

    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();
    const monthName = selectedMonthDate.toLocaleString('default', { month: 'short' });

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Attendance Ledger</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #f1f5f9; color: #475569; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; font-family: sans-serif; font-size: 10pt; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px; font-family: sans-serif; font-size: 10pt; text-align: center; }
          .present { background-color: #d1fae5 !important; color: #065f46 !important; font-weight: bold; }
          .half-day { background-color: #fef3c7 !important; color: #92400e !important; font-weight: bold; }
          .absent { background-color: #fee2e2 !important; color: #991b1b !important; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supervisor Name</th>
              <th>Status</th>
              <th>Morning Check-In (10:00-10:30)</th>
              <th>Midday Check-In (14:00-14:30)</th>
              <th>Evening Check-In (19:00-19:30)</th>
              <th>Total Check-Ins</th>
              <th>Morning Location</th>
              <th>Midday Location</th>
              <th>Evening Location</th>
              <th>Morning Match Score</th>
              <th>Midday Match Score</th>
              <th>Evening Match Score</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const sup of supsToExport) {
      const supLogs = logs.filter(l => l.supervisorId === sup.id);
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const details = getDayAttendanceStatus(dayDate, supLogs);
        
        if (details.status === 'future') continue;

        const formatTime = (log?: CheckInLog) => {
          if (!log) return 'Missed';
          return new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        const formatLocationCell = (log?: CheckInLog) => {
          if (!log) return '<td>N/A</td>';
          const locName = log.locationName || `${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}`;
          if (log.locationStatus === 'flagged') {
            return `<td style="background-color: #fee2e2 !important; color: #991b1b !important; font-weight: bold;">⚠️ ${locName}</td>`;
          }
          return `<td>${locName}</td>`;
        };

        const formatScore = (log?: CheckInLog) => {
          if (!log) return 'N/A';
          return log.similarityScore ? `${log.similarityScore}%` : 'Profile Enrolled';
        };

        const statusClass = details.status === 'present' ? 'present'
                          : details.status === 'half-day' ? 'half-day'
                          : 'absent';

        const statusText = details.status === 'present' ? 'Present'
                         : details.status === 'half-day' ? 'Half Day'
                         : 'Absent';

        html += `
          <tr>
            <td>${dayDate.toISOString().split('T')[0]}</td>
            <td>${sup.name}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${formatTime(details.morningLog)}</td>
            <td>${formatTime(details.middayLog)}</td>
            <td>${formatTime(details.eveningLog)}</td>
            <td>${details.allLogs.length}</td>
            ${formatLocationCell(details.morningLog)}
            ${formatLocationCell(details.middayLog)}
            ${formatLocationCell(details.eveningLog)}
            <td>${formatScore(details.morningLog)}</td>
            <td>${formatScore(details.middayLog)}</td>
            <td>${formatScore(details.eveningLog)}</td>
          </tr>
        `;
      }
    }

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = selectedFilterSupId === 'all'
      ? `All_Staff_Attendance_${monthName}_${year}.xls`
      : `${supsToExport[0].name.replace(/\s+/g, '_')}_Attendance_${monthName}_${year}.xls`;
    
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const focusLocation = (lat: number, lng: number) => {
    setMapCenter([lat, lng]);
    setMapZoom(15);
  };

  // Filter logs by search term & selected supervisor filter
  const filteredLogs = logs.filter(log => {
    const matchesSup = selectedFilterSupId === 'all' || log.supervisorId === selectedFilterSupId;
    const matchesSearch = log.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.faceMatchStatus.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSup && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade-in">
      
      {/* Dashboard Top Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)' }}>Company Admin Console</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time location mapping ledger & biometric face matching</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Profile:</span>
            <select
              value={selectedFilterSupId}
              onChange={(e) => setSelectedFilterSupId(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.8rem', padding: '0.4rem 1.8rem 0.4rem 0.75rem', width: '170px', margin: 0 }}
            >
              <option value="all">All Staff</option>
              {supervisors.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.name}</option>
              ))}
            </select>
          </div>

          <button onClick={loadAllData} className="btn btn-secondary">
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button onClick={handleExportCSV} className="btn btn-emerald" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Download size={16} />
            Export to Excel
          </button>
          <button onClick={handleClearLogs} className="btn btn-rose">
            <Trash2 size={16} />
            Clear Ledger Logs
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card border-primary">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{metrics.card1Title}</span>
            <Users size={20} className="text-primary-color" />
          </div>
          <h3 style={{ fontSize: selectedFilterSupId === 'all' ? '2rem' : '1.3rem', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={metrics.card1Value}>
            {metrics.card1Value}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{metrics.card1Sub}</p>
        </div>

        <div className="glass-card border-emerald">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Check-ins</span>
            <CheckCircle size={20} className="text-emerald" />
          </div>
          <h3 style={{ fontSize: '2rem', marginTop: '0.5rem', color: '#10b981' }}>{metrics.totalCheckIns}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Submissions logged on map</p>
        </div>

        <div className="glass-card border-primary">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{metrics.card3Title}</span>
            <Shield size={20} className="text-primary-color" />
          </div>
          <h3 style={{ fontSize: '2rem', marginTop: '0.5rem', color: 'var(--color-primary)' }}>{metrics.card3Value}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{metrics.card3Sub}</p>
        </div>

        <div className="glass-card border-amber">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Biometric Match Rate</span>
            <Shield size={20} className="text-amber" />
          </div>
          <h3 style={{ fontSize: '2rem', marginTop: '0.5rem', color: '#b45309' }}>
            {metrics.avgFaceScore > 0 ? `${metrics.avgFaceScore}%` : 'N/A'}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Avg facial similarity match</p>
        </div>
      </div>

      {/* Main Grid: Interactive Map + User Registry */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Interactive Map card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '440px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.5rem 0 0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe className="text-primary-color" size={18} />
              <h4 style={{ fontSize: '1rem' }}>Live Check-in Map</h4>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Showing supervisors' physical locations anywhere in India
            </span>
          </div>

          <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden' }}>
            {filteredLogs.length > 0 ? (
              <MapView logs={filteredLogs} center={mapCenter} zoom={mapZoom} />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', color: 'var(--text-muted)', gap: '0.5rem' }}>
                <Globe size={32} />
                <span>No check-in logs recorded on map.</span>
              </div>
            )}
          </div>
        </div>

        {/* User Registry Sidebar Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {selectedFilterSupId !== 'all' && (
            <AttendanceCalendar
              logs={logs.filter(l => l.supervisorId === selectedFilterSupId)}
              supervisorName={supervisors.find(s => s.id === selectedFilterSupId)?.name || 'Filtered Profile'}
              calendarDate={selectedMonthDate}
              onMonthChange={setSelectedMonthDate}
            />
          )}
          
          {/* Supervisor Registrar form */}
          <div className="glass-card">
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus className="text-primary-color" size={16} />
              Register New Supervisor
            </h4>
            
            <form onSubmit={handleAddSupervisor} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Assigned Work Site</label>
                <select
                  value={newSupSiteId}
                  onChange={(e) => setNewSupSiteId(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
                >
                  {WORK_SITES.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              {supFormError && (
                <p style={{ color: 'var(--color-rose)', fontSize: '0.75rem' }}>{supFormError}</p>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Add Supervisor
              </button>
            </form>
          </div>

          {/* Supervisor Registry List */}
          <div className="glass-card" style={{ flex: 1, maxHeight: '220px', overflowY: 'auto' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              Registered Staff ({supervisors.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {supervisors.map((sup) => (
                <div
                  key={sup.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.01)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem'
                  }}
                >
                  {(() => {
                    const supUser = users.find(u => u.supervisorId === sup.id);
                    return (
                      <>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>{sup.name}</span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span>{sup.referenceFaceDescriptor ? 'Face ID Configured' : 'No Face ID Setup'}</span>
                            {supUser && (
                              <span style={{ 
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                fontSize: '0.6rem', 
                                fontWeight: 'bold',
                                background: supUser.role === 'admin' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(0,0,0,0.05)',
                                color: supUser.role === 'admin' ? 'var(--color-primary)' : 'var(--text-muted)'
                              }}>
                                {supUser.role.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {supUser ? (
                            <button
                              onClick={() => toggleUserRole(supUser.username)}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: supUser.role === 'admin' ? 'var(--color-primary)' : 'var(--text-muted)', 
                                cursor: 'pointer', 
                                padding: '0.2rem',
                                marginRight: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.15rem'
                              }}
                              title={supUser.role === 'admin' ? 'Demote to Supervisor' : 'Promote to Admin'}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = supUser.role === 'admin' ? 'var(--color-primary)' : 'var(--text-muted)')}
                            >
                              <UserCog size={14} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>No Login</span>
                          )}
                          
                          <button
                            onClick={() => handleDeleteSupervisor(sup.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                            title="Remove Supervisor"
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-rose)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* User Accounts & Role Permissions (Promote to Admin / Demote to Supervisor) */}
          <div className="glass-card" style={{ flex: 1, maxHeight: '240px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                User Accounts & Roles ({users.length})
              </h4>
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: isSupabaseConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: isSupabaseConfigured ? '#059669' : '#d97706',
                fontWeight: 600
              }}>
                {isSupabaseConfigured ? '☁️ Cloud Synced' : '📦 Local Device Storage'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {users.map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <div
                    key={u.username}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(0,0,0,0.01)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {u.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>@{u.username}</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', marginTop: '0.15rem' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          background: isAdmin ? 'rgba(79, 70, 229, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: isAdmin ? 'var(--color-primary)' : '#059669'
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleUserRole(u.username)}
                      className="btn"
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: isAdmin ? 'rgba(239, 68, 68, 0.08)' : 'rgba(79, 70, 229, 0.08)',
                        color: isAdmin ? '#dc2626' : 'var(--color-primary)',
                      }}
                      title={isAdmin ? 'Change to Supervisor' : 'Promote to Admin'}
                    >
                      {isAdmin ? 'Make Supervisor' : 'Make Admin ⚡'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Ledger Ledger Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem' }}>Attendance Ledger Logs</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Logs mapping supervisors' physical check-in locations & face match verification</p>
          </div>

          {/* Search filter bar */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <input
              type="text"
              placeholder="Search logs (e.g. Rohan)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
            />
            <Search size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        {filteredLogs.length > 0 ? (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Selfie Capture</th>
                  <th>Supervisor</th>
                  <th>Timestamp</th>
                  <th>Check-In Location</th>
                  <th>Facial Verdict</th>
                  <th>Map Recenter</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id || log.timestamp}>
                    <td>
                      <div
                        onClick={() => setExpandedPhoto(log.image)}
                        style={{ width: '46px', height: '36px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-color)', position: 'relative' }}
                        title="Click to view image"
                      >
                        <img src={log.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Capture" />
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.supervisorName}</td>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 500,
                          color: log.locationStatus === 'flagged' ? 'var(--color-rose)' : 'inherit'
                        }}>
                          {log.locationName || `${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}`}
                        </span>
                        {log.locationStatus === 'flagged' && (
                          <span style={{
                            alignSelf: 'flex-start',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--color-rose)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            letterSpacing: '0.02em',
                            width: 'max-content'
                          }}>
                            OUT OF GEOFENCE
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        log.faceMatchStatus === 'matched' 
                          ? 'badge-emerald' 
                          : log.faceMatchStatus === 'mismatched' 
                            ? 'badge-rose' 
                            : 'badge-amber'
                      }`}>
                        {log.faceMatchStatus === 'matched' 
                          ? `Matched (${log.similarityScore}%)` 
                          : log.faceMatchStatus === 'mismatched' 
                            ? `Mismatch (${log.similarityScore}%)` 
                            : 'Setup Face ID'
                        }
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => focusLocation(log.latitude, log.longitude)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        <MapPin size={12} style={{ marginRight: '0.2rem' }} />
                        Center Map
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(0,0,0,0.01)', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            No check-in entries logged. Perform check-ins on the Supervisor screen to fill this ledger.
          </div>
        )}
      </div>

      {/* Expanded Photo Overlay modal */}
      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 6, 8, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={expandedPhoto}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '16px',
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
              alt="Supervisor Selfie Full-screen"
            />
            <button
              onClick={() => setExpandedPhoto(null)}
              className="btn btn-secondary"
              style={{ position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)' }}
            >
              Close View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
