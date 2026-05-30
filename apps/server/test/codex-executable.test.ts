import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCodexExecutablePath } from "../src/codex-executable.js";

const tempDirectories: string[] = [];

function createTempDirectory(): string {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "farfield-codex-path-"),
  );
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

function writeExecutable(filePath: string, modifiedAt: Date): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
  fs.utimesSync(filePath, modifiedAt, modifiedAt);
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop();
    if (!tempDirectory) {
      continue;
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

describe("resolveCodexExecutablePath", () => {
  it("uses an explicit Codex CLI path first", () => {
    expect(
      resolveCodexExecutablePath(
        {
          CODEX_CLI_PATH: "D:\\Tools\\codex.exe",
          LOCALAPPDATA: "D:\\LocalAppData",
        },
        "win32",
      ),
    ).toBe("D:\\Tools\\codex.exe");
  });

  it("uses the newest Windows Codex desktop executable", () => {
    const localAppData = createTempDirectory();
    const binRoot = path.join(localAppData, "OpenAI", "Codex", "bin");
    const oldExecutable = path.join(binRoot, "1.0.0", "codex.exe");
    const newExecutable = path.join(binRoot, "2.0.0", "codex.exe");
    const rootExecutable = path.join(binRoot, "codex.exe");

    writeExecutable(oldExecutable, new Date("2025-01-01T00:00:00Z"));
    writeExecutable(newExecutable, new Date("2025-02-01T00:00:00Z"));
    writeExecutable(rootExecutable, new Date("2025-01-15T00:00:00Z"));

    expect(
      resolveCodexExecutablePath(
        {
          LOCALAPPDATA: localAppData,
        },
        "win32",
      ),
    ).toBe(newExecutable);
  });

  it("uses the PATH command name when Windows desktop binaries are absent", () => {
    const localAppData = createTempDirectory();

    expect(
      resolveCodexExecutablePath(
        {
          LOCALAPPDATA: localAppData,
        },
        "win32",
      ),
    ).toBe("codex");
  });
});
