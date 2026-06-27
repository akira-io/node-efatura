export const EventType = {
  FiscalDocumentCancellation: 'FDC',
  UnusedDocumentNumber: 'UDN',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EVENT_TYPES = Object.values(EventType) as readonly EventType[];

export function eventTypeFromValue(value: unknown): EventType | null {
  if (typeof value !== 'string') {
    return null;
  }

  return isEventType(value) ? value : null;
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}
