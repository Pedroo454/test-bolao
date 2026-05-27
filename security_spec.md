# Security Specifications (TDD Spec)

## Data Invariants
1. A **Bet** cannot be edited or submitted unless it belongs to the authenticated user.
2. A **Bet** cannot be created or updated if the match's round is locked (deadline is 5 minutes before the round's first game starts).
3. Only the **Admin** (defined by username admin in session / specific privilege flag) can create or modify **Matches**.
4. Only the **Admin** can create or permanently delete **Users**. Users can update their own avatars.

## Hardened Path Schema Validations
Instead of trusting arbitrary inputs, we validate field structures, sizes, and integrity.
- All scores and predictions must be numbers between `0` and `99`.
- Any custom user id or composite key matches our regex filter and length constraints.
- Timestamps must correspond to the server transaction time where applicable.
