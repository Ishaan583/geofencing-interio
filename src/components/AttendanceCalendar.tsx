import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { CheckInLog } from '../db/indexedDB';

interface AttendanceCalendarProps {
  logs: CheckInLog[];
  supervisorName: string;
  calendarDate?: Date;
  onMonthChange?: (date: Date) => void;
}

export interface DayStatus {
  status: 'present' | 'half-day' | 'absent' | 'future';
  morningLog?: CheckInLog;
  middayLog?: CheckInLog;
  eveningLog?: CheckInLog;
  allLogs: CheckInLog[];
}

export function getDayAttendanceStatus(dayDate: Date, logs: CheckInLog[]): DayStatus {
  const today = new Date();
  
  // If the day is in the future
  const compareDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
  const compareToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  if (compareDate > compareToday) {
    return { status: 'future', allLogs: [] };
  }

  // Filter logs for this specific calendar day
  const dayLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate.getDate() === dayDate.getDate() &&
           logDate.getMonth() === dayDate.getMonth() &&
           logDate.getFullYear() === dayDate.getFullYear();
  });

  // Calculate minutes from midnight for each log to check windows
  // Morning: 10:00 AM (600 mins) to 10:30 AM (630 mins)
  const morningLog = dayLogs.find(log => {
    const date = new Date(log.timestamp);
    const min = date.getHours() * 60 + date.getMinutes();
    return min >= 600 && min <= 630;
  });

  // Midday: 2:00 PM (840 mins) to 2:30 PM (870 mins)
  const middayLog = dayLogs.find(log => {
    const date = new Date(log.timestamp);
    const min = date.getHours() * 60 + date.getMinutes();
    return min >= 840 && min <= 870;
  });

  // Evening: 7:00 PM (1140 mins) to 7:30 PM (1170 mins)
  const eveningLog = dayLogs.find(log => {
    const date = new Date(log.timestamp);
    const min = date.getHours() * 60 + date.getMinutes();
    return min >= 1140 && min <= 1170;
  });

  if (morningLog && eveningLog) {
    return { status: 'present', morningLog, eveningLog, allLogs: dayLogs };
  }
  
  if (middayLog && (morningLog || eveningLog)) {
    return { status: 'half-day', morningLog, middayLog, eveningLog, allLogs: dayLogs };
  }

  return { status: 'absent', allLogs: dayLogs };
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ 
  logs, 
  supervisorName,
  calendarDate,
  onMonthChange
}) => {
  const [internalDate, setInternalDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  
  const currentDate = calendarDate || internalDate;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Get total days in selected month and first day offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)

  // Calendar cells array
  const calendarCells = [];
  
  // Fill in empty cells for offset
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }

  // Fill in actual days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(new Date(year, month, d));
  }

  const handlePrevMonth = () => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    if (onMonthChange) {
      onMonthChange(nextDate);
    } else {
      setInternalDate(nextDate);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    if (onMonthChange) {
      onMonthChange(nextDate);
    } else {
      setInternalDate(nextDate);
    }
    setSelectedDay(null);
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'present': return 'status-bg-green';
      case 'half-day': return 'status-bg-yellow';
      case 'absent': return 'status-bg-red';
      default: return 'status-bg-future';
    }
  };

  const getSelectedDayDetails = () => {
    if (!selectedDay) return null;
    return getDayAttendanceStatus(selectedDay, logs);
  };

  const dayDetails = getSelectedDayDetails();

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '1.25rem' }}>
      
      {/* Calendar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon className="text-primary-color" size={18} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', margin: 0 }}>
              Attendance Tracker
            </h4>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              {supervisorName}
            </span>
          </div>
        </div>

        {/* Month Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.04)', padding: '0.2rem 0.4rem', borderRadius: '6px' }}>
          <button 
            type="button" 
            onClick={handlePrevMonth} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', padding: '0.1rem 0.3rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}
            title="Previous Month"
          >
            &lt;
          </button>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '60px', textAlign: 'center', display: 'inline-block' }}>
            {monthName.substring(0,3)} {year}
          </span>
          <button 
            type="button" 
            onClick={handleNextMonth} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', padding: '0.1rem 0.3rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}
            title="Next Month"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Week Day Labels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.35rem',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginBottom: '0.5rem'
      }}>
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.35rem',
        marginBottom: '1rem'
      }}>
        {calendarCells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} style={{ aspectRatio: '1' }} />;
          }

          const dayStatus = getDayAttendanceStatus(cell, logs);
          const isSelected = selectedDay && selectedDay.getDate() === cell.getDate() && selectedDay.getMonth() === cell.getMonth();

          return (
            <button
              key={`day-${cell.getDate()}`}
              type="button"
              onClick={() => setSelectedDay(cell)}
              className={getStatusColorClass(dayStatus.status)}
              style={{
                aspectRatio: '1',
                borderRadius: '8px',
                border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.04)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: dayStatus.status === 'future' ? 'var(--text-muted)' : '#0f172a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.15s ease'
              }}
              title={`Day ${cell.getDate()}: ${dayStatus.status}`}
            >
              {cell.getDate()}
              
              {/* Dot Indicator */}
              {dayStatus.status !== 'future' && (
                <div style={{
                  position: 'absolute',
                  bottom: '4px',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: 
                    dayStatus.status === 'present' ? '#059669' :
                    dayStatus.status === 'half-day' ? '#d97706' : '#dc2626'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.65rem',
        color: 'var(--text-secondary)',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '0.75rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
          <span>Present (Green)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }}></span>
          <span>Half Day (Yellow)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
          <span>Absent (Red)</span>
        </div>
      </div>

      {/* Selected Day Check-in Details */}
      {selectedDay && dayDetails && (
        <div style={{
          background: 'rgba(0,0,0,0.01)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.75rem'
        }}>
          <h5 style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Day {selectedDay.getDate()} Audit</span>
            <span style={{
              textTransform: 'capitalize',
              fontWeight: 700,
              color: 
                dayDetails.status === 'present' ? '#059669' :
                dayDetails.status === 'half-day' ? '#d97706' :
                dayDetails.status === 'absent' ? '#dc2626' : 'var(--text-muted)'
            }}>
              {dayDetails.status}
            </span>
          </h5>

          {dayDetails.allLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0 }}>No check-in entries logged on this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dayDetails.allLogs.map((log) => {
                const logTime = new Date(log.timestamp);
                const min = logTime.getHours() * 60 + logTime.getMinutes();
                const isMorning = min >= 600 && min <= 630;
                const isMidday = min >= 840 && min <= 870;
                const isEvening = min >= 1140 && min <= 1170;

                let windowTag = 'General Check-in';
                let tagColor = 'var(--text-secondary)';
                if (isMorning) { windowTag = 'Morning Window (10:00-10:30)'; tagColor = '#059669'; }
                else if (isMidday) { windowTag = 'Midday Window (2:00-2:30)'; tagColor = '#d97706'; }
                else if (isEvening) { windowTag = 'Evening Window (7:00-7:30)'; tagColor = '#059669'; }

                return (
                  <div key={log.id || log.timestamp} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#ffffff',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <img src={log.image} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.7rem', color: tagColor }}>{windowTag}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Logged: {logTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Loc: {log.locationName || `${log.latitude.toFixed(3)}, ${log.longitude.toFixed(3)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
