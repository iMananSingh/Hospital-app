/**
 * Utility for parsing and formatting timestamps with proper timezone handling
 */

interface ParsedTimestamp {
  hasTime: boolean;
  date: Date | null;
  display: string;
}

/**
 * Parse various timestamp formats and return display string with proper timezone handling
 */
export function parseTimestamp(raw: any, hospitalTimeZone?: string): ParsedTimestamp {
  if (!raw) return { hasTime: false, date: null, display: "N/A" };
  
  const rawStr = String(raw);
  let date: Date | null = null;
  let hasTime = false;

  // Detect format and parse appropriately
  if (detectISO(rawStr)) {
    // ISO format with timezone info - parse as UTC and convert
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

  // Format the date appropriately
  const display = formatDateTime(date, hasTime, hospitalTimeZone);
  
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
  // Parse "YYYY-MM-DD HH:MM:SS" as local time to avoid timezone conversion
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

function formatDateTime(date: Date, hasTime: boolean, timeZone?: string): string {
  // Convert to IST if timeZone is specified as Asia/Kolkata
  let displayDate = date;
  if (timeZone === 'Asia/Kolkata' && hasTime) {
    // Add 5 hours and 30 minutes to convert UTC to IST
    displayDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  if (hasTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const formatted = formatter.format(displayDate);

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