import handler from "../_handlers/local-expired-finder.js";
import { runNodeHandler } from "../_lib/node-handler-adapter.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
