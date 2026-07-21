# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta4](https://github.com/akira-io/node-efatura/compare/v1.0.0-beta3...v1.0.0-beta4) (2026-07-21)

### Bug Fixes

- **totals:** Reconcile retention and informational taxes ([c5cf0c3](https://github.com/akira-io/node-efatura/commit/c5cf0c33acda973e85837c48110c8903cd33ab3a))
- **totals:** Keep informational null tax from suppressing totals ([d2a5c01](https://github.com/akira-io/node-efatura/commit/d2a5c01d512cebdfc79a621434d17b7f8b9d7b31))
- **domain:** Enforce phone and XML decimal limits ([c010fe5](https://github.com/akira-io/node-efatura/commit/c010fe59014a5f3017762fb58645d2537484ec02))
- **domain:** Guard XML decimal pre-rounding ([ef7c282](https://github.com/akira-io/node-efatura/commit/ef7c282e50573e2a7b7fa3f1a110a700ce42c2fd))
- **domain:** Use emitter tax id in event XML ([ca0c49a](https://github.com/akira-io/node-efatura/commit/ca0c49a261f32858e420dbdb82fa049376af573b))
- **domain:** Align DFE header compatibility rules ([9cfa181](https://github.com/akira-io/node-efatura/commit/9cfa181dfdc4df21b62737dc31542f94f68924bf))
- **domain:** Validate coded fiscal values ([87c6fe3](https://github.com/akira-io/node-efatura/commit/87c6fe30912862a6fb3e926990f4820adcf66361))
- **domain:** Match unit code schema range ([ae18cc5](https://github.com/akira-io/node-efatura/commit/ae18cc5c71ceb1808651f5c03e06d2cc4a5ea78f))
- **domain:** Allow absent exchange rate source ([0bb47c7](https://github.com/akira-io/node-efatura/commit/0bb47c789ae007e6f507e6faf783e40d673fd99b))
- **infra:** Harden bcv exchange rate provider ([7e2e9a9](https://github.com/akira-io/node-efatura/commit/7e2e9a9fb9f87d97a0fef47c5454e1c805ff3a3b))
- **infra:** Sanitize world bank response failures ([d131dd1](https://github.com/akira-io/node-efatura/commit/d131dd1961ea9f122f3e3c6f6235a5579f7530c2))
- **domain:** Validate currency invoice input ([81553f4](https://github.com/akira-io/node-efatura/commit/81553f4a3024c483f873f0a25e0b57e996f27858))
- **dfa:** Preserve currency conversion evidence ([8a98b43](https://github.com/akira-io/node-efatura/commit/8a98b4321c6f8e3a3d8885805d827e69e3899437))
- **domain:** Harden fiscal currency conversion ([2e16814](https://github.com/akira-io/node-efatura/commit/2e1681493fb7554abf991fe60caf5e8c8bce9b81))
- **domain:** Align currency codes with fiscal schema ([3ef196f](https://github.com/akira-io/node-efatura/commit/3ef196ff47ff7d3ab0df00e1b9f117bdd2085734))
- **domain:** Account for mixed-case IDR schema entry ([dc648d5](https://github.com/akira-io/node-efatura/commit/dc648d5781f74e04b30a2c802d6ce3a31c110d41))
- **domain:** Enforce fiscal conversion integrity ([eb70666](https://github.com/akira-io/node-efatura/commit/eb70666127fe9129cbbc6848317dd15bc3b11c19))
- **domain:** Tighten currency validation ([c6c1268](https://github.com/akira-io/node-efatura/commit/c6c1268f2d9b2d7fbcac941fba7243c65253dd39))
- **infra:** Pin BCV exchange-rate source ([694d92a](https://github.com/akira-io/node-efatura/commit/694d92aa616ad5f0674cfc8bb3081e38f68e339b))
- **domain:** Reconcile converted fiscal totals ([9918108](https://github.com/akira-io/node-efatura/commit/99181080d663779e74e4f8bc7b9bdc9a0a6c3937))
- **domain:** Harden fiscal amount reconciliation ([b40a813](https://github.com/akira-io/node-efatura/commit/b40a8132f8074fb90e3ad1fcc37ae34a611c3510))
- **dfa:** Harden currency deprecation warning ([f1573b3](https://github.com/akira-io/node-efatura/commit/f1573b383440d77998f8ebd95326df05b3050f9d))
- **dfa:** Warn before HTTP request validation ([7ebae5b](https://github.com/akira-io/node-efatura/commit/7ebae5b59de087037c23b074137a02fa55e3a284))


### Features

- **domain:** Add exchange rate contracts ([cdbce47](https://github.com/akira-io/node-efatura/commit/cdbce478be2c28966b064bf4c84fd73e0a8eec0c))
- **domain:** Convert invoice amounts to cve ([f6908a7](https://github.com/akira-io/node-efatura/commit/f6908a78b7561317f9075ae13fbd279928b5abbb))
- **infra:** Add configurable exchange rate providers ([c1a9877](https://github.com/akira-io/node-efatura/commit/c1a98778d9e2ae53ae47f7de3fd6f0144ac9a063))
- **infra:** Add bcv exchange rate provider ([ab72476](https://github.com/akira-io/node-efatura/commit/ab724760812a5e42b480522a694700c288413108))
- **infra:** Add world bank exchange rate provider ([9bf1bd6](https://github.com/akira-io/node-efatura/commit/9bf1bd6ce2c84f8498b65099f4855b14bfd2b15b))
- **domain:** Prepare invoices in cve ([5bd69dc](https://github.com/akira-io/node-efatura/commit/5bd69dcff4fef169972d0cc03eb663518326e8b9))
- **dfa:** Show currency conversion evidence ([409d63a](https://github.com/akira-io/node-efatura/commit/409d63a64ffd27e20f979e13de74774a4c707050))
- **dfa:** Warn on deprecated currency option ([527bbcd](https://github.com/akira-io/node-efatura/commit/527bbcd207820f528152f77b5cde7fc8cd6e98b2))

## [1.0.0-beta3](https://github.com/akira-io/node-efatura/compare/v1.0.0-beta2...v1.0.0-beta3) (2026-07-01)

### Bug Fixes

- **totals:** Apply line-type signs and exclude withholding from payable ([4f7b800](https://github.com/akira-io/node-efatura/commit/4f7b80084453b689adfb41848536dd11fd5dfb48))
- **tax:** Restrict exemption reason to NA tax type ([d6178f8](https://github.com/akira-io/node-efatura/commit/d6178f8aafda1e23e6025e07ae048e1aad2f74ec))
- **issue-date:** Interpret issue datetime in Cabo Verde time ([eefdd7e](https://github.com/akira-io/node-efatura/commit/eefdd7e11efc4df97553a7f0eebc189dd9e1cf42))
- **sequence:** Atomic knex upsert and single-process file store ([bbcfeda](https://github.com/akira-io/node-efatura/commit/bbcfeda3798d52394b95d9554d825fe23e5b8f7a))
- **sequence:** Fsync file writes and use bigint counter ([5626566](https://github.com/akira-io/node-efatura/commit/5626566ae02e52262c50098ff0400da2be589248))
- **http:** Close SSRF, enforce auth, validate QR and extra-field names ([bece241](https://github.com/akira-io/node-efatura/commit/bece241f2ad21289ab9a37b603daf0ae792e150f))
- **dfa:** Strip trailing slashes without a backtracking regex ([46bdac8](https://github.com/akira-io/node-efatura/commit/46bdac8e8a72065ffb7f4798875d4ce1e2da5a2d))
- **transport:** Strip trailing slashes without a backtracking regex ([7702bdc](https://github.com/akira-io/node-efatura/commit/7702bdc43d98a7a0388b361254101dabd07ac3d5))
- **domain:** Enforce contingency LED, receiver tax threshold, and event range type ([dfdf158](https://github.com/akira-io/node-efatura/commit/dfdf158b411cefc24ae2474ce817692de0038bad))
- **fiscal-readiness:** Do not fail a passing check on informational issues ([6e20572](https://github.com/akira-io/node-efatura/commit/6e205722b2b0ef62d52c604d27fc2e89092f985c))
- **test:** Decouple Prisma client import from generated types in typecheck ([d98302e](https://github.com/akira-io/node-efatura/commit/d98302ecce1b785fd6734606069cb7e8e5f5886b))
- **ci:** Trust better-sqlite3 so its native binding builds on install ([ac0155f](https://github.com/akira-io/node-efatura/commit/ac0155f314994bacc3d27d429614215142edb2c8))
- **signing:** Canonicalize xades references in document ([53bf078](https://github.com/akira-io/node-efatura/commit/53bf078ae6fb2bb2b2dbeae54b46f96b3a5157b1))
- **totals:** Reject missing line amounts ([5970660](https://github.com/akira-io/node-efatura/commit/5970660508d07e9f67d31eb2bbe763afa1ad0038))
- **fiscal-readiness:** Fail closed on client errors ([4f75f47](https://github.com/akira-io/node-efatura/commit/4f75f47c2a5120a170b175a6c494405c1f11f4c0))
- **tax:** Enforce rempe invoice tax code ([5a842df](https://github.com/akira-io/node-efatura/commit/5a842df3d864ec02715a832be26327c3088e972e))
- **totals:** Accept official tax rounding methods ([5a12eb8](https://github.com/akira-io/node-efatura/commit/5a12eb83335655e09153b044e8649f6af6e4fb9b))
- **dfa:** Render invoice PDFs from adapter payloads ([1808b60](https://github.com/akira-io/node-efatura/commit/1808b60a5dd9e8c85a6711a4a15685b412cd2157))


### Code Refactoring

- **storage:** Move sequence adapters under storage and knex behind subpath ([e1c6e8b](https://github.com/akira-io/node-efatura/commit/e1c6e8bda07d6b52d3d14ae2dae4c9829a71bacd))


### Features

- **storage:** Add Prisma sequence store at @akira-io/efatura/prisma subpath ([e484513](https://github.com/akira-io/node-efatura/commit/e484513216b0027b2d9c4252d9ae04b9202f9376))
- **prisma:** Add schema copy cli ([e3475ba](https://github.com/akira-io/node-efatura/commit/e3475ba37432e23dd705e67ef7cf801a5fb6bb20))


### Other

- **storage:** Export knex adapter via @akira-io/efatura/knex subpath ([9db0c81](https://github.com/akira-io/node-efatura/commit/9db0c81139d6c46f7a9c15a170bcdb7d937548ac))
- **storage:** Export Prisma adapter via @akira-io/efatura/prisma subpath ([a3443a1](https://github.com/akira-io/node-efatura/commit/a3443a1d965f4879c227b8d9ba2ab91e54ea4ee0))

## [1.0.0-beta2](https://github.com/akira-io/node-efatura/compare/...v1.0.0-beta2) (2026-06-28)

### Bug Fixes

- **core:** Fail closed on fiscal authority responses ([0632ce5](https://github.com/akira-io/node-efatura/commit/0632ce536e2b3dc4cae0992e100976ff635fa019))
- **domain:** Validate event date-times ([495130b](https://github.com/akira-io/node-efatura/commit/495130b9ab07eb1d3641d1212bca973cea2df847))
- **core:** Render dfa contingency modes ([2c394f7](https://github.com/akira-io/node-efatura/commit/2c394f7ec1870881b40f9f9777714e318aa6c666))
- **adapters:** Add authorization hooks ([5ddc9ca](https://github.com/akira-io/node-efatura/commit/5ddc9ca1a8257d4ca8ddc8e5f6f1f8de7b9f6422))


### Features

- **core:** Add efatura engine ([fa6268f](https://github.com/akira-io/node-efatura/commit/fa6268f0585e2a894b16780b67a9057e63cc8710))
- **adapters:** Add http framework adapters ([c91d958](https://github.com/akira-io/node-efatura/commit/c91d958ca80d6d5fc6ada4d6aface255b4dd8d59))
- **v11:** Model official dfe xml structures ([efedc68](https://github.com/akira-io/node-efatura/commit/efedc68c3a798ffe93cdbebb90e9c5a422e4bcd2))
- **core:** Add official infrastructure implementations ([8cff67d](https://github.com/akira-io/node-efatura/commit/8cff67da93c19693c036c2690db2fa453f0fe31d))
- **v11:** Add events dfa and rule coverage ([7ea3c20](https://github.com/akira-io/node-efatura/commit/7ea3c2089d058d099b38929e152fb4cbe86661d5))
- **v11:** Enforce official document schemas ([04b8c0a](https://github.com/akira-io/node-efatura/commit/04b8c0ac4e4e7d276f6057855fc4f29774fbdb09))
- **core:** Add artifact validation infrastructure ([782b6b0](https://github.com/akira-io/node-efatura/commit/782b6b0f5acd95c69ec1b6ecb0a89d9ad2022c8d))
- **core:** Normalize fiscal service responses ([6db1ba7](https://github.com/akira-io/node-efatura/commit/6db1ba7dc042f9b5dd1186e54e896f5ef3df09b0))
- **v11:** Enforce fiscal rules and enum APIs ([91e022b](https://github.com/akira-io/node-efatura/commit/91e022b8648be3331c4c6af2d18b21461d2b9b99))
- **core:** Support configured invoice emitters ([f395166](https://github.com/akira-io/node-efatura/commit/f395166fd300d354a4321d049aac770eddef84a9))
- **domain:** Validate Cabo Verde tax ids ([c15e690](https://github.com/akira-io/node-efatura/commit/c15e690eb5abd121c4ed7276eb1d754943f51b0a))
- **core:** Add fiscal readiness validation ([f21388a](https://github.com/akira-io/node-efatura/commit/f21388aa4bd827619ae27a9b81ea60b5e7c2a09b))
- **adapters:** Expose fiscal readiness route ([d158d30](https://github.com/akira-io/node-efatura/commit/d158d30132bfd45593a17c04cbe54424564f4f8a))
- **v11:** Close extra fields compliance ([fca2cde](https://github.com/akira-io/node-efatura/commit/fca2cde5df5adffec31ca01a9e462152ea58351f))

