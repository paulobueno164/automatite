
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.

## 2025-05-20 - [Lazy Loading Integrations in Execution Context]
**Learning:** Pre-loading and decrypting all user integrations (AES-256-GCM) at the start of every automation run adds significant overhead, especially for flows that only use internal or AI actions. Moving to a lazy-loading pattern in the `EngineContext` avoids unnecessary DB queries and CPU-intensive decryption.
**Action:** Use a getter function in execution contexts to fetch external credentials only when an action requires them.
## 2026-06-22 - [N+1 Query Optimization in Scheduler]
**Learning:** Batching automation lookups with their owner (User) in `runDueSchedules` prevents O(N) database queries during cron execution. Implementing `runAutomation` to accept pre-fetched objects allows for flexible, high-performance execution patterns.
**Action:** Always check if batch queries can include relations needed by downstream functions to avoid redundant lookups.
