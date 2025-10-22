/**
 * Utility for parsing and formatting timestamps using local system time
 */

interface ParsedTimestamp {
  hasTime: boolean;
  date: Date | null;
  display: string;
}

/**
 * Parse various timestamp formats and return display string using local system time
 */
export function parseTimestamp(raw: any, hospitalTimeZone?: string): ParsedTimestamp {
  if (!raw) return { hasTime: false, date: null, display: "N/A" };
  
  const rawStr = String(raw);
  let date: Date | null = null;
  let hasTime = false;

  // Detect format and parse appropriately
  if (detectISO(rawStr)) {
    // ISO format - parse normally and let browser handle timezone
    date = new Date(rawStr);
    hasTime = true;
  } else if (detectSQLDateTime(rawStr)) {
    // SQL format "YYYY-MM-DD HH:MM:SS" - parse as local time
    date = parseSQLDateTime(rawStr);
    hasTime = true;
  } else if (detectDateOnly(rawStr)) {
    // Date only "YYYY-MM-DD" - no time info
    const [year, month, day] = rawStr.split('-').map(Number);
    date = new Date(year, month - 1, day);
    hasTime = false;
  } else if (detectNumeric(rawStr)) {
    // Numeric timestamp
    const num = Number(rawStr);
    const timestamp = num > 1e12 ? num : num * 1000; // Convert seconds to ms if needed
    date = new Date(timestamp);
    hasTime = true;
  } else {
    // Fallback to default Date parsing
    date = new Date(rawStr);
    hasTime = rawStr.includes(':') || rawStr.includes('T');
  }

  if (!date || isNaN(date.getTime())) {
    return { hasTime: false, date: null, display: "N/A" };
  }

  // Format the date appropriately using local system time
  const display = formatDateTime(date, hasTime);
  
  return { hasTime, date, display };
}

function detectISO(str: string): boolean {
  return /T.*[Z\+\-]/.test(str) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str);
}

function detectSQLDateTime(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str);
}

function detectDateOnly(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function detectNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

function parseSQLDateTime(sqlStr: string): Date {
  // Parse "YYYY-MM-DD HH:MM:SS" as local time
  const match = sqlStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return new Date(sqlStr); // Fallback
  
  const [, year, month, day, hour, minute, second = '0'] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

/**
 * Calculate admission stay duration in days using consistent logic
 * Uses the same calculation as backend billing to ensure consistency
 */
export function calcStayDays(admissionDate: string | Date, endDate?: string | Date): number {
  let startDate: Date;
  
  // Parse admission date using existing detection logic for robustness
  if (typeof admissionDate === 'string') {
    if (detectSQLDateTime(admissionDate)) {
      startDate = parseSQLDateTime(admissionDate);
    } else if (detectISO(admissionDate)) {
      startDate = new Date(admissionDate);
    } else {
      startDate = new Date(admissionDate);
    }
  } else {
    startDate = admissionDate;
  }
  
  const end = endDate ? new Date(endDate) : new Date();
  
  // Guard against invalid dates
  if (isNaN(startDate.getTime()) || isNaN(end.getTime())) {
    return 1; // Fallback to minimum 1 day for invalid dates
  }
  
  // Use the same calculation as backend billing system
  const timeDiff = end.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));
}

function formatDateTime(date: Date, hasTime: boolean): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
    // No timeZone specified - uses local system timezone automatically
  };

  if (hasTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const formatted = formatter.format(date);

  if (hasTime) {
    // Split date and time parts for better styling
    const parts = formatted.split(' at ');
    if (parts.length === 2) {
      return parts.join(' at ');
    } else {
      // Fallback: try to split on comma or last space before AM/PM
      const match = formatted.match(/^(.+?)(\s+\d{1,2}:\d{2}\s*[AP]M)$/i);
      if (match) {
        return `${match[1]} at ${match[2].trim()}`;
      }
    }
  }

  return formatted;
}