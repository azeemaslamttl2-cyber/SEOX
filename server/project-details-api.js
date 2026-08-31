import { query, queryOne } from "../functions/_lib/mysql.js";
import {
  createProjectDetailsHandler,
  createProjectInsertHandler,
} from "../functions/_handlers/project-details.js";

const getProjectDetails = createProjectDetailsHandler(queryOne);
const insertProject = createProjectInsertHandler(queryOne, query);

/**
 * Register the project-details route on an Express application.
 *
 * Usage: registerProjectDetailsRoute(app) creates
 * GET /api/project-details?admin_token=...&url=...
 */
export function registerProjectDetailsRoute(app, handler = getProjectDetails) {
  app.get("/api/project-details", async (req, res) => {
    try {
      const project = await handler(req.query);
      return res.status(200).json(project);
    } catch (error) {
      const status = error?.status || 500;
      if (status >= 500) console.error("Project details API error", error);
      return res.status(status).json({
        error: status === 500 ? "Internal server error" : error.message,
      });
    }
  });
}

/**
 * Register the add-project-detail route on an Express application.
 *
 * Usage: registerAddProjectDetailRoute(app) creates
 * POST /api/add-project-detail
 */
export function registerAddProjectDetailRoute(app, handler = insertProject) {
  app.post("/api/add-project-detail", async (req, res) => {
    try {
      const project = await handler(req.body || req.query);
      return res.status(201).json(project);
    } catch (error) {
      const status = error?.status || 500;
      if (status >= 500) console.error("Add project API error", error);
      return res.status(status).json({
        error: status === 500 ? "Internal server error" : error.message,
      });
    }
  });
}
