export interface WindowsLog {
  LineId: string;
  Time: string;
  Component: string;
  Level: string;
  Content: string;
}

export interface LogGroup {
  component: string;
  contentFingerprint: string;
  content: string;
  level: string;
  count: number;
  sampleTime: string;
}

export interface AnalyzedInsight {
  contentFingerprint: string;
  component: string;
  level: string;
  count: number;
  plainEnglish: string;
  businessImpact: string;
  recommendedFix: string;
  originalContent: string;
  sampleTime: string;
}

export interface AnalysisStats {
  totalLogs: number;
  uniqueIssues: number;
  errorPercentage: number;
}

