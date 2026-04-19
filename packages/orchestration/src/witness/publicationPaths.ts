import { realpath } from "node:fs/promises";
import path from "node:path";

function assertResolvedWithinCanonicalRoot(
  canonicalRootPath: string,
  canonicalTargetPath: string,
  label: string
): void {
  const relativePath = path.relative(canonicalRootPath, canonicalTargetPath);
  if (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  ) {
    return;
  }

  throw new Error(`${label} must resolve within ${canonicalRootPath}.`);
}

export function publicationExportsRoot(publicationBundleRoot: string): string {
  return path.join(publicationBundleRoot, "exports");
}

export function publicationPackagesRoot(publicationBundleRoot: string): string {
  return path.join(publicationBundleRoot, "packages");
}

export async function resolvePublicationPathWithinRoot(
  rootPath: string,
  targetPath: string,
  label: string
): Promise<string> {
  const canonicalRootPath = await realpath(rootPath);
  const canonicalTargetPath = await realpath(targetPath);
  assertResolvedWithinCanonicalRoot(
    canonicalRootPath,
    canonicalTargetPath,
    label
  );
  return canonicalTargetPath;
}
