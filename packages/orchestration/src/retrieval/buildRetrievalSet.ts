import type { LoadedCanon } from "../types/canon";
import type { Mode } from "../types/modes";
import { selectCanonDocuments } from "../canon/selectCanon";
import { selectContinuityFacts } from "./selectContinuityFacts";
import { selectGlossaryTerms } from "./selectGlossaryTerms";
import { selectRecoveredArtifacts } from "./selectRecoveredArtifacts";

export function buildRetrievalSet(
  canon: LoadedCanon,
  query: string,
  mode: Mode
) {
  return {
    documents: selectCanonDocuments(canon, query, mode),
    facts: selectContinuityFacts(canon.continuityFacts, query, mode),
    glossaryTerms: selectGlossaryTerms(canon.glossary.terms, query),
    recoveredArtifacts: selectRecoveredArtifacts(
      canon.recoveredArtifacts,
      query,
      mode
    ),
  };
}
