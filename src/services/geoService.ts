export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface WorkSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Preset Indian construction & project sites for geofencing
export const WORK_SITES: WorkSite[] = [
  { id: 'site-bhopal', name: 'Bhopal Metro Project (Site-A)', latitude: 23.2300, longitude: 77.4300 },
  { id: 'site-mumbai', name: 'Mumbai Coastal Road Project', latitude: 19.0100, longitude: 72.8200 },
  { id: 'site-delhi', name: 'Delhi Expressway Project', latitude: 28.5800, longitude: 77.2200 },
  { id: 'site-bangalore', name: 'Bangalore Tech Park Site', latitude: 12.9500, longitude: 77.6200 },
  { id: 'site-indore', name: 'Indore Smart City Site-B', latitude: 22.7300, longitude: 75.8700 }
];

// Haversine formula to compute distance between two coordinates in meters
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Reverse geocode latitude and longitude into a readable location name using Nominatim OpenStreetMap API
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    if (!response.ok) throw new Error('Geocoding response failed');
    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '';
      const state = addr.state || '';
      const country = addr.country || '';
      
      if (city && state) {
        return `${city}, ${state}`;
      } else if (state) {
        return `${state}, ${country}`;
      } else if (data.display_name) {
        return data.display_name.split(',').slice(0, 2).join(',').trim();
      }
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // fallback to coordinates string
  }
}

// Preset Indian cities to easily mock supervisor locations anywhere in India
export const CITY_PRESETS = [
  {
    name: 'Bhopal (MP)',
    latitude: 23.2599,
    longitude: 77.4126,
    description: 'Bhopal City Center',
  },
  {
    name: 'Mumbai (MH)',
    latitude: 19.0760,
    longitude: 72.8777,
    description: 'Gateway of India, Mumbai',
  },
  {
    name: 'Delhi (DL)',
    latitude: 28.6139,
    longitude: 77.2090,
    description: 'Connaught Place, New Delhi',
  },
  {
    name: 'Bangalore (KA)',
    latitude: 12.9716,
    longitude: 77.5946,
    description: 'M.G. Road, Bangalore',
  },
  {
    name: 'Indore (MP)',
    latitude: 22.7196,
    longitude: 75.8577,
    description: 'Rajwada Palace, Indore',
  },
];
