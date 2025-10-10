// Timezone formatting utilities for the frontend
// All timestamps from the server are in UTC. These utilities format them
// for display using the configured timezone from system settings.
// Uses Intl.DateTimeFormat to correctly handle timezone conversion including DST.

interface SystemSettings {
  timezone?: string;
  timezoneOffset?: string;
}

// Cache for system settings
let cachedSettings: SystemSettings | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 60000; // 1 minute

/**
 * Get system settings (cached)
 */
async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  if (!cachedSettings || (now - lastCacheTime) > CACHE_DURATION_MS) {
    try {
      const response = await fetch('/api/settings/system', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("hospital_token")}`,
        },
      });
      if (response.ok) {
        cachedSettings = await response.json();
        lastCacheTime = now;
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
    }
  }
  return cachedSettings || {};
}

/**
 * Format a UTC timestamp for human-readable display in the configured timezone
 * @param utcDateString - ISO 8601 UTC timestamp string from the server
 * @param settings - Optional system settings (will fetch if not provided)
 * @returns Formatted date and time string (e.g., "Oct 2, 2025, 8:30 PM")
 */
export async function formatDateTimeDisplay(
  utcDateString: string,
  settings?: SystemSettings
): Promise<string> {
  try {
    const utcDate = new Date(utcDateString);
    const systemSettings = settings || await getSystemSettings();
    const timezone = systemSettings.timezone || 'UTC';
    
    // Use Intl.DateTimeFormat with the IANA timezone identifier
    // This correctly handles DST and timezone conversion
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(utcDate);
  } catch (error) {
    console.error('Error formatting timestamp with timezone:', error);
    // Fallback to UTC display
    return new Date(utcDateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Format a UTC timestamp for date-only display in the configured timezone
 * @param utcDateString - ISO 8601 UTC timestamp string from the server
 * @param settings - Optional system settings (will fetch if not provided)
 * @returns Formatted date string (e.g., "Oct 2, 2025")
 */
export async function formatDateDisplay(
  utcDateString: string,
  settings?: SystemSettings
): Promise<string> {
  try {
    const utcDate = new Date(utcDateString);
    const systemSettings = settings || await getSystemSettings();
    const timezone = systemSettings.timezone || 'UTC';
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(utcDate);
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return new Date(utcDateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

/**
 * Format a UTC timestamp for time-only display in the configured timezone
 * @param utcDateString - ISO 8601 UTC timestamp string from the server
 * @param settings - Optional system settings (will fetch if not provided)
 * @returns Formatted time string (e.g., "8:30 PM")
 */
export async function formatTimeDisplay(
  utcDateString: string,
  settings?: SystemSettings
): Promise<string> {
  try {
    const utcDate = new Date(utcDateString);
    const systemSettings = settings || await getSystemSettings();
    const timezone = systemSettings.timezone || 'UTC';
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(utcDate);
  } catch (error) {
    console.error('Error formatting time with timezone:', error);
    return new Date(utcDateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Clear the settings cache (call this when timezone settings are updated)
 */
export function clearTimezoneCache(): void {
  cachedSettings = null;
  lastCacheTime = 0;
}
