import { jsPDF } from 'jspdf';
import autoTablePackage from 'jspdf-autotable';

const autoTable = autoTablePackage.default || autoTablePackage;

const PAGE = { width: 210, height: 297, margin: 14, footerY: 290 };
const COLORS = {
    ink: [15, 23, 42],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    surface: [248, 250, 252],
    white: [255, 255, 255],
    success: [5, 150, 105],
    warning: [217, 119, 6],
    danger: [220, 38, 38],
    info: [37, 99, 235]
};

const TONE_COLORS = {
    success: COLORS.success,
    warning: COLORS.warning,
    danger: COLORS.danger,
    info: COLORS.info,
    neutral: COLORS.muted
};

export const sanitizePdfText = (value) => String(value ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[✓✔]/g, 'PASS')
    .replace(/[✗✘]/g, 'FAIL')
    .replace(/[⚠⚡]/g, 'WARNING')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const safePdfFilenamePart = (value, fallback = 'report') => {
    const cleaned = sanitizePdfText(value)
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return cleaned || fallback;
};

export const calculateContainedImageSize = (width, height, maxWidth, maxHeight) => {
    const sourceWidth = safeNumber(width, 1);
    const sourceHeight = safeNumber(height, 1);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
        width: sourceWidth * scale,
        height: sourceHeight * scale
    };
};

export const normalizeProfessionalPdfModel = (input = {}) => {
    const generatedAt = input.generatedAt instanceof Date ? input.generatedAt : new Date(input.generatedAt || Date.now());
    const sections = Array.isArray(input.sections) ? input.sections : [];
    const filename = input.filename || `${safePdfFilenamePart(input.title)}-${generatedAt.toISOString().slice(0, 10)}.pdf`;

    return {
        title: sanitizePdfText(input.title || 'Audit Report'),
        subtitle: sanitizePdfText(input.subtitle || 'Professional analysis and recommendations'),
        target: sanitizePdfText(input.target || ''),
        period: sanitizePdfText(input.period || ''),
        generatedAt,
        filename: filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`,
        theme: Array.isArray(input.theme) && input.theme.length === 3 ? input.theme.map(v => safeNumber(v)) : [79, 70, 229],
        branding: {
            name: sanitizePdfText(input.branding?.name || 'SemanticsX'),
            logo: input.branding?.logo || null
        },
        score: input.score ? {
            value: sanitizePdfText(input.score.value),
            label: sanitizePdfText(input.score.label || 'Overall score'),
            status: sanitizePdfText(input.score.status || ''),
            tone: input.score.tone || 'neutral'
        } : null,
        summary: sanitizePdfText(input.summary || ''),
        metrics: (input.metrics || []).map(metric => ({
            label: sanitizePdfText(metric.label),
            value: sanitizePdfText(metric.value),
            note: sanitizePdfText(metric.note || ''),
            tone: metric.tone || 'neutral'
        })),
        priorities: (input.priorities || []).map(priority => ({
            severity: sanitizePdfText(priority.severity || 'Review').toUpperCase(),
            title: sanitizePdfText(priority.title),
            detail: sanitizePdfText(priority.detail || '')
        })),
        sections: sections.map(section => ({
            title: sanitizePdfText(section.title),
            description: sanitizePdfText(section.description || ''),
            columns: (section.columns || []).map(column => sanitizePdfText(column)),
            rows: (section.rows || []).map(row => (Array.isArray(row) ? row : [row]).map(sanitizePdfText)),
            columnStyles: section.columnStyles || {},
            emptyMessage: sanitizePdfText(section.emptyMessage || 'No records found.'),
            note: sanitizePdfText(section.note || '')
        }))
    };
};

const scoreTone = (tone) => TONE_COLORS[tone] || COLORS.muted;

export const createProfessionalPdfReport = (input = {}) => {
    const model = normalizeProfessionalPdfModel(input);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const { margin, height, footerY } = PAGE;
    const contentWidth = PAGE.width - margin * 2;
    let y = 0;

    const drawRunningHeader = () => {
        if (doc.internal.getCurrentPageInfo().pageNumber === 1) return;
        doc.setFillColor(...COLORS.ink);
        doc.rect(0, 0, PAGE.width, 13, 'F');
        doc.setFillColor(...model.theme);
        doc.rect(0, 13, PAGE.width, 1.2, 'F');
        doc.setTextColor(...COLORS.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(model.title, margin, 8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(model.branding.name, PAGE.width - margin, 8.5, { align: 'right' });
    };

    const addPage = () => {
        doc.addPage();
        drawRunningHeader();
        y = 23;
    };

    const ensureSpace = (space = 24) => {
        if (y + space > height - 18) addPage();
    };

    const wrappedText = (text, x, maxWidth, options = {}) => {
        const lines = doc.splitTextToSize(sanitizePdfText(text), maxWidth);
        doc.text(lines, x, y, options);
        y += Math.max(1, lines.length) * (options.lineHeight || 4.6);
    };

    const sectionHeading = (title, description = '') => {
        ensureSpace(description ? 22 : 14);
        doc.setFillColor(...model.theme);
        doc.roundedRect(margin, y, 3, 9, 1, 1, 'F');
        doc.setTextColor(...COLORS.ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(title, margin + 7, y + 6.4);
        y += 12;
        if (description) {
            doc.setTextColor(...COLORS.muted);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            wrappedText(description, margin, contentWidth, { lineHeight: 4.2 });
            y += 2;
        }
    };

    // Branded cover band.
    doc.setFillColor(...COLORS.ink);
    doc.rect(0, 0, PAGE.width, 55, 'F');
    doc.setFillColor(...model.theme);
    doc.rect(0, 51.5, PAGE.width, 3.5, 'F');
    let titleX = margin;
    if (model.branding.logo) {
        try {
            const properties = doc.getImageProperties(model.branding.logo);
            const logo = calculateContainedImageSize(properties.width, properties.height, 28, 19);
            const logoY = 18 + (19 - logo.height) / 2;
            doc.addImage(model.branding.logo, 'AUTO', margin, logoY, logo.width, logo.height);
            titleX += logo.width + 6;
        } catch {
            titleX = margin;
        }
    }
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(model.branding.name.toUpperCase(), margin, 12);
    doc.setFontSize(21);
    const titleLines = doc.splitTextToSize(model.title, (model.score ? 137 : contentWidth) - (titleX - margin));
    doc.text(titleLines, titleX, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(203, 213, 225);
    doc.text(model.subtitle, titleX, 42);

    if (model.score) {
        const tone = scoreTone(model.score.tone);
        doc.setFillColor(...COLORS.white);
        doc.roundedRect(158, 9, 38, 34, 3, 3, 'F');
        doc.setTextColor(...tone);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(model.score.value, 177, 23, { align: 'center' });
        doc.setTextColor(...COLORS.ink);
        doc.setFontSize(7.5);
        doc.text(model.score.label.toUpperCase(), 177, 30, { align: 'center' });
        doc.setTextColor(...tone);
        doc.setFontSize(7);
        doc.text(model.score.status, 177, 37, { align: 'center', maxWidth: 33 });
    }

    y = 64;
    if (model.target || model.period) {
        const target = model.target || model.period;
        const targetLines = doc.splitTextToSize(target, contentWidth - 10);
        const targetCardHeight = Math.max(22, 14 + targetLines.length * 4);
        doc.setFillColor(...COLORS.surface);
        doc.setDrawColor(...COLORS.line);
        doc.roundedRect(margin, y, contentWidth, targetCardHeight, 2, 2, 'FD');
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(model.target ? 'AUDIT TARGET' : 'REPORT PERIOD', margin + 5, y + 6);
        doc.setTextColor(...COLORS.ink);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(targetLines, margin + 5, y + 13);
        if (model.target && model.period) {
            doc.setTextColor(...COLORS.muted);
            doc.setFontSize(7.5);
            doc.text(model.period, PAGE.width - margin - 5, y + 6, { align: 'right' });
        }
        y += targetCardHeight + 7;
    }

    if (model.summary) {
        sectionHeading('Executive Summary');
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        wrappedText(model.summary, margin, contentWidth, { lineHeight: 4.8 });
        y += 3;
    }

    if (model.metrics.length) {
        sectionHeading('Key Metrics');
        const gap = 4;
        const cols = Math.min(4, model.metrics.length);
        const cardWidth = (contentWidth - gap * (cols - 1)) / cols;
        const cardHeight = 24;
        model.metrics.forEach((metric, index) => {
            const col = index % cols;
            if (index > 0 && col === 0) y += cardHeight + gap;
            ensureSpace(cardHeight + 4);
            const x = margin + col * (cardWidth + gap);
            const tone = scoreTone(metric.tone);
            doc.setFillColor(...COLORS.surface);
            doc.setDrawColor(...COLORS.line);
            doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
            doc.setFillColor(...tone);
            doc.rect(x, y, 2, cardHeight, 'F');
            doc.setTextColor(...tone);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(metric.value, x + 5, y + 10);
            doc.setTextColor(...COLORS.ink);
            doc.setFontSize(7.2);
            doc.text(metric.label.toUpperCase(), x + 5, y + 16);
            if (metric.note) {
                doc.setTextColor(...COLORS.muted);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.text(doc.splitTextToSize(metric.note, cardWidth - 9).slice(0, 1), x + 5, y + 21);
            }
        });
        y += cardHeight + 8;
    }

    if (model.priorities.length) {
        sectionHeading('Priority Action Plan', 'Start with the highest-impact findings below, then work through the detailed evidence sections.');
        autoTable(doc, {
            startY: y,
            head: [['Priority', 'Recommended action', 'Evidence / impact']],
            body: model.priorities.map(item => [item.severity, item.title, item.detail || '-']),
            theme: 'grid',
            margin: { left: margin, right: margin, top: 20, bottom: 17 },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.4, textColor: COLORS.ink, lineColor: COLORS.line, lineWidth: 0.15, overflow: 'linebreak' },
            headStyles: { fillColor: model.theme, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8 },
            columnStyles: { 0: { cellWidth: 23, fontStyle: 'bold' }, 1: { cellWidth: 58 } },
            didParseCell: data => {
                if (data.section === 'body' && data.column.index === 0) {
                    const value = String(data.cell.raw).toLowerCase();
                    data.cell.styles.textColor = value.includes('critical') || value.includes('high') ? COLORS.danger : value.includes('medium') ? COLORS.warning : COLORS.info;
                }
            },
            willDrawPage: () => drawRunningHeader()
        });
        y = doc.lastAutoTable.finalY + 9;
    }

    model.sections.forEach(section => {
        sectionHeading(section.title, section.description);
        if (!section.rows.length) {
            doc.setFillColor(...COLORS.surface);
            doc.setTextColor(...COLORS.muted);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
            doc.text(section.emptyMessage, margin + 5, y + 7.5);
            y += 18;
            return;
        }

        autoTable(doc, {
            startY: y,
            head: section.columns.length ? [section.columns] : undefined,
            body: section.rows,
            theme: 'grid',
            margin: { left: margin, right: margin, top: 20, bottom: 17 },
            styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2.1, textColor: COLORS.ink, lineColor: COLORS.line, lineWidth: 0.12, overflow: 'linebreak', valign: 'top' },
            headStyles: { fillColor: model.theme, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7.5 },
            alternateRowStyles: { fillColor: COLORS.surface },
            columnStyles: section.columnStyles,
            willDrawPage: () => drawRunningHeader()
        });
        y = doc.lastAutoTable.finalY + 5;
        if (section.note) {
            ensureSpace(10);
            doc.setTextColor(...COLORS.muted);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.2);
            wrappedText(section.note, margin, contentWidth, { lineHeight: 3.8 });
        }
        y += 5;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        drawRunningHeader();
        doc.setDrawColor(...COLORS.line);
        doc.line(margin, footerY - 4, PAGE.width - margin, footerY - 4);
        doc.setTextColor(...COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${model.branding.name} | Confidential audit report`, margin, footerY);
        doc.text(`Page ${page} of ${pageCount}`, PAGE.width - margin, footerY, { align: 'right' });
    }

    return { doc, filename: model.filename, model };
};

export const downloadProfessionalPdfReport = (input) => {
    const report = createProfessionalPdfReport(input);
    report.doc.save(report.filename);
    return report;
};

export const getPdfBranding = (user) => ({
    name: user?.agencyEnabled && user?.agencyName ? user.agencyName : 'SemanticsX',
    logo: user?.agencyEnabled ? user?.agencyLogo : null
});
