import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Upload,
    FileText,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Info,
    Download,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Search,
    X,
    RefreshCw,
    FileSearch,
    BarChart2,
    Trash2,
    Check,
    ExternalLink,
    FileSpreadsheet,
    Sparkles,
    Target,
    ListChecks
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { downloadScreamingFrogPdf } from '../lib/toolPdfReports';

// CSV Parser utility
const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    });

    return { headers, rows };
};

// File type detection based on headers
const detectFileType = (headers) => {
    const headerSet = new Set(headers.map(h => h.toLowerCase()));

    if (headerSet.has('issue name') && headerSet.has('issue type') && (headerSet.has('priority') || headerSet.has('issue priority'))) {
        return 'issues_overview';
    }
    if (headerSet.has('address') && headerSet.has('title 1') && headerSet.has('meta description 1')) {
        return 'internal_html';
    }
    if (headerSet.has('address') && headerSet.has('errors') && headerSet.has('warnings') && headerSet.has('total types')) {
        return 'structured_data';
    }
    if (headerSet.has('address') && headerSet.has('canonical link element 1')) {
        return 'canonicals';
    }
    // Images detection - check for image-specific columns
    if (headerSet.has('address') && (headerSet.has('img inlinks') || headerSet.has('dimensions') || headerSet.has('alt text 1'))) {
        return 'images';
    }
    if (headerSet.has('address') && headerSet.has('title 1') && !headerSet.has('meta description 1')) {
        return 'page_titles';
    }
    if (headerSet.has('address') && headerSet.has('meta description 1') && !headerSet.has('title 1')) {
        return 'meta_descriptions';
    }
    if (headerSet.has('address') && headerSet.has('h1-1')) {
        return 'h1';
    }
    if (headerSet.has('destination') || (headerSet.has('address') && headerSet.has('status code') && !headerSet.has('title 1'))) {
        return 'external';
    }

    return 'unknown';
};

// Define checklist categories and items as per the reference images
const CHECKLIST_CATEGORIES = [
    {
        id: 'indexation',
        name: 'Indexation Issues Checklist',
        color: 'blue',
        items: [
            { id: 'directory_pages', name: 'Directory Pages' },
            { id: 'post_tags', name: 'Post Tags' },
            { id: 'media_attachments', name: 'Media Attachments' },
            { id: 'authors', name: 'Authors' },
            { id: 'thin_empty', name: 'Thin or Empty Pages' },
            { id: 'parameters', name: 'Parameters' },
            { id: 'category_pages', name: 'Category Pages' },
            { id: 'pdf_pages', name: 'PDF Pages' },
            { id: 'search_result', name: 'Search Result Pages' }
        ]
    },
    {
        id: 'woocommerce',
        name: 'WooCommerce Issues Checklist',
        color: 'yellow',
        items: [
            { id: 'product_tags', name: 'Product Tags (WooCommerce)' },
            { id: 'account_pages', name: 'Account Pages' }
        ]
    },
    {
        id: 'url_issues',
        name: 'URL Issues Checklist',
        color: 'blue',
        items: [
            { id: 'redirect_301_internal', name: '301 Redirects (Internal)' },
            { id: 'redirect_404_internal', name: '404 Redirects (Internal)' },
            { id: 'uppercase_urls', name: 'Upper Case Urls' },
            { id: 'underscore_urls', name: 'Under Score Urls' },
            { id: 'over_115_chars', name: 'Over 115 Characters' },
            { id: 'redirect_301_external', name: '301 Redirects (External)' },
            { id: 'redirect_404_external', name: '404 Redirects (External)' },
            { id: 'params_internal', name: "Make Sure Parameters aren't used in Internal Links" },
            { id: 'trailing_issues', name: 'Look for Trailing Internal Linking Issues' },
            { id: 'non_trailing_issues', name: 'Look for Non Trailing Internal Linking Issues' },
            { id: 'spammy_comments', name: 'Make Sure No Spammy Comments are Approved' },
            { id: 'low_quality_links', name: "Make Sure the website doesn't Link to Low Quality Websites" },
            { id: 'redirect_chains', name: 'Check for Redirect Chains' }
        ]
    },
    {
        id: 'page_titles',
        name: 'Page Titles Checklist',
        color: 'blue',
        items: [
            { id: 'title_missing', name: 'Missing', showDetails: true },
            { id: 'title_duplicate', name: 'Duplicate', showDetails: true },
            { id: 'title_over_60', name: 'Over 60 Characters', showDetails: true },
            { id: 'title_below_30', name: 'Below 30 Characters', showDetails: true },
            { id: 'title_multiple', name: 'Multiple' },
            { id: 'title_branding', name: 'Extract Titles into sheet and look for inconsistent Title Tag Branding' },
            { id: 'title_over_optimized', name: 'Extract and Check for Over Optimized Title Tags' },
            { id: 'title_headings_compare', name: 'Compare Titles and Headings' }
        ]
    },
    {
        id: 'meta_descriptions',
        name: 'Meta Description Checklist',
        color: 'yellow',
        items: [
            { id: 'meta_missing', name: 'Missing', showDetails: true },
            { id: 'meta_duplicate', name: 'Duplicate', showDetails: true },
            { id: 'meta_over_155', name: 'Over 155 Characters', showDetails: true },
            { id: 'meta_below_70', name: 'Below 70 Characters', showDetails: true },
            { id: 'meta_multiple', name: 'Multiple' }
        ]
    },
    {
        id: 'h1_headings',
        name: 'Heading 1 Checklist',
        color: 'blue',
        items: [
            { id: 'h1_missing', name: 'Missing', showDetails: true },
            { id: 'h1_duplicate', name: 'Duplicate', showDetails: true },
            { id: 'h1_over_70', name: 'Over 70 Characters', showDetails: true },
            { id: 'h1_multiple', name: 'Multiple' }
        ]
    },
    {
        id: 'images',
        name: 'Images Checklist',
        color: 'yellow',
        items: [
            { id: 'images_over_100kb', name: 'Over 100 KB' },
            { id: 'images_missing_alt', name: 'Missing Alt Text' },
            { id: 'images_alt_over_100', name: 'Alt Over 100 Words' },
            { id: 'images_seo_optimized', name: 'Are Images Urls SEO Optimized?' }
        ]
    },
    {
        id: 'canonicals',
        name: 'Canonicals Checklist',
        color: 'blue',
        items: [
            { id: 'canonical_canonicalized', name: 'Canonicalized' },
            { id: 'canonical_missing', name: 'Missing' },
            { id: 'canonical_multiple', name: 'Multiple' },
            { id: 'canonical_non_indexable', name: 'Non Indexable' }
        ]
    },
    {
        id: 'structured_data',
        name: 'Structured Data Checklist',
        color: 'yellow',
        items: [
            { id: 'schema_errors', name: 'Errors' },
            { id: 'schema_missing', name: 'Missing' }
        ]
    }
];

// Analyze data and map to checklist items - now with detailed data for title/meta issues
const analyzeData = (data) => {
    const results = {};

    // Initialize all items with empty arrays
    CHECKLIST_CATEGORIES.forEach(cat => {
        cat.items.forEach(item => {
            results[item.id] = { count: 0, urls: [], details: [] };
        });
    });

    // Analyze internal_html data
    if (data.internal_html?.rows) {
        const rows = data.internal_html.rows;
        const indexableRows = rows.filter(r => r['Indexability'] === 'Indexable');

        // Page Titles - with details
        const missingTitles = indexableRows.filter(r => !r['Title 1'] || r['Title 1'].trim() === '');
        results.title_missing = {
            count: missingTitles.length,
            urls: missingTitles.map(r => r['Address']),
            details: missingTitles.map(r => ({
                url: r['Address'],
                value: r['Title 1'] || '(empty)',
                length: parseInt(r['Title 1 Length'] || '0', 10)
            }))
        };

        const longTitles = indexableRows.filter(r => parseInt(r['Title 1 Length'] || '0', 10) > 60);
        results.title_over_60 = {
            count: longTitles.length,
            urls: longTitles.map(r => r['Address']),
            details: longTitles.map(r => ({
                url: r['Address'],
                value: r['Title 1'],
                length: parseInt(r['Title 1 Length'] || '0', 10)
            }))
        };

        const shortTitles = indexableRows.filter(r => r['Title 1'] && parseInt(r['Title 1 Length'] || '0', 10) < 30);
        results.title_below_30 = {
            count: shortTitles.length,
            urls: shortTitles.map(r => r['Address']),
            details: shortTitles.map(r => ({
                url: r['Address'],
                value: r['Title 1'],
                length: parseInt(r['Title 1 Length'] || '0', 10)
            }))
        };

        // Find duplicate titles
        const titleCounts = {};
        indexableRows.forEach(r => {
            const title = r['Title 1']?.trim();
            if (title) {
                if (!titleCounts[title]) titleCounts[title] = [];
                titleCounts[title].push(r);
            }
        });
        const duplicateTitleRows = Object.entries(titleCounts)
            .filter(([_, rows]) => rows.length > 1)
            .flatMap(([title, rows]) => rows.map(r => ({ ...r, duplicateTitle: title })));

        results.title_duplicate = {
            count: duplicateTitleRows.length,
            urls: duplicateTitleRows.map(r => r['Address']),
            details: duplicateTitleRows.map(r => ({
                url: r['Address'],
                value: r['Title 1'],
                length: parseInt(r['Title 1 Length'] || '0', 10)
            }))
        };

        // Meta Descriptions - with details
        const missingMeta = indexableRows.filter(r => !r['Meta Description 1'] || r['Meta Description 1'].trim() === '');
        results.meta_missing = {
            count: missingMeta.length,
            urls: missingMeta.map(r => r['Address']),
            details: missingMeta.map(r => ({
                url: r['Address'],
                value: r['Meta Description 1'] || '(empty)',
                length: parseInt(r['Meta Description 1 Length'] || '0', 10)
            }))
        };

        const longMeta = indexableRows.filter(r => parseInt(r['Meta Description 1 Length'] || '0', 10) > 155);
        results.meta_over_155 = {
            count: longMeta.length,
            urls: longMeta.map(r => r['Address']),
            details: longMeta.map(r => ({
                url: r['Address'],
                value: r['Meta Description 1'],
                length: parseInt(r['Meta Description 1 Length'] || '0', 10)
            }))
        };

        const shortMeta = indexableRows.filter(r => r['Meta Description 1'] && parseInt(r['Meta Description 1 Length'] || '0', 10) < 70);
        results.meta_below_70 = {
            count: shortMeta.length,
            urls: shortMeta.map(r => r['Address']),
            details: shortMeta.map(r => ({
                url: r['Address'],
                value: r['Meta Description 1'],
                length: parseInt(r['Meta Description 1 Length'] || '0', 10)
            }))
        };

        // Find duplicate meta descriptions
        const metaCounts = {};
        indexableRows.forEach(r => {
            const meta = r['Meta Description 1']?.trim();
            if (meta) {
                if (!metaCounts[meta]) metaCounts[meta] = [];
                metaCounts[meta].push(r);
            }
        });
        const duplicateMetaRows = Object.entries(metaCounts)
            .filter(([_, rows]) => rows.length > 1)
            .flatMap(([meta, rows]) => rows);

        results.meta_duplicate = {
            count: duplicateMetaRows.length,
            urls: duplicateMetaRows.map(r => r['Address']),
            details: duplicateMetaRows.map(r => ({
                url: r['Address'],
                value: r['Meta Description 1'],
                length: parseInt(r['Meta Description 1 Length'] || '0', 10)
            }))
        };

        // H1 Headings - with details
        const missingH1 = indexableRows.filter(r => !r['H1-1'] || r['H1-1'].trim() === '');
        results.h1_missing = {
            count: missingH1.length,
            urls: missingH1.map(r => r['Address']),
            details: missingH1.map(r => ({
                url: r['Address'],
                value: r['H1-1'] || '(empty)',
                length: r['H1-1']?.length || 0
            }))
        };

        const longH1 = indexableRows.filter(r => r['H1-1'] && r['H1-1'].length > 70);
        results.h1_over_70 = {
            count: longH1.length,
            urls: longH1.map(r => r['Address']),
            details: longH1.map(r => ({
                url: r['Address'],
                value: r['H1-1'],
                length: r['H1-1']?.length || 0
            }))
        };

        // Find duplicate H1s
        const h1Counts = {};
        indexableRows.forEach(r => {
            const h1 = r['H1-1']?.trim();
            if (h1) {
                if (!h1Counts[h1]) h1Counts[h1] = [];
                h1Counts[h1].push(r);
            }
        });
        const duplicateH1Rows = Object.entries(h1Counts)
            .filter(([_, rows]) => rows.length > 1)
            .flatMap(([h1, rows]) => rows);

        results.h1_duplicate = {
            count: duplicateH1Rows.length,
            urls: duplicateH1Rows.map(r => r['Address']),
            details: duplicateH1Rows.map(r => ({
                url: r['Address'],
                value: r['H1-1'],
                length: r['H1-1']?.length || 0
            }))
        };

        // Multiple H1s
        const multipleH1 = indexableRows.filter(r => r['H1-2'] && r['H1-2'].trim() !== '');
        results.h1_multiple = {
            count: multipleH1.length,
            urls: multipleH1.map(r => r['Address']),
            details: []
        };

        // Multiple Titles
        const multipleTitles = indexableRows.filter(r => r['Title 2'] && r['Title 2'].trim() !== '');
        results.title_multiple = {
            count: multipleTitles.length,
            urls: multipleTitles.map(r => r['Address']),
            details: []
        };

        // Multiple Meta Descriptions
        const multipleMeta = indexableRows.filter(r => r['Meta Description 2'] && r['Meta Description 2'].trim() !== '');
        results.meta_multiple = {
            count: multipleMeta.length,
            urls: multipleMeta.map(r => r['Address']),
            details: []
        };

        // URL Issues
        results.uppercase_urls = {
            count: rows.filter(r => r['Address'] && r['Address'] !== r['Address'].toLowerCase()).length,
            urls: rows.filter(r => r['Address'] && r['Address'] !== r['Address'].toLowerCase()).map(r => r['Address']),
            details: []
        };

        results.underscore_urls = {
            count: rows.filter(r => {
                const path = r['Address']?.replace(/https?:\/\/[^\/]+/, '') || '';
                return path.includes('_');
            }).length,
            urls: rows.filter(r => {
                const path = r['Address']?.replace(/https?:\/\/[^\/]+/, '') || '';
                return path.includes('_');
            }).map(r => r['Address']),
            details: []
        };

        results.over_115_chars = {
            count: rows.filter(r => r['Address'] && r['Address'].length > 115).length,
            urls: rows.filter(r => r['Address'] && r['Address'].length > 115).map(r => r['Address']),
            details: []
        };

        results.params_internal = {
            count: rows.filter(r => r['Address'] && r['Address'].includes('?')).length,
            urls: rows.filter(r => r['Address'] && r['Address'].includes('?')).map(r => r['Address']),
            details: []
        };

        // Trailing slash issues
        results.trailing_issues = {
            count: rows.filter(r => {
                const url = r['Address'] || '';
                const path = url.replace(/https?:\/\/[^\/]+/, '');
                return path && !path.endsWith('/') && !path.includes('.');
            }).length,
            urls: rows.filter(r => {
                const url = r['Address'] || '';
                const path = url.replace(/https?:\/\/[^\/]+/, '');
                return path && !path.endsWith('/') && !path.includes('.');
            }).map(r => r['Address']),
            details: []
        };

        // Redirects
        results.redirect_301_internal = {
            count: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 301).length,
            urls: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 301).map(r => r['Address']),
            details: []
        };

        results.redirect_404_internal = {
            count: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 404).length,
            urls: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 404).map(r => r['Address']),
            details: []
        };

        // Indexation Issues - detect by URL patterns
        results.directory_pages = {
            count: rows.filter(r => r['Address']?.includes('/directory/') || r['Address']?.includes('/listings/')).length,
            urls: rows.filter(r => r['Address']?.includes('/directory/') || r['Address']?.includes('/listings/')).map(r => r['Address']),
            details: []
        };

        results.post_tags = {
            count: rows.filter(r => r['Address']?.includes('/tag/')).length,
            urls: rows.filter(r => r['Address']?.includes('/tag/')).map(r => r['Address']),
            details: []
        };

        results.media_attachments = {
            count: rows.filter(r => r['Address']?.includes('/attachment/')).length,
            urls: rows.filter(r => r['Address']?.includes('/attachment/')).map(r => r['Address']),
            details: []
        };

        results.authors = {
            count: rows.filter(r => r['Address']?.includes('/author/')).length,
            urls: rows.filter(r => r['Address']?.includes('/author/')).map(r => r['Address']),
            details: []
        };

        results.thin_empty = {
            count: rows.filter(r => parseInt(r['Word Count'] || '0', 10) < 100 && r['Indexability'] === 'Indexable').length,
            urls: rows.filter(r => parseInt(r['Word Count'] || '0', 10) < 100 && r['Indexability'] === 'Indexable').map(r => r['Address']),
            details: []
        };

        results.parameters = {
            count: rows.filter(r => r['Indexability'] === 'Indexable' && r['Address']?.includes('?')).length,
            urls: rows.filter(r => r['Indexability'] === 'Indexable' && r['Address']?.includes('?')).map(r => r['Address']),
            details: []
        };

        results.category_pages = {
            count: rows.filter(r => r['Address']?.includes('/category/')).length,
            urls: rows.filter(r => r['Address']?.includes('/category/')).map(r => r['Address']),
            details: []
        };

        results.pdf_pages = {
            count: rows.filter(r => r['Address']?.toLowerCase().endsWith('.pdf')).length,
            urls: rows.filter(r => r['Address']?.toLowerCase().endsWith('.pdf')).map(r => r['Address']),
            details: []
        };

        results.search_result = {
            count: rows.filter(r => r['Address']?.includes('/search/') || r['Address']?.includes('?s=')).length,
            urls: rows.filter(r => r['Address']?.includes('/search/') || r['Address']?.includes('?s=')).map(r => r['Address']),
            details: []
        };

        // WooCommerce
        results.product_tags = {
            count: rows.filter(r => r['Address']?.includes('/product-tag/')).length,
            urls: rows.filter(r => r['Address']?.includes('/product-tag/')).map(r => r['Address']),
            details: []
        };

        results.account_pages = {
            count: rows.filter(r => r['Address']?.includes('/my-account/')).length,
            urls: rows.filter(r => r['Address']?.includes('/my-account/')).map(r => r['Address']),
            details: []
        };
    }

    // Analyze structured data
    if (data.structured_data?.rows) {
        const rows = data.structured_data.rows;

        results.schema_errors = {
            count: rows.filter(r => parseInt(r['Errors'] || '0', 10) > 0).length,
            urls: rows.filter(r => parseInt(r['Errors'] || '0', 10) > 0).map(r => r['Address']),
            details: []
        };

        results.schema_missing = {
            count: rows.filter(r => r['Indexability'] === 'Indexable' && parseInt(r['Total Types'] || '0', 10) === 0).length,
            urls: rows.filter(r => r['Indexability'] === 'Indexable' && parseInt(r['Total Types'] || '0', 10) === 0).map(r => r['Address']),
            details: []
        };
    }

    // Analyze canonicals
    if (data.canonicals?.rows) {
        const rows = data.canonicals.rows;

        results.canonical_missing = {
            count: rows.filter(r => r['Indexability'] === 'Indexable' && (!r['Canonical Link Element 1'] || r['Canonical Link Element 1'].trim() === '')).length,
            urls: rows.filter(r => r['Indexability'] === 'Indexable' && (!r['Canonical Link Element 1'] || r['Canonical Link Element 1'].trim() === '')).map(r => r['Address']),
            details: []
        };

        results.canonical_canonicalized = {
            count: rows.filter(r => {
                const canonical = r['Canonical Link Element 1'] || '';
                const address = r['Address'] || '';
                return canonical && canonical !== address;
            }).length,
            urls: rows.filter(r => {
                const canonical = r['Canonical Link Element 1'] || '';
                const address = r['Address'] || '';
                return canonical && canonical !== address;
            }).map(r => r['Address']),
            details: []
        };

        results.canonical_non_indexable = {
            count: rows.filter(r => r['Indexability'] === 'Non-Indexable').length,
            urls: rows.filter(r => r['Indexability'] === 'Non-Indexable').map(r => r['Address']),
            details: []
        };
    }

    // Analyze images - ONLY if we have images data with alt text column
    if (data.images?.rows) {
        const rows = data.images.rows;

        // Check if Alt Text column exists in the data
        const hasAltTextColumn = rows.length > 0 && 'Alt Text 1' in rows[0];

        results.images_over_100kb = {
            count: rows.filter(r => parseInt(r['Size (Bytes)'] || r['Size (bytes)'] || '0', 10) > 102400).length,
            urls: rows.filter(r => parseInt(r['Size (Bytes)'] || r['Size (bytes)'] || '0', 10) > 102400).map(r => r['Address']),
            details: []
        };

        // Only count missing alt text if the column exists
        if (hasAltTextColumn) {
            results.images_missing_alt = {
                count: rows.filter(r => !r['Alt Text 1'] || r['Alt Text 1'].trim() === '').length,
                urls: rows.filter(r => !r['Alt Text 1'] || r['Alt Text 1'].trim() === '').map(r => r['Address']),
                details: []
            };

            results.images_alt_over_100 = {
                count: rows.filter(r => r['Alt Text 1'] && r['Alt Text 1'].split(/\s+/).length > 100).length,
                urls: rows.filter(r => r['Alt Text 1'] && r['Alt Text 1'].split(/\s+/).length > 100).map(r => r['Address']),
                details: []
            };
        } else {
            // Alt text column doesn't exist - set to 0
            results.images_missing_alt = { count: 0, urls: [], details: [] };
            results.images_alt_over_100 = { count: 0, urls: [], details: [] };
        }
    }

    // Analyze external links
    if (data.external?.rows) {
        const rows = data.external.rows;

        results.redirect_301_external = {
            count: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 301).length,
            urls: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 301).map(r => r['Destination'] || r['Address']),
            details: []
        };

        results.redirect_404_external = {
            count: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 404).length,
            urls: rows.filter(r => parseInt(r['Status Code'] || '0', 10) === 404).map(r => r['Destination'] || r['Address']),
            details: []
        };
    }

    return results;
};

// Component to render detailed table for title/meta/h1 issues
const DetailedIssueTable = ({ details, type, itemId, tablePage, setTablePage }) => {
    if (!details || details.length === 0) return null;

    const ITEMS_PER_PAGE = 20;
    const currentPage = tablePage?.[itemId] || 1;
    const totalPages = Math.ceil(details.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedDetails = details.slice(startIdx, endIdx);

    const getLabel = () => {
        switch (type) {
            case 'title': return 'Title';
            case 'meta': return 'Meta Description';
            case 'h1': return 'H1';
            default: return 'Value';
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-100 text-left">
                        <th className="px-3 py-2 font-semibold text-gray-700 w-1/2">URL</th>
                        <th className="px-3 py-2 font-semibold text-gray-700">{getLabel()}</th>
                        <th className="px-3 py-2 font-semibold text-gray-700 w-20 text-center">Length</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedDetails.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"
                                >
                                    <span className="truncate max-w-[300px]">{item.url}</span>
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                                <span className={`${item.value === '(empty)' ? 'text-red-500 italic' : ''}`}>
                                    {item.value?.substring(0, 100)}{item.value?.length > 100 ? '...' : ''}
                                </span>
                            </td>
                            <td className={`px-3 py-2 text-center font-medium ${item.length === 0 ? 'text-red-500' :
                                item.length > 60 && type === 'title' ? 'text-orange-500' :
                                    item.length > 155 && type === 'meta' ? 'text-orange-500' :
                                        item.length > 70 && type === 'h1' ? 'text-orange-500' :
                                            'text-gray-600'
                                }`}>
                                {item.length}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 px-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setTablePage(prev => ({ ...prev, [itemId]: Math.max(1, currentPage - 1) }));
                        }}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>
                    <span className="text-sm text-gray-500">
                        Page {currentPage} of {totalPages} ({details.length} items)
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setTablePage(prev => ({ ...prev, [itemId]: Math.min(totalPages, currentPage + 1) }));
                        }}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

const ScreamingFrogAnalyzer = () => {
    const { user } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState({});
    const [parsedData, setParsedData] = useState({});
    const [analysisResults, setAnalysisResults] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [expandedItems, setExpandedItems] = useState({});
    const [checkedItems, setCheckedItems] = useState({});
    const [showUploadSection, setShowUploadSection] = useState(true);
    const [urlPages, setUrlPages] = useState({}); // Pagination state per URL list
    const [tablePage, setTablePage] = useState({}); // Pagination state for detailed tables
    const [markedUrls, setMarkedUrls] = useState({}); // Track marked URLs per issue: { issueId: { url: true } }
    const URLS_PER_PAGE = 20;
    const STORAGE_KEY = 'screaming_frog_analysis';

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.analysisResults) setAnalysisResults(data.analysisResults);
                if (data.checkedItems) setCheckedItems(data.checkedItems);
                if (data.markedUrls) setMarkedUrls(data.markedUrls);
                if (data.analysisResults) setShowUploadSection(false);
            }
        } catch (e) {
            console.error('Failed to load saved analysis:', e);
        }
    }, []);

    // Save to localStorage when data changes
    useEffect(() => {
        if (analysisResults) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    analysisResults,
                    checkedItems,
                    markedUrls,
                    savedAt: new Date().toISOString()
                }));
            } catch (e) {
                console.error('Failed to save analysis:', e);
            }
        }
    }, [analysisResults, checkedItems, markedUrls]);

    // Toggle a single URL as marked
    const toggleUrlMark = useCallback((issueId, url) => {
        setMarkedUrls(prev => {
            const issueMarks = prev[issueId] || {};
            return {
                ...prev,
                [issueId]: {
                    ...issueMarks,
                    [url]: !issueMarks[url]
                }
            };
        });
    }, []);

    // Mark all URLs in an issue as done
    const markAllUrlsDone = useCallback((issueId, urls) => {
        setMarkedUrls(prev => {
            const newMarks = {};
            urls.forEach(url => { newMarks[url] = true; });
            return {
                ...prev,
                [issueId]: newMarks
            };
        });
    }, []);

    // Get count of marked URLs for an issue
    const getMarkedCount = useCallback((issueId) => {
        const marks = markedUrls[issueId] || {};
        return Object.values(marks).filter(Boolean).length;
    }, [markedUrls]);

    // Clear saved data
    const clearSavedData = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setMarkedUrls({});
    }, []);

    const handleFileUpload = useCallback((event) => {
        const files = Array.from(event.target.files);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const { headers, rows } = parseCSV(text);
                const fileType = detectFileType(headers);

                setUploadedFiles(prev => ({
                    ...prev,
                    [file.name]: { name: file.name, type: fileType, rowCount: rows.length }
                }));

                setParsedData(prev => ({
                    ...prev,
                    [fileType]: { headers, rows }
                }));
            };
            reader.readAsText(file);
        });
    }, []);

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files).filter(f => f.name.endsWith('.csv'));

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const { headers, rows } = parseCSV(text);
                const fileType = detectFileType(headers);

                setUploadedFiles(prev => ({
                    ...prev,
                    [file.name]: { name: file.name, type: fileType, rowCount: rows.length }
                }));

                setParsedData(prev => ({
                    ...prev,
                    [fileType]: { headers, rows }
                }));
            };
            reader.readAsText(file);
        });
    }, []);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
    }, []);

    const runAnalysis = useCallback(() => {
        setIsAnalyzing(true);

        setTimeout(() => {
            const results = analyzeData(parsedData);
            setAnalysisResults(results);
            setIsAnalyzing(false);
            setShowUploadSection(false); // Collapse upload section after analysis
        }, 500);
    }, [parsedData]);

    const removeFile = useCallback((fileName) => {
        const fileInfo = uploadedFiles[fileName];
        setUploadedFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[fileName];
            return newFiles;
        });

        if (fileInfo) {
            setParsedData(prev => {
                const newData = { ...prev };
                delete newData[fileInfo.type];
                return newData;
            });
        }
    }, [uploadedFiles]);

    const clearAll = useCallback(() => {
        setUploadedFiles({});
        setParsedData({});
        setAnalysisResults(null);
        setCheckedItems({});
        setMarkedUrls({});
        clearSavedData();
    }, [clearSavedData]);

    const toggleExpand = useCallback((itemId) => {
        setExpandedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    }, []);

    const toggleCheck = useCallback((itemId) => {
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    }, []);

    const stats = useMemo(() => {
        if (!analysisResults) return null;

        let totalIssues = 0;
        let totalUrls = 0;

        CHECKLIST_CATEGORIES.forEach(cat => {
            cat.items.forEach(item => {
                const result = analysisResults[item.id];
                if (result && result.count > 0) {
                    totalIssues++;
                    totalUrls += result.count;
                }
            });
        });

        return { totalIssues, totalUrls };
    }, [analysisResults]);

    // Export CSV matching the reference image format with category headers and status column
    const exportCSV = useCallback(() => {
        if (!analysisResults) return;

        const rows = [];

        // Add title row
        rows.push(['Website Audit Checklist', '', '', '']);
        rows.push(['', '', '', '']);

        CHECKLIST_CATEGORIES.forEach(cat => {
            // Add category header row (matching reference: colored header row)
            rows.push([cat.name, '', 'Issues', 'Status']);

            // Add items under this category
            cat.items.forEach(item => {
                const result = analysisResults[item.id];
                rows.push([
                    item.name,
                    '',
                    result?.count || '',
                    checkedItems[item.id] ? 'Checked' : 'Not Checked'
                ]);
            });

            // Add empty row between categories
            rows.push(['', '', '', '']);
        });

        const csvContent = rows
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `website-audit-checklist-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [analysisResults, checkedItems]);

    // Export PDF similar to EEAT export
    const exportLegacyPDF = useCallback(() => {
        if (!analysisResults) return;

        const doc = new jsPDF();
        const totalChecks = CHECKLIST_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);
        const checkedCount = Object.values(checkedItems).filter(Boolean).length;
        const issuesFound = stats?.totalIssues || 0;
        const urlsAffected = stats?.totalUrls || 0;

        // Emerald gradient header
        doc.setFillColor(5, 150, 105); // emerald-600
        doc.rect(0, 0, 210, 45, 'F');
        doc.setFillColor(20, 184, 166); // teal-500
        doc.rect(100, 0, 110, 45, 'F');

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Website Audit Checklist', 14, 18);

        // Subtitle
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Screaming Frog Analysis Report', 14, 28);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);

        // Stats box on the right
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(145, 8, 55, 30, 3, 3, 'F');
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(`${issuesFound}`, 172, 20, { align: 'center' });
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Issues Found', 172, 30, { align: 'center' });

        // Summary stats section
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, 58);

        // Stats boxes
        doc.setFillColor(5, 150, 105); // emerald
        doc.roundedRect(14, 62, 45, 20, 2, 2, 'F');
        doc.setFillColor(249, 115, 22); // orange
        doc.roundedRect(65, 62, 45, 20, 2, 2, 'F');
        doc.setFillColor(20, 184, 166); // teal
        doc.roundedRect(116, 62, 45, 20, 2, 2, 'F');
        doc.setFillColor(139, 92, 246); // violet
        doc.roundedRect(167, 62, 35, 20, 2, 2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`${CHECKLIST_CATEGORIES.length} Categories`, 37, 75, { align: 'center' });
        doc.text(`${totalChecks} Checks`, 87, 75, { align: 'center' });
        doc.text(`${urlsAffected} URLs`, 138, 75, { align: 'center' });
        doc.text(`${checkedCount} Done`, 184, 75, { align: 'center' });

        // Build table data with category headers
        const tableData = [];
        CHECKLIST_CATEGORIES.forEach(cat => {
            // Category header row
            tableData.push([
                {
                    content: cat.name, colSpan: 3, styles: {
                        fillColor: cat.color === 'blue' ? [6, 182, 212] : [252, 211, 77],
                        textColor: cat.color === 'blue' ? [255, 255, 255] : [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'center'
                    }
                }
            ]);

            // Items
            cat.items.forEach(item => {
                const result = analysisResults[item.id];
                const hasIssues = result && result.count > 0;
                const isChecked = checkedItems[item.id];
                tableData.push([
                    item.name,
                    result?.count || 0,
                    isChecked ? 'Checked' : 'Not Checked'
                ]);
            });
        });

        autoTable(doc, {
            startY: 90,
            head: [['Check Item', 'Issues', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [5, 150, 105],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 25, halign: 'center' },
                2: { cellWidth: 35, halign: 'center' }
            },
            didParseCell: (data) => {
                // Color Status column
                if (data.column.index === 2 && data.section === 'body') {
                    if (data.cell.raw === 'Checked') {
                        data.cell.styles.textColor = [16, 185, 129];
                    } else {
                        data.cell.styles.textColor = [156, 163, 175];
                    }
                }
                // Color Issues column if has issues
                if (data.column.index === 1 && data.section === 'body') {
                    const val = parseInt(data.cell.raw) || 0;
                    if (val > 0) {
                        data.cell.styles.textColor = [239, 68, 68]; // red
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`SemanticsX - Website Audit Report | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`website-audit-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    }, [analysisResults, checkedItems, stats]);

    const exportPDF = useCallback(() => {
        if (!analysisResults) return;
        try {
            downloadScreamingFrogPdf({
                analysisResults,
                categories: CHECKLIST_CATEGORIES,
                checkedItems,
                user
            });
        } catch (pdfError) {
            console.error('Professional Screaming Frog report failed; using compatibility exporter.', pdfError);
            exportLegacyPDF();
        }
    }, [analysisResults, checkedItems, user, exportLegacyPDF]);

    const fileCount = Object.keys(uploadedFiles).length;
    const hasData = Object.keys(parsedData).length > 0;

    // Helper to determine detail type for an item
    const getDetailType = (itemId) => {
        if (itemId.startsWith('title_')) return 'title';
        if (itemId.startsWith('meta_')) return 'meta';
        if (itemId.startsWith('h1_')) return 'h1';
        return null;
    };

    return (
        <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 to-emerald-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileSearch className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold">Screaming Frog Analyzer</h1>
                    </div>
                    <p className="text-emerald-100 max-w-2xl">
                        Upload your Screaming Frog CSV exports to analyze SEO issues and generate a comprehensive audit report.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Upload Section - Collapsible after analysis */}
                <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 mb-8 overflow-hidden transition-all duration-300 ${analysisResults && !showUploadSection ? 'p-0' : 'p-6'}`}>
                    {/* Collapsible Header */}
                    <button
                        onClick={() => setShowUploadSection(!showUploadSection)}
                        className={`w-full flex items-center justify-between ${analysisResults ? 'cursor-pointer hover:bg-gray-50/50' : 'cursor-default'} ${analysisResults && !showUploadSection ? 'p-4' : ''} transition-colors rounded-xl`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-500/25">
                                <Upload className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-lg font-semibold text-gray-800">Upload CSV Files</h2>
                                {analysisResults && !showUploadSection && fileCount > 0 && (
                                    <p className="text-sm text-gray-500">{fileCount} file(s) uploaded • Click to expand</p>
                                )}
                            </div>
                        </div>
                        {analysisResults && (
                            <div className="flex items-center gap-2">
                                {fileCount > 0 && !showUploadSection && (
                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                                        {fileCount} files
                                    </span>
                                )}
                                <div className={`p-2 rounded-lg ${showUploadSection ? 'bg-emerald-100' : 'bg-gray-100'} transition-colors`}>
                                    {showUploadSection ? <ChevronUp className="w-5 h-5 text-emerald-600" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                </div>
                            </div>
                        )}
                    </button>

                    {/* Upload Content - Hidden when collapsed after analysis */}
                    {(showUploadSection || !analysisResults) && (
                        <div className={`${analysisResults ? 'mt-4 pt-4 border-t border-gray-100' : 'mt-4'}`}>
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer bg-gradient-to-br from-gray-50/50 to-emerald-50/30"
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => document.getElementById('csv-upload').click()}
                            >
                                <input
                                    type="file"
                                    id="csv-upload"
                                    accept=".csv"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                                    <Upload className="w-8 h-8 text-emerald-600" />
                                </div>
                                <p className="text-gray-700 font-medium mb-2">Drag & drop CSV files here, or click to browse</p>
                                <p className="text-sm text-gray-400 mb-1">
                                    <span className="font-medium">Required files:</span> issues_overview_report.csv, internal_html.csv, external_html.csv
                                </p>
                                <p className="text-sm text-gray-400">
                                    page_titles.csv, meta_description.csv, h1.csv, images.csv, canonicals.csv, structured_data.csv
                                </p>
                            </div>


                            {/* Uploaded Files List */}
                            {fileCount > 0 && (
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-gray-700">Uploaded Files ({fileCount})</h3>
                                        <button
                                            onClick={clearAll}
                                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {Object.values(uploadedFiles).map(file => (
                                            <div
                                                key={file.name}
                                                className="flex items-center justify-between bg-gradient-to-br from-gray-50 to-white rounded-lg px-4 py-3 border border-gray-200 shadow-sm"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                                        <FileText className="w-4 h-4 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-sm truncate max-w-[150px]">{file.name}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {file.type !== 'unknown' ? file.type.replace(/_/g, ' ') : 'Unknown format'} • {file.rowCount} rows
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Analyze Button */}
                                    <button
                                        onClick={runAnalysis}
                                        disabled={!hasData || isAnalyzing}
                                        className="mt-6 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Run Analysis
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Results Section - Premium Design */}
                {analysisResults && (
                    <>
                        {/* Premium Stats Dashboard */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {/* Categories Card */}
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-500/25 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <ListChecks className="w-4 h-4" />
                                        </div>
                                        <p className="text-xs text-indigo-100 uppercase font-semibold tracking-wide">Categories</p>
                                    </div>
                                    <p className="text-3xl font-bold">{CHECKLIST_CATEGORIES.length}</p>
                                </div>
                            </div>

                            {/* Total Checks Card */}
                            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-5 text-white shadow-xl shadow-cyan-500/25 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Check className="w-4 h-4" />
                                        </div>
                                        <p className="text-xs text-cyan-100 uppercase font-semibold tracking-wide">Total Checks</p>
                                    </div>
                                    <p className="text-3xl font-bold">
                                        {CHECKLIST_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0)}
                                    </p>
                                </div>
                            </div>

                            {/* Issues Found Card */}
                            <div className="bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl p-5 text-white shadow-xl shadow-orange-500/25 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <AlertTriangle className="w-4 h-4" />
                                        </div>
                                        <p className="text-xs text-orange-100 uppercase font-semibold tracking-wide">Issues Found</p>
                                    </div>
                                    <p className="text-3xl font-bold">{stats?.totalIssues || 0}</p>
                                </div>
                            </div>

                            {/* URLs Affected Card */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-xl shadow-emerald-500/25 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                            <Target className="w-4 h-4" />
                                        </div>
                                        <p className="text-xs text-emerald-100 uppercase font-semibold tracking-wide">URLs Affected</p>
                                    </div>
                                    <p className="text-3xl font-bold">{stats?.totalUrls?.toLocaleString() || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Export Buttons - Premium Style */}
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-500/25">
                                    <FileSearch className="w-5 h-5" />
                                </div>
                                Audit Checklist
                            </h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={exportCSV}
                                    className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm font-medium"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                    Export CSV
                                </button>
                                <button
                                    onClick={exportPDF}
                                    className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl hover:from-rose-600 hover:to-pink-600 transition-all flex items-center gap-2 shadow-lg shadow-rose-500/25 font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    Export PDF
                                </button>
                            </div>
                        </div>

                        {/* Checklist Categories - Premium Table */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                            <table className="w-full">
                                <tbody>
                                    {CHECKLIST_CATEGORIES.map((category, catIndex) => (
                                        <React.Fragment key={category.id}>
                                            {/* Category Header */}
                                            <tr className={category.color === 'blue' ? 'bg-cyan-500' : 'bg-amber-100'}>
                                                <td
                                                    colSpan="2"
                                                    className={`py-3 px-4 font-bold text-center ${category.color === 'blue' ? 'text-white' : 'text-gray-800'}`}
                                                >
                                                    {category.name}
                                                </td>
                                                <td
                                                    className={`py-3 px-4 font-bold text-center w-32 ${category.color === 'blue' ? 'text-white' : 'text-gray-800'}`}
                                                >
                                                    Issues
                                                </td>
                                            </tr>

                                            {/* Category Items */}
                                            {category.items.map((item, itemIndex) => {
                                                const result = analysisResults[item.id];
                                                const hasIssues = result && result.count > 0;
                                                const isExpanded = expandedItems[item.id];
                                                const isChecked = checkedItems[item.id];
                                                const detailType = getDetailType(item.id);
                                                const hasDetails = item.showDetails && result?.details?.length > 0;

                                                return (
                                                    <React.Fragment key={item.id}>
                                                        <tr
                                                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${hasIssues ? 'bg-red-50' : ''}`}
                                                        >
                                                            <td className="py-2.5 px-4 w-10">
                                                                <button
                                                                    onClick={() => toggleCheck(item.id)}
                                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked
                                                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                        : 'border-gray-300 hover:border-emerald-400'
                                                                        }`}
                                                                >
                                                                    {isChecked && <Check className="w-3 h-3" />}
                                                                </button>
                                                            </td>
                                                            <td
                                                                className={`py-2.5 px-2 font-medium cursor-pointer ${isChecked ? 'line-through text-gray-400' : 'text-gray-800'}`}
                                                                onClick={() => hasIssues && toggleExpand(item.id)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {hasIssues && (
                                                                        isExpanded
                                                                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                                                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                                                                    )}
                                                                    {item.name}
                                                                </div>
                                                            </td>
                                                            <td className={`py-2.5 px-4 text-center font-semibold w-32 ${hasIssues ? 'text-red-600' : 'text-gray-400'}`}>
                                                                {result?.count || 0}
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Details */}
                                                        {isExpanded && hasIssues && (
                                                            <tr>
                                                                <td colSpan="3" className="bg-gray-50 px-4 py-3">
                                                                    <div className="max-h-96 overflow-y-auto">
                                                                        {hasDetails ? (
                                                                            <DetailedIssueTable
                                                                                details={result.details}
                                                                                type={detailType}
                                                                                itemId={item.id}
                                                                                tablePage={tablePage}
                                                                                setTablePage={setTablePage}
                                                                            />
                                                                        ) : (
                                                                            <div>
                                                                                <p className="text-xs text-gray-500 mb-2 font-medium">
                                                                                    Affected URLs ({result.urls.length}):
                                                                                </p>
                                                                                {(() => {
                                                                                    const currentPage = urlPages[item.id] || 1;
                                                                                    const totalPages = Math.ceil(result.urls.length / URLS_PER_PAGE);
                                                                                    const startIdx = (currentPage - 1) * URLS_PER_PAGE;
                                                                                    const endIdx = startIdx + URLS_PER_PAGE;
                                                                                    const paginatedUrls = result.urls.slice(startIdx, endIdx);

                                                                                    return (
                                                                                        <>
                                                                                            {/* Mark all done button */}
                                                                                            <div className="flex items-center justify-between mb-2">
                                                                                                <span className="text-xs text-gray-400">
                                                                                                    {getMarkedCount(item.id)} of {result.urls.length} marked as done
                                                                                                </span>
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        markAllUrlsDone(item.id, result.urls);
                                                                                                    }}
                                                                                                    className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                                                                                                >
                                                                                                    ✓ Mark all done
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="grid gap-1">
                                                                                                {paginatedUrls.map((url, idx) => {
                                                                                                    const isMarked = markedUrls[item.id]?.[url];
                                                                                                    return (
                                                                                                        <div key={idx} className="flex items-center gap-2 group">
                                                                                                            <button
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    toggleUrlMark(item.id, url);
                                                                                                                }}
                                                                                                                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isMarked
                                                                                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                                                                    : 'border-gray-300 hover:border-emerald-400 text-transparent'
                                                                                                                    }`}
                                                                                                            >
                                                                                                                {isMarked && <Check className="w-3 h-3" />}
                                                                                                            </button>
                                                                                                            <a
                                                                                                                href={url}
                                                                                                                target="_blank"
                                                                                                                rel="noopener noreferrer"
                                                                                                                className={`text-sm hover:underline truncate py-0.5 flex items-center gap-1 transition-colors ${isMarked
                                                                                                                    ? 'text-gray-400 line-through'
                                                                                                                    : 'text-emerald-600 hover:text-emerald-800'
                                                                                                                    }`}
                                                                                                            >
                                                                                                                <span className="truncate">{url}</span>
                                                                                                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                                                                            </a>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                            {totalPages > 1 && (
                                                                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setUrlPages(prev => ({ ...prev, [item.id]: Math.max(1, currentPage - 1) }));
                                                                                                        }}
                                                                                                        disabled={currentPage === 1}
                                                                                                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                                    >
                                                                                                        ← Previous
                                                                                                    </button>
                                                                                                    <span className="text-sm text-gray-500">
                                                                                                        Page {currentPage} of {totalPages}
                                                                                                    </span>
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setUrlPages(prev => ({ ...prev, [item.id]: Math.min(totalPages, currentPage + 1) }));
                                                                                                        }}
                                                                                                        disabled={currentPage >= totalPages}
                                                                                                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                                    >
                                                                                                        Next →
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Empty State */}
                {fileCount === 0 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                        <FileSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Files Uploaded</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Upload your Screaming Frog CSV exports to begin the analysis.
                            You can upload multiple files at once.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScreamingFrogAnalyzer;
