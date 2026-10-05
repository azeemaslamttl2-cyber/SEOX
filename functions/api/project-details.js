import { configureMysqlConnection, query, queryOne } from "../_lib/mysql.js";
import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from "../_lib/http.js";
import { createProjectDetailsHandler, createProjectInsertHandler } from "../_handlers/project-details.js";
import { resolveGscData } from "../_lib/gsc-server.js";

const insertProject = createProjectInsertHandler(queryOne, query);

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    configureMysqlConnection(env);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const getProjectDetails = createProjectDetailsHandler(queryOne, { resolveGscData, env });
      const project = await getProjectDetails({
        admin_token: url.searchParams.get("admin_token"),
        url: url.searchParams.get("url"),
        project_id: url.searchParams.get("project_id"),
        feature: url.searchParams.get("feature"),
        refresh: url.searchParams.get("refresh"),
      });
      return jsonResponse(project, 200, headers);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const project = await insertProject(body);
      return jsonResponse(project, 201, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
