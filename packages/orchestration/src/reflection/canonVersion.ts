import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

interface CanonManifest {
  version?: string;
  last_updated?: string;
}

/**
 * Read the active canon version from the manifest. Used to stamp every
 * authored artifact and reflection run with the canon snapshot they were
 * authored against.
 */
export async function readCanonVersion(canonRoot: string): Promise<string> {
  const manifestPath = path.join(canonRoot, "manifest.yaml");
  const raw = await readFile(manifestPath, "utf8");
  const parsed = YAML.parse(raw) as CanonManifest | undefined;
  const version = parsed?.version;
  if (!version || typeof version !== "string") {
    throw new Error(
      `Canon manifest at ${manifestPath} is missing a string "version" field`
    );
  }
  return version;
}
