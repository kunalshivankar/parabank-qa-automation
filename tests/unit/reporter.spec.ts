import { expect, test } from '@playwright/test';
import {
  computeTotals,
  formatDuration,
  formatPercent,
  stripAnsi,
  summarizeProjects,
  type ReportData,
} from '../../reporters/model';
import { ACCENT_COLOR, escapeHtml, renderReport } from '../../reporters/template';
import { buildSampleReportData } from '../support/sampleReportData';

test.describe('report model helpers', () => {
  test('stripAnsi removes terminal colour codes', () => {
    const esc = String.fromCharCode(27);
    expect(stripAnsi(`${esc}[31mExpected${esc}[39m: ${esc}[1;32m1${esc}[0m`)).toBe('Expected: 1');
  });

  test('computeTotals counts each status and derives the pass rate', () => {
    const totals = computeTotals(buildSampleReportData().tests);
    expect(totals).toEqual({ total: 5, passed: 2, failed: 1, flaky: 1, skipped: 1, passRate: 50 });
  });

  test('computeTotals reports no pass rate when nothing executed', () => {
    expect(computeTotals([{ status: 'skipped' }]).passRate).toBeNull();
    expect(computeTotals([]).passRate).toBeNull();
  });

  test('computeTotals rounds the pass rate to one decimal place', () => {
    const tests = [{ status: 'passed' as const }, { status: 'passed' as const }, { status: 'failed' as const }];
    expect(computeTotals(tests).passRate).toBe(66.7);
  });

  test('summarizeProjects groups results by project', () => {
    const projects = summarizeProjects(buildSampleReportData().tests);
    expect(projects.map((project) => [project.name, project.total])).toEqual([
      ['unit', 3],
      ['ui', 2],
    ]);
  });

  test('formatDuration picks a readable unit', () => {
    expect(formatDuration(80)).toBe('80 ms');
    expect(formatDuration(2400)).toBe('2.4 s');
    expect(formatDuration(65_000)).toBe('1m 05s');
  });

  test('formatPercent handles whole numbers, decimals and missing values', () => {
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(66.7)).toBe('66.7%');
    expect(formatPercent(null)).toBe('n/a');
  });
});

test.describe('report template', () => {
  const html = renderReport(buildSampleReportData());

  test('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  test('never emits untrusted markup from titles, errors or attachments', () => {
    const hostile: ReportData = buildSampleReportData();
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    hostile.title = payload;
    const firstTest = hostile.tests[2];
    if (!firstTest) throw new Error('sample data changed');
    firstTest.title = payload;
    firstTest.errors = [{ attempt: 1, message: payload, location: payload, snippet: payload }];
    firstTest.attachments = [
      { attempt: 1, name: payload, contentType: 'text/plain', kind: 'text', text: payload },
      { attempt: 1, name: payload, contentType: 'application/zip', kind: 'file', href: 'a" onclick="alert(3)' },
    ];

    const output = renderReport(hostile);
    expect(output).not.toContain('<img src=x');
    expect(output).not.toContain('<script>alert');
    expect(output).not.toContain('onclick="alert(3)"');
    expect(output).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  test('defines the accent colour exactly once, as a single CSS variable', () => {
    expect(ACCENT_COLOR).toBe('#F48031');
    expect(html.match(/#F48031/gi)).toHaveLength(1);
    expect(html).toContain('--accent: #F48031;');
  });

  test('uses translucency and background blur for glass surfaces', () => {
    expect(html).toMatch(/backdrop-filter: blur\(var\(--blur\)\)/);
    expect(html).toMatch(/-webkit-backdrop-filter: blur\(var\(--blur\)\)/);
    expect(html).toMatch(/background-color: var\(--glass-fill\)/);
    expect(html).toMatch(/--glass-fill: rgba\(255, 255, 255, 0\.08\)/);
  });

  test('renders an accessible tab list with exactly one selected tab', () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/<button[^>]*role="tab"/g)).toHaveLength(3);
    expect(html.match(/<button[^>]*role="tab"[^>]*aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/<section[^>]*role="tabpanel"/g)).toHaveLength(3);
  });

  test('lists every test in the Tests panel and only failed or flaky ones in Failures', () => {
    const testsPanel = html.slice(html.indexOf('id="panel-tests"'), html.indexOf('id="panel-failures"'));
    const failuresPanel = html.slice(html.indexOf('id="panel-failures"'));
    expect(testsPanel.match(/<details class="test/g)).toHaveLength(5);
    expect(failuresPanel.match(/<details class="test/g)).toHaveLength(2);
  });

  test('embeds screenshots, text evidence and validated trace links', () => {
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('&quot;approved&quot;:false');
    expect(html).toContain('href="../test-results/sample/trace.zip"');
  });

  test('shows an empty state when there are no failures', () => {
    const passing = buildSampleReportData();
    passing.tests = passing.tests.filter((entry) => entry.status === 'passed');
    passing.totals = computeTotals(passing.tests);
    passing.runStatus = 'passed';
    const output = renderReport(passing);
    expect(output).toContain('No failed or flaky tests in this run.');
    expect(output).toContain('data-run-status="passed"');
  });

  test('is self-contained and loads nothing from the network', () => {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/i);
  });
});
