import { parse, isValid, format } from 'date-fns';

/**
 * Common date format patterns to try when parsing dates.
 * Ordered by likelihood/preference.
 */
const DATE_FORMATS = [
  'yyyy-MM-dd',           // ISO 8601: 2025-11-04
  'dd/MM/yyyy',           // AU/UK: 04/11/2025
  'MM/dd/yyyy',           // US: 11/04/2025
  'dd-MM-yyyy',           // Hyphenated: 04-11-2025
  'MM-dd-yyyy',           // US hyphenated: 11-04-2025
  'yyyy/MM/dd',           // ISO slash: 2025/11/04
  "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",  // ISO 8601 with time
  "yyyy-MM-dd'T'HH:mm:ss",         // ISO without timezone
  'MMMM dd yyyy HH:mm:ss',         // Verbose: August 19 1975 23:15:30
  'MMMM dd yyyy',                  // Verbose short: August 19 1975
];

/**
 * Parse a date string in various formats and normalize to YYYY-MM-DD.
 * 
 * @param {string} dateString - Date string to parse
 * @param {string} formatHint - Format hint: 'auto', 'dd/mm/yyyy', 'mm/dd/yyyy', or 'yyyy-mm-dd'
 * @returns {Object} Result object with { success: boolean, date: string|null, error: string|null }
 * 
 * @example
 * parseAndNormalizeDate('04/11/2025', 'dd/mm/yyyy') // { success: true, date: '2025-11-04', error: null }
 * parseAndNormalizeDate('04/11/2025', 'mm/dd/yyyy') // { success: true, date: '2025-04-11', error: null }
 * parseAndNormalizeDate('August 19 1975 23:15:30 UTC') // { success: true, date: '1975-08-19', error: null }
 * parseAndNormalizeDate('invalid') // { success: false, date: null, error: 'Unable to parse date...' }
 */
export function parseAndNormalizeDate(dateString, formatHint = 'auto') {
  if (!dateString || typeof dateString !== 'string') {
    return {
      success: false,
      date: null,
      error: 'Date is required',
    };
  }

  const trimmed = dateString.trim();
  if (!trimmed) {
    return {
      success: false,
      date: null,
      error: 'Date is required',
    };
  }

  // Build format priority list based on hint
  let formatsToTry = [...DATE_FORMATS];
  
  if (formatHint === 'dd/mm/yyyy') {
    // Prioritize DD/MM/YYYY formats
    formatsToTry = [
      'dd/MM/yyyy',
      'dd-MM-yyyy',
      ...DATE_FORMATS.filter(f => !f.includes('dd/MM') && !f.includes('dd-MM'))
    ];
  } else if (formatHint === 'mm/dd/yyyy') {
    // Prioritize MM/DD/YYYY formats
    formatsToTry = [
      'MM/dd/yyyy',
      'MM-dd-yyyy',
      ...DATE_FORMATS.filter(f => !f.includes('MM/dd') && !f.includes('MM-dd'))
    ];
  } else if (formatHint === 'yyyy-mm-dd') {
    // Prioritize ISO formats
    formatsToTry = [
      'yyyy-MM-dd',
      'yyyy/MM/dd',
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      "yyyy-MM-dd'T'HH:mm:ss",
      ...DATE_FORMATS.filter(f => !f.startsWith('yyyy'))
    ];
  }
  // 'auto' uses default DATE_FORMATS order

  // Try parsing with each format
  for (const formatString of formatsToTry) {
    try {
      const parsed = parse(trimmed, formatString, new Date());
      if (isValid(parsed)) {
        // Normalize to YYYY-MM-DD (ISO 8601 date only)
        const normalized = format(parsed, 'yyyy-MM-dd');
        return {
          success: true,
          date: normalized,
          error: null,
        };
      }
    } catch (e) {
      // Continue to next format
      continue;
    }
  }

  // If no format matched, try native Date parsing as last resort
  try {
    const parsed = new Date(trimmed);
    if (isValid(parsed) && !isNaN(parsed.getTime())) {
      const normalized = format(parsed, 'yyyy-MM-dd');
      return {
        success: true,
        date: normalized,
        error: null,
      };
    }
  } catch (e) {
    // Fall through to error
  }

  return {
    success: false,
    date: null,
    error: `Unable to parse date: "${trimmed}". Expected formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or ISO 8601.`,
  };
}

/**
 * Validate that a date string is in YYYY-MM-DD format.
 * 
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid YYYY-MM-DD format
 */
export function isValidISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(dateString)) {
    return false;
  }
  
  const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(parsed);
}
