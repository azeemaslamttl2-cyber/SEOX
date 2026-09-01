import handler from "../_handlers/check-redirects.js";
import { runNodeHandler } from "../_lib/node-handler-adapter.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
