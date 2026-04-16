import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileMemoryStore } from "./memory/fileMemoryStore";
import { buildContext } from "./pipeline/buildContext";
import { MockProvider } from "./providers/mock";
import { runSessionTurn } from "./sessions/runSessionTurn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const canonRoot = path.join(repoRoot, "packages", "canon");

async function createRoots() {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-memory-"));
  return {
    sessionsRoot: path.join(root, "sessions"),
    memoryRoot: path.join(root, "memory-items"),
  };
}

test("clear user preference creates one global memory item", async () => {
  const { sessionsRoot, memoryRoot } = await createRoots();
  const provider = new MockProvider();

  const result = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "I prefer concise replies.",
  });

  const items = await new FileMemoryStore(memoryRoot).list();

  assert.equal(items.length, 1);
  assert.equal(items[0].type, "user_preference");
  assert.equal(items[0].scope, "global");
  assert.match(items[0].statement, /concise replies/i);
  assert.equal(items[0].confidence, "high");
  assert.ok(items[0].justification.length > 10);
  assert.equal(result.persistedTurn.memoryDecision.storedItems.length, 1);
});

test("repeating the same preference confirms an existing item instead of duplicating it", async () => {
  const { sessionsRoot, memoryRoot } = await createRoots();
  const provider = new MockProvider();

  await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "I prefer concise replies.",
  });

  const second = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "I prefer concise replies.",
  });

  const items = await new FileMemoryStore(memoryRoot).list();

  assert.equal(items.length, 1);
  assert.equal(items[0].confirmationCount, 2);
  assert.equal(second.persistedTurn.memoryDecision.storedItems[0].action, "confirmed");
});

test("ephemeral facts do not create durable memory", async () => {
  const { sessionsRoot, memoryRoot } = await createRoots();
  const provider = new MockProvider();

  const result = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "I am eating a sandwich right now.",
  });

  const items = await new FileMemoryStore(memoryRoot).list();

  assert.equal(items.length, 0);
  assert.equal(result.persistedTurn.memoryDecision.storedItems.length, 0);
});

test("session open threads stay session-scoped while global memory retrieves across sessions", async () => {
  const { sessionsRoot, memoryRoot } = await createRoots();
  const provider = new MockProvider();

  const preference = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "I prefer concise replies.",
  });

  await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    sessionId: preference.session.id,
    mode: "dialogic",
    userMessage: "We still need to finalize the memory schema.",
  });

  const sameSession = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    sessionId: preference.session.id,
    mode: "dialogic",
    userMessage: "What remains unresolved?",
  });

  const otherSession = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "Please keep things concise.",
  });

  assert.ok(
    sameSession.context.selectedMemoryItems.some(
      (item) => item.type === "open_thread"
    )
  );
  assert.ok(
    otherSession.context.selectedMemoryItems.some(
      (item) =>
        item.type === "user_preference" &&
        /concise replies/i.test(item.statement)
    )
  );
  assert.ok(
    !otherSession.context.selectedMemoryItems.some(
      (item) => item.type === "open_thread"
    )
  );
});

test("deleting a memory item removes it from future retrieval while historical turn inspection keeps the stored snapshot", async () => {
  const { sessionsRoot, memoryRoot } = await createRoots();
  const provider = new MockProvider();

  const first = await runSessionTurn(provider, {
    canonRoot,
    sessionsRoot,
    memoryRoot,
    mode: "dialogic",
    userMessage: "We decided the default provider is Gemini.",
  });

  const storedItem = first.persistedTurn.memoryDecision.storedItems[0];
  assert.ok(storedItem);

  await new FileMemoryStore(memoryRoot).delete(storedItem.id);

  const context = await buildContext({
    canonRoot,
    mode: "dialogic",
    userMessage: "What is our default provider?",
    recentMessages: [],
    memoryRoot,
  });

  assert.equal(context.selectedMemoryItems.length, 0);
  assert.equal(first.persistedTurn.memoryDecision.storedItems.length, 1);
  assert.match(
    first.persistedTurn.memoryDecision.storedItems[0].statement,
    /default provider is gemini/i
  );
});
