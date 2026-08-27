import { supabase, isSupabaseConfigured } from '../services/supabase';

export interface Supervisor {
  id: string;
  name: string;
  referenceFaceDescriptor: number[] | null; // serialized Float32Array
  referenceImage: string | null; // base64 image data URI
  assignedSiteId?: string;
  assignedSiteName?: string;
  assignedLatitude?: number;
  assignedLongitude?: number;
}

export interface CheckInLog {
  id?: number;
  supervisorId: string;
  supervisorName: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  image: string; // base64 photo
  similarityScore: number | null;
  faceMatchStatus: 'matched' | 'mismatched' | 'not_verified';
  locationName?: string; // Human-readable location name
  locationStatus?: 'verified' | 'flagged'; // Location status audit flag
}

export interface UserAccount {
  username: string;
  name: string;
  password?: string; // in local app we can check simple match
  role: 'admin' | 'supervisor';
  supervisorId?: string; // matches supervisor table id
}

const DB_NAME = 'GeoGuardDB';
const DB_VERSION = 3; // Incremented database version to include users store

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('supervisors')) {
        db.createObjectStore('supervisors', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('checkins')) {
        db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'username' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// User store CRUD
export async function getUsers(): Promise<UserAccount[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return (data || []) as UserAccount[];
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addUser(user: UserAccount): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('users').upsert(user);
    if (error) throw error;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getUser(username: string): Promise<UserAccount | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (error) throw error;
    return (data || undefined) as UserAccount | undefined;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.get(username);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Supervisor CRUD
export async function addSupervisor(supervisor: Supervisor): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('supervisors').upsert(supervisor);
    if (error) throw error;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supervisors', 'readwrite');
    const store = tx.objectStore('supervisors');
    const request = store.put(supervisor);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSupervisor(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('checkins').delete().eq('supervisorId', id);
    await supabase.from('users').delete().eq('supervisorId', id);
    const { error } = await supabase.from('supervisors').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supervisors', 'readwrite');
    const store = tx.objectStore('supervisors');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSupervisors(): Promise<Supervisor[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('supervisors').select('*');
    if (error) throw error;
    return (data || []) as Supervisor[];
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supervisors', 'readonly');
    const store = tx.objectStore('supervisors');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getSupervisor(id: string): Promise<Supervisor | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('supervisors').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data || undefined) as Supervisor | undefined;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supervisors', 'readonly');
    const store = tx.objectStore('supervisors');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateSupervisorFace(
  id: string,
  descriptor: number[],
  image: string
): Promise<void> {
  const supervisor = await getSupervisor(id);
  if (!supervisor) throw new Error('Supervisor not found');

  supervisor.referenceFaceDescriptor = descriptor;
  supervisor.referenceImage = image;
  await addSupervisor(supervisor);
}

export async function addCheckIn(log: CheckInLog): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const cleanLog = { ...log };
    delete cleanLog.id;
    const { error } = await supabase.from('checkins').insert(cleanLog);
    if (error) throw error;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('checkins', 'readwrite');
    const store = tx.objectStore('checkins');
    const request = store.add(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCheckIns(): Promise<CheckInLog[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []) as CheckInLog[];
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('checkins', 'readonly');
    const store = tx.objectStore('checkins');
    const request = store.getAll();
    request.onsuccess = () => {
      const logs = request.result || [];
      resolve(logs.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearCheckIns(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('checkins').delete().neq('supervisorId', '');
    if (error) throw error;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('checkins', 'readwrite');
    const store = tx.objectStore('checkins');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Seeds a demo supervisor with 40 days of realistic daily check-in logs for testing
export async function seedDemoSupervisor40Days(): Promise<void> {
  // 1. Add Supervisor Profile
  const supervisorId = 'sup-demo-40days';
  const name = 'Demo Staff (Simulated 40 Days)';
  const defaultImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e2e8f0"/><text x="50" y="55" font-family="sans-serif" font-size="12" fill="%2394a3b8" text-anchor="middle">Selfie</text></svg>';
  
  await addSupervisor({
    id: supervisorId,
    name,
    referenceFaceDescriptor: new Array(128).fill(0.1), // Dummy descriptor
    referenceImage: defaultImage,
    assignedSiteId: 'site-bhopal',
    assignedSiteName: 'Bhopal Metro Project (Site-A)',
    assignedLatitude: 23.2300,
    assignedLongitude: 77.4300
  });

  // 2. Add User Login Credentials
  await addUser({
    username: 'demo',
    name,
    password: 'password123',
    role: 'supervisor',
    supervisorId,
  });

  // 3. Generate 40 Days of Past logs
  const today = new Date();
  
  for (let i = 1; i <= 40; i++) {
    const logDate = new Date();
    logDate.setDate(today.getDate() - i);
    
    // Day distribution logic:
    // Weekends (Sunday/Saturday) -> Absent (no logs)
    // i % 5 === 0 -> Half Day (Morning + Midday logs)
    // i % 5 === 1 -> Absent (Morning log only)
    // Else -> Present (Morning + Evening logs)
    
    const isWeekend = (logDate.getDay() === 0 || logDate.getDay() === 6);
    if (isWeekend) continue; // Absent on weekends

     // Shift coordinates slightly around Bhopal Metro Project coordinates (23.2300, 77.4300)
     // Keep offsets tiny (less than 0.001) so they remain within the 200m geofence!

    // Simulate cheating events on Day 5 (Indore) and Day 12 (Mumbai) to test audit reports
    const isCheating = (i === 5 || i === 12);
    let lat = 23.2300;
    let lng = 77.4300;
    let locName = 'Bhopal Metro Project (Site-A)';
    let locStatus: 'verified' | 'flagged' = 'verified';

    if (isCheating) {
      locStatus = 'flagged';
      if (i === 5) {
        lat = 22.7196;
        lng = 75.8577;
        locName = 'Indore, Madhya Pradesh (193 km OUT OF SITE)';
      } else {
        lat = 19.0100;
        lng = 72.8200;
        locName = 'Mumbai, Maharashtra (740 km OUT OF SITE)';
      }
    } else {
      const randomOffsetLat = (Math.sin(i) * 0.0005);
      const randomOffsetLng = (Math.cos(i) * 0.0005);
      lat = 23.2300 + randomOffsetLat;
      lng = 77.4300 + randomOffsetLng;
    }

    const morningTime = new Date(logDate);
    morningTime.setHours(10, 10 + (i % 15), 0, 0); // Morning check-in (10:10 - 10:25)

    const middayTime = new Date(logDate);
    middayTime.setHours(14, 10 + (i % 15), 0, 0); // Midday check-in (14:10 - 14:25)

    const eveningTime = new Date(logDate);
    eveningTime.setHours(19, 10 + (i % 15), 0, 0); // Evening check-in (19:10 - 19:25)

    if (i % 5 === 0) {
      // Half Day: Morning + Midday logs
      await addCheckIn({
        supervisorId,
        supervisorName: name,
        timestamp: morningTime.getTime(),
        latitude: lat,
        longitude: lng,
        image: defaultImage,
        similarityScore: 90 + (i % 5),
        faceMatchStatus: 'matched' as const,
        locationName: locName,
        locationStatus: locStatus
      });
      await addCheckIn({
        supervisorId,
        supervisorName: name,
        timestamp: middayTime.getTime(),
        latitude: lat,
        longitude: lng,
        image: defaultImage,
        similarityScore: 88 + (i % 5),
        faceMatchStatus: 'matched' as const,
        locationName: locName,
        locationStatus: locStatus
      });
    } else if (i % 5 === 1) {
      // Absent: Morning log only
      await addCheckIn({
        supervisorId,
        supervisorName: name,
        timestamp: morningTime.getTime(),
        latitude: lat,
        longitude: lng,
        image: defaultImage,
        similarityScore: 92,
        faceMatchStatus: 'matched' as const,
        locationName: locName,
        locationStatus: locStatus
      });
    } else {
      // Present: Morning + Evening logs
      await addCheckIn({
        supervisorId,
        supervisorName: name,
        timestamp: morningTime.getTime(),
        latitude: lat,
        longitude: lng,
        image: defaultImage,
        similarityScore: 91 + (i % 4),
        faceMatchStatus: 'matched' as const,
        locationName: locName,
        locationStatus: locStatus
      });
      await addCheckIn({
        supervisorId,
        supervisorName: name,
        timestamp: eveningTime.getTime(),
        latitude: lat,
        longitude: lng,
        image: defaultImage,
        similarityScore: 93 + (i % 4),
        faceMatchStatus: 'matched' as const,
        locationName: locName,
        locationStatus: locStatus
      });
    }
  }
}

// Initial seed data helper (kept as a no-op for a clean production database)
export async function seedInitialData(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    // Keep Supabase cloud database clean for production
    return;
  }

  const isWiped = localStorage.getItem('db_wiped_v9');
  if (!isWiped) {
    try {
      const db = await initDB();
      const stores = ['supervisors', 'checkins', 'users'];
      const tx = db.transaction(stores, 'readwrite');
      
      stores.forEach(s => {
        if (db.objectStoreNames.contains(s)) {
          tx.objectStore(s).clear();
        }
      });

      // Await database clear transaction to complete fully
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Clear local storage sessions
      localStorage.removeItem('currentUser');
      localStorage.setItem('db_wiped_v9', 'true');
      console.log('IndexedDB cleared for fresh clean setup.');
    } catch (err) {
      console.error('Failed to clear local database stores:', err);
    }
  }
}

// Seeds simulated past logs for testing calendar color codes automatically
export async function seedPastLogsForSupervisor(supervisorId: string, name: string, referenceImage: string | null): Promise<void> {
  const defaultImage = referenceImage || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e2e8f0"/><text x="50" y="55" font-family="sans-serif" font-size="12" fill="%2394a3b8" text-anchor="middle">Selfie</text></svg>';
  
  const supervisor = await getSupervisor(supervisorId);
  const siteLat = supervisor?.assignedLatitude || 23.2300;
  const siteLng = supervisor?.assignedLongitude || 77.4300;
  const siteName = supervisor?.assignedSiteName || 'Bhopal Metro Project (Site-A)';

  const today = new Date();
  
  // Day 1: 3 days ago (Present: Green)
  const d3 = new Date();
  d3.setDate(today.getDate() - 3);
  const d3Morning = new Date(d3);
  d3Morning.setHours(10, 15, 0, 0);
  const d3Evening = new Date(d3);
  d3Evening.setHours(19, 15, 0, 0);

  // Day 2: 2 days ago (Half Day: Yellow - needs midday + morning/evening)
  const d2 = new Date();
  d2.setDate(today.getDate() - 2);
  const d2Morning = new Date(d2);
  d2Morning.setHours(10, 15, 0, 0);
  const d2Midday = new Date(d2);
  d2Midday.setHours(14, 15, 0, 0);

  // Day 3: 1 day ago (Absent/Incomplete: Red)
  const d1 = new Date();
  d1.setDate(today.getDate() - 1);
  const d1Morning = new Date(d1);
  d1Morning.setHours(10, 15, 0, 0);

  const mockLogs = [
    // 3 days ago (Green)
    {
      supervisorId,
      supervisorName: name,
      timestamp: d3Morning.getTime(),
      latitude: siteLat,
      longitude: siteLng,
      image: defaultImage,
      similarityScore: 92,
      faceMatchStatus: 'matched' as const,
      locationName: siteName
    },
    {
      supervisorId,
      supervisorName: name,
      timestamp: d3Evening.getTime(),
      latitude: siteLat,
      longitude: siteLng,
      image: defaultImage,
      similarityScore: 94,
      faceMatchStatus: 'matched' as const,
      locationName: siteName
    },
    // 2 days ago (Yellow - Morning + Midday logs)
    {
      supervisorId,
      supervisorName: name,
      timestamp: d2Morning.getTime(),
      latitude: siteLat,
      longitude: siteLng,
      image: defaultImage,
      similarityScore: 90,
      faceMatchStatus: 'matched' as const,
      locationName: siteName
    },
    {
      supervisorId,
      supervisorName: name,
      timestamp: d2Midday.getTime(),
      latitude: siteLat,
      longitude: siteLng,
      image: defaultImage,
      similarityScore: 89,
      faceMatchStatus: 'matched' as const,
      locationName: siteName
    },
    // 1 day ago (Red - missing evening check-in)
    {
      supervisorId,
      supervisorName: name,
      timestamp: d1Morning.getTime(),
      latitude: siteLat,
      longitude: siteLng,
      image: defaultImage,
      similarityScore: 91,
      faceMatchStatus: 'matched' as const,
      locationName: siteName
    }
  ];

  for (const log of mockLogs) {
    await addCheckIn(log);
  }
}
