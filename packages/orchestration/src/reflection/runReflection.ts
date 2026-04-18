import { buildContext } from "../pipeline/buildContext";
import {
  buildReflectionCritiquePrompt,
  buildReflectionDraftPrompt,
  buildReflectionRevisePrompt,
} from "../pipeline/prompts/reflectionPrompts";
import { describeProvider } from "../providers/label";
import type { ModelProvider } from "../types/providers";
import type { ReflectionTopic, ReflectionRun } from "../schemas/reflection";
import { readCanonVersion } from "./canonVersion";

export interface RunReflectionInput {
  topic: ReflectionTopic;
  canonRoot: string;
  /** Optional non-canonical context excerpt drawn from a linked session. */
  linkedSessionContext?: string;
}

export interface ReflectionRunArtifacts {
  run: Omit<ReflectionRun, "schemaVersion" | "id">;
}

/**
 * Run the reflection authoring pass for a single topic.
 *
 * The pipeline reuses the existing context builder to anchor the draft in
 * active canon, but uses reflection-specific prompts that explicitly mark
 * the output as authored material rather than canon. This function does
 * not persist anything; the caller is responsible for storing the run and
 * the resulting authored artifact.
 */
export async function runReflection(
  provider: ModelProvider,
  input: RunReflectionInput
): Promise<ReflectionRunArtifacts> {
  const startedAt = new Date().toISOString();
  const canonVersion = await readCanonVersion(input.canonRoot);

  const context = await buildContext({
    canonRoot: input.canonRoot,
    mode: "reflective",
    userMessage: `${input.topic.title}\n\n${input.topic.prompt}`,
    recentMessages: [],
  });

  const draftUserPrompt = buildReflectionDraftPrompt({
    topicTitle: input.topic.title,
    topicPrompt: input.topic.prompt,
    notes: input.topic.notes,
    linkedSessionContext: input.linkedSessionContext,
  });

  const draftResult = await provider.generateText({
    system: context.systemPrompt,
    user: draftUserPrompt,
  });
  const draft = draftResult.text;

  const critiqueResult = await provider.generateText({
    system: "You are the reflection critique pass for G_5.2.",
    user: buildReflectionCritiquePrompt(draft),
  });
  const critique = critiqueResult.text;

  const revisionResult = await provider.generateText({
    system: context.systemPrompt,
    user: buildReflectionRevisePrompt(draft, critique),
  });
  const revision = revisionResult.text;

  const completedAt = new Date().toISOString();
  const providerLabel = describeProvider(provider, revisionResult.model ?? "unknown");

  return {
    run: {
      topicId: input.topic.id,
      startedAt,
      completedAt,
      status: "completed",
      provider: providerLabel,
      canonVersion,
      draft,
      critique,
      revision,
      final: revision,
      contextSnapshot: {
        selectedDocuments: context.selectedDocuments.map((d) => ({
          slug: d.slug,
          title: d.title,
        })),
        selectedFacts: context.selectedFacts.map((f) => ({
          id: f.id,
          statement: f.statement,
        })),
        selectedGlossaryTerms: context.selectedGlossaryTerms.map((t) => ({
          term: t.term,
          definition: t.definition,
        })),
        selectedRecoveredArtifacts: context.selectedRecoveredArtifacts.map(
          (a) => ({ slug: a.slug, title: a.title })
        ),
      },
    },
  };
}
