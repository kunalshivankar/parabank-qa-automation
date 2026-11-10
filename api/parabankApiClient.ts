import type { APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import type { AppConfig } from '../config/env';
import {
  AccountSchema,
  CustomerSchema,
  DepositResponseSchema,
  TransactionSchema,
  type ParaBankAccount,
  type ParaBankCustomer,
  type ParaBankDepositResponse,
  type ParaBankTransaction,
} from '../types/api';
import { formatCents } from '../utils/money';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseXmlObject(value: string, tagName: string): Record<string, unknown> {
  const cleaned = value.replace(/^\s*<\?xml[^>]*>\s*/, '').trim();
  const match = new RegExp(`^<${tagName}>([\\s\\S]*?)<\\/${tagName}>$`, 'm').exec(cleaned);
  if (!match) {
    throw new Error(`Cannot parse XML payload for <${tagName}>`);
  }

  const inner = match[1];
  if (inner === undefined) {
    throw new Error(`Cannot parse XML payload for <${tagName}>`);
  }

  const result: Record<string, unknown> = {};
  const fieldPattern = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;

  for (const fieldMatch of inner.matchAll(fieldPattern)) {
    const [, fieldName, fieldValue] = fieldMatch;
    if (!fieldName || fieldValue === undefined) {
      continue;
    }
    const trimmed = fieldValue.trim();
    if (/<[A-Za-z0-9_]+>/.test(trimmed)) {
      result[fieldName] = parseXmlObject(fieldMatch[0], fieldName);
      continue;
    }
    result[fieldName] = decodeXmlEntities(trimmed);
  }

  return result;
}

function parseXmlList(value: string, tagName: string): Record<string, unknown>[] {
  const items = [...value.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'g'))];
  return items.map((match) => parseXmlObject(match[0], tagName));
}

export class ParaBankApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly appConfig: AppConfig,
  ) {}

  private buildUrl(path: string): string {
    return new URL(path, `${this.appConfig.baseUrl}/parabank/services/bank/`).toString();
  }

  async requestLogin(username: string, password: string) {
    return this.request.get(this.buildUrl(`login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`), {
      headers: { Accept: 'application/xml' },
    });
  }

  async login(username: string, password: string): Promise<ParaBankCustomer> {
    const response = await this.requestLogin(username, password);
    if (!response.ok()) {
      throw new Error(`ParaBank login failed with HTTP ${response.status()}.`);
    }

    const xml = await response.text();
    const customer = parseXmlObject(xml, 'customer');
    return CustomerSchema.parse(customer);
  }

  async getCustomerAccounts(customerId: number): Promise<ParaBankAccount[]> {
    const response = await this.request.get(this.buildUrl(`customers/${customerId}/accounts`), {
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok()) {
      throw new Error(`ParaBank customer accounts call failed with HTTP ${response.status()}.`);
    }

    const xml = await response.text();
    const rawAccounts = parseXmlList(xml, 'account');
    return z.array(AccountSchema).parse(rawAccounts);
  }

  async getAccount(accountId: number): Promise<ParaBankAccount> {
    const response = await this.request.get(this.buildUrl(`accounts/${accountId}`), {
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok()) {
      throw new Error(`ParaBank account lookup failed with HTTP ${response.status()}.`);
    }

    const xml = await response.text();
    const rawAccount = parseXmlObject(xml, 'account');
    return AccountSchema.parse(rawAccount);
  }

  async deposit(accountId: number, amountCents: number): Promise<ParaBankDepositResponse> {
    if (!this.appConfig.allowApiDeposit || this.appConfig.apiDepositAccountId !== accountId) {
      throw new Error('ParaBank API deposits require explicit authorization for this exact account ID.');
    }
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new Error('ParaBank API deposit account ID must be a positive safe integer.');
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error('ParaBank API deposit amount must be a positive safe integer number of cents.');
    }

    const response = await this.request.post(this.buildUrl('deposit'), {
      params: { accountId, amount: formatCents(amountCents).slice(1) },
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok()) {
      throw new Error(`ParaBank deposit failed with HTTP ${response.status()}.`);
    }
    return DepositResponseSchema.parse(await response.text());
  }

  async getTransactions(accountId: number): Promise<ParaBankTransaction[]> {
    const response = await this.request.get(this.buildUrl(`accounts/${accountId}/transactions`), {
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok()) {
      throw new Error(`ParaBank transaction lookup failed with HTTP ${response.status()}.`);
    }

    const xml = await response.text();
    const rawTransactions = parseXmlList(xml, 'transaction');
    return z.array(TransactionSchema).parse(rawTransactions);
  }

  async getTransactionsByAmount(accountId: number, amount: number): Promise<ParaBankTransaction[]> {
    const normalized = Number(amount).toFixed(2).replace(/\.00$/, '.00');
    const response = await this.request.get(this.buildUrl(`accounts/${accountId}/transactions/amount/${normalized}`), {
      headers: { Accept: 'application/xml' },
    });
    if (!response.ok()) {
      throw new Error(`ParaBank transaction search by amount failed with HTTP ${response.status()}.`);
    }

    const xml = await response.text();
    const rawTransactions = parseXmlList(xml, 'transaction');
    return z.array(TransactionSchema).parse(rawTransactions);
  }
}
