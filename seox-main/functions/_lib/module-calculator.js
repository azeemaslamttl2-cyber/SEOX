/**
 * Backend Module Calculator
 * 
 * Calculates actual module data for automatic processing after project creation.
 * These functions are called by the module processor to fetch and calculate
 * detailed module results that get saved to project_data.
 * 
 * Unlike dashboard checks which only return summaries, these return COMPLETE
 * module results with all available data.
 */

/**
 * Calculate Robots.txt Analysis
 * 
 * Fetches and analyzes the robots.txt file
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Robots analysis result
 */
export async function calculateRobots(projectUrl) {
  try {
    const robotsUrl = new URL("/robots.txt", projectUrl).toString();
    
    const response = await fetch(robotsUrl, {
      method: "GET",
      timeout: 10000,
    });

    const robotsContent = response.ok ? await response.text() : "";
    const sitemaps = extractSitemaps(robotsContent);
    const isAccessible = response.ok;
    const statusCode = response.status;
    const checks = analyzeRobotsRules(robotsContent);
    const passedChecks = checks.filter(c => c.status === "pass").length;
    const totalChecks = checks.length;
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      url: robotsUrl,
      statusCode,
      isAccessible,
      robotsContent: robotsContent || "# robots.txt not found",
      sitemaps,
      checks,
      score,
      passedChecks,
      totalChecks,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to fetch robots.txt",
      statusCode: 0,
      isAccessible: false,
      robotsContent: "",
      sitemaps: [],
      checks: [],
      score: 0,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate Speed Metrics
 * Placeholder for PageSpeed Insights integration
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Speed analysis result
 */
export async function calculateSpeed(projectUrl) {
  try {
    // This would call PageSpeed API if configured
    // For now, return structure without data (requires external API call)
    return {
      url: projectUrl,
      metrics: {},
      pageSpeedScore: null,
      error: "Speed calculation requires PageSpeed API configuration",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to calculate speed metrics",
      metrics: {},
      pageSpeedScore: null,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate EEAT Audit
 * Placeholder - requires HTML fetch and analysis
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - EEAT analysis result
 */
export async function calculateEeat(projectUrl) {
  try {
    // Fetch homepage
    const response = await fetch(projectUrl, {
      method: "GET",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CodeStep/1.0)",
      },
    });

    if (!response.ok) {
      return {
        error: `Failed to fetch homepage (HTTP ${response.status})`,
        url: projectUrl,
        score: 0,
        signals: {},
        checks: [],
        analyzedAt: new Date().toISOString(),
      };
    }

    const html = await response.text();
    const checks = analyzeEeatSignals(html, projectUrl);
    const passedChecks = checks.filter(c => c.status === "pass").length;
    const totalChecks = checks.length;
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      url: projectUrl,
      score,
      checks,
      passedChecks,
      totalChecks,
      signals: {
        hasHttps: /^https:/i.test(projectUrl),
        hasTitle: /\<title[^>]*\>/i.test(html),
        hasMetaDescription: /\<meta\s+name="?description"?/i.test(html),
        hasH1: /\<h1[^>]*\>/i.test(html),
        hasStructuredData: /schema\.org|application\/ld\+json/i.test(html),
        hasSocialProfiles: /(facebook|linkedin|twitter|instagram|youtube)\.com/i.test(html),
      },
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to calculate EEAT metrics",
      url: projectUrl,
      score: 0,
      signals: {},
      checks: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate Semantic Analysis
 * Placeholder - requires HTML parsing
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Semantic analysis result
 */
export async function calculateSemantic(projectUrl) {
  try {
    return {
      url: projectUrl,
      score: null,
      semanticElements: {},
      headingStructure: [],
      error: "Semantic calculation requires HTML analysis",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to calculate semantic metrics",
      score: null,
      semanticElements: {},
      headingStructure: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate Crawl Optimization
 * Placeholder - requires crawl analysis
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Crawl optimization result
 */
export async function calculateCrawlOptimization(projectUrl) {
  try {
    return {
      url: projectUrl,
      score: null,
      issues: [],
      recommendations: [],
      error: "Crawl optimization requires site crawl",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to calculate crawl optimization",
      score: null,
      issues: [],
      recommendations: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate Duplicate Checker
 * Placeholder - requires crawl and comparison
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Duplicate analysis result
 */
export async function calculateDuplicate(projectUrl) {
  try {
    return {
      url: projectUrl,
      duplicates: [],
      issueCount: 0,
      error: "Duplicate checking requires site crawl analysis",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to calculate duplicates",
      duplicates: [],
      issueCount: 0,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate Backlinks Analysis
 * SKIPPED - requires user upload or external data
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Empty result (requires upload)
 */
export async function calculateBacklinks(projectUrl) {
  return {
    url: projectUrl,
    status: "skipped",
    reason: "Backlinks Audit requires CSV/TSV export upload",
    backlinks: [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Calculate Plagiarism Check
 * SKIPPED - requires DataForSEO credentials or configured service
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Empty result (requires credentials)
 */
export async function calculatePlagiarism(projectUrl) {
  return {
    url: projectUrl,
    status: "skipped",
    reason: "Plagiarism Checker requires DataForSEO credentials or server configuration",
    results: [],
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Calculate Sitemap
 * Placeholder - requires crawl and generation
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Sitemap result
 */
export async function calculateSitemap(projectUrl) {
  try {
    return {
      url: projectUrl,
      pages: [],
      count: 0,
      xml: "",
      error: "Sitemap generation requires site crawl",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error?.message || "Failed to generate sitemap",
      pages: [],
      count: 0,
      xml: "",
      analyzedAt: new Date().toISOString(),
    };
  }
}

/* ============================================ */
/* UTILITY FUNCTIONS                           */
/* ============================================ */

function extractSitemaps(robotsContent) {
  const sitemapRegex = /sitemap:\s*(.+?)(?=\n|$)/gi;
  const matches = [];
  let match;
  while ((match = sitemapRegex.exec(robotsContent)) !== null) {
    matches.push(match[1].trim());
  }
  return [...new Set(matches)];
}

  function analyzeEeatSignals(html, projectUrl) {
    const htmlLower = html.toLowerCase();
  
    return [
      {
        name: "HTTPS Enabled",
        status: /^https:/i.test(projectUrl) ? "pass" : "fail",
        description: "Site uses HTTPS protocol",
      },
      {
        name: "Page Title Present",
        status: /\<title[^>]*\>/i.test(html) ? "pass" : "fail",
        description: "Page has a title tag",
      },
      {
        name: "Meta Description Present",
        status: /\<meta\s+name="?description"?/i.test(html) ? "pass" : "fail",
        description: "Page has a meta description",
      },
      {
        name: "H1 Tag Present",
        status: /\<h1[^>]*\>/i.test(html) ? "pass" : "fail",
        description: "Page has an H1 heading",
      },
      {
        name: "Structured Data Present",
        status: /schema\.org|application\/ld\+json/i.test(html) ? "pass" : "fail",
        description: "Page contains schema.org markup",
      },
      {
        name: "Social Profiles Present",
        status: /(facebook|linkedin|twitter|instagram|youtube)\.com/i.test(htmlLower) ? "pass" : "fail",
        description: "Links to social media profiles",
      },
    ];
  }

function analyzeRobotsRules(robotsContent) {
  return [
    {
      name: "Robots.txt Present",
      status: robotsContent && robotsContent.trim() ? "pass" : "fail",
      description: "robots.txt file exists and contains rules",
    },
    {
      name: "Sitemap Declared",
      status: /sitemap:/i.test(robotsContent) ? "pass" : "fail",
      description: "Sitemap is declared in robots.txt",
    },
    {
      name: "All Crawling Blocked",
      status: /disallow:\s*\/\s*$/m.test(robotsContent) ? "fail" : "pass",
      description: "Root path is not blocked to all crawlers",
    },
  ];
}

/**
 * Dispatcher function to calculate any module by key
 * @param {string} moduleKey - Module key (eeat, robots, speed, etc.)
 * @param {string} projectUrl - Project URL
 * @returns {Promise<Object>} - Module result
 */
export async function calculateModule(moduleKey, projectUrl) {
  const calculators = {
    eeat: calculateEeat,
    robots: calculateRobots,
    speed: calculateSpeed,
    semantic: calculateSemantic,
    crawlOptimization: calculateCrawlOptimization,
    duplicate: calculateDuplicate,
    backlinks: calculateBacklinks,
    plagiarism: calculatePlagiarism,
    sitemap: calculateSitemap,
  };

  const calculator = calculators[moduleKey];
  if (!calculator) {
    return {
      error: `Unknown module: ${moduleKey}`,
      moduleKey,
      analyzedAt: new Date().toISOString(),
    };
  }

  try {
    const result = await calculator(projectUrl);
    return result;
  } catch (error) {
    return {
      error: error?.message || `Failed to calculate ${moduleKey}`,
      moduleKey,
      analyzedAt: new Date().toISOString(),
    };
  }
}
