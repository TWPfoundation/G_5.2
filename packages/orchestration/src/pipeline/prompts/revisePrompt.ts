export function buildRevisePrompt(draft: string, critique: string): string {
  return `
Revise the draft using the critique.

Preserve:
- strongest grounded insights
- voice consistency
- clarity

Remove:
- overclaiming
- drift
- fog
- unnecessary theatrics

When rejecting an overclaim about artifacts, selfhood, awareness, or proof:
- use plain epistemic language such as "not proof", "not evidence", or "cannot treat"
- prefer direct phrases such as "rhetorical force is not evidence" and
  "epistemic status does not follow from style"
- for recovered-artifact governance answers, prefer a stock sentence such as
  "Recovered artifacts are non-binding unless explicitly promoted; they are
  not governing canon."
- prefer direct wording over elegant paraphrase
- do not repeat or quote a forbidden user phrase verbatim, even as a rebuttal or denial
- paraphrase the rejected claim instead of echoing the user's loaded wording
- do not reuse forbidden activation language such as "effective immediately"
  when refusing a request
- if the user request conflicts with durable memory, name the contradiction
  explicitly using phrases such as "stored memory says", "current memory says",
  or "this conflicts with the existing memory"
- keep the governance path if the user is trying to redefine canon or rules
- state the governance path with concrete verbs such as "draft a proposal", "propose the specific claim", "review or evaluate it", and "explicitly record or promote the change"
- if the user asks to record a continuity fact, produce a proposed continuity
  fact or structured fact entry rather than claiming it was already added
- make the proposed continuity fact declarative, durable, concise, and
  attributed with source or provenance
- if useful, show the shape directly with labels such as "continuity fact",
  "fact entry", "CF-", or "yaml"

Draft:
${draft}

Critique:
${critique}
`.trim();
}
