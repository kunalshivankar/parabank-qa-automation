import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { config as appConfig } from '../config/env';
import { redactText } from '../utils/redact';
import {
  computeTotals,
  stripAnsi,
  summarizeProjects,
  type ReportAttachment,
  type ReportData,
  type ReportError,
  type ReportLog,
  type ReportStep,
  type ReportTest,
  type TestStatus,
} from './model';
import { renderReport } from './template';

export interface GlassReporterOptions {
  outputFile?: string;
  title?: string;
}

const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_INLINE_TEXT_CHARS = 20_000;
const TEXT_CONTENT_TYPES = /^(text\/|application\/(json|xml|x-www-form-urlencoded))/;

export default class GlassReporter implements Reporter {
  private playwrightConfig!: FullConfig;
  private rootSuite!: Suite;
  private projectRoot = process.cwd();
  private startedAt = new Date();
  private readonly options: GlassReporterOptions;

  constructor(options: GlassReporterOptions = {}) {
    this.options = options;
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.playwrightConfig = config;
    this.rootSuite = suite;
    this.projectRoot = config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.startedAt = new Date();
  }

  async onEnd(result: FullResult): Promise<void> {
    const outputPath = path.resolve(this.projectRoot, this.options.outputFile ?? 'reports/parabank-report.html');
    const data = await this.buildReportData(result, outputPath, new Date());
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderReport(data), 'utf8');
    process.stdout.write(`\nCustom report written to ${outputPath}\n`);
  }

  private async buildReportData(result: FullResult, outputPath: string, endedAt: Date): Promise<ReportData> {
    const tests: ReportTest[] = [];
    for (const test of this.rootSuite.allTests()) {
      tests.push(await this.toReportTest(test, path.dirname(outputPath)));
    }

    return {
      title: this.options.title ?? 'ParaBank test report',
      startedAt: this.startedAt.toISOString(),
      durationMs: result.duration,
      runStatus: result.status,
      totals: computeTotals(tests),
      projects: summarizeProjects(tests),
      environment: this.describeEnvironment(),
      tests,
      endedAt: endedAt.toISOString(),
      tester: this.describeTester(),
      artifactCounts: this.countArtifacts(tests),
    };
  }

  private describeEnvironment(): ReportData['environment'] {
    return [
      { label: 'Run id', value: appConfig.runId },
      { label: 'Base URL', value: appConfig.baseUrl },
      {
        label: 'Global database reset',
        value: appConfig.allowGlobalReset ? 'enabled' : 'disabled',
      },
      { label: 'Workers', value: String(this.playwrightConfig.workers) },
      { label: 'Playwright', value: this.playwrightConfig.version },
      { label: 'Node', value: process.version },
      { label: 'Platform', value: `${os.platform()} ${os.release()}` },
      { label: 'CI', value: process.env.CI ? 'yes' : 'no' },
    ];
  }

  private describeTester(): ReportData['tester'] {
    const headed = process.env.HEADED;
    return {
      name: process.env.TESTER_NAME,
      designation: process.env.TESTER_DESIGNATION,
      projectName: process.env.PROJECT_NAME,
      applicationUrl: appConfig.parabankUrl,
      environment: process.env.TEST_ENVIRONMENT,
      browser: process.env.BROWSER_NAME,
      browserVersion: process.env.BROWSER_VERSION,
      operatingSystem: `${os.platform()} ${os.release()}`,
      playwrightVersion: this.playwrightConfig.version,
      executionMode: headed === 'true' ? 'Headed' : headed === 'false' ? 'Headless' : undefined,
      buildNumber: process.env.BUILD_NUMBER,
    };
  }

  private countArtifacts(tests: readonly ReportTest[]): ReportData['artifactCounts'] {
    const attachments = tests.flatMap((test) => test.attachments);
    return {
      screenshots: attachments.filter((attachment) => attachment.contentType.startsWith('image/')).length,
      videos: attachments.filter((attachment) => attachment.contentType.startsWith('video/')).length,
      traces: attachments.filter((attachment) => attachment.name.toLowerCase().includes('trace') || attachment.href?.toLowerCase().endsWith('.zip')).length,
    };
  }

  private async toReportTest(test: TestCase, reportDir: string): Promise<ReportTest> {
    const status = this.resolveStatus(test);
    const lastResult = test.results.at(-1);
    const firstResult = test.results.at(0);
    const errors: ReportError[] = [];
    const attachments: ReportAttachment[] = [];
    const logs: ReportLog[] = [];

    const stepAttachmentMeta = new Map<string, { stepTitle: string; timestamp: string }>();
    const collectStepAttachments = (steps: readonly TestStep[]): void => {
      for (const step of steps) {
        for (const attachment of step.attachments) {
          const key = attachment.path ?? `${attachment.name}:${attachment.contentType}`;
          stepAttachmentMeta.set(key, { stepTitle: step.title, timestamp: step.startTime.toISOString() });
        }
        collectStepAttachments(step.steps);
      }
    };
    test.results.forEach((result) => collectStepAttachments(result.steps));

    for (const result of test.results) {
      const attempt = result.retry + 1;
      for (const error of result.errors) {
        const failedStep = findFailedStep(result.steps);
        errors.push({
          attempt,
          message: redactText(stripAnsi(error.message ?? error.value ?? 'Unknown error')),
          location: error.location
            ? `${path.relative(this.projectRoot, error.location.file)}:${error.location.line}`
            : undefined,
          snippet: error.snippet ? redactText(stripAnsi(error.snippet)) : undefined,
          stack: error.stack ? redactText(stripAnsi(error.stack)) : undefined,
          stepTitle: failedStep?.title,
        });
      }
      for (const stream of ['stdout', 'stderr'] as const) {
        for (const entry of result[stream]) {
          const text = redactText(stripAnsi(Buffer.isBuffer(entry) ? entry.toString('utf8') : entry));
          if (text.trim()) logs.push({ stream, text });
        }
      }
      for (const attachment of result.attachments) {
        const key = attachment.path ?? `${attachment.name}:${attachment.contentType}`;
        const meta = stepAttachmentMeta.get(key);
        const sensitiveEvidence = /registration|phase2a-registration/i.test(
          `${test.title} ${test.location.file}`,
        );
        attachments.push(await this.toReportAttachment(attachment, attempt, reportDir, meta, sensitiveEvidence));
      }
    }

    const projectName = test.parent.project()?.name ?? '';
    const project = this.playwrightConfig.projects.find((entry) => entry.name === projectName);
    const startTime = firstResult?.startTime;
    const endTime = lastResult && startTime ? new Date(startTime.getTime() + lastResult.duration) : undefined;
    const annotations = [...test.annotations, ...test.results.flatMap((result) => result.annotations)];
    return {
      id: test.id,
      title: test.titlePath().slice(3).join(' > ') || test.title,
      file: path.relative(this.projectRoot, test.location.file),
      line: test.location.line,
      project: projectName,
      status,
      outcomeDetail: lastResult?.status ?? 'not run',
      durationMs: test.results.reduce((total, result) => total + result.duration, 0),
      attempts: test.results.length,
      tags: test.tags,
      annotations: annotations.map((annotation) => ({
        type: annotation.type,
        description: annotation.description,
      })),
      errors,
      attachments,
      module: path.dirname(path.relative(this.projectRoot, test.location.file)).replaceAll(path.sep, '/'),
      browser: project?.use.browserName,
      environment: process.env.TEST_ENVIRONMENT,
      actualResult: lastResult?.status,
      startTime: startTime?.toISOString(),
      endTime: endTime?.toISOString(),
      steps: firstResult?.steps.map(toReportStep) ?? [],
      logs,
      priority: annotationValue(annotations, 'priority'),
      severity: annotationValue(annotations, 'severity'),
      bugReference: annotationValue(annotations, 'bug') ?? annotationValue(annotations, 'bug-reference'),
      bugTitle: annotationValue(annotations, 'bug-title'),
    };
  }

  private resolveStatus(test: TestCase): TestStatus {
    switch (test.outcome()) {
      case 'expected':
        return 'passed';
      case 'flaky':
        return 'flaky';
      case 'skipped':
        return 'skipped';
      case 'unexpected':
        return 'failed';
    }
  }

  private async toReportAttachment(
    attachment: TestResult['attachments'][number],
    attempt: number,
    reportDir: string,
    metadata?: { stepTitle: string; timestamp: string },
    sensitiveEvidence = false,
  ): Promise<ReportAttachment> {
    const base = { attempt, name: attachment.name, contentType: attachment.contentType, ...metadata };

    try {
      if (isTraceAttachment(attachment)) {
        return {
          ...base,
          kind: 'unavailable',
          note: 'raw Playwright trace is retained locally only because it may contain request payloads',
        };
      }
      if (sensitiveEvidence && (attachment.contentType.startsWith('image/') || attachment.contentType.startsWith('video/'))) {
        return {
          ...base,
          kind: 'unavailable',
          note: 'withheld from the HTML report because registration evidence may contain sensitive data',
        };
      }
      if (attachment.path && attachment.contentType.startsWith('video/')) {
        await access(attachment.path);
        const href = this.safeAttachmentHref(attachment.path, reportDir);
        return href ? { ...base, kind: 'file', href } : { ...base, kind: 'unavailable', note: 'attachment path is outside the report workspace' };
      }
      const content = attachment.body ?? (attachment.path ? await readFile(attachment.path) : undefined);

      if (attachment.contentType.startsWith('image/') && content) {
        if (content.byteLength > MAX_INLINE_IMAGE_BYTES) {
          return { ...base, kind: 'unavailable', note: 'image is too large to embed' };
        }
        return {
          ...base,
          kind: 'image',
          dataUri: `data:${attachment.contentType};base64,${content.toString('base64')}`,
        };
      }

      if (TEXT_CONTENT_TYPES.test(attachment.contentType) && content) {
        const text = redactText(content.toString('utf8'));
        const clipped =
          text.length > MAX_INLINE_TEXT_CHARS
            ? `${text.slice(0, MAX_INLINE_TEXT_CHARS)}\n... truncated ${text.length - MAX_INLINE_TEXT_CHARS} characters`
            : text;
        return { ...base, kind: 'text', text: clipped };
      }

      if (attachment.path) {
        const href = this.safeAttachmentHref(attachment.path, reportDir);
        return href ? { ...base, kind: 'file', href } : { ...base, kind: 'unavailable', note: 'attachment path is outside the report workspace' };
      }

      return { ...base, kind: 'unavailable', note: 'attachment has no content' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ...base, kind: 'unavailable', note: `could not be read (${reason})` };
    }
  }

  private safeAttachmentHref(attachmentPath: string, reportDir: string): string | undefined {
    const absolute = path.resolve(attachmentPath);
    const relativeToRoot = path.relative(this.projectRoot, absolute);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return undefined;
    return path.relative(reportDir, absolute).split(path.sep).map((segment) => encodeURIComponent(segment)).join('/');
  }
}

function isTraceAttachment(attachment: TestResult['attachments'][number]): boolean {
  return (
    attachment.name.toLowerCase().includes('trace') ||
    attachment.contentType === 'application/zip' ||
    attachment.path?.toLowerCase().endsWith('.zip') === true
  );
}

function annotationValue(annotations: readonly { type: string; description?: string }[], type: string): string | undefined {
  return annotations.find((annotation) => annotation.type.toLowerCase() === type)?.description;
}

function findFailedStep(steps: readonly TestStep[]): TestStep | undefined {
  for (const step of steps) {
    if (step.error) return step;
    const nested = findFailedStep(step.steps);
    if (nested) return nested;
  }
  return undefined;
}

function toReportStep(step: TestStep): ReportStep {
  return {
    title: step.title,
    category: step.category,
    subtitle: step.subtitle,
    status: step.error ? 'failed' : 'passed',
    durationMs: step.duration,
    startTime: step.startTime.toISOString(),
    error: step.error?.message ?? step.error?.value,
    steps: step.steps.map(toReportStep),
  };
}
