
## 2025-05-15 - [CRM Phone Lookup Optimization]
**Learning:** Using Prisma's `findMany` followed by an in-memory `.find()` causes O(N) performance and high memory usage, even when the underlying database field is indexed. Direct database queries (`findFirst`) are essential for scalability.
**Action:** Always prefer direct database lookups over loading collections into memory for filtering, especially for unique or semi-unique identifiers like phone numbers.
