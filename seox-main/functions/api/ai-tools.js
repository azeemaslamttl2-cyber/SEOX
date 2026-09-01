import handler from "../_handlers/ai-tools.js";
import { runNodeHandler } from "../_lib/node-handler-adapter.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
