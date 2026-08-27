import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { CheckInLog } from '../db/indexedDB';

// Custom SVG marker for supervisor locations
const createSvgMarker = (color: string, name: string) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 24px; height: 24px; background: ${color}; opacity: 0.2; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 10;"></div>
        <div style="position: absolute; bottom: 20px; background: rgba(255, 255, 255, 0.95); color: #0f172a; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.08); white-space: nowrap; pointer-events: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          ${name}
        </div>
      </div>
      <style>
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Component to dynamically adjust map center when selection changes
interface MapRecenterProps {
  center: [number, number];
  zoom: number;
}

const MapRecenter: React.FC<MapRecenterProps> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
    map.invalidateSize();
    
    // Multiple delayed calls to account for layout shifts and css transition settles
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [center, zoom, map]);
  return null;
};

const MapResizeObserver: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);
  return null;
};

interface MapViewProps {
  logs: CheckInLog[];
  center: [number, number];
  zoom?: number;
}

export const MapView: React.FC<MapViewProps> = ({ logs, center, zoom = 13 }) => {
  // Get last check-in log for each unique supervisor to display on map
  const lastLogsMap = new Map<string, CheckInLog>();
  // Since logs are pre-sorted descending, the first one we find is the latest
  logs.forEach((log) => {
    if (!lastLogsMap.has(log.supervisorId)) {
      lastLogsMap.set(log.supervisorId, log);
    }
  });
  const latestSupervisorLogs = Array.from(lastLogsMap.values());

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', minHeight: '380px' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter center={center} zoom={zoom} />
      <MapResizeObserver />

      {/* Render latest supervisor locations */}
      {latestSupervisorLogs.map((log) => {
        const markerColor = 'var(--color-primary)'; // Indigo theme color
        
        return (
          <Marker
            key={log.id || log.timestamp}
            position={[log.latitude, log.longitude]}
            icon={createSvgMarker(markerColor, log.supervisorName)}
          >
            <Popup>
              <div style={{ color: '#0f172a', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '150px' }}>
                <strong style={{ fontSize: '0.9rem' }}>{log.supervisorName}</strong>
                <div>
                  <strong>Check-in Time:</strong><br />
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div>
                  <strong>Coordinates:</strong><br />
                  {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                </div>
                {log.image && (
                  <div style={{ width: '100%', height: '90px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', marginTop: '0.2rem' }}>
                    <img src={log.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Check-in Capture" />
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};
