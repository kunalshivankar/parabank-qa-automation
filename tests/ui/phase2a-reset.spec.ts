import { test } from '../../fixtures';
import { Phase2AAdminClient } from '../../api/phase2aAdmin';

test('explicitly authorized Phase 2A database reset setup', async ({ request, appConfig, log }) => {
  test.skip(
    !appConfig.allowGlobalReset,
    'BLOCKED: global reset is disabled. This setup test never calls cleanDB against the shared sandbox.',
  );
  await new Phase2AAdminClient(request, appConfig).cleanDatabase();
  log.info('Explicitly authorized Phase 2A database reset completed');
});
