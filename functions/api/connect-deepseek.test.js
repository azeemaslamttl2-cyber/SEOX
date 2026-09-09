import test from "node:test";
import assert from "node:assert/strict";

import { onRequest as deepseekHandler } from "./deepseek.js";
import { onRequest as connectDeepseekHandler } from "./connect-deepseek.js";
import * as route from "../../app/api/connect-deepseek/route.js";

test("Connect DeepSeek re-exports the existing DeepSeek handler", () => {
  assert.equal(connectDeepseekHandler, deepseekHandler);
  assert.equal(typeof route.POST, "function");
  assert.equal(typeof route.OPTIONS, "function");
});
