import handler from "../../_handlers/crawler-fetch.js";
import { runNodeHandler } from "../../_lib/node-handler-adapter.js";

export function onRequest(context) {
  return runNodeHandler(context, handler);
}
