// Additional route name for the same authenticated DeepSeek implementation.
// Re-exporting keeps request handling, validation, key resolution, response
// shape, and error behavior identical to /api/deepseek.
export { onRequest } from "./deepseek.js";
