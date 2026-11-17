/**
 * Narrow source-mode shim for the Linux process birth-time probe.
 *
 * Keep this independent of the Runner package entrypoint: recovery code uses
 * it during cold child-process startup, and importing the full Runner graph
 * here can stall before the process identity read even begins. The server
 * build replaces this emitted shim with the matching compiled Runner module
 * when it vendors packages/paperclip-runner/dist.
 */
type RunnerProcessStart = typeof import("@paperclipai/paperclip-runner").readLinuxProcessStartedAt;

const sourceUrl = new URL(
  "../../../../../packages/paperclip-runner/src/live/linux-process-start.ts",
  import.meta.url,
);
const source = (await import(sourceUrl.href)) as {
  readLinuxProcessStartedAt: RunnerProcessStart;
};

export const readLinuxProcessStartedAt = source.readLinuxProcessStartedAt;
export type { LinuxProcessStartOptions } from "@paperclipai/paperclip-runner";
