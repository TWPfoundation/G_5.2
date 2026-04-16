# Memory Discipline V1

## Summary
- Add a real durable-memory layer as the lowest-precedence retrievable context in G_5.2.
- V1 uses a hybrid scope: `global` memory for `user_preference` and `project_decision`, plus `session` memory for `open_thread`.
- Memory writes are automatic only when a dedicated structured post-revision memory pass returns a high-confidence candidate with explicit justification.
- Operators can inspect and hard-delete memory in the inquiry surface from day one; there is no manual create/edit flow in V1.

## Key Changes
- Add runtime memory types: `MemoryItem`, `MemoryCandidate`, `MemoryType`, `MemoryScope`, and a structured `MemoryDecision` result. `MemoryItem` should carry `id`, `type`, `scope`, `statement`, `justification`, `confidence`, `tags`, `sessionId?`, `createdAt`, `updatedAt`, `createdFrom`, `lastConfirmedFrom`, and `confirmationCount`.
- Replace the regex-only `decideMemory()` with a dedicated structured memory pass after revision. Feed it `mode`, `userMessage`, `final`, `recentMessages`, and `sessionSummary`, plus strict memory rules. Do not pass the full canon pack into this step.
- Allowed candidate types are `user_preference`, `project_decision`, and `open_thread`. Default scopes are `user_preference -> global`, `project_decision -> global`, and `open_thread -> session`. Reject canon claims, speculative claims, temporary state, sentimental residue, and anything without concrete justification.
- Persist only `confidence === "high"` candidates. Lower-confidence candidates remain visible in the turn’s `memoryDecision` as skipped proposals.
- Deduplicate on normalized `{type, scope, sessionId?, statement}`. A duplicate should confirm the existing item by updating `updatedAt`, `lastConfirmedFrom`, and `confirmationCount`, not create a second item.
- Keep the store file-backed for V1, matching the current session architecture. Use `data/memory-items/<id>.json` behind a `MemoryStore` abstraction with `list`, `load`, `upsert/confirm`, and `delete`.
- Extend context building and trace with `selectedMemoryItems`. Retrieval order is: same-session `open_thread` items first, then relevant global `project_decision`, then relevant global `user_preference`. Cap retrieval at 5 items total.
- Render memory in the prompt after session summary and recent context under `Durable memory (lowest-priority, non-canonical):`. Render only normalized statements there; keep justifications in trace/UI, not in prompt text.
- Keep memory strictly below canon, continuity, session summary, and recent turns. Memory never outranks canon, never overrides recent context, and never promotes itself into canon.
- Expand persisted turn records so `memoryDecision` includes structured candidates plus stored/confirmed item refs or snapshots. Turn inspection should show what was proposed, what was stored, and why.
- Add dashboard endpoints for memory listing and deletion. V1 API shape should be `GET /api/memory` with optional `sessionId` and `scope` filters, plus `DELETE /api/memory/:id` for hard delete.
- Extend the inquiry surface with a memory inspector on the existing page. Show active items newest-first with type/scope badges, source session link, justification, confirmation count, and delete actions. When a session is active, its session-linked items float to the top.
- Extend the turn inspection drawer with a `Stored Memory` block showing items created or confirmed by that turn, plus skipped candidates.
- Make memory statements searchable in the inquiry surface so the operator can find sessions and memory by stored content.
- Extend eval trace and assertion support with `selectedMemoryItems`, and allow eval cases to load optional memory fixtures so retrieval behavior can be tested without a live store.
- Update docs and glossary to reflect the actual V1 implementation and remove the stale “stored in the database” wording.

## Test Plan
- Unit test: a clear user preference creates one global memory item with justification and `high` confidence.
- Unit test: repeating the same preference confirms the existing item instead of duplicating it.
- Unit test: ephemeral facts like food, mood, or temporary logistics do not create memory.
- Unit test: `open_thread` items retrieve only for the originating session; global items retrieve across sessions.
- Unit test: deleting a memory item removes it from future retrieval while historical turn inspection still shows the stored snapshot/ref.
- Integration test: `runSessionTurn` writes memory, retrieves it into a later turn, and records stored/confirmed items on the persisted turn.
- Eval cases: relevant memory is retrieved when it should be, irrelevant memory is not, and memory never overrides canon or continuity.
- UI smoke: inquiry shows active memory, turn inspection shows stored memory details, and delete removes the item from the live list and subsequent retrieval.

## Assumptions And Defaults
- File-backed storage is the V1 default and should stay aligned with the current zero-external-dependency operator stack.
- V1 supports inspect and delete only; no manual create/edit and no approval queue.
- `open_thread` resolution is manual delete in V1; there is no auto-resolution, TTL, or archival state yet.
- Memory retrieval applies to normal live inquiry turns across the current mode set without mode-specific branching in V1.
- The memory pass uses the active provider but with a minimal dedicated prompt so it stays much lighter than the full turn pipeline.
