# Security Specification - Luxe Furniture

## Data Invariants
- A user login record must have a valid name, phone number, and a server-generated timestamp.
- Phone numbers should be at least 8 digits.
- Only unauthorized (unauthenticated or specifically tagged) users can create a login record.
- Only the Admin can view the list of user logins and delete them.

## The "Dirty Dozen" Payloads
1. Create record with missing phone number.
2. Create record with dangerously long name (1MB).
3. Create record with fake `loginAt` (non-server timestamp).
4. Unauthenticated user trying to `list` the `/logins` collection.
5. Unauthenticated user trying to `delete` a record.
6. Authenticated non-admin trying to `list` the `/logins` collection.
7. Attempting to update an existing login record (should be immutable).
8. Injecting extra fields like `isAdmin: true` into a login record.
9. Using an invalid ID format for the document.
10. Attempting to read a single document by ID without admin status.
11. Attempting to bulk delete without admin status.
12. Attempting to change `loginAt` on a existing record.

## Test Runner Logic
- All write operations for standard users must pass schema validation.
- All read/delete operations must fail except for the admin.
