'use client';

import { useState, useCallback } from 'react';
import { Collapse, Tag, Tooltip } from 'antd';
import {
  DashboardOutlined,
  UploadOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CheckCircleFilled,
  LoadingOutlined,
  ExclamationCircleFilled,
  CloseOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { parseCSV } from '@/utils/csvParser';
import { processLogs, calculateStats } from '@/lib/log-processor';
import { analyzeLogDigest } from '@/app/actions/analyzeLogDigest';
import { LogEntry, AnalyzedLogPattern, LogFormat } from '@/types/logs';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Library: Ant Design (antd)
   Aesthetic: Retro terminal / CRT monitor
   — Sharp corners, monospace labels, electric
   green primary, amber warnings, red errors,
   CRT scanline overlay, blinking cursors.
   Looks nothing like shadcn/NextUI/HeroUI.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// ── Progress Steps ──
function TerminalProgress({ status }: { status: string }) {
  const steps = [
    { id: 'parsing', label: 'PARSE_CSV' },
    { id: 'processing', label: 'PROCESS_LOGS' },
    { id: 'analyzing', label: 'AI_ANALYZE' },
    { id: 'complete', label: 'COMPLETE' },
  ];

  const currentIdx = steps.findIndex((s) => s.id === status);

  return (
    <div style={{ padding: '20px' }}>
      {steps.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const cls = isDone ? 'step-done' : isActive ? 'step-active' : '';
        return (
          <div key={step.id} className={`lv-progress-step ${cls}`}>
            <div className="lv-progress-pip" />
            <span>
              {isDone && '✓ '}
              {isActive && '▶ '}
              {step.label}
              {isActive && <span style={{ animation: 'blink 1s step-end infinite' }}> _</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──
export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'processing' | 'analyzing' | 'complete'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyzedPatterns, setAnalyzedPatterns] = useState<AnalyzedLogPattern[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<number | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<LogFormat>('auto');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setAnalyzedPatterns([]);
    setStats(null);
    setStatus('parsing');

    try {
      const parsedLogs = await parseCSV(file, 'auto');
      setLogs(parsedLogs);

      if (parsedLogs.length > 0) {
        const source = parsedLogs[0].source || 'unknown';
        const formatMap: Record<string, LogFormat> = {
          Windows: 'windows', Linux: 'linux-syslog', Apache: 'apache',
          Hadoop: 'hadoop', Spark: 'spark', OpenSSH: 'openssh',
        };
        setDetectedFormat(formatMap[source] || 'auto');
      }

      setStatus('processing');
      await new Promise((r) => setTimeout(r, 100));
      const digest = processLogs(parsedLogs);
      const calculatedStats = calculateStats(parsedLogs);
      setStats(calculatedStats);

      setStatus('analyzing');
      const aiSummaries = await analyzeLogDigest(digest);

      const patterns: AnalyzedLogPattern[] = digest.map((d, idx) => ({
        ...d,
        humanMeaning: aiSummaries[idx]?.humanMeaning || 'Awaiting analysis...',
        severityScore: aiSummaries[idx]?.severityScore || 5,
        totalOccurrences: d.frequency,
      }));

      setAnalyzedPatterns(patterns);
      setStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStatus('idle');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      const input = document.getElementById('file-upload') as HTMLInputElement;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const getSevClass = (score: number) => score >= 8 ? 'lv-sev-crit' : score >= 5 ? 'lv-sev-warn' : 'lv-sev-info';
  const getLevelClass = (level: string) => level === 'Error' ? 'lv-level-error' : level === 'Warning' ? 'lv-level-warning' : 'lv-level-info';

  const filteredPatterns = severityFilter !== null
    ? analyzedPatterns.filter((p) => p.severityScore >= severityFilter)
    : analyzedPatterns;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--lv-bg)' }}>
      {/* ════ Sidebar ════ */}
      <aside className="lv-sidebar">
        <div className="lv-sidebar-logo">
          <h2>
            {'>'} LogVision
            <span className="logo-cursor" />
          </h2>
          <p>system log analyzer</p>
        </div>

        <nav className="lv-nav">
          <div className="lv-nav-item active">
            <DashboardOutlined />
            Dashboard
          </div>
          <div className="lv-nav-item">
            <UploadOutlined />
            Ingest
          </div>
          <div className="lv-nav-item">
            <BarChartOutlined />
            Patterns
          </div>
        </nav>

        <div className="lv-sidebar-footer">
          v1.0 &middot; gemini ai engine
        </div>
      </aside>

      {/* ════ Main ════ */}
      <div style={{ flex: 1, marginLeft: 220, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header className="lv-header">
          <h1 style={{ fontFamily: "'Space Grotesk', var(--font-heading), sans-serif" }}>
            Log Analysis Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {detectedFormat !== 'auto' && !loading && (
              <span className="lv-format-badge">
                fmt: {detectedFormat}
              </span>
            )}
            <div className="lv-status">
              <div className={`lv-status-dot ${loading ? 'active' : ''}`} />
              <span style={{ color: loading ? 'var(--lv-amber)' : 'var(--lv-green-dim)' }}>
                {loading ? 'PROCESSING' : 'IDLE'}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: '20px 24px' }}>

          {/* Error */}
          {error && (
            <div className="lv-error-panel" style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ExclamationCircleFilled style={{ color: 'var(--lv-red)', fontSize: 14, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                  fontSize: 11,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  color: 'var(--lv-red)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}>
                  ERROR
                </div>
                <div style={{ fontSize: 13, color: 'var(--lv-text)', lineHeight: 1.5 }}>
                  {error}
                </div>
              </div>
              <CloseOutlined
                onClick={() => setError(null)}
                style={{ color: 'var(--lv-text-muted)', cursor: 'pointer', fontSize: 12 }}
              />
            </div>
          )}

          {/* Upload */}
          {!loading && status !== 'complete' && (
            <div className="lv-panel" style={{ marginBottom: 20 }}>
              <div className="lv-panel-header">
                <span className="lv-panel-title">
                  <FileTextOutlined style={{ marginRight: 8 }} />
                  Upload Log File
                </span>
              </div>
              <div style={{ padding: 20 }}>
                <label
                  htmlFor="file-upload"
                  className={`lv-upload-zone ${isDragging ? 'dragging' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                    style={{ display: 'none' }}
                  />
                  <UploadOutlined className="lv-upload-icon" />
                  <div style={{
                    fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--lv-text)',
                    marginBottom: 8,
                  }}>
                    {isDragging ? '[ DROP FILE ]' : '[ CLICK OR DROP CSV ]'}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                    fontSize: 10,
                    color: 'var(--lv-text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.04em',
                    maxWidth: 480,
                    textAlign: 'center' as const,
                    lineHeight: 1.8,
                  }}>
                    Windows &middot; Linux &middot; Apache &middot; Hadoop &middot; Spark &middot; OpenSSH &middot; OpenStack &middot; HDFS &middot; BGL &middot; HPC &middot; Mac &middot; Thunderbird
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="lv-panel" style={{ marginBottom: 20, display: 'flex' }}>
              <div style={{ borderRight: '1px solid var(--lv-border)', minWidth: 200 }}>
                <TerminalProgress status={status} />
              </div>
              <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="lv-shimmer" style={{ height: 36, animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && !loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <div className="lv-stat-block stat-total">
                <div className="lv-stat-label">total logs</div>
                <div className="lv-stat-value val-total">{stats.totalLogs.toLocaleString()}</div>
              </div>
              <div className="lv-stat-block stat-patterns">
                <div className="lv-stat-label">unique patterns</div>
                <div className="lv-stat-value val-patterns">{stats.uniquePatterns.toLocaleString()}</div>
              </div>
              <div className="lv-stat-block stat-errors">
                <div className="lv-stat-label">errors</div>
                <div className="lv-stat-value val-errors">{stats.errorCount.toLocaleString()}</div>
              </div>
              <div className="lv-stat-block stat-warnings">
                <div className="lv-stat-label">warnings</div>
                <div className="lv-stat-value val-warnings">{stats.warningCount.toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Results */}
          {analyzedPatterns.length > 0 && !loading && (
            <div className="lv-panel">
              <div className="lv-panel-header">
                <span className="lv-panel-title">
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  AI-Analyzed Patterns
                  <span style={{ marginLeft: 8, color: 'var(--lv-text-muted)' }}>
                    ({filteredPatterns.length}/{analyzedPatterns.length})
                  </span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                    fontSize: 10,
                    color: 'var(--lv-text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em',
                  }}>
                    min sev:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="—"
                    value={severityFilter ?? ''}
                    onChange={(e) => setSeverityFilter(e.target.value ? parseInt(e.target.value) : null)}
                    className="lv-filter-input"
                  />
                  {severityFilter !== null && (
                    <Tag
                      closable
                      onClose={() => setSeverityFilter(null)}
                      style={{
                        background: 'var(--lv-green-bg)',
                        color: 'var(--lv-green-dim)',
                        border: '1px solid var(--lv-green-muted)',
                        borderRadius: 2,
                        fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                        fontSize: 11,
                      }}
                    >
                      ≥{severityFilter}
                    </Tag>
                  )}
                </div>
              </div>

              {/* Pattern rows with Ant Design Collapse */}
              <Collapse
                accordion={false}
                ghost
                expandIcon={({ isActive }) => (
                  <CaretRightOutlined
                    rotate={isActive ? 90 : 0}
                    style={{ color: 'var(--lv-text-muted)', fontSize: 10 }}
                  />
                )}
                items={filteredPatterns.map((pattern) => ({
                  key: pattern.fingerprint,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--lv-text)',
                      }}>
                        {pattern.component}
                      </span>
                      <span className={`lv-level ${getLevelClass(pattern.level)}`}>
                        {pattern.level}
                      </span>
                      <span className={`lv-sev ${getSevClass(pattern.severityScore)}`}>
                        {pattern.severityScore >= 8 ? '▲' : pattern.severityScore >= 5 ? '●' : '▼'} {pattern.severityScore}/10
                      </span>
                      <Tooltip title="Total occurrences" placement="top">
                        <span style={{
                          fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                          fontSize: 11,
                          color: 'var(--lv-text-muted)',
                          background: 'var(--lv-bg)',
                          border: '1px solid var(--lv-border)',
                          padding: '1px 8px',
                          borderRadius: 2,
                        }}>
                          {pattern.totalOccurrences}×
                        </span>
                      </Tooltip>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                        fontSize: 11,
                        color: 'var(--lv-text-dim)',
                        marginLeft: 'auto',
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' as const,
                      }}>
                        {pattern.humanMeaning}
                      </span>
                    </div>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div className="lv-detail-label">AI Interpretation</div>
                        <p style={{
                          fontSize: 13,
                          lineHeight: 1.7,
                          color: 'var(--lv-text)',
                          margin: 0,
                          fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                        }}>
                          {pattern.humanMeaning}
                        </p>
                      </div>
                      <div>
                        <div className="lv-detail-label">Raw Log Sample</div>
                        <div className="lv-code">{pattern.sampleContent}</div>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: 32,
                        paddingTop: 12,
                        borderTop: '1px solid var(--lv-border)',
                      }}>
                        <div>
                          <div className="lv-detail-label">Frequency</div>
                          <span style={{
                            fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                            fontWeight: 700,
                            fontSize: 16,
                            color: 'var(--lv-cyan)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {pattern.frequency.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <div className="lv-detail-label">Severity Score</div>
                          <span style={{
                            fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                            fontWeight: 700,
                            fontSize: 16,
                            color: pattern.severityScore >= 8 ? 'var(--lv-red)' : pattern.severityScore >= 5 ? 'var(--lv-amber)' : 'var(--lv-green-dim)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {pattern.severityScore} / 10
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                }))}
              />

              {filteredPatterns.length === 0 && (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  fontFamily: "'IBM Plex Mono', var(--font-mono), monospace",
                  fontSize: 12,
                  color: 'var(--lv-text-muted)',
                }}>
                  No patterns match severity ≥ {severityFilter}. Adjust filter.
                </div>
              )}
            </div>
          )}

          {/* Analyze another */}
          {status === 'complete' && !loading && analyzedPatterns.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <label htmlFor="file-upload-again" className="lv-again-btn">
                <input
                  id="file-upload-again"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                [ ↻ ANALYZE ANOTHER ]
              </label>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
