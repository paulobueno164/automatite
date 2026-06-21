
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.

## 2025-05-20 - [Lazy Loading Integrations in Execution Context]
**Learning:** Pre-loading and decrypting all user integrations (AES-256-GCM) at the start of every automation run adds significant overhead, especially for flows that only use internal or AI actions. Moving to a lazy-loading pattern in the `EngineContext` avoids unnecessary DB queries and CPU-intensive decryption.
**Action:** Use a getter function in execution contexts to fetch external credentials only when an action requires them.

## 2025-05-25 - [Scheduled Execution N+1 Optimization]
**Learning:** The scheduled task runner followed an N+1 pattern by fetching only IDs and then re-fetching the full object (with relations) for each task execution. Passing the full object directly to the engine eliminates redundant DB round-trips.
**Action:** Update core engine functions to accept either an ID or a pre-fetched object to support both single-trigger and batch-trigger scenarios efficiently.

## 2025-05-25 - [Crypto Key Memoization]
**Learning:** Frequent encryption/decryption calls were repeatedly validating the environment's hex key and creating new Buffer objects. Simple memoization of the parsed key avoids unnecessary CPU cycles.
**Action:** Memoize frequently used configuration-derived objects (like crypto keys) at the module level.
