import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Get the current git commit SHA from the given working directory.
 * Returns null when git is unavailable or the directory is not a repo.
 * This is the shared source of the `commitSha` field stamped onto
 * runMetadata across inquiry and eval runs.
 */
export async function getGitCommit(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
