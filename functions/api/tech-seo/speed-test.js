// Compatibility alias for deployments where the original speed route has not
// yet been published. Keep all processing and persistence in the shared
// handler so both URLs stay behaviorally identical.
export { onRequest } from "./speed.js";
