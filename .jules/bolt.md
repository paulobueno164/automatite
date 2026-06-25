
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.

## 2025-05-20 - [Lazy Loading Integrations in Execution Context]
**Learning:** Pre-loading and decrypting all user integrations (AES-256-GCM) at the start of every automation run adds significant overhead, especially for flows that only use internal or AI actions. Moving to a lazy-loading pattern in the `EngineContext` avoids unnecessary DB queries and CPU-intensive decryption.
**Action:** Use a getter function in execution contexts to fetch external credentials only when an action requires them.

## 2025-05-25 - [Lazy Decryption and Key Memoization]
**Learning:** Decrypting all user integrations (AES-256-GCM) eagerly at the start of a flow creates unnecessary CPU and memory overhead, especially for flows with few or no external actions. Memoizing the encryption key and using `Object.defineProperty` for lazy decryption ensures we only pay the cost for integrations actually used.
**Action:** Implement lazy-loading patterns for sensitive data and memoize results of expensive deterministic operations like key derivation.
