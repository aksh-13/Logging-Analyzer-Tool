import { LogEntry, LogDigest, WindowsLog } from '@/types/logs';
import { convertWindowsLog } from '@/utils/logParsers';

/**
 * Simple clustering: Groups logs by Component-Level combination
 * This is the "money-saving" approach - minimal processing, maximum efficiency
 * Works with unified LogEntry format (supports Windows, Linux, Apache, Hadoop, etc.)
 */
export function processLogs(logs: LogEntry[] | WindowsLog[]): LogDigest[] {
  // Convert WindowsLog format to LogEntry if needed (backward compatibility)
  const unifiedLogs: LogEntry[] = logs.length > 0 && 'LineId' in logs[0]
    ? (logs as WindowsLog[]).map(convertWindowsLog)
    : logs as LogEntry[];
  // Step 1: Group logs by Component-Level (the "Human" clustering)
  const clusters = unifiedLogs.reduce((acc, log) => {
    const key = `${log.component}-${log.level}`;
    
    if (!acc[key]) {
      acc[key] = {
        component: log.component,
        level: log.level,
        count: 0,
        sample: log.content,
        fingerprint: key,
      };
    }
    
    acc[key].count++;
    return acc;
  }, {} as Record<string, {
    component: string;
    level: string;
    count: number;
    sample: string;
    fingerprint: string;
  }>);

  // Step 2: Convert to array and sort by count (most frequent first)
  const patterns = Object.values(clusters);
  
  // Sort by frequency (descending), then by level priority (Error > Warning > Info)
  const levelPriority: Record<string, number> = {
    Error: 3,
    Warning: 2,
    Info: 1,
  };

  patterns.sort((a, b) => {
    // First sort by count
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Then by level priority
    return (levelPriority[b.level] || 0) - (levelPriority[a.level] || 0);
  });

  // Step 3: Return top 100 (or all if less than 100)
  return patterns.slice(0, 100).map((p) => ({
    component: p.component,
    level: p.level,
    frequency: p.count,
    sampleContent: p.sample,
    fingerprint: p.fingerprint,
  }));
}

/**
 * Calculates processing statistics
 * Works with unified LogEntry format
 */
export function calculateStats(logs: LogEntry[] | WindowsLog[]): {
  totalLogs: number;
  uniquePatterns: number;
  errorCount: number;
  warningCount: number;
} {
  // Convert WindowsLog format to LogEntry if needed
  const unifiedLogs: LogEntry[] = logs.length > 0 && 'LineId' in logs[0]
    ? (logs as WindowsLog[]).map(convertWindowsLog)
    : logs as LogEntry[];
  
  const errorCount = unifiedLogs.filter((log) => log.level.toLowerCase() === 'error').length;
  const warningCount = unifiedLogs.filter((log) => log.level.toLowerCase() === 'warning').length;
  
  // Count unique Component-Level combinations (matching our clustering strategy)
  const uniquePatterns = new Set(
    unifiedLogs.map((log) => `${log.component}-${log.level}`)
  ).size;

  return {
    totalLogs: unifiedLogs.length,
    uniquePatterns,
    errorCount,
    warningCount,
  };
}

