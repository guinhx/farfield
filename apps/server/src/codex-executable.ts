import fs from "node:fs";
import path from "node:path";

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

interface CodexExecutableCandidate {
  path: string;
  modifiedAtMs: number;
}

export function resolveCodexExecutablePath(
  env: EnvironmentVariables = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const explicitPath = env["CODEX_CLI_PATH"];
  if (explicitPath) {
    return explicitPath;
  }

  if (platform === "win32") {
    const windowsPath = resolveWindowsCodexExecutablePath(env);
    if (windowsPath) {
      return windowsPath;
    }
  }

  const desktopPath = "/Applications/Codex.app/Contents/Resources/codex";
  if (fs.existsSync(desktopPath)) {
    return desktopPath;
  }

  return "codex";
}

function resolveWindowsCodexExecutablePath(
  env: EnvironmentVariables,
): string | null {
  const localAppData = env["LOCALAPPDATA"];
  if (!localAppData) {
    return null;
  }

  const binRoot = path.join(localAppData, "OpenAI", "Codex", "bin");
  const candidates: CodexExecutableCandidate[] = [];
  addWindowsCodexCandidate(path.join(binRoot, "codex.exe"), candidates);

  if (fs.existsSync(binRoot)) {
    for (const entry of fs.readdirSync(binRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      addWindowsCodexCandidate(
        path.join(binRoot, entry.name, "codex.exe"),
        candidates,
      );
    }
  }

  candidates.sort(
    (left, right) =>
      right.modifiedAtMs - left.modifiedAtMs ||
      left.path.localeCompare(right.path),
  );
  return candidates[0]?.path ?? null;
}

function addWindowsCodexCandidate(
  candidatePath: string,
  candidates: CodexExecutableCandidate[],
): void {
  try {
    const stats = fs.statSync(candidatePath);
    if (stats.isFile()) {
      candidates.push({
        path: candidatePath,
        modifiedAtMs: stats.mtimeMs,
      });
    }
  } catch {
    return;
  }
}
