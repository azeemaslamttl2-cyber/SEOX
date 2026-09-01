import handler from "../_handlers/fetch-url-meta.js";
import { runNodeHandler } from "../_lib/node-handler-adapter.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
