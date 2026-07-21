import { z } from 'zod';

export const dfeXmlRequestSchema = z.object({
  invoice: z.record(z.string(), z.unknown()),
  options: z.record(z.string(), z.unknown()).optional().default({}),
});

export const eventXmlRequestSchema = z.object({
  event: z.record(z.string(), z.unknown()),
  options: z.record(z.string(), z.unknown()).optional().default({}),
});

export const dfeZipFileSchema = z.object({
  iud: z.string().min(1),
  xml: z.union([z.string(), z.instanceof(Buffer)]),
});

export const dfeZipRequestSchema = z.object({
  files: z.array(dfeZipFileSchema).min(1),
});

export const fiscalReadinessRequestSchema = z.object({
  invoice: z.record(z.string(), z.unknown()),
  options: z
    .object({
      accessToken: z.string().min(1).optional(),
      validateReceiver: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export const dfaRenderRequestSchema = z.object({
  iud: z.string().min(1),
  invoice: z.record(z.string(), z.unknown()).optional(),
  options: z
    .object({
      emissionMode: z.enum(['Online', 'Offline', 'Off']).optional(),
      contingencyIuc: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
      currency: z.literal('CVE').optional(),
      conversion: z.never().optional(),
    })
    .optional()
    .default({}),
});

export type DfeXmlRequest = z.infer<typeof dfeXmlRequestSchema>;
export type EventXmlRequest = z.infer<typeof eventXmlRequestSchema>;
export type DfeZipRequest = z.infer<typeof dfeZipRequestSchema>;
export type FiscalReadinessRequest = z.infer<typeof fiscalReadinessRequestSchema>;
export type DfaRenderRequest = z.infer<typeof dfaRenderRequestSchema>;
