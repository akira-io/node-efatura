import type { ResolvedEfaturaConfig } from '../../config';
import { buildEventId } from '../../domain/iud/event-id';
import { type EventData, eventDataFrom } from '../../domain/value-objects/event-data';
import type { EfaturaBuildEventIdInput, EfaturaBuildEventXmlOptions } from '../efatura-options';
import { buildEventXml } from '../xml/event-xml';

export function buildEventIdForConfig(
  input: EfaturaBuildEventIdInput,
  config: ResolvedEfaturaConfig,
): string {
  return buildEventId({
    ...input,
    repositoryCode: input.repositoryCode ?? config.repositoryCode,
    transmitterNif: input.transmitterNif ?? config.transmitterNif,
  });
}

export function buildEventXmlForConfig(
  data: Record<string, unknown> | EventData,
  options: EfaturaBuildEventXmlOptions,
  config: ResolvedEfaturaConfig,
): string {
  const event = isEventData(data) ? data : eventDataFrom(data);
  const eventId =
    options.id ??
    event.id ??
    buildEventIdForConfig(
      {
        issueDateTime: event.issueDateTime,
      },
      config,
    );

  return buildEventXml({
    eventId,
    event,
    config,
    emissionMode: options.emissionMode ?? 'Online',
  });
}

function isEventData(value: Record<string, unknown> | EventData): value is EventData {
  return (
    typeof value.type === 'string' &&
    typeof value.issueDateTime === 'string' &&
    typeof value.issueReasonDescription === 'string' &&
    Array.isArray(value.iuds) &&
    'range' in value
  );
}
