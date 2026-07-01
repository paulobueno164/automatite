
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.

## 2025-05-20 - [Lazy Loading Integrations in Execution Context]
**Learning:** Pre-loading and decrypting all user integrations (AES-256-GCM) at the start of every automation run adds significant overhead, especially for flows that only use internal or AI actions. Moving to a lazy-loading pattern in the `EngineContext` avoids unnecessary DB queries and CPU-intensive decryption.
**Action:** Use a getter function in execution contexts to fetch external credentials only when an action requires them.

## 2025-06-15 - [Batch Fetching for Scheduled Executions]
**Learning:** The execution engine (`runAutomation`) previously fetched the automation and user relation on every call. When triggered by `runDueSchedules`, this created an N+1 query pattern.
**Action:** Updated `runAutomation` to accept an optional `automation` object in its options, allowing batch-fetchers like the scheduler to pass pre-hydrated records and eliminate redundant database round-trips.
