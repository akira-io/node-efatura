import { z } from 'zod';
import { isRecord, optionalText } from '../../support/normalizers';
import { EfaturaValidationError } from '../errors';

export interface PayeeFinancialAccountData {
  accountNumber: string | null;
  nib: string | null;
  name: string;
}

export interface PaymentData {
  paymentMeansCode: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  paymentAmount: number | null;
  payeeFinancialAccount: PayeeFinancialAccountData | null;
}

export interface PaymentsData {
  paymentDueDate: string | null;
  paymentTermsNote: string | null;
  payeeFinancialAccounts: PayeeFinancialAccountData[];
  payments: PaymentData[];
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const payeeFinancialAccountDataSchema = z
  .object({
    accountNumber: z.preprocess(
      normalizeOptionalText,
      z.string().max(15).regex(/^\d+$/).nullable(),
    ),
    nib: z.preprocess(normalizeOptionalText, z.string().length(21).regex(/^\d+$/).nullable()),
    name: z.preprocess(normalizeOptionalText, z.string().min(3).max(150)),
  })
  .superRefine((account, context) => {
    if (!account.accountNumber && !account.nib) {
      context.addIssue({
        code: 'custom',
        path: ['accountNumber'],
        message: 'AccountNumber or NIB is required.',
      });
    }
  });

export const paymentDataSchema = z.object({
  paymentMeansCode: z.preprocess(normalizeOptionalText, z.string().max(50).nullable()),
  paymentReference: z.preprocess(normalizeOptionalText, z.string().max(50).nullable()),
  paymentDate: z.preprocess(normalizeOptionalText, dateSchema.nullable()),
  paymentAmount: z.coerce.number().finite().gt(0).nullable(),
  payeeFinancialAccount: payeeFinancialAccountDataSchema.nullable(),
});

export const paymentsDataSchema = z.object({
  paymentDueDate: z.preprocess(normalizeOptionalText, dateSchema.nullable()),
  paymentTermsNote: z.preprocess(normalizeOptionalText, z.string().min(10).max(500).nullable()),
  payeeFinancialAccounts: z.array(payeeFinancialAccountDataSchema).default([]),
  payments: z.array(paymentDataSchema).default([]),
});

export function paymentsDataFrom(value: unknown, prefix = 'payments'): PaymentsData | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseRequired(
    {
      paymentDueDate: value.paymentDueDate,
      paymentTermsNote: value.paymentTermsNote,
      payeeFinancialAccounts: arrayOf(value.payeeFinancialAccounts),
      payments: arrayOf(value.payments).map((payment) => ({
        paymentMeansCode: payment.paymentMeansCode,
        paymentReference: payment.paymentReference,
        paymentDate: payment.paymentDate,
        paymentAmount: nullableNumber(payment.paymentAmount),
        payeeFinancialAccount: isRecord(payment.payeeFinancialAccount)
          ? payment.payeeFinancialAccount
          : null,
      })),
    },
    paymentsDataSchema,
    prefix,
    'Payments are invalid.',
  );
}

function parseRequired<T>(
  value: unknown,
  schema: z.ZodType<T>,
  prefix: string,
  message: string,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const issuePath = result.error.issues[0]?.path.join('.') ?? prefix;

    throw new EfaturaValidationError(
      field(prefix, issuePath),
      message,
      'document_structure.invalid',
    );
  }

  return result.data;
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function nullableNumber(value: unknown): unknown {
  return value === undefined || value === null || value === '' ? null : value;
}

function normalizeOptionalText(value: unknown): string | null {
  return optionalText(value);
}

function field(prefix: string, name: string): string {
  return prefix === '' ? name : `${prefix}.${name}`;
}
