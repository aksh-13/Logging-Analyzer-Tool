import { LogEntry, WindowsLog, LogFormat } from '@/types/logs';

/**
 * Detects log format from CSV headers or content
 */
export function detectLogFormat(headers: string[], sampleRows: any[]): LogFormat {
  const headerLower = headers.map(h => h.toLowerCase());
  
  // Windows Structured Log format
  if (headerLower.includes('lineid') && headerLower.includes('component') && headerLower.includes('level')) {
    return 'windows';
  }
  
  // Linux syslog format (common CSV exports)
  if (headerLower.includes('timestamp') && (headerLower.includes('hostname') || headerLower.includes('host'))) {
    return 'linux-syslog';
  }
  
  // Apache access/error logs
  if (headerLower.includes('remotehost') || headerLower.includes('request') || headerLower.includes('status')) {
    return 'apache';
  }
  
  // Hadoop/HDFS logs
  if (headerLower.includes('logtime') && (headerLower.includes('level') || headerLower.includes('priority'))) {
    return 'hadoop';
  }
  
  // Spark logs
  if (headerLower.includes('timestamp') && headerLower.includes('logger')) {
    return 'spark';
  }
  
  // OpenSSH logs
  if (sampleRows.some(row => {
    const content = String(row[headers[0] || ''] || '').toLowerCase();
    return content.includes('sshd') || content.includes('connection') || content.includes('authentication');
  })) {
    return 'openssh';
  }
  
  // Default to auto-detect based on content
  return 'auto';
}

/**
 * Parses Windows Structured Log format
 */
function parseWindowsLog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase());
    return String(row[header || key] || '');
  };
  
  return {
    timestamp: getValue('Time'),
    component: getValue('Component'),
    level: getValue('Level'),
    content: getValue('Content'),
    source: 'Windows',
  };
}

/**
 * Parses Linux syslog format
 * Common formats:
 * - timestamp, hostname, program, level, message
 * - date, time, hostname, service, message
 */
function parseLinuxSyslog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string, alt?: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase() || h.toLowerCase() === (alt || '').toLowerCase());
    return String(row[header || key] || '');
  };
  
  const timestamp = getValue('timestamp', 'date') + ' ' + getValue('time', '');
  const component = getValue('program', 'service') || getValue('component', 'daemon') || getValue('logger', '');
  const level = getValue('level', 'priority') || getValue('severity', '') || 'Info';
  const content = getValue('message', 'msg') || getValue('content', '');
  
  return {
    timestamp: timestamp.trim(),
    component: component || 'unknown',
    level: normalizeLevel(level),
    content: content,
    source: 'Linux',
    hostname: getValue('hostname', 'host'),
    pid: getValue('pid', 'processid'),
  };
}

/**
 * Parses Apache log format
 */
function parseApacheLog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string, alt?: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase() || h.toLowerCase() === (alt || '').toLowerCase());
    return String(row[header || key] || '');
  };
  
  const timestamp = getValue('timestamp', 'time');
  const status = getValue('status', 'code');
  const request = getValue('request', 'uri');
  const level = parseInt(status) >= 500 ? 'Error' : parseInt(status) >= 400 ? 'Warning' : 'Info';
  
  return {
    timestamp: timestamp,
    component: 'apache',
    level: level,
    content: `${getValue('method', '')} ${request} - ${status} - ${getValue('referer', '')}`,
    source: 'Apache',
    hostname: getValue('remotehost', 'host'),
  };
}

/**
 * Parses Hadoop/HDFS log format
 */
function parseHadoopLog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string, alt?: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase() || h.toLowerCase() === (alt || '').toLowerCase());
    return String(row[header || key] || '');
  };
  
  return {
    timestamp: getValue('logtime', 'timestamp'),
    component: getValue('logger', 'component') || 'hadoop',
    level: normalizeLevel(getValue('level', 'priority')),
    content: getValue('message', 'msg') || getValue('content', ''),
    source: 'Hadoop',
  };
}

/**
 * Parses Spark log format
 */
function parseSparkLog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string, alt?: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase() || h.toLowerCase() === (alt || '').toLowerCase());
    return String(row[header || key] || '');
  };
  
  return {
    timestamp: getValue('timestamp', 'time'),
    component: getValue('logger', 'component') || 'spark',
    level: normalizeLevel(getValue('level', 'priority')),
    content: getValue('message', 'msg') || getValue('content', ''),
    source: 'Spark',
  };
}

/**
 * Parses OpenSSH log format
 */
function parseOpenSSHLog(row: any, headers: string[]): LogEntry {
  const getValue = (key: string, alt?: string) => {
    const header = headers.find(h => h.toLowerCase() === key.toLowerCase() || h.toLowerCase() === (alt || '').toLowerCase());
    return String(row[header || key] || '');
  };
  
  const content = getValue('message', 'msg') || getValue('content', '');
  const level = content.toLowerCase().includes('error') || content.toLowerCase().includes('failed') 
    ? 'Error' 
    : content.toLowerCase().includes('warning') 
    ? 'Warning' 
    : 'Info';
  
  return {
    timestamp: getValue('timestamp', 'date'),
    component: 'sshd',
    level: level,
    content: content,
    source: 'OpenSSH',
    hostname: getValue('hostname', 'host'),
  };
}

/**
 * Normalizes log levels across different systems
 */
function normalizeLevel(level: string): string {
  const levelLower = level.toLowerCase().trim();
  
  // Standard mappings
  if (levelLower.match(/error|err|critical|crit|fatal|emergency|emerg/)) return 'Error';
  if (levelLower.match(/warn|warning/)) return 'Warning';
  if (levelLower.match(/info|information|notice/)) return 'Info';
  if (levelLower.match(/debug|trace|verbose/)) return 'Debug';
  
  // Numeric levels (syslog)
  if (levelLower === '0' || levelLower === '1' || levelLower === '2') return 'Error';
  if (levelLower === '3' || levelLower === '4') return 'Warning';
  if (levelLower === '5' || levelLower === '6') return 'Info';
  if (levelLower === '7') return 'Debug';
  
  return level || 'Info';
}

/**
 * Universal log parser - handles all formats
 */
export function parseLogRow(row: any, headers: string[], format: LogFormat): LogEntry {
  switch (format) {
    case 'windows':
      return parseWindowsLog(row, headers);
    case 'linux-syslog':
      return parseLinuxSyslog(row, headers);
    case 'apache':
      return parseApacheLog(row, headers);
    case 'hadoop':
      return parseHadoopLog(row, headers);
    case 'spark':
      return parseSparkLog(row, headers);
    case 'openssh':
      return parseOpenSSHLog(row, headers);
    case 'auto':
    default:
      // Try to auto-detect from content
      const detected = detectLogFormat(headers, [row]);
      if (detected !== 'auto') {
        return parseLogRow(row, headers, detected);
      }
      // Fallback to Linux syslog format (most common)
      return parseLinuxSyslog(row, headers);
  }
}

/**
 * Converts WindowsLog format to unified LogEntry format
 */
export function convertWindowsLog(windowsLog: WindowsLog): LogEntry {
  return {
    timestamp: windowsLog.Time,
    component: windowsLog.Component,
    level: windowsLog.Level,
    content: windowsLog.Content,
    source: 'Windows',
  };
}

