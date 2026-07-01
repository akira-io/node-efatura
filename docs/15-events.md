# Events

The package builds official Event XML for the event types currently supported by the domain layer:

| Event | Code | Purpose |
|-------|------|---------|
| Fiscal document cancellation | `FDC` | Cancels one or more fiscal documents by IUD |
| Unused document number | `UDN` | Reports an unused document number range |

## Event ID

```ts
const eventId = efatura.buildEventId({
  issueDateTime: '2026-02-08T11:30:00',
});
```

The Event ID is a 24-character value containing country, repository code, issue date and time, and transmitter NIF.

You can pass `repositoryCode` and `transmitterNif` to override config values for a specific event.

## FDC

```ts
const xml = efatura.buildEventXml({
  type: 'FDC',
  issueDateTime: '2026-02-08T11:30:00',
  issueReasonDescription: 'Documento emitido com dados incorretos.',
  iuds: [
    'CV3260208100200300001230100000000112345678909',
  ],
});
```

Rules:

- `issueDateTime` must be a valid ISO date-time.
- `issueReasonDescription` is required.
- `iuds` must contain at least one valid IUD.
- Range data is not accepted for `FDC`.

## UDN

```ts
const xml = efatura.buildEventXml({
  type: 'UDN',
  issueDateTime: '2026-02-08T11:30:00',
  issueReasonDescription: 'Sequencia nao utilizada.',
  range: {
    year: '2026',
    ledCode: '123',
    serie: '123',
    documentTypeCode: 1,
    documentNumberStart: 10,
    documentNumberEnd: 12,
  },
});
```

Rules:

- `issueDateTime` must be a valid ISO date-time.
- `issueReasonDescription` is required.
- `range` is required.
- `documentTypeCode` must resolve to a supported document type.
- `documentNumberStart` and `documentNumberEnd` define the unused range.
- IUD lists are not accepted for `UDN`.

## Options

```ts
const xml = efatura.buildEventXml(event, {
  id: eventId,
  emissionMode: 'Online',
});
```

| Option | Purpose |
|--------|---------|
| `id` | Use an existing Event ID |
| `emissionMode` | Event emission mode |

## Validation

```ts
const event = efatura.validateEvent(rawEvent);
const xml = efatura.buildEventXml(event);
const result = await efatura.validateEventXml(xml);
```

`validateEvent()` applies domain validation. `validateEventXml()` delegates to the configured XSD validator.

## HTTP Adapter

```ts
await fetch('/efatura/event/xml', {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    event,
    options: { emissionMode: 'Online' },
  }),
});
```

The response body is:

```json
{
  "xml": "<Event>...</Event>"
}
```

Keep event creation on the server side when the event depends on fiscal-number recovery or cancellation approvals.
