import type { APIRequestContext } from '@playwright/test';
import { assertGlobalResetAllowed, type AppConfig } from '../config/env';

/**
 * The cleanDB operation is the documented ParaBank admin operation used by Phase 2A.
 * It is intentionally not called unless the test has explicitly enabled global reset.
 */
export class Phase2AAdminClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly appConfig: AppConfig,
  ) {}

  async cleanDatabase(): Promise<void> {
    assertGlobalResetAllowed(this.appConfig);
    const response = await this.request.post('services/bank/cleanDB');
    if (!response.ok()) {
      throw new Error(`ParaBank cleanDB failed with HTTP ${response.status()}.`);
    }
  }
}
