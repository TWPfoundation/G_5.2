# Repo Reconciliation — 2026-04-17

This repo (`G_5.2`) is the canonical repo after promoting the former `G52` workspace.

The only tracked files that existed in the older local `G_5.2` repo but not in the promoted former `G52` workspace are listed below. They were reviewed against the current canonical architecture before deciding whether to port them.

## Keep / Drop Decision

| File | Decision | Rationale |
| --- | --- | --- |
| `scripts/init-db.sql` | Drop | Defines an old `inquiries` table for the DB-backed inquiry path. The canonical repo now persists runtime state to file-backed `data/` stores and context snapshots, so this schema is no longer part of the active architecture. |
| `scripts/init-db.ts` | Drop | One-off Postgres bootstrap script for the same deprecated inquiry table. No matching runtime path exists in the canonical repo, and keeping it would imply a supported persistence backend that the repo no longer uses. |
| `packages/orchestration/src/types/supabase.ts` | Drop | Leftover type surface from the older Supabase/Postgres approach. The current orchestration package uses file-backed persistence, and this type file has no corresponding live integration in the canonical repo. |

## Notes

- `G_5.2` also contains older package dependencies and server logic tied to `pg` / Supabase. Those should remain reference-only unless the repo deliberately reintroduces a database-backed runtime.
- If a future milestone brings back a database backend, start from a fresh design under a clearly named module rather than reviving these files in place. The current repo's documented contract is file-backed operator-managed runtime state under `data/`.
