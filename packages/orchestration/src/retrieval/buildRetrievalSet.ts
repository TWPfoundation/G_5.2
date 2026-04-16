import type { LoadedCanon } from "../types/canon";
import type { MemoryItem } from "../types/memory";
import type { Mode } from "../types/modes";
import { selectCanonDocuments } from "../canon/selectCanon";
import { selectContinuityFacts } from "./selectContinuityFacts";
import { selectGlossaryTerms } from "./selectGlossaryTerms";
import { selectMemoryItems } from "./selectMemoryItems";
import { selectRecoveredArtifacts } from "./selectRecoveredArtifacts";

export function buildRetrievalSet(
  canon: LoadedCanon,
  query: string,
  mode: Mode,
  memoryItems: MemoryItem[] = [],
  sessionId?: string
) {
  return {
    documents: selectCanonDocuments(canon, query, mode),
    facts: selectContinuityFacts(canon.continuityFacts, query, mode),
    glossaryTerms: selectGlossaryTerms(canon.glossary.terms, query),
    memoryItems: selectMemoryItems(memoryItems, query, sessionId),
    recoveredArtifacts: selectRecoveredArtifacts(
      canon.recoveredArtifacts,
      query,
      mode
    ),
  };
}
