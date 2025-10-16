import { useQuery } from "@tanstack/react-query";

/**
 * Hook to get timezone-aware formatting functions
 * These functions will automatically use the configured hospital timezone
 */
export function useTimezone() {
  const { data: systemSettings } = useQuery({
    queryKey: ["/api/settings/system"],
  });

  const timezone = systemSettings?.timezone || "UTC";

  /**
   * Format a UTC timestamp for human-readable display in the configured timezone
   * @param utcDateString - ISO 8601 UTC timestamp string from the server
   * @returns Formatted date and time string (e.g., "Oct 2, 2025, 8:30 PM")
   */
  const formatDateTime = (utcDateString: string | null | undefined): string => {
    if (!utcDateString) return "N/A";
    
    try {
      // Ensure the date string is treated as UTC
      let utcDate: Date;
      if (utcDateString.endsWith('Z') || utcDateString.includes('+') || utcDateString.includes('T')) {
        // Already in ISO format with timezone info
        utcDate = new Date(utcDateString);
      } else {
        // Assume UTC if no timezone info (append Z)
        utcDate = new Date(utcDateString + 'Z');
      }
      
      if (isNaN(utcDate.getTime())) {
        return "N/A";
      }
      
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(utcDate);
    } catch (error) {
      console.error("Error formatting timestamp with timezone:", error);
      return "N/A";
    }
  };

  /**
   * Format a UTC timestamp for date-only display in the configured timezone
   * @param utcDateString - ISO 8601 UTC timestamp string from the server
   * @returns Formatted date string (e.g., "Oct 2, 2025")
   */
  const formatDate = (utcDateString: string | null | undefined): string => {
    if (!utcDateString) return "N/A";
    
    try {
      // Ensure the date string is treated as UTC
      let utcDate: Date;
      if (utcDateString.endsWith('Z') || utcDateString.includes('+') || utcDateString.includes('T')) {
        utcDate = new Date(utcDateString);
      } else {
        utcDate = new Date(utcDateString + 'Z');
      }
      
      if (isNaN(utcDate.getTime())) {
        return "N/A";
      }
      
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(utcDate);
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      return "N/A";
    }
  };

  /**
   * Format a UTC timestamp for time-only display in the configured timezone
   * @param utcDateString - ISO 8601 UTC timestamp string from the server
   * @returns Formatted time string (e.g., "8:30 PM")
   */
  const formatTime = (utcDateString: string | null | undefined): string => {
    if (!utcDateString) return "N/A";
    
    try {
      // Ensure the date string is treated as UTC
      let utcDate: Date;
      if (utcDateString.endsWith('Z') || utcDateString.includes('+') || utcDateString.includes('T')) {
        utcDate = new Date(utcDateString);
      } else {
        utcDate = new Date(utcDateString + 'Z');
      }
      
      if (isNaN(utcDate.getTime())) {
        return "N/A";
      }
      
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(utcDate);
    } catch (error) {
      console.error("Error formatting time with timezone:", error);
      return "N/A";
    }
  };

  return {
    timezone,
    formatDateTime,
    formatDate,
    formatTime,
  };
}
