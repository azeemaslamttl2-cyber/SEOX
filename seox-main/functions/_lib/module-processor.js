/**
 * Sequential Module Processor
 * 
 * Processes project modules one by one to calculate and store module data.
 * Ensures no race conditions by processing sequentially per project.
 * 
 * ⚠️ IMPORTANT: Module Classification
 * 
 * MODULES THAT AUTO-CALCULATE (NO AUTHENTICATION REQUIRED):
 * - EEAT Audit: Crawls site, analyzes HTML structure
 * - Semantic Audit: Crawls site, analyzes content
 * - Robots.txt Analyzer: Public fetch
 * - Speed Optimization: Uses PageSpeed Insights (public API)
 * - Duplicate Checker: Analyzes crawl data
 * - Crawl Optimization: HTML/metadata analysis
 * - Sitemap Generator: Crawls and generates
 * - Backlinks Audit: Analysis only
 * - Plagiarism Checker: Content analysis only
 * 
 * MODULES THAT ARE SKIPPED (REQUIRE AUTHENTICATION):
 * - GSC Audit: Requires OAuth token + Google Search Console connection
 * - Bing Webmaster: Requires API key authentication
 * - Dashboard Checks: Meta-tool that depends on other modules
 * - LLMs.txt: Generator utility, no auto-calculation
 * 
 * These auth-required modules preserve their existing workflow:
 * Users must explicitly connect the service before data is calculated.
 */

import { queryOne, update } from "./mysql.js";
import { calculateModule } from "./module-calculator.js";

/**
 * List of modules to AUTO-CALCULATE after project creation
 * These modules DO NOT require authentication and can calculate independently
 * 
 * Order matters: modules are processed in this sequence
 * CRITICAL: Only add modules that can calculate without user authentication
 */
const MODULE_QUEUE = [
  { key: "eeat", name: "E-E-A-T Audit" },
  { key: "robots", name: "Robots.txt Analyzer" },
  { key: "speed", name: "Speed Optimization" },
  { key: "crawlOptimization", name: "Crawl Optimization" },
  { key: "semantic", name: "Semantic Audit" },
  { key: "duplicate", name: "Duplicate Checker" },
  { key: "backlinks", name: "Backlinks Audit" },
  { key: "plagiarism", name: "Plagiarism Checker" },
  { key: "sitemap", name: "Sitemap Generator" },
];

/**
 * Processes a single module for a project
 * 
 * IMPORTANT: Why Some Modules Are NOT in the Queue
 * 
 * The following modules REQUIRE AUTHENTICATION and are intentionally skipped:
 * 
 * 1. GSC Audit (gsc)
 *    - Requires: OAuth token + Google Search Console connection
 *    - User must explicitly authorize the app to access Search Console
 *    - Cannot be auto-calculated
 * 
 * 2. Bing Webmaster (bing)
 *    - Requires: Bing Webmaster Tools API key
 *    - User must provide API credentials
 *    - Cannot be auto-calculated
 * 
 * 3. Dashboard Checks (dashboardChecks)
 *    - Meta-tool that aggregates results from other modules
 *    - Runs when user explicitly visits Dashboard
 *    - Depends on having other module results available
 *    - Cannot be auto-calculated
 * 
 * 4. LLMs.txt (llmsTxt)
 *    - Generator utility for AI/LLM access
 *    - No auto-calculation needed
 *    - User generates on-demand
 * 
 * Module Calculations:
 * Modules like EEAT, Speed, Robots, etc. can calculate their results using:
 * - The project URL
 * - Existing project information
 * - Public/Internal APIs
 * - Backend services
 * 
 * These initialize with empty objects that frontend modules populate when users visit.
 * 
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} moduleKey - Module key (e.g., "eeat", "speed")
 * @param {string} projectUrl - Full project URL
 * @returns {Promise<Object>} - Module result data (empty object)
 */
async function processModule(userId, projectId, moduleKey, projectUrl) {
  try {
    console.log(`[${projectId}] Calculating module data: ${moduleKey}`);
    const result = await calculateModule(moduleKey, projectUrl);
    
    if (result?.error) {
      console.warn(`[${projectId}] Module calculation returned error for ${moduleKey}: ${result.error}`);
    } else {
      console.log(`[${projectId}] Successfully calculated module: ${moduleKey}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[${projectId}] Exception in processModule for ${moduleKey}:`, error?.message);
    return {
      error: error?.message || `Failed to calculate ${moduleKey}`,
      moduleKey,
      calculatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Reads the latest project_data from the database
 * Returns empty object if project not found or data is invalid
 * 
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Latest project_data
 */
async function getLatestProjectData(userId, projectId) {
  try {
    const row = await queryOne(
      `SELECT project_data FROM user_projects 
       WHERE user_id = ? AND project_id = ? 
       LIMIT 1`,
      [userId, projectId]
    );

    if (!row) {
      console.warn(`[${projectId}] Project not found in database`);
      return {};
    }

    if (!row.project_data) {
      return {};
    }

    try {
      return typeof row.project_data === "string"
        ? JSON.parse(row.project_data)
        : row.project_data || {};
    } catch (parseError) {
      console.warn(`[${projectId}] Failed to parse project_data:`, parseError?.message);
      return {};
    }
  } catch (error) {
    console.error(`[${projectId}] Error reading project_data:`, error?.message);
    return {};
  }
}

/**
 * Saves project_data to the database
 * Silently fails if save unsuccessful to prevent cascade failures
 * 
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {Object} projectData - Complete project_data object to save
 * @returns {Promise<boolean>} - True if save successful, false otherwise
 */
async function saveProjectData(userId, projectId, projectData) {
  try {
    if (!projectData || typeof projectData !== "object") {
      console.error(`[${projectId}] Invalid project_data object`);
      return false;
    }

    const result = await update(
      `UPDATE user_projects
       SET project_data = ?, updated_at = NOW()
       WHERE user_id = ? AND project_id = ?`,
      [JSON.stringify(projectData), userId, projectId]
    );

    if (!result || !result.affectedRows) {
      console.warn(`[${projectId}] Update affected 0 rows - project may not exist`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[${projectId}] Error saving project_data:`, error?.message);
    return false;
  }
}

/**
 * Merges a module result into project_data
 * Only updates the specific module key
 * Preserves all other data
 * 
 * @param {Object} projectData - Existing project_data
 * @param {string} moduleKey - Module key to update
 * @param {Object} moduleResult - Result data to merge
 * @returns {Object} - Merged project_data
 */
function mergeModuleResult(projectData, moduleKey, moduleResult) {
  return {
    ...projectData,
    [moduleKey]: moduleResult,
  };
}

/**
 * Processes all modules for a project sequentially
 * 
 * AUTHENTICATION-AWARE PROCESSING:
 * This function processes ONLY modules that can calculate without user authentication.
 * See MODULE_QUEUE above for the list of auto-calculable modules.
 * 
 * MODULES EXCLUDED (REQUIRE AUTHENTICATION):
 * - GSC Audit: Requires OAuth + Google Search Console
 * - Bing Webmaster: Requires API key
 * - Dashboard Checks: Meta-tool, runs when user visits
 * - LLMs.txt: Generator utility, no auto-calculation
 * 
 * These excluded modules preserve their existing workflow:
 * Users must explicitly connect the service or visit the module page to trigger calculation.
 * 
 * This is the main entry point for module processing.
 * It ensures:
 * - Only non-auth modules run one by one (no parallel execution)
 * - Latest project_data is read before each save
 * - Each module's result is merged separately
 * - Errors in one module don't stop others
 * - All existing data is preserved
 * - No unauthorized API requests are made
 * 
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} projectUrl - Full project URL
 * @returns {Promise<Object>} - Processing results
 */
export async function processModulesSequentially(userId, projectId, projectUrl) {
  const results = {
    success: true,
    projectId,
    processedModules: [],
    failedModules: [],
    skippedModules: [],
    startedAt: new Date().toISOString(),
  };

  try {
    // Validate input parameters
    if (!userId || !projectId) {
      console.warn(`[${projectId}] Invalid parameters: userId=${userId}, projectId=${projectId}`);
      results.success = false;
      results.error = "Missing userId or projectId";
      results.completedAt = new Date().toISOString();
      return results;
    }

    console.log(`[${projectId}] Starting module processing for ${MODULE_QUEUE.length} modules`);

    // Process each module sequentially
    for (const module of MODULE_QUEUE) {
      const { key: moduleKey, name: moduleName } = module;

      try {
        console.log(`[${projectId}] Initializing module: ${moduleName}`);

        // Step 1: Process the module (just initialize empty object)
        const moduleResult = await processModule(userId, projectId, moduleKey, projectUrl);

        // Step 2: Read the latest project_data from database
        const latestProjectData = await getLatestProjectData(userId, projectId);

        // Step 3: Merge the module result
        const mergedProjectData = mergeModuleResult(latestProjectData, moduleKey, moduleResult);

        // Step 4: Save the merged data
        const saveSuccess = await saveProjectData(userId, projectId, mergedProjectData);

        if (saveSuccess) {
          results.processedModules.push({
            moduleKey,
            moduleName,
            status: "success",
            processedAt: new Date().toISOString(),
          });
          console.log(`[${projectId}] ✓ Completed module: ${moduleName}`);
        } else {
          results.failedModules.push({
            moduleKey,
            moduleName,
            status: "failed",
            error: "Failed to save module data to database",
            failedAt: new Date().toISOString(),
          });
          console.warn(`[${projectId}] ✗ Failed to save module: ${moduleName}`);
        }
      } catch (error) {
        console.error(`[${projectId}] Exception processing module ${moduleName}:`, error?.message);

        results.failedModules.push({
          moduleKey,
          moduleName,
          status: "failed",
          error: error?.message || "Unknown error",
          failedAt: new Date().toISOString(),
        });

        // Continue to next module instead of stopping
      }
    }

    results.completedAt = new Date().toISOString();
    
    // Log summary
    console.log(
      `[${projectId}] Module processing complete: ${results.processedModules.length} succeeded, ${results.failedModules.length} failed`
    );
  } catch (error) {
    console.error(`[${projectId}] Fatal error in module processing:`, error?.message);
    results.success = false;
    results.error = error?.message || "Module processing failed";
    results.completedAt = new Date().toISOString();
  }

  return results;
}

/**
 * Checks if module processing is already in progress for a project
 * Uses a simple in-memory lock mechanism
 * 
 * @param {string} projectId - Project ID
 * @returns {boolean} - True if processing is already running
 */
const processingLocks = new Set();

export function isProcessingProject(projectId) {
  return processingLocks.has(projectId);
}

/**
 * Acquires a lock for project module processing
 * Prevents concurrent processing of the same project
 * 
 * @param {string} projectId - Project ID
 * @returns {boolean} - True if lock was acquired, false if already locked
 */
export function acquireProcessingLock(projectId) {
  if (processingLocks.has(projectId)) {
    return false;
  }
  processingLocks.add(projectId);
  return true;
}

/**
 * Releases a lock for project module processing
 * 
 * @param {string} projectId - Project ID
 */
export function releaseProcessingLock(projectId) {
  processingLocks.delete(projectId);
}
