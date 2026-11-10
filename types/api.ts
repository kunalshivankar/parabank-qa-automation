import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.coerce.number().int().positive(),
  firstName: z.string(),
  lastName: z.string(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
    })
    .passthrough(),
  phoneNumber: z.string().optional(),
  ssn: z.string().optional(),
});

export const AccountSchema = z.object({
  id: z.coerce.number().int().positive(),
  customerId: z.coerce.number().int().positive(),
  type: z.enum(['CHECKING', 'SAVINGS', 'LOAN']),
  balance: z.coerce.number(),
});

export const TransactionSchema = z.object({
  id: z.coerce.number().int().positive(),
  accountId: z.coerce.number().int().positive(),
  type: z.enum(['Credit', 'Debit']),
  date: z.string(),
  amount: z.coerce.number(),
  description: z.string(),
});

export const DepositResponseSchema = z.string().min(1);

export type ParaBankCustomer = z.infer<typeof CustomerSchema>;
export type ParaBankAccount = z.infer<typeof AccountSchema>;
export type ParaBankTransaction = z.infer<typeof TransactionSchema>;
export type ParaBankDepositResponse = z.infer<typeof DepositResponseSchema>;
