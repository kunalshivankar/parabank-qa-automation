export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';
export type RunStatus = 'passed' | 'failed' | 'timedout' | 'interrupted';

export interface ReportError {
  attempt: number;
  message: string;
  location?: string;
  snippet?: string;
  stack?: string;
  stepTitle?: string;
}

export interface ReportAttachment {
  attempt: number;
  name: string;
  contentType: string;
  kind: 'image' | 'text' | 'file' | 'unavailable';
  dataUri?: string;
  text?: string;
  href?: string;
  note?: string;
  stepTitle?: string;
  timestamp?: string;
}

export interface ReportAnnotation {
  type: string;
  description?: string;
}

export interface ReportStep {
  title: string;
  category: string;
  subtitle?: string;
  status?: string;
  durationMs: number;
  startTime?: string;
  error?: string;
  steps: ReportStep[];
}

export interface ReportLog {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface ReportTest {
  id: string;
  title: string;
  file: string;
  line: number;
  project: string;
  status: TestStatus;
  outcomeDetail: string;
  durationMs: number;
  attempts: number;
  tags: string[];
  annotations: ReportAnnotation[];
  errors: ReportError[];
  attachments: ReportAttachment[];
  module?: string;
  description?: string;
  scenario?: string;
  testType?: string;
  priority?: string;
  severity?: string;
  browser?: string;
  environment?: string;
  preconditions?: string;
  testData?: string;
  expectedResult?: string;
  actualResult?: string;
  startTime?: string;
  endTime?: string;
  steps?: ReportStep[];
  logs?: ReportLog[];
  bugReference?: string;
  bugTitle?: string;
}

export interface ReportTotals {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  passRate: number | null;
}

export interface ProjectSummary extends ReportTotals {
  name: string;
}

export interface EnvironmentEntry {
  label: string;
  value: string;
}

export interface TesterInformation {
  name?: string;
  designation?: string;
  projectName?: string;
  applicationUrl?: string;
  environment?: string;
  browser?: string;
  browserVersion?: string;
  operatingSystem?: string;
  playwrightVersion?: string;
  executionMode?: string;
  buildNumber?: string;
}

export interface ArtifactCounts {
  screenshots: number;
  videos: number;
  traces: number;
}

export interface ReportData {
  title: string;
  startedAt: string;
  durationMs: number;
  runStatus: RunStatus;
  totals: ReportTotals;
  projects: ProjectSummary[];
  environment: EnvironmentEntry[];
  tests: ReportTest[];
  tester?: TesterInformation;
  endedAt?: string;
  artifactCounts?: ArtifactCounts;
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function computeTotals(tests: readonly Pick<ReportTest, 'status'>[]): ReportTotals {
  const count = (status: TestStatus): number => tests.filter((test) => test.status === status).length;
  const passed = count('passed');
  const failed = count('failed');
  const flaky = count('flaky');
  const skipped = count('skipped');
  const executed = passed + failed + flaky;
  return {
    total: tests.length,
    passed,
    failed,
    flaky,
    skipped,
    passRate: executed === 0 ? null : Math.round((passed * 1000) / executed) / 10,
  };
}

export function summarizeProjects(tests: readonly ReportTest[]): ProjectSummary[] {
  const names = [...new Set(tests.map((test) => test.project))];
  return names.map((name) => ({
    name,
    ...computeTotals(tests.filter((test) => test.project === name)),
  }));
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)} s`;
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}m ${seconds}s`;
}

export function formatPercent(value: number | null): string {
  return value === null ? 'n/a' : `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
