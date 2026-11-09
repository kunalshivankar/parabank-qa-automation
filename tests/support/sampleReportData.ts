import { computeTotals, summarizeProjects, type ReportData, type ReportTest } from '../../reporters/model';

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function sampleTest(overrides: Partial<ReportTest> & Pick<ReportTest, 'id' | 'title' | 'status'>): ReportTest {
  return {
    file: 'tests/unit/sample.spec.ts',
    line: 10,
    project: 'unit',
    outcomeDetail: overrides.status === 'failed' ? 'failed' : 'passed',
    durationMs: 120,
    attempts: 1,
    tags: [],
    annotations: [],
    errors: [],
    attachments: [],
    ...overrides,
  };
}

/** Synthetic data used only to exercise the report template. It is not test evidence. */
export function buildSampleReportData(): ReportData {
  const tests: ReportTest[] = [
    sampleTest({ id: 't1', title: 'parses a plain dollar amount', status: 'passed' }),
    sampleTest({ id: 't2', title: 'sums three transfers exactly', status: 'passed', durationMs: 2400 }),
    sampleTest({
      id: 't3',
      title: 'loan request is approved',
      status: 'failed',
      project: 'ui',
      file: 'tests/ui/sample.spec.ts',
      durationMs: 8300,
      errors: [
        {
          attempt: 1,
          message: 'Expected: "Approved"\nReceived: "Denied"',
          location: 'tests/ui/sample.spec.ts:42',
          snippet: '  41 |   await loan.submit();\n> 42 |   expect(result).toBe("Approved");',
        },
      ],
      attachments: [
        { attempt: 1, name: 'screenshot', contentType: 'image/png', kind: 'image', dataUri: ONE_PIXEL_PNG },
        {
          attempt: 1,
          name: 'last-api-response',
          contentType: 'application/json',
          kind: 'text',
          text: '{"approved":false,"message":"Denied"}',
        },
        {
          attempt: 1,
          name: 'trace',
          contentType: 'application/zip',
          kind: 'file',
          href: '../test-results/sample/trace.zip',
        },
      ],
    }),
    sampleTest({
      id: 't4',
      title: 'dropdown lists the new account',
      status: 'flaky',
      project: 'ui',
      file: 'tests/ui/sample.spec.ts',
      attempts: 2,
      outcomeDetail: 'passed',
      errors: [{ attempt: 1, message: 'Timed out waiting for option' }],
    }),
    sampleTest({ id: 't5', title: 'skipped until the API contract is confirmed', status: 'skipped', outcomeDetail: 'skipped' }),
  ];

  return {
    title: 'ParaBank test report',
    startedAt: '2026-11-06T09:30:00.000Z',
    durationMs: 14_200,
    runStatus: 'failed',
    totals: computeTotals(tests),
    projects: summarizeProjects(tests),
    environment: [
      { label: 'Run id', value: 'sample01' },
      { label: 'Base URL', value: 'https://parabank.parasoft.com' },
      { label: 'Global database reset', value: 'disabled' },
    ],
    tests,
  };
}
