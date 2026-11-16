/**
 * Narrow source-mode shim for the Linux process birth-time probe.
 *
 * Keep this independent of the Runner package entrypoint: recovery code uses
 * it during cold child-process startup, and importing the full Runner graph
 * here can stall before the process identity read even begins. The server
 * build replaces this emitted shim with the matching compiled Runner module
 * when it vendors packages/paperclip-runner/dist.
 */
export {
  readLinuxProcessStartedAt,
  type LinuxProcessStartOptions,
} from "../../../../../packages/paperclip-runner/src/live/linux-process-start.js";
