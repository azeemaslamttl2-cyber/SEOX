"use client";

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { installAuthenticatedApiFetch } from "./lib/authenticatedApiFetch.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CrawlProvider } from "./context/CrawlContext.jsx";
import RootLayout from "./layouts/RootLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import AuditorLayout from "./layouts/AuditorLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import FeatureGroupLayout from "./layouts/FeatureGroupLayout.jsx";
import HomePage from "./pages/HomePage.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import StripeSettings from "./pages/settings/StripeSettings.jsx";
import AuditorOverview from "./pages/auditor/AuditorOverview.jsx";
import AuditorIssues from "./pages/auditor/AuditorIssues.jsx";
import AuditorIssueDetail from "./pages/auditor/AuditorIssueDetail.jsx";
import NewProject from "./pages/auditor/NewProject.jsx";
import CrawlLog from "./pages/auditor/CrawlLog.jsx";
import ProjectHistory from "./pages/auditor/ProjectHistory.jsx";
import BulkExport from "./pages/auditor/BulkExport.jsx";
import PageExplorer from "./pages/auditor/PageExplorer.jsx";
import LinkExplorer from "./pages/auditor/LinkExplorer.jsx";
import InternalLinks from "./pages/auditor/InternalLinks.jsx";
import StructureExplorer from "./pages/auditor/StructureExplorer.jsx";
import InternalPagesReport from "./pages/auditor/reports/InternalPagesReport.jsx";
import IndexabilityReport from "./pages/auditor/reports/IndexabilityReport.jsx";
import LinksReport from "./pages/auditor/reports/LinksReport.jsx";
import RedirectsReport from "./pages/auditor/reports/RedirectsReport.jsx";
import ContentReport from "./pages/auditor/reports/ContentReport.jsx";
import SocialTagsReport from "./pages/auditor/reports/SocialTagsReport.jsx";
import DuplicatesReport from "./pages/auditor/reports/DuplicatesReport.jsx";
import LocalizationReport from "./pages/auditor/reports/LocalizationReport.jsx";
import PerformanceReport from "./pages/auditor/reports/PerformanceReport.jsx";
import ImagesReport from "./pages/auditor/reports/ImagesReport.jsx";
import JavaScriptReport from "./pages/auditor/reports/JavaScriptReport.jsx";
import CssReport from "./pages/auditor/reports/CssReport.jsx";
import ExternalPagesReport from "./pages/auditor/reports/ExternalPagesReport.jsx";
import SitemapsReport from "./pages/auditor/reports/SitemapsReport.jsx";
import OtherReport from "./pages/auditor/reports/OtherReport.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import GscLayout from "./layouts/GscLayout.jsx";
import GscDashboard from "./pages/gsc/GscDashboard.jsx";
import GscOverview from "./pages/gsc/GscOverview.jsx";
import GscKeywords from "./pages/gsc/GscKeywords.jsx";
import GscPages from "./pages/gsc/GscPages.jsx";
import GscAnonymousQueries from "./pages/gsc/GscAnonymousQueries.jsx";
import GscOAuthCallback from "./pages/gsc/GscOAuthCallback.jsx";
import TechSeoLayout from "./layouts/TechSeoLayout.jsx";
import EeatAudit from "./pages/techseo/EeatAudit.jsx";
import RobotsAnalyzer from "./pages/techseo/RobotsAnalyzer.jsx";
import CrawlOptimization from "./pages/techseo/CrawlOptimization.jsx";
import SpeedOptimization from "./pages/techseo/SpeedOptimization.jsx";
import W3CValidator from "./pages/techseo/W3CValidator.jsx";
import GscAudit from "./pages/techseo/GscAudit.jsx";
import BingWebmaster from "./pages/techseo/BingWebmaster.jsx";
import BacklinksAudit from "./pages/techseo/BacklinksAudit.jsx";
import DuplicateChecker from "./pages/techseo/DuplicateChecker.jsx";
import PlagiarismChecker from "./pages/techseo/PlagiarismChecker.jsx";
import SemanticAudit from "./pages/techseo/SemanticAudit.jsx";
import OnPageSeoLayout from "./layouts/OnPageSeoLayout.jsx";
import OnPageAnalyzer from "./pages/onpage/OnPageAnalyzer.jsx";
import OffPageSeoLayout from "./layouts/OffPageSeoLayout.jsx";
import ExpiredDomainFinder from "./pages/offpage/ExpiredDomainFinder.jsx";
import BacklinkCleaner from "./pages/offpage/BacklinkCleaner.jsx";
import BacklinkIndexer from "./pages/offpage/BacklinkIndexer.jsx";
import BacklinkDirectory from "./pages/offpage/BacklinkDirectory.jsx";
import KeywordResearchLayout from "./layouts/KeywordResearchLayout.jsx";
import KeywordResearch from "./pages/keywords/KeywordResearch.jsx";
import SuggestKeywords from "./pages/keywords/SuggestKeywords.jsx";
import Ubersuggest from "./pages/keywords/Ubersuggest.jsx";
import NewKeywords from "./pages/keywords/NewKeywords.jsx";
import LowHangingKeywords from "./pages/keywords/LowHangingKeywords.jsx";
import LostKeywords from "./pages/keywords/LostKeywords.jsx";
import BrandedKeywords from "./pages/keywords/BrandedKeywords.jsx";
import KeywordCannibalization from "./pages/keywords/KeywordCannibalization.jsx";
import ContentLayout from "./layouts/ContentLayout.jsx";
import OutlineCreator from "./pages/content/OutlineCreator.jsx";
import EntitiesExtractor from "./pages/content/EntitiesExtractor.jsx";
import EntitiesGenerator from "./pages/content/EntitiesGenerator.jsx";
import NGramsExtractor from "./pages/content/NGramsExtractor.jsx";
import NLPExtractor from "./pages/content/NLPExtractor.jsx";
import GrammarGenerator from "./pages/content/GrammarGenerator.jsx";
import UniqueNGrams from "./pages/content/UniqueNGrams.jsx";
import SkipGramWords from "./pages/content/SkipGramWords.jsx";
import ContentOptimization from "./pages/content/ContentOptimization.jsx";
import ChatGPTWatermarkRemover from "./pages/content/ChatGPTWatermarkRemover.jsx";
import AIContentHelper from "./pages/content/AIContentHelper.jsx";
import SemanticContentWriter from "./pages/content/SemanticContentWriter.jsx";
import ContentWriterDashboard from "./pages/content/ContentWriterDashboard.jsx";
import GeoLayout from "./layouts/GeoLayout.jsx";
import PromptTracking from "./pages/geo/PromptTracking.jsx";
import BrandSentiment from "./pages/geo/BrandSentiment.jsx";
import AiCitationFlow from "./pages/geo/AiCitationFlow.jsx";
import CompetitorResearch from "./pages/geo/CompetitorResearch.jsx";
import InternalLinksCrawl from "./pages/geo/InternalLinksCrawl.jsx";
import AiChatConsole from "./pages/geo/AiChatConsole.jsx";
import SeoToolsLayout from "./layouts/SeoToolsLayout.jsx";
import SeoToolsHub from "./pages/seotools/SeoToolsHub.jsx";
import UltimateUrlEditor from "./pages/seotools/UltimateUrlEditor.jsx";
import UniversalTextEditor from "./pages/seotools/UniversalTextEditor.jsx";
import DomainSeparator from "./pages/seotools/DomainSeparator.jsx";
import WordCounter from "./pages/seotools/WordCounter.jsx";
import BotViewer from "./pages/seotools/BotViewer.jsx";
import BulkDaPaChecker from "./pages/seotools/BulkDaPaChecker.jsx";
import SitemapGenerator from "./pages/seotools/SitemapGenerator.jsx";
import RobotsGenerator from "./pages/seotools/RobotsGenerator.jsx";
import XmlSitemapExtractor from "./pages/seotools/XmlSitemapExtractor.jsx";
import BulkMetaExtractor from "./pages/seotools/BulkMetaExtractor.jsx";
import BrandRadarLayout from "./layouts/BrandRadarLayout.jsx";
import BrandRadar from "./pages/brandradar/BrandRadar.jsx";
import BrandRadarOverview from "./pages/brandradar/BrandRadarOverview.jsx";
import BrandRadarAIResponses from "./pages/brandradar/BrandRadarAIResponses.jsx";
import BrandRadarTopics from "./pages/brandradar/BrandRadarTopics.jsx";
import BrandRadarCitedPages from "./pages/brandradar/BrandRadarCitedPages.jsx";
import BrandRadarAIVisibility from "./pages/brandradar/BrandRadarAIVisibility.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminAnalytics from "./pages/admin/AdminAnalytics.jsx";
import AdminPayments from "./pages/admin/AdminPayments.jsx";
import AdminNiches from "./pages/admin/AdminNiches.jsx";
import AdminAffiliates from "./pages/admin/AdminAffiliates.jsx";
import AdminStripe from "./pages/admin/AdminStripe.jsx";
import AdminApis from "./pages/admin/AdminApis.jsx";

// Next renders App.jsx directly (without src/main.jsx), so install the API
// authorization wrapper here as well as in the Vite entry point.
installAuthenticatedApiFetch();

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

function RouteLoading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-white/50">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CrawlProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
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
              <Route path="/settings" element={<Navigate to="/settings/stripe" replace />} />
              <Route path="/settings/stripe" element={<StripeSettings />} />
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
              <Route path="/local-seo/image-geo-tagger" element={<ImageGeoTagger />} />
              <Route path="/local-seo/local-image-geo-tagger" element={<Navigate to="/local-seo/image-geo-tagger" replace />} />
              <Route path="/local-seo/rank-grid-pro" element={<RankGridPro />} />                <Route path="/local-seo/lead-finder" element={<LeadFinderTool />} />
                <Route path="/local-seo/local-expired-finder" element={<LocalExpiredFinder />} />              <Route path="/local-seo" element={<Navigate to="/local-seo/image-geo-tagger" replace />} />
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
          </Suspense>
        </BrowserRouter>
      </CrawlProvider>
    </AuthProvider>
  );
}
