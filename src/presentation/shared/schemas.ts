import { z } from 'zod';

export const dfeXmlRequestSchema = z.object({
  invoice: z.record(z.string(), z.unknown()),
  options: z.record(z.string(), z.unknown()).optional().default({}),
});

export const dfeZipFileSchema = z.object({
  iud: z.string().min(1),
  xml: z.union([z.string(), z.instanceof(Buffer)]),
});

export const dfeZipRequestSchema = z.object({
  files: z.array(dfeZipFileSchema).min(1),
});

export type DfeXmlRequest = z.infer<typeof dfeXmlRequestSchema>;
export type DfeZipRequest = z.infer<typeof dfeZipRequestSchema>;
