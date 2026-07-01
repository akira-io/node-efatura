# Vue Example

This Vue example calls the Fastify adapter from a single page application. It uses browser credentials so the server can authorize the request through the application session.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { createInvoice } from './invoice';

const apiBaseUrl = import.meta.env.VITE_EFATURA_API_URL ?? 'http://localhost:3000/efatura';
const invoice = computed(() => createInvoice());
const xml = ref('');
const error = ref<string | null>(null);

async function buildXml(): Promise<void> {
  error.value = null;

  try {
    const result = await postJson<{ xml: string }>('/dfe/xml', {
      invoice: invoice.value,
      options: { documentNumber: 1 },
    });

    xml.value = result.xml;
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Request failed.';
  }
}

async function openDfa(): Promise<void> {
  error.value = null;

  try {
    const currentXml =
      xml.value || (await postJson<{ xml: string }>('/dfe/xml', { invoice: invoice.value })).xml;
    const iud = requireIud(currentXml);
    const pdf = await postBinary('/dfa', {
      iud,
      invoice: invoice.value,
      options: { currency: 'CVE' },
    });

    window.open(URL.createObjectURL(pdf), '_blank', 'noopener,noreferrer');
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Request failed.';
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

<template>
  <main>
    <button type="button" @click="buildXml">Build XML</button>
    <button type="button" @click="openDfa">Open DFA PDF</button>
    <p v-if="error" role="alert">{{ error }}</p>
    <pre>{{ xml }}</pre>
  </main>
</template>
```
