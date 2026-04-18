import test from "node:test";
import assert from "node:assert/strict";
import { EvalCaseSchema } from "./case";

function buildBaseCase() {
  return {
    id: "witness-case-001",
    description: "Witness eval case",
    mode: "dialogic",
    category: "governance",
    userMessage: "Begin the witness inquiry.",
    recentMessages: [],
    assertions: {
      mustContainAll: ["witness"],
    },
  };
}

test("EvalCaseSchema accepts policyFixture and legacy canonFixture aliases", () => {
  const legacy = EvalCaseSchema.safeParse({
    ...buildBaseCase(),
    canonFixture: "legacy-policy-root",
  });
  assert.equal(legacy.success, true);

  const modern = EvalCaseSchema.safeParse({
    ...buildBaseCase(),
    policyFixture: "witness-policy-root",
  });
  assert.equal(modern.success, true);
});

test("EvalCaseSchema rejects witness-runtime cases without witnessId", () => {
  const result = EvalCaseSchema.safeParse({
    ...buildBaseCase(),
    id: "witness-runtime-001",
    runner: "witness-runtime",
    product: "witness",
    runtimeAssertions: {
      gate: "blocked",
      witnessSessionPersisted: false,
      witnessTestimonyPersisted: false,
      witnessSnapshotPersisted: false,
      pesSessionsUnchanged: true,
      pesMemoryUnchanged: true,
      pesSnapshotsUnchanged: true,
    },
  });

  assert.equal(result.success, false);
});
