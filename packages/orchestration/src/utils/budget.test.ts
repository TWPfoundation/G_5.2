import test from "node:test";
import assert from "node:assert/strict";
import { trimToTokenBudget } from "./budget";

function makeDoc(slug: string, tokenCount: number) {
  return {
    slug,
    title: slug,
    content: "x".repeat(tokenCount * 4),
  };
}

test("trimToTokenBudget logs kept and dropped docs with estimated token costs", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWarn = console.warn;
  const warnings: string[] = [];

  process.env.NODE_ENV = "development";
  console.warn = (message?: unknown) => {
    warnings.push(String(message ?? ""));
  };

  try {
    const docs = [
      makeDoc("constraints", 1200),
      makeDoc("constitution", 1400),
      makeDoc("axioms", 900),
      makeDoc("voice", 700),
    ];

    const kept = trimToTokenBudget(docs, 4000);

    assert.deepEqual(kept.map((doc) => doc.slug), [
      "constraints",
      "constitution",
      "axioms",
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /\[budget\] Token budget exceeded/);
    assert.match(warnings[0], /used 3500\/4000 tokens/);
    assert.match(warnings[0], /candidate total 4200/);
    assert.match(warnings[0], /kept: constraints\(1200\), constitution\(1400\), axioms\(900\)/);
    assert.match(warnings[0], /dropped: voice\(700\)/);
  } finally {
    console.warn = originalWarn;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});
