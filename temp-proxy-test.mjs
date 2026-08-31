import { runNodeHandler } from "./functions/_lib/node-handler-adapter.js";
import proxyHandler from "./functions/_handlers/proxy.js";
const body = JSON.stringify({service:"dataforseo",action:"plagiarism_serp_search",phrase:"hi",depth:10});
const request = new Request("http://127.0.0.1/api/proxy", {method:"POST", headers:{"content-type":"application/json"}, body});
const response = await runNodeHandler({request, env:{NODE_ENV:"development"}}, proxyHandler);
console.log(response.status);
console.log(await response.text());
