import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Resolve paperclip-runnerd for integration tests, building only when needed. */
export function ensurePaperclipRunnerBinary(runnerRoot: string): string {
  const runnerBinName = process.platform === "win32" ? "paperclip-runnerd.exe" : "paperclip-runnerd";
  const builtRunnerBin = join(runnerRoot, "runner/target/release", runnerBinName);
  const envRunnerBin = process.env.PAPERCLIP_RUNNER_BINARY;
  if (envRunnerBin && existsSync(envRunnerBin)) return envRunnerBin;
  if (existsSync(builtRunnerBin)) return builtRunnerBin;
  // Cold release builds on GitHub-hosted runners can exceed 5 minutes without a warm cache.
  execFileSync(
    "cargo",
    [
      "build",
      "--release",
      "--locked",
      "--manifest-path",
      join(runnerRoot, "runner/Cargo.toml"),
      "-p",
      "paperclip-runner-core",
      "--bin",
      "paperclip-runnerd",
    ],
    { cwd: runnerRoot, stdio: "inherit", timeout: 900_000 },
  );
  return builtRunnerBin;
}
