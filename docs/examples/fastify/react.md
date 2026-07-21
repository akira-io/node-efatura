# React Example

This React example posts invoice data to the Fastify adapter and opens the rendered DFA PDF. It assumes the Fastify route is protected by the application session and accepts browser requests from the React origin.

The `createInvoice` helper is shown in [Fastify Invoice Payload](invoice.md).

```tsx
import { useMemo, useState } from 'react';
import { createInvoice } from './invoice';

const apiBaseUrl = import.meta.env.VITE_EFATURA_API_URL ?? 'http://localhost:3000/efatura';

export function EfaturaPreview(): JSX.Element {
  const invoice = useMemo(() => createInvoice(), []);
  const [xml, setXml] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function buildXml(): Promise<void> {
    setError(null);

    try {
      const result = await postJson<{ xml: string }>('/dfe/xml', {
        invoice,
        options: { documentNumber: 1 },
      });

      setXml(result.xml);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    }
  }

  async function openDfa(): Promise<void> {
    setError(null);

    try {
      const currentXml =
        xml ||
        (await postJson<{ xml: string }>('/dfe/xml', {
          invoice,
          options: { documentNumber: 1 },
        })).xml;
      const iud = requireIud(currentXml);
      const response = await postBinary('/dfa', {
        iud,
        invoice,
      });
      const url = URL.createObjectURL(response);

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    }
  }

  return (
    <main>
      <button type="button" onClick={buildXml}>
        Build XML
      </button>
      <button type="button" onClick={openDfa}>
        Open DFA PDF
      </button>
      {error ? <p role="alert">{error}</p> : null}
      <pre>{xml}</pre>
    </main>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

async function postBinary(path: string, body: unknown): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.blob();
}

function requireIud(xml: string): string {
  const iud = xml.match(/<Dfe[^>]+Id="([^"]+)"/)?.[1];

  if (!iud) {
    throw new Error('Generated XML did not include a DFE Id.');
  }

  return iud;
}
```

Keep the invoice factory in a separate module so the same payload can be reused by XML, ZIP, fiscal readiness, and DFA calls.
