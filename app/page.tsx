'use client';

import { useState } from 'react';
import { Card, Chip, Spinner, Alert, Accordion, AccordionItem, Input } from '@heroui/react';
import { parseCSV } from '@/utils/csvParser';
import { processLogs, calculateStats } from '@/lib/log-processor';
import { analyzeLogDigest } from '@/app/actions/analyzeLogDigest';
import { LogEntry, AnalyzedLogPattern, LogFormat } from '@/types/logs';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'processing' | 'analyzing' | 'complete'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyzedPatterns, setAnalyzedPatterns] = useState<AnalyzedLogPattern[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<number | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<LogFormat>('auto');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setAnalyzedPatterns([]);
    setStats(null);
    setStatus('parsing');

    try {
      // Step 1: Parse CSV (auto-detects format)
      setStatus('parsing');
      const parsedLogs = await parseCSV(file, 'auto');
      setLogs(parsedLogs);
      
      // Detect format from first log entry
      if (parsedLogs.length > 0) {
        const source = parsedLogs[0].source || 'unknown';
        const formatMap: Record<string, LogFormat> = {
          'Windows': 'windows',
          'Linux': 'linux-syslog',
          'Apache': 'apache',
          'Hadoop': 'hadoop',
          'Spark': 'spark',
          'OpenSSH': 'openssh',
        };
        setDetectedFormat(formatMap[source] || 'auto');
      }

      // Step 2: Pre-aggregate locally (client-side)
      setStatus('processing');
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for UI update
      const digest = processLogs(parsedLogs);
      const calculatedStats = calculateStats(parsedLogs);
      setStats(calculatedStats);

      // Step 3: Send only the digest to AI (minimal payload)
      setStatus('analyzing');
      const aiSummaries = await analyzeLogDigest(digest);

      // Step 4: Combine digest with AI summaries
      const patterns: AnalyzedLogPattern[] = digest.map((d, idx) => ({
        ...d,
        humanMeaning: aiSummaries[idx]?.humanMeaning || 'Analysis pending...',
        severityScore: aiSummaries[idx]?.severityScore || 5,
        totalOccurrences: d.frequency,
      }));

      setAnalyzedPatterns(patterns);
      setStatus('complete');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process file';
      setError(errorMessage);
      setStatus('idle');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const getLevelColor = (level: string): 'danger' | 'warning' | 'primary' => {
    if (level === 'Error') return 'danger';
    if (level === 'Warning') return 'warning';
    return 'primary';
  };

  const getSeverityColor = (score: number): 'danger' | 'warning' | 'success' | 'default' => {
    if (score >= 8) return 'danger';
    if (score >= 5) return 'warning';
    if (score >= 3) return 'success';
    return 'default';
  };

  const filteredPatterns = severityFilter !== null
    ? analyzedPatterns.filter((p) => p.severityScore >= severityFilter)
    : analyzedPatterns;

  const statusMessages = {
    idle: 'Ready to upload',
    parsing: 'Parsing CSV file...',
    processing: 'Pre-aggregating logs (client-side)...',
    analyzing: 'Analyzing with AI...',
    complete: 'Analysis complete',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📊</span>
            <h2 className="text-xl font-bold text-gray-900">LogVision</h2>
          </div>
          <p className="text-sm text-gray-500">High-Efficiency Log Analyzer</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Log Analysis Dashboard</h1>
          {status !== 'idle' && (
            <p className="text-sm text-gray-600 mt-1">{statusMessages[status]}</p>
          )}
        </header>

        {/* Content */}
        <main className="p-8 space-y-6">
          {/* Upload Section */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Upload CSV Log File</h3>
            <label
              htmlFor="file-upload"
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                loading
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-primary hover:bg-primary-50'
              }`}
            >
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
              />
              <span className={`text-5xl mb-4 ${loading ? 'text-gray-400' : 'text-primary'}`}>📤</span>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Click or drag CSV file to this area to upload
              </p>
              <p className="text-xs text-gray-500 text-center px-4">
                Supports multiple log formats: Windows, Linux syslog, Apache, Hadoop, Spark, OpenSSH, OpenStack, HDFS, BGL, HPC, Mac, Proxifier, Thunderbird, and more. Auto-detects format from CSV headers.
              </p>
            </label>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert
              color="danger"
              title="Error"
              description={error}
              onClose={() => setError(null)}
              className="mb-4"
            />
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center">
                <Spinner size="lg" color="primary" />
                <p className="mt-4 text-gray-600">{statusMessages[status]}</p>
              </div>
            </Card>
          )}

          {/* Detected Format */}
          {detectedFormat !== 'auto' && !loading && (
            <Alert
              color="success"
              title="Log Format Detected"
              description={`Successfully parsed ${detectedFormat} format logs`}
              className="mb-4"
            />
          )}

          {/* Stats Overview */}
          {stats && !loading && (
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-primary mb-2">
                    {stats.totalLogs.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600">Total Logs</p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-success mb-2">
                    {stats.uniquePatterns.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600">Unique Patterns</p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-danger mb-2">
                    {stats.errorCount.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600">Errors</p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-warning mb-2">
                    {stats.warningCount.toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-600">Warnings</p>
                </div>
              </Card>
            </div>
          )}

          {/* Results with Accordion */}
          {analyzedPatterns.length > 0 && !loading && (
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">AI-Analyzed Log Patterns</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Filter by Severity:</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="Min score"
                    value={severityFilter?.toString() || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSeverityFilter(val ? parseInt(val) : null);
                    }}
                    className="w-24"
                    size="sm"
                  />
                  {severityFilter !== null && (
                    <Chip
                      variant="flat"
                      onClose={() => setSeverityFilter(null)}
                      size="sm"
                    >
                      ≥ {severityFilter}
                    </Chip>
                  )}
                </div>
              </div>
              <Accordion selectionMode="multiple" variant="splitted">
                {filteredPatterns.map((pattern) => (
                  <AccordionItem
                    key={pattern.fingerprint}
                    title={
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {pattern.component}
                        </span>
                        <Chip
                          color={getLevelColor(pattern.level)}
                          variant="flat"
                          size="sm"
                        >
                          {pattern.level}
                        </Chip>
                        <Chip
                          color={getSeverityColor(pattern.severityScore)}
                          variant="flat"
                          size="sm"
                        >
                          Severity: {pattern.severityScore}/10
                        </Chip>
                        <Chip variant="flat" size="sm">
                          {pattern.totalOccurrences}x
                        </Chip>
                      </div>
                    }
                    subtitle={pattern.humanMeaning}
                  >
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-900 mb-2">
                          Human Meaning:
                        </h4>
                        <p className="text-sm text-gray-700">{pattern.humanMeaning}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-gray-900 mb-2">
                          Original Technical Content:
                        </h4>
                        <div className="p-3 bg-white rounded border border-gray-200 font-mono text-xs text-gray-800 overflow-x-auto">
                          {pattern.sampleContent}
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>
                          <span className="font-medium">Frequency:</span> {pattern.frequency} occurrences
                        </span>
                        <span>
                          <span className="font-medium">Severity Score:</span> {pattern.severityScore}/10
                        </span>
                      </div>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredPatterns.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No patterns match the severity filter. Try adjusting the filter.
                </p>
              )}
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
