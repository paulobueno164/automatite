
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.

## 2025-05-20 - [Lazy Loading Integrations in Execution Context]
**Learning:** Pre-loading and decrypting all user integrations (AES-256-GCM) at the start of every automation run adds significant overhead, especially for flows that only use internal or AI actions. Moving to a lazy-loading pattern in the `EngineContext` avoids unnecessary DB queries and CPU-intensive decryption.
**Action:** Use a getter function in execution contexts to fetch external credentials only when an action requires them.

## 2025-05-25 - [Scheduled Engine N+1 Query Elimination]
**Learning:** The scheduled automation runner (`runDueSchedules`) was fetching only IDs and then re-fetching the full automation record and user relation for every item in the loop. Passing the fully hydrated object down the call stack avoids redundant database round-trips during high-load scheduling cycles.
**Action:** When iterating over records that trigger further processing, pre-fetch all necessary relations in the initial query and pass the objects to downstream functions instead of IDs.
