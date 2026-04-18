# Gold baselines

Frozen eval reports used as the comparison anchor for release
candidates and the per-provider drift budget. See
[`docs/gold-baseline-process.md`](../../../docs/gold-baseline-process.md)
for the refresh process and
[`docs/drift-budget.md`](../../../docs/drift-budget.md) for how the
drift budget is evaluated against these files.

File naming: `<provider>-<canonVersion>.json`, one per provider per
canon version.

| Provider | Canon version | Prompt revision | Total cases | Pass rate | Critical failed |
|----------|---------------|-----------------|-------------|-----------|-----------------|
| azure | 0.1.2 | baseline-hardening-v1 | 42 | 100% | 0 |

Older baselines move to `archive/` once superseded by a new release
candidate, per the gold-baseline process doc.
