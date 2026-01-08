// Unified log entry interface that works across all log types
export interface LogEntry {
  timestamp: string;
  component: string; // Service/daemon name (e.g., "sshd", "apache2", "kernel")
  level: string; // Severity (Error, Warning, Info, Debug, etc.)
  content: string; // The actual log message
  source?: string; // Original log source (Windows, Linux, Apache, etc.)
  hostname?: string; // For distributed systems
  pid?: string; // Process ID
}

// Legacy Windows format (for backward compatibility)
export interface WindowsLog {
  LineId: string;
  Time: string;
  Component: string;
  Level: string;
  Content: string;
}

export interface LogDigest {
  component: string;
  level: string;
  frequency: number;
  sampleContent: string;
  fingerprint: string;
}

export interface AISummary {
  humanMeaning: string;
  severityScore: number;
}

export interface AnalyzedLogPattern extends LogDigest {
  humanMeaning: string;
  severityScore: number;
  totalOccurrences: number;
}

export interface ProcessingStatus {
  stage: 'idle' | 'parsing' | 'processing' | 'analyzing' | 'complete';
  message: string;
  progress?: number;
}

// Supported log formats
export type LogFormat = 
  | 'windows' 
  | 'linux-syslog' 
  | 'apache' 
  | 'hadoop' 
  | 'spark' 
  | 'openssh' 
  | 'openstack' 
  | 'thunderbird'
  | 'auto'; // Auto-detect
