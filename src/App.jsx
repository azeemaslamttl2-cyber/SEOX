"use client";

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { installAuthenticatedApiFetch } from "./lib/authenticatedApiFetch.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CrawlProvider } from "./context/CrawlContext.jsx";
import { ProjectsProvider } from "./context/ProjectsContext.jsx";
import RootLayout from "./layouts/RootLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PageLoader from "./components/PageLoader.jsx";
import RouteErrorBoundary from "./components/RouteErrorBoundary.jsx";
import {
  RouteReadySignal,
  RouteTransitionOverlay,
} from "./components/RouteTransitionOverlay.jsx";
import { beginInitialLoad, installRouteTransitionWatcher } from "./lib/routeTransition.js";

/* ------------------------------------------------------------------ *
 * Route-level code splitting.
 *
 * Everything above this comment is on the first-paint path: the router
 * shell, the three entry layouts, and the pages a cold visit can land on
 * (public home, sign-in, sign-up, dashboard). Everything below is loaded
 * on demand.
 *
 * Chunks are grouped per feature section rather than per page - see
 * `manualChunks` in vite.config.js. Entering a section downloads it once,
 * after which navigating inside it needs no further request.
 *
 * Each feature layout is lazy along with its pages on purpose: the layout
 * files are small, but they pull in their nav components and, for the GSC
 * layout, the whole GscInsightsContext. Keeping them static would leave
 * that weight in the entry chunk and defeat the split.
 *
 * No <Suspense> is added here. Every layout renders <RouteOutlet/>, which
 * already provides a Suspense fallback and an error boundary inside the
 * content area.
 * ------------------------------------------------------------------ */

/* ---- Public marketing home ----
 * Lazy despite being an entry point. Its 10 marketing components are the only
 * thing in the app that imports framer-motion (115 KB), so keeping it static
 * put ~172 KB into every signed-in user's eager payload for a page they never
 * open. RootLayout stays static, so the navbar and footer still paint
 * immediately and only the hero content suspends.
 */
const HomePage = lazy(() => import("./pages/HomePage.jsx"));

/* ---- Projects & settings ---- */
const ProjectsList = lazy(() => import("./pages/projects/ProjectsList.jsx"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage.jsx"));
const LegacySettingsRedirect = lazy(() => import("./pages/settings/LegacySettingsRedirect.jsx"));

/* ---- Site Auditor ---- */
const AuditorLayout = lazy(() => import("./layouts/AuditorLayout.jsx"));
const AuditorOverview = lazy(() => import("./pages/auditor/AuditorOverview.jsx"));
const AuditorIssues = lazy(() => import("./pages/auditor/AuditorIssues.jsx"));
const AuditorIssueDetail = lazy(() => import("./pages/auditor/AuditorIssueDetail.jsx"));
const NewProject = lazy(() => import("./pages/auditor/NewProject.jsx"));
const CrawlLog = lazy(() => import("./pages/auditor/CrawlLog.jsx"));
const ProjectHistory = lazy(() => import("./pages/auditor/ProjectHistory.jsx"));
const BulkExport = lazy(() => import("./pages/auditor/BulkExport.jsx"));
const PageExplorer = lazy(() => import("./pages/auditor/PageExplorer.jsx"));
const LinkExplorer = lazy(() => import("./pages/auditor/LinkExplorer.jsx"));
const InternalLinks = lazy(() => import("./pages/auditor/InternalLinks.jsx"));
const StructureExplorer = lazy(() => import("./pages/auditor/StructureExplorer.jsx"));
const InternalPagesReport = lazy(() => import("./pages/auditor/reports/InternalPagesReport.jsx"));
const IndexabilityReport = lazy(() => import("./pages/auditor/reports/IndexabilityReport.jsx"));
const LinksReport = lazy(() => import("./pages/auditor/reports/LinksReport.jsx"));
const RedirectsReport = lazy(() => import("./pages/auditor/reports/RedirectsReport.jsx"));
const ContentReport = lazy(() => import("./pages/auditor/reports/ContentReport.jsx"));
const SocialTagsReport = lazy(() => import("./pages/auditor/reports/SocialTagsReport.jsx"));
const DuplicatesReport = lazy(() => import("./pages/auditor/reports/DuplicatesReport.jsx"));
const LocalizationReport = lazy(() => import("./pages/auditor/reports/LocalizationReport.jsx"));
const PerformanceReport = lazy(() => import("./pages/auditor/reports/PerformanceReport.jsx"));
const ImagesReport = lazy(() => import("./pages/auditor/reports/ImagesReport.jsx"));
const JavaScriptReport = lazy(() => import("./pages/auditor/reports/JavaScriptReport.jsx"));
const CssReport = lazy(() => import("./pages/auditor/reports/CssReport.jsx"));
const ExternalPagesReport = lazy(() => import("./pages/auditor/reports/ExternalPagesReport.jsx"));
const SitemapsReport = lazy(() => import("./pages/auditor/reports/SitemapsReport.jsx"));
const OtherReport = lazy(() => import("./pages/auditor/reports/OtherReport.jsx"));

/* ---- Google Search Console ---- */
const GscLayout = lazy(() => import("./layouts/GscLayout.jsx"));
const GscDashboard = lazy(() => import("./pages/gsc/GscDashboard.jsx"));
const GscOverview = lazy(() => import("./pages/gsc/GscOverview.jsx"));
const GscKeywords = lazy(() => import("./pages/gsc/GscKeywords.jsx"));
const GscPages = lazy(() => import("./pages/gsc/GscPages.jsx"));
const GscAnonymousQueries = lazy(() => import("./pages/gsc/GscAnonymousQueries.jsx"));
const GscOAuthCallback = lazy(() => import("./pages/gsc/GscOAuthCallback.jsx"));

/* ---- Technical SEO ---- */
const TechSeoLayout = lazy(() => import("./layouts/TechSeoLayout.jsx"));
const EeatAudit = lazy(() => import("./pages/techseo/EeatAudit.jsx"));
const RobotsAnalyzer = lazy(() => import("./pages/techseo/RobotsAnalyzer.jsx"));
const CrawlOptimization = lazy(() => import("./pages/techseo/CrawlOptimization.jsx"));
const SpeedOptimization = lazy(() => import("./pages/techseo/SpeedOptimization.jsx"));
const W3CValidator = lazy(() => import("./pages/techseo/W3CValidator.jsx"));
const GscAudit = lazy(() => import("./pages/techseo/GscAudit.jsx"));
const BingWebmaster = lazy(() => import("./pages/techseo/BingWebmaster.jsx"));
const BacklinksAudit = lazy(() => import("./pages/techseo/BacklinksAudit.jsx"));
const DuplicateChecker = lazy(() => import("./pages/techseo/DuplicateChecker.jsx"));
const PlagiarismChecker = lazy(() => import("./pages/techseo/PlagiarismChecker.jsx"));
const SemanticAudit = lazy(() => import("./pages/techseo/SemanticAudit.jsx"));
const WordPressSecurity = lazy(() => import("./pages/techseo/WordPressSecurity.jsx"));

/* ---- On-Page SEO ---- */
const OnPageSeoLayout = lazy(() => import("./layouts/OnPageSeoLayout.jsx"));
const OnPageAnalyzer = lazy(() => import("./pages/onpage/OnPageAnalyzer.jsx"));

/* ---- Off-Page SEO ---- */
const OffPageSeoLayout = lazy(() => import("./layouts/OffPageSeoLayout.jsx"));
const ExpiredDomainFinder = lazy(() => import("./pages/offpage/ExpiredDomainFinder.jsx"));
const BacklinkCleaner = lazy(() => import("./pages/offpage/BacklinkCleaner.jsx"));
const BacklinkIndexer = lazy(() => import("./pages/offpage/BacklinkIndexer.jsx"));
const BacklinkDirectory = lazy(() => import("./pages/offpage/BacklinkDirectory.jsx"));

/* ---- Keyword Research ---- */
const KeywordResearchLayout = lazy(() => import("./layouts/KeywordResearchLayout.jsx"));
const KeywordResearch = lazy(() => import("./pages/keywords/KeywordResearch.jsx"));
const SuggestKeywords = lazy(() => import("./pages/keywords/SuggestKeywords.jsx"));
const Ubersuggest = lazy(() => import("./pages/keywords/Ubersuggest.jsx"));
const NewKeywords = lazy(() => import("./pages/keywords/NewKeywords.jsx"));
const LowHangingKeywords = lazy(() => import("./pages/keywords/LowHangingKeywords.jsx"));
const LostKeywords = lazy(() => import("./pages/keywords/LostKeywords.jsx"));
const BrandedKeywords = lazy(() => import("./pages/keywords/BrandedKeywords.jsx"));
const KeywordCannibalization = lazy(() => import("./pages/keywords/KeywordCannibalization.jsx"));

/* ---- Content Writing ---- */
const ContentLayout = lazy(() => import("./layouts/ContentLayout.jsx"));
const OutlineCreator = lazy(() => import("./pages/content/OutlineCreator.jsx"));
const EntitiesExtractor = lazy(() => import("./pages/content/EntitiesExtractor.jsx"));
const EntitiesGenerator = lazy(() => import("./pages/content/EntitiesGenerator.jsx"));
const NGramsExtractor = lazy(() => import("./pages/content/NGramsExtractor.jsx"));
const NLPExtractor = lazy(() => import("./pages/content/NLPExtractor.jsx"));
const GrammarGenerator = lazy(() => import("./pages/content/GrammarGenerator.jsx"));
const UniqueNGrams = lazy(() => import("./pages/content/UniqueNGrams.jsx"));
const SkipGramWords = lazy(() => import("./pages/content/SkipGramWords.jsx"));
const ContentOptimization = lazy(() => import("./pages/content/ContentOptimization.jsx"));
const ChatGPTWatermarkRemover = lazy(() => import("./pages/content/ChatGPTWatermarkRemover.jsx"));
const AIContentHelper = lazy(() => import("./pages/content/AIContentHelper.jsx"));
const ContentWriterDashboard = lazy(() => import("./pages/content/ContentWriterDashboard.jsx"));
// 316 KB on its own - given a dedicated chunk so the rest of the content
// section does not have to carry it.
const SemanticContentWriter = lazy(() => import("./pages/content/SemanticContentWriter.jsx"));

/* ---- GEO / AI visibility ---- */
const GeoLayout = lazy(() => import("./layouts/GeoLayout.jsx"));
const PromptTracking = lazy(() => import("./pages/geo/PromptTracking.jsx"));
const BrandSentiment = lazy(() => import("./pages/geo/BrandSentiment.jsx"));
const AiCitationFlow = lazy(() => import("./pages/geo/AiCitationFlow.jsx"));
const CompetitorResearch = lazy(() => import("./pages/geo/CompetitorResearch.jsx"));
const InternalLinksCrawl = lazy(() => import("./pages/geo/InternalLinksCrawl.jsx"));
const AiChatConsole = lazy(() => import("./pages/geo/AiChatConsole.jsx"));

/* ---- SEO Tools ---- */
const SeoToolsLayout = lazy(() => import("./layouts/SeoToolsLayout.jsx"));
const SeoToolsHub = lazy(() => import("./pages/seotools/SeoToolsHub.jsx"));
const UltimateUrlEditor = lazy(() => import("./pages/seotools/UltimateUrlEditor.jsx"));
const UniversalTextEditor = lazy(() => import("./pages/seotools/UniversalTextEditor.jsx"));
const DomainSeparator = lazy(() => import("./pages/seotools/DomainSeparator.jsx"));
const WordCounter = lazy(() => import("./pages/seotools/WordCounter.jsx"));
const BotViewer = lazy(() => import("./pages/seotools/BotViewer.jsx"));
const BulkDaPaChecker = lazy(() => import("./pages/seotools/BulkDaPaChecker.jsx"));
const SitemapGenerator = lazy(() => import("./pages/seotools/SitemapGenerator.jsx"));
const RobotsGenerator = lazy(() => import("./pages/seotools/RobotsGenerator.jsx"));
const XmlSitemapExtractor = lazy(() => import("./pages/seotools/XmlSitemapExtractor.jsx"));
const BulkMetaExtractor = lazy(() => import("./pages/seotools/BulkMetaExtractor.jsx"));

/* ---- Brand Radar ---- */
const BrandRadarLayout = lazy(() => import("./layouts/BrandRadarLayout.jsx"));
const BrandRadar = lazy(() => import("./pages/brandradar/BrandRadar.jsx"));
const BrandRadarOverview = lazy(() => import("./pages/brandradar/BrandRadarOverview.jsx"));
const BrandRadarAIResponses = lazy(() => import("./pages/brandradar/BrandRadarAIResponses.jsx"));
const BrandRadarTopics = lazy(() => import("./pages/brandradar/BrandRadarTopics.jsx"));
const BrandRadarCitedPages = lazy(() => import("./pages/brandradar/BrandRadarCitedPages.jsx"));
const BrandRadarAIVisibility = lazy(() => import("./pages/brandradar/BrandRadarAIVisibility.jsx"));

/* ---- Admin ---- */
const AdminLayout = lazy(() => import("./layouts/AdminLayout.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.jsx"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments.jsx"));
const AdminNiches = lazy(() => import("./pages/admin/AdminNiches.jsx"));
const AdminAffiliates = lazy(() => import("./pages/admin/AdminAffiliates.jsx"));
const AdminStripe = lazy(() => import("./pages/admin/AdminStripe.jsx"));
const AdminApis = lazy(() => import("./pages/admin/AdminApis.jsx"));

/* ---- Google Business Profile ---- */
const GbpConnect = lazy(() => import("./pages/gbp/GbpConnect.jsx"));
const GbpOverview = lazy(() => import("./pages/gbp/GbpOverview.jsx"));
const GbpOAuthCallback = lazy(() => import("./pages/gbp/GbpOAuthCallback.jsx"));
const GbpProfile = lazy(() => import("./pages/gbp/GbpProfile.jsx"));
const GbpAudit = lazy(() => import("./pages/gbp/GbpAudit.jsx"));
const GbpPosts = lazy(() => import("./pages/gbp/GbpPosts.jsx"));
const GbpAutomation = lazy(() => import("./pages/gbp/GbpAutomation.jsx"));
const GbpReviews = lazy(() => import("./pages/gbp/GbpReviews.jsx"));
const GbpInsights = lazy(() => import("./pages/gbp/GbpInsights.jsx"));
const GbpQanda = lazy(() => import("./pages/gbp/GbpQanda.jsx"));
const GbpRecommendations = lazy(() => import("./pages/gbp/GbpRecommendations.jsx"));
const GbpHistory = lazy(() => import("./pages/gbp/GbpHistory.jsx"));
const GbpOperations = lazy(() => import("./pages/gbp/GbpOperations.jsx"));

/* ---- Semantic tools group (FeatureGroupLayout) ---- */
const FeatureGroupLayout = lazy(() => import("./layouts/FeatureGroupLayout.jsx"));

// Next renders App.jsx directly (without src/main.jsx), so install the API
// authorization wrapper here as well as in the Vite entry point.
installAuthenticatedApiFetch();
// Watches history so the navigation loader can appear the moment a route
// changes, before the router transition commits. Idempotent.
installRouteTransitionWatcher();
// Takes ownership of the boot loader painted by index.html. A reload fires no
// history event, so without this the initial load is invisible to the watcher
// above and nothing would ever take that node down. Module scope on purpose:
// it has to be pending before the router mounts, or the first route could
// signal ready against a store that is not yet loading.
beginInitialLoad();

const SchemaGenerator = lazy(() => import("./semanticsx/components/SchemaGenerator.jsx"));
const CompetitorSchemaChecker = lazy(() => import("./semanticsx/components/CompetitorSchemaChecker.jsx"));
const SemanticResourcesPage = lazy(() => import("./semanticsx/components/SemanticResourcesPage.jsx"));
const AIAgentsPage = lazy(() => import("./semanticsx/components/AIAgentsPage.jsx"));
const SemanticTopicalMapPlaceholder = lazy(() => import("./semanticsx/components/SemanticTopicalMapPlaceholder.jsx"));
const ImageGeoTagger = lazy(() => import("./semanticsx/components/ImageGeoTagger.jsx"));
const RankGridPro = lazy(() => import("./semanticsx/components/RankGridPro.jsx"));
const LlmsTxtGenerator = lazy(() => import("./semanticsx/components/LlmsTxtGenerator.jsx"));
const AIModelIndexChecker = lazy(() => import("./semanticsx/components/AIModelIndexChecker.jsx"));
const AIModelCompatibility = lazy(() => import("./semanticsx/components/AIModelCompatibility.jsx"));
const BulkAnalysisPage = lazy(() => import("./semanticsx/components/BulkAnalysisPage.jsx"));
const BingBulkAnalysisPage = lazy(() => import("./semanticsx/components/BingBulkAnalysisPage.jsx"));
const YandexBulkAnalysisPage = lazy(() => import("./semanticsx/components/YandexBulkAnalysisPage.jsx"));
const ScreamingFrogAnalyzer = lazy(() => import("./semanticsx/components/ScreamingFrogAnalyzer.jsx"));
const AIBacklinkGenerator = lazy(() => import("./semanticsx/components/AIBacklinkGenerator.jsx"));
const CsvGenerator = lazy(() => import("./semanticsx/components/CsvGenerator.jsx"));
const SEOTools = lazy(() => import("./semanticsx/components/SEOTools.jsx"));
const LeadFinderTool = lazy(() => import("./semanticsx/components/LeadFinderTool.jsx"));
const LocalExpiredFinder = lazy(() => import("./semanticsx/components/LocalExpiredFinder.jsx"));
const SemanticKeywordAnalyzer = lazy(() => import("./semanticsx/components/SemanticKeywordAnalyzer.jsx"));
const CompetitorContentAnalyzer = lazy(() => import("./semanticsx/components/CompetitorContentAnalyzer.jsx"));
const YoutubeSEOChecker = lazy(() => import("./semanticsx/components/YoutubeSEOChecker.jsx"));

/**
 * Error boundary for everything the router renders.
 *
 * RouteErrorBoundary already sits inside every layout, via RouteOutlet - but
 * that only covers the page inside the layout. The layouts are themselves lazy,
 * so a layout chunk that fails to download throws *above* every one of those
 * boundaries. With only a Suspense here, that produced a blank page: the
 * clearest way to hit it is a browser holding an index.html from a previous
 * deploy, whose chunk filenames no longer exist.
 *
 * Keyed on the pathname, so navigating elsewhere clears a caught error.
 */
function RoutedContent({ children }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader fullScreen />}>
        {/* Inside the boundary on purpose: while a lazy chunk is downloading
            React holds this subtree uncommitted, so the ready signal fires when
            the page is actually on screen rather than when the URL changed. */}
        <RouteReadySignal>{children}</RouteReadySignal>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectsProvider>
        <CrawlProvider>
          <BrowserRouter>
            <RouteTransitionOverlay />
            {/* Safety net. Each layout carries its own loading and error
                boundary around <Outlet/> (see RouteOutlet), so the shell stays
                on screen while a page loads. This one catches anything lazy
                that fails outside a layout - including a layout chunk itself,
                which no inner boundary can see. */}
            <RoutedContent>
              <Routes>
            {/* Public site (with Navbar + Footer) */}
            <Route element={<RootLayout />}>
              <Route path="/" element={<HomePage />} />
            </Route>

            {/* Dashboard (app-shell with sidebar + topbar) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsList />} />
              {/* One central settings page; every category is a tab on it. The
                  old per-category URLs redirect to their tab so existing
                  bookmarks and the Stripe onboarding return link keep working. */}
              <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
              <Route path="/settings/general" element={<SettingsPage />} />
              <Route path="/settings/stripe" element={<LegacySettingsRedirect tab="stripe" />} />
              <Route path="/settings/deepseek" element={<LegacySettingsRedirect tab="deepseek" />} />
              <Route path="/settings/apis" element={<LegacySettingsRedirect tab="seo-apis" />} />
              <Route path="/settings/google" element={<LegacySettingsRedirect tab="google" />} />
              <Route path="/settings/*" element={<Navigate to="/settings/general" replace />} />
            </Route>

            {/* Admin Panel */}
            <Route
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/stripe" element={<AdminStripe />} />
              <Route path="/admin/apis" element={<AdminApis />} />
              <Route path="/admin/niches" element={<AdminNiches />} />
              <Route path="/admin/affiliates" element={<AdminAffiliates />} />
              <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* Brand Radar */}
            <Route
              element={
                <ProtectedRoute>
                  <BrandRadarLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/brand-radar" element={<BrandRadar />} />
              <Route path="/brand-radar/overview" element={<BrandRadarOverview />} />
              <Route path="/brand-radar/ai-visibility" element={<BrandRadarAIVisibility />} />
              <Route path="/brand-radar/ai-responses" element={<BrandRadarAIResponses />} />
              <Route path="/brand-radar/topics" element={<BrandRadarTopics />} />
              <Route path="/brand-radar/cited-pages" element={<BrandRadarCitedPages />} />
              <Route path="/brand-radar/*" element={<Navigate to="/brand-radar" replace />} />
            </Route>

            {/* New Project wizard (full-screen, no sidebars) */}
            <Route
              path="/auditor/new"
              element={
                <ProtectedRoute>
                  <NewProject />
                </ProtectedRoute>
              }
            />

            {/* Site Auditor (full-screen tool layout) */}
            <Route
              element={
                <ProtectedRoute>
                  <AuditorLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/auditor" element={<AuditorOverview />} />
              <Route path="/auditor/issues" element={<AuditorIssues />} />
              <Route path="/auditor/issues/:slug" element={<AuditorIssueDetail />} />
              <Route path="/auditor/alerts" element={<AuditorIssues />} />
              <Route path="/auditor/export" element={<BulkExport />} />
              <Route path="/auditor/history" element={<ProjectHistory />} />
              <Route path="/auditor/log" element={<CrawlLog />} />
              <Route path="/auditor/pages" element={<PageExplorer />} />
              <Route path="/auditor/links" element={<LinkExplorer />} />
              <Route path="/auditor/internal-links" element={<InternalLinks />} />
              <Route path="/auditor/structure" element={<StructureExplorer />} />
              <Route path="/auditor/reports/internal" element={<InternalPagesReport />} />
              <Route path="/auditor/reports/indexability" element={<IndexabilityReport />} />
              <Route path="/auditor/reports/links" element={<LinksReport />} />
              <Route path="/auditor/reports/redirects" element={<RedirectsReport />} />
              <Route path="/auditor/reports/content" element={<ContentReport />} />
              <Route path="/auditor/reports/social" element={<SocialTagsReport />} />
              <Route path="/auditor/reports/duplicates" element={<DuplicatesReport />} />
              <Route path="/auditor/reports/localization" element={<LocalizationReport />} />
              <Route path="/auditor/reports/performance" element={<PerformanceReport />} />
              <Route path="/auditor/reports/images" element={<ImagesReport />} />
              <Route path="/auditor/reports/javascript" element={<JavaScriptReport />} />
              <Route path="/auditor/reports/css" element={<CssReport />} />
              <Route path="/auditor/reports/external" element={<ExternalPagesReport />} />
              <Route path="/auditor/reports/sitemaps" element={<SitemapsReport />} />
              <Route path="/auditor/reports/other" element={<OtherReport />} />
              <Route path="/auditor/reports/*" element={<Navigate to="/auditor" replace />} />
              <Route path="/auditor/*" element={<Navigate to="/auditor" replace />} />
            </Route>

            {/* Google Business Profile OAuth return */}
            <Route
              path="/gbp/oauth-callback"
              element={
                <ProtectedRoute>
                  <GbpOAuthCallback />
                </ProtectedRoute>
              }
            />

            {/* GSC Insights */}
            <Route
              path="/gsc/oauth-callback"
              element={
                <ProtectedRoute>
                  <GscOAuthCallback />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <GscLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/gsc" element={<GscDashboard />} />
              <Route path="/gsc/bulk-analysis" element={<BulkAnalysisPage />} />
              <Route path="/gsc/bulk-analysis/:siteId" element={<BulkAnalysisPage />} />
              <Route path="/gsc/bing-bulk-analysis" element={<BingBulkAnalysisPage />} />
              <Route path="/gsc/bing-bulk-analysis/:siteId" element={<BingBulkAnalysisPage />} />
              <Route path="/gsc/yandex-bulk-analysis" element={<YandexBulkAnalysisPage />} />
              <Route path="/gsc/:siteId" element={<GscOverview />} />
              <Route path="/gsc/:siteId/keywords" element={<GscKeywords />} />
              <Route path="/gsc/:siteId/pages" element={<GscPages />} />
              <Route path="/gsc/:siteId/anonymous" element={<GscAnonymousQueries />} />
              <Route path="/gsc/*" element={<Navigate to="/gsc" replace />} />
            </Route>

            {/* Technical SEO */}
            <Route
              element={
                <ProtectedRoute>
                  <TechSeoLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/tech-seo/eeat" element={<EeatAudit />} />
              <Route path="/tech-seo/semantic" element={<SemanticAudit />} />
              <Route path="/tech-seo/robots" element={<RobotsAnalyzer />} />
              <Route path="/tech-seo/crawl" element={<CrawlOptimization />} />
              <Route path="/tech-seo/speed" element={<SpeedOptimization />} />
              <Route path="/tech-seo/w3c" element={<W3CValidator />} />
              <Route path="/tech-seo/gsc-audit" element={<GscAudit />} />
              <Route path="/tech-seo/bing" element={<BingWebmaster />} />
              <Route path="/tech-seo/backlinks" element={<BacklinksAudit />} />
              <Route path="/tech-seo/duplicate" element={<DuplicateChecker />} />
              <Route path="/tech-seo/plagiarism" element={<PlagiarismChecker />} />
              <Route path="/tech-seo/screaming-frog" element={<ScreamingFrogAnalyzer />} />
              <Route path="/tech-seo/wordpress-security" element={<WordPressSecurity />} />
              <Route path="/tech-seo" element={<Navigate to="/tech-seo/eeat" replace />} />
              <Route path="/tech-seo/*" element={<Navigate to="/tech-seo/eeat" replace />} />
            </Route>

            {/* On-Page SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <OnPageSeoLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/on-page/analyzer" element={<OnPageAnalyzer />} />
              <Route path="/on-page" element={<Navigate to="/on-page/analyzer" replace />} />
              <Route path="/on-page/*" element={<Navigate to="/on-page/analyzer" replace />} />
            </Route>

            {/* Off-Page SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <OffPageSeoLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/off-page/expired-domains" element={<ExpiredDomainFinder />} />
              <Route path="/off-page/backlink-cleaner" element={<BacklinkCleaner />} />
              <Route path="/off-page/backlink-indexer" element={<BacklinkIndexer />} />
              <Route path="/off-page/backlink-directory" element={<BacklinkDirectory />} />
              <Route path="/off-page/ai-link-builder" element={<AIBacklinkGenerator />} />
              <Route path="/off-page/csv-generator" element={<CsvGenerator />} />
              <Route path="/off-page" element={<Navigate to="/off-page/expired-domains" replace />} />
              <Route path="/off-page/*" element={<Navigate to="/off-page/expired-domains" replace />} />
            </Route>

            {/* Keyword Research section */}
            <Route
              element={
                <ProtectedRoute>
                  <KeywordResearchLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/keywords/research" element={<KeywordResearch />} />
              <Route path="/keywords/suggest" element={<SuggestKeywords />} />
              <Route path="/keywords/ubersuggest" element={<Ubersuggest />} />
              <Route path="/keywords/new" element={<NewKeywords />} />
              <Route path="/keywords/low-hanging" element={<LowHangingKeywords />} />
              <Route path="/keywords/lost" element={<LostKeywords />} />
              <Route path="/keywords/branded" element={<BrandedKeywords />} />
              <Route path="/keywords/cannibalization" element={<KeywordCannibalization />} />
              <Route path="/keywords" element={<Navigate to="/keywords/research" replace />} />
              <Route path="/keywords/*" element={<Navigate to="/keywords/research" replace />} />
            </Route>

            {/* Content Writing section */}
            <Route
              element={
                <ProtectedRoute>
                  <ContentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/content/semantic-writer" element={<ContentWriterDashboard />} />
              <Route path="/content/semantic-writer/editor" element={<SemanticContentWriter />} />
              <Route path="/content/content-writer" element={<ContentWriterDashboard />} />
              <Route path="/content/content-writer/editor" element={<SemanticContentWriter />} />
              <Route path="/content/ai-helper" element={<AIContentHelper />} />
              <Route path="/content/outline" element={<OutlineCreator />} />
              <Route path="/content/entities-extractor" element={<EntitiesExtractor />} />
              <Route path="/content/entities-generator" element={<EntitiesGenerator />} />
              <Route path="/content/ngrams" element={<NGramsExtractor />} />
              <Route path="/content/nlp" element={<NLPExtractor />} />
              <Route path="/content/grammar" element={<GrammarGenerator />} />
              <Route path="/content/unique-ngrams" element={<UniqueNGrams />} />
              <Route path="/content/skip-gram" element={<SkipGramWords />} />
              <Route path="/content/optimization" element={<ContentOptimization />} />
              <Route path="/content/watermark-remover" element={<ChatGPTWatermarkRemover />} />
              <Route path="/content/semantic-generator" element={<SemanticKeywordAnalyzer />} />
              <Route path="/content/content-analyzer" element={<CompetitorContentAnalyzer />} />
              <Route path="/content" element={<Navigate to="/content/outline" replace />} />
              <Route path="/content/*" element={<Navigate to="/content/outline" replace />} />
            </Route>

            {/* Semantic SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <FeatureGroupLayout group="semantic" />
                </ProtectedRoute>
              }
            >
              <Route path="/semantic-seo/topical-map" element={<SemanticTopicalMapPlaceholder />} />
              <Route path="/semantic-seo/resources" element={<SemanticResourcesPage />} />
              <Route path="/semantic-seo/ai-agents" element={<AIAgentsPage />} />
              <Route path="/resources/semantic" element={<SemanticResourcesPage />} />
              <Route path="/semantic-seo" element={<Navigate to="/semantic-seo/resources" replace />} />
              <Route path="/semantic-seo/*" element={<Navigate to="/semantic-seo/resources" replace />} />
            </Route>

            {/* Schema SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <FeatureGroupLayout group="schema" />
                </ProtectedRoute>
              }
            >
              <Route path="/schema-seo" element={<SchemaGenerator />} />
              <Route path="/schema-seo/competitor-schema" element={<CompetitorSchemaChecker />} />
              <Route path="/schema-seo/:schemaType" element={<SchemaGenerator />} />
              <Route path="/schema-seo/*" element={<Navigate to="/schema-seo" replace />} />
            </Route>

            {/* Local SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <FeatureGroupLayout group="local" />
                </ProtectedRoute>
              }
            >
              <Route path="/local-seo/gbp" element={<GbpConnect />} />
              <Route path="/local-seo/gbp/overview" element={<GbpOverview />} />
              <Route path="/local-seo/gbp/profile" element={<GbpProfile />} />
              <Route path="/local-seo/gbp/audit" element={<GbpAudit />} />
              <Route path="/local-seo/gbp/posts" element={<GbpPosts />} />
              <Route path="/local-seo/gbp/reviews" element={<GbpReviews />} />
              <Route path="/local-seo/gbp/insights" element={<GbpInsights />} />
              <Route path="/local-seo/gbp/qanda" element={<GbpQanda />} />
              <Route path="/local-seo/gbp/recommendations" element={<GbpRecommendations />} />
              <Route path="/local-seo/gbp/history" element={<GbpHistory />} />
              <Route path="/local-seo/gbp/operations" element={<GbpOperations />} />
              <Route path="/local-seo/gbp/automation" element={<GbpAutomation />} />
              <Route path="/local-seo/image-geo-tagger" element={<ImageGeoTagger />} />
              <Route path="/local-seo/local-image-geo-tagger" element={<Navigate to="/local-seo/image-geo-tagger" replace />} />
              <Route path="/local-seo/rank-grid-pro" element={<RankGridPro />} />
              <Route path="/local-seo/lead-finder" element={<LeadFinderTool />} />
              <Route path="/local-seo/local-expired-finder" element={<LocalExpiredFinder />} />
              <Route path="/local-seo" element={<Navigate to="/local-seo/image-geo-tagger" replace />} />
              <Route path="/local-seo/*" element={<Navigate to="/local-seo/image-geo-tagger" replace />} />
            </Route>

            {/* SEO Tools section */}
            <Route
              element={
                <ProtectedRoute>
                  <SeoToolsLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/seo-tools" element={<SeoToolsHub />} />
              <Route path="/seo-tools/url-editor" element={<UltimateUrlEditor />} />
              <Route path="/seo-tools/text-editor" element={<UniversalTextEditor />} />
              <Route path="/seo-tools/domain-separator" element={<DomainSeparator />} />
              <Route path="/seo-tools/word-counter" element={<WordCounter />} />
              <Route path="/seo-tools/bot-viewer" element={<BotViewer />} />
              <Route path="/seo-tools/da-pa-checker" element={<BulkDaPaChecker />} />
              <Route path="/seo-tools/sitemap-generator" element={<SitemapGenerator />} />
              <Route path="/seo-tools/robots-generator" element={<RobotsGenerator />} />
              <Route path="/seo-tools/sitemap-extractor" element={<XmlSitemapExtractor />} />
              <Route path="/seo-tools/meta-extractor" element={<BulkMetaExtractor />} />
              <Route path="/seo-tools/*" element={<Navigate to="/seo-tools" replace />} />
            </Route>

            {/* GEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <GeoLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/geo/prompt-tracking" element={<PromptTracking />} />
              <Route path="/geo/brand-sentiment" element={<BrandSentiment />} />
              <Route path="/geo/citation-flow" element={<AiCitationFlow />} />
              <Route path="/geo/competitor-research" element={<CompetitorResearch />} />
              <Route path="/geo/internal-links" element={<InternalLinksCrawl />} />
              <Route path="/geo/ai-chat" element={<AiChatConsole />} />
              <Route path="/geo/llms-generator" element={<LlmsTxtGenerator />} />
              <Route path="/geo/ai-model-checker" element={<AIModelIndexChecker />} />
              <Route path="/geo/ai-compatibility" element={<AIModelCompatibility />} />
              <Route path="/geo" element={<Navigate to="/geo/prompt-tracking" replace />} />
              <Route path="/geo/*" element={<Navigate to="/geo/prompt-tracking" replace />} />
            </Route>

            {/* YouTube SEO section */}
            <Route
              element={
                <ProtectedRoute>
                  <FeatureGroupLayout group="youtube" />
                </ProtectedRoute>
              }
            >
              <Route path="/youtube/seo-checker" element={<YoutubeSEOChecker />} />
              <Route path="/youtube" element={<Navigate to="/youtube/seo-checker" replace />} />
              <Route path="/youtube/*" element={<Navigate to="/youtube/seo-checker" replace />} />
            </Route>

            {/* Auth pages (split-screen brand layout) */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Catch-all → home */}
            <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </RoutedContent>
          </BrowserRouter>
        </CrawlProvider>
      </ProjectsProvider>
    </AuthProvider>
  );
}
