# Compliance Matrix

This matrix tracks implementation coverage against the official e-Fatura v11 manual and the XML-XSD package published at `efatura.cv/docs/xsd`.

| Reference | Rule | Type | Status | Implementation | Test | Notes |
|---|---|---|---|---|---|---|
| Manual 6.2 | DFE XML must follow the official XSD. | xsd | done | `XmllintXsdValidator` | `tests/xsd.test.ts` | Uses bundled `2024-05-27` XSD package. |
| Manual 6.2 | XML must be UTF-8 and compact. | local | done | `buildDfeXml` | `tests/xml.test.ts` | Generates XML without pretty-print whitespace. |
| Manual 6.2 | DFE root has `Version`, `Id`, and `DocumentTypeCode`. | xsd | done | `buildDfeXml` | `tests/xml.test.ts` | Root namespace is `urn:cv:efatura:xsd:v1.0`. |
| Manual 6.2.2 | IUD has 45 characters and Luhn check digit. | local | done | `buildIud`, `validateIud` | `tests/iud.test.ts` | Luhn is for IUD, not NIF. |
| Manual 6.3.1 | CV NIF format is `[1-9][0-9]{8}`. | local | done | `tax-id` value object | `tests/validation.test.ts` | Existence is PE/DNRE external validation. |
| Manual 6.3 | Party, address, contacts, payments, references, transport and rent receipt are structured fields. | local | done | domain value objects, reserved `ExtraFields` names | `tests/validation.test.ts` | Known official fields are first-class schemas and cannot be injected through `ExtraFields`. |
| Manual 7.2 | Emitter party is mandatory and must include CV NIF, name, address, email and phone/mobile. | local | done | `invoice-fiscal-rules`, `dfe-party-xml` | `tests/official-rules.test.ts`, `tests/xml.test.ts` | Registry existence is external. |
| Manual 7.2 | Receiver party rules vary by DFE type and threshold. | local | done | `documents`, `invoice-data` | `tests/validation.test.ts` | External NIF existence is separate. |
| Manual 7.2 | Payment party and transport service provider use the same TaxId format rules. | local | done | `party-data`, `tax-id` | `tests/validation.test.ts` | Registry existence is external. |
| Manual 7.9 | Software code, name and version are required. | local | done | `resolveConfig`, `transmissionXml` | `tests/config.test.ts`, `tests/xml.test.ts` | Registered software validation is external. |
| Manual 7.18 | Transmission includes IssueMode, TransmitterTaxId and Software. | xsd | done | `transmissionXml` | `tests/xml.test.ts`, `tests/xsd.test.ts` | IssueMode enum preserves Online, Offline and Off. |
| Manual 7.19 | Contingency is required when IssueMode is not Online. | local | done | `assertContingencyMatchesEmissionMode` | `tests/official-rules.test.ts` | Off requires IUC. |
| Manual 7.21 | Online date/time tolerance and contingency tolerance must be validated. | local | done | `validateIssueDateTolerance` | `tests/event.test.ts`, `tests/official-rules.test.ts` | Uses injectable clock. |
| Manual 7 | Tax type NA requires exemption reason. | local | done | `tax-data` | `tests/validation.test.ts` | Tax code enum is exported. |
| Manual 7 | Totals must match line amounts and tax totals. | local | done | `invoice-fiscal-rules` | `tests/official-rules.test.ts` | Uses money tolerance of 0.01. |
| Manual 7 | Corrective notes require valid references and reason codes. | local | done | `documents`, `invoice-field-compatibility` | `tests/validation.test.ts` | Includes credit, debit and return notes. |
| Manual 7 | Transport documents require transport type, route and service provider rules. | local | done | `documents`, `transport-structures` | `tests/validation.test.ts` | Recipient activity checks are external. |
| Manual 7 | Receipt type renda requires rent receipt structure. | local | done | `documents`, `document-structures` | `tests/validation.test.ts` | XSD validates generated XML. |
| Manual 8 | XML signature must be XAdES-BES with SHA-256/RSA. | local | done | `XadesBesSigner` | `tests/signing.test.ts` | Signature bytes are not compared to official vectors because none are published. |
| Manual 10 | Middleware submission sends Deflate ZIP with `{IUD}.xml` filenames. | local | done | `buildDfeZip`, `FetchMiddlewareTransport` | `tests/middleware.test.ts` | Internal ZIP baseline fixture exists. |
| Manual 10 | PE/middleware responses must preserve documents, errors and metadata. | local | done | `response-parser` | `tests/response-parser.test.ts` | Handles JSON/XML and Portuguese keys. |
| Manual 11 | Transmitter and emitter authorization are configured in middleware/PE. | pe | done | fiscal authority contracts and fetch clients | `tests/fiscal-readiness.test.ts`, `tests/fiscal-readiness-live.test.ts` | Live checks require `EFATURA_LIVE_TESTS=1` and credentials. |
| Manual 12 | DFA includes QR Code URL and contingency notice. | local | done | `PdfDfaRenderer`, `dfaQrCodeUrl` | `tests/middleware.test.ts` | Base URL is configurable. |
| Artifacts | Official XML examples are validated against XSD. | artifact | done | bundled XML-XSD package | `tests/xsd.test.ts` | Source is official XML-XSD package. |
| Artifacts | Official golden vectors for IUD, ZIP and signature. | artifact | not published | `FileSystemGoldenVectorRepository` | `tests/golden-vectors.test.ts` | Internal fixtures are package baselines, not DNRE vectors. |
