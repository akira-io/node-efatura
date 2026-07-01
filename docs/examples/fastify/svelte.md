# Svelte Example

This Svelte example builds DFE XML and opens the DFA PDF through the Fastify adapter. It assumes the adapter is available at the same authenticated boundary as the rest of the application.

The `createInvoice` helper is shown in [Fastify Invoice Payload](invoice.md).

```svelte
<script lang="ts">
  import { createInvoice } from './invoice';

  const apiBaseUrl = import.meta.env.VITE_EFATURA_API_URL ?? 'http://localhost:3000/efatura';
  const invoice = createInvoice();
  let xml = '';
  let error: string | null = null;

  async function buildXml(): Promise<void> {
    error = null;

    try {
      const result = await postJson<{ xml: string }>('/dfe/xml', {
        invoice,
        options: { documentNumber: 1 },
      });

      xml = result.xml;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Request failed.';
    }
  }

  async function openDfa(): Promise<void> {
    error = null;

    try {
      const currentXml =
        xml ||
        (
          await postJson<{ xml: string }>('/dfe/xml', {
            invoice,
            options: { documentNumber: 1 },
          })
        ).xml;
      const iud = requireIud(currentXml);
      const pdf = await postBinary('/dfa', {
        iud,
        invoice,
        options: { currency: 'CVE' },
      });

      window.open(URL.createObjectURL(pdf), '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Request failed.';
    }
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

  function requireIud(xmlContent: string): string {
    const iud = xmlContent.match(/<Dfe[^>]+Id="([^"]+)"/)?.[1];

    if (!iud) {
      throw new Error('Generated XML did not include a DFE Id.');
    }

    return iud;
  }
</script>

<main>
  <button type="button" on:click={buildXml}>Build XML</button>
  <button type="button" on:click={openDfa}>Open DFA PDF</button>
  {#if error}
    <p role="alert">{error}</p>
  {/if}
  <pre>{xml}</pre>
</main>
```
