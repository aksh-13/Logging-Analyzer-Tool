import Papa from 'papaparse';
import { LogEntry, LogFormat, WindowsLog } from '@/types/logs';
import { detectLogFormat, parseLogRow, convertWindowsLog } from './logParsers';

/**
 * Parses CSV file and returns unified LogEntry array
 * Supports multiple log formats: Windows, Linux syslog, Apache, Hadoop, Spark, OpenSSH, etc.
 */
export function parseCSV(file: File, format: LogFormat = 'auto'): Promise<LogEntry[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            reject(new Error('CSV file is empty or has no valid data'));
            return;
          }

          const headers = results.meta.fields || [];
          const detectedFormat = format === 'auto' ? detectLogFormat(headers, results.data.slice(0, 5)) : format;
          
          console.log(`[Parser] Detected log format: ${detectedFormat}`);
          console.log(`[Parser] Headers:`, headers);

          const logs: LogEntry[] = results.data.map((row: any) => {
            try {
              return parseLogRow(row, headers, detectedFormat);
            } catch (error) {
              console.warn('[Parser] Failed to parse row:', row, error);
              // Return a minimal log entry for invalid rows
              return {
                timestamp: new Date().toISOString(),
                component: 'unknown',
                level: 'Info',
                content: JSON.stringify(row),
                source: detectedFormat,
              };
            }
          }).filter(log => log.content && log.content.trim().length > 0);

          resolve(logs);
        } catch (error) {
          reject(new Error(`Failed to parse CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message || 'Unknown error'}`));
      },
    });
  });
}

/**
 * Legacy function for backward compatibility - converts to WindowsLog format
 */
export function parseCSVAsWindowsLog(file: File): Promise<WindowsLog[]> {
  return parseCSV(file).then((logs: LogEntry[]) => {
    return logs.map((log, index) => ({
      LineId: String(index + 1),
      Time: log.timestamp,
      Component: log.component,
      Level: log.level,
      Content: log.content,
    }));
  });
}

