const URL_COLUMNS = new Set(['address', 'url', 'source url']);
const SCREAMING_FROG_HEADERS = new Set([
  ...URL_COLUMNS, 'destination', 'status code', 'issue name', 'issue type',
  'title 1', 'meta description 1', 'h1-1', 'canonical link element 1', 'errors', 'warnings',
]);

export function parseScreamingFrogCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  if (!source.trim()) return { headers: [], rows: [], urls: [], errors: [], hasRecognizedHeader: false };

  // Screaming Frog exports can be comma, semicolon, or tab separated. Parse
  // records (rather than splitting lines) so quoted values may contain commas
  // and line breaks.
  const firstLine = source.split(/\r\n|\n|\r/, 1)[0] || '';
  const delimiters = [',', ';', '\t'];
  const delimiter = delimiters.reduce((best, candidate) => {
    const count = (firstLine.match(new RegExp(candidate === '\t' ? '\\t' : `\\${candidate}`, 'g')) || []).length;
    return count > best.count ? { value: candidate, count } : best;
  }, { value: ',', count: -1 }).value;
  const records = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell)) records.push(row);
      row = []; value = '';
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some((cell) => cell)) records.push(row);
  if (!records.length) return { headers: [], rows: [], urls: [], errors: [], hasRecognizedHeader: false };

  const firstRow = records[0];
  const hasHeader = firstRow.some((header) => SCREAMING_FROG_HEADERS.has(header.toLowerCase()));
  if (!hasHeader) {
    const values = records.flat().map((cell) => cell.replace(/^['"]|['"]$/g, '').trim()).filter(Boolean);
    return { headers: ['Address'], rows: values.map((Address) => ({ Address })), urls: values, errors: [], hasRecognizedHeader: false };
  }

  const headers = firstRow;
  const rows = records.slice(1).map((values) => {
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
  const urlHeader = headers.find((header) => URL_COLUMNS.has(header.toLowerCase()));
  return {
    headers,
    rows,
    urls: rows.map((row) => row[urlHeader]).filter(Boolean),
    errors: [],
    hasRecognizedHeader: true,
  };
}

function item() {
  return { count: 0, urls: [], details: [] };
}

function setResult(results, id, rows, predicate, detail) {
  const matches = rows.filter(predicate);
  results[id] = {
    count: matches.length,
    urls: matches.map((row) => row.Address || row.Destination || row['Source URL'] || ''),
    details: detail ? matches.map(detail) : [],
  };
}

function number(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return Number.parseInt(row[key], 10) || 0;
  }
  return 0;
}

export function detectScreamingFrogFileType(headers) {
  const names = new Set(headers.map((header) => header.toLowerCase()));
  if (names.has('issue name') && names.has('issue type')) return 'issues_overview';
  if (names.has('address') && names.has('title 1') && names.has('meta description 1')) return 'internal_html';
  if (names.has('address') && names.has('errors') && names.has('warnings')) return 'structured_data';
  if (names.has('address') && names.has('canonical link element 1')) return 'canonicals';
  if (names.has('address') && (names.has('img inlinks') || names.has('dimensions') || names.has('alt text 1'))) return 'images';
  if (names.has('address') && names.has('title 1')) return 'page_titles';
  if (names.has('address') && names.has('meta description 1')) return 'meta_descriptions';
  if (names.has('address') && names.has('h1-1')) return 'h1';
  if (names.has('destination') || (names.has('address') && names.has('status code'))) return 'external';
  if (names.has('address')) return 'internal_html';
  return null;
}

export function analyzeScreamingFrog(data) {
  const results = {};
  const ids = [
    'directory_pages', 'post_tags', 'media_attachments', 'authors', 'thin_empty', 'parameters', 'category_pages', 'pdf_pages', 'search_result',
    'product_tags', 'account_pages', 'redirect_301_internal', 'redirect_404_internal', 'uppercase_urls', 'underscore_urls', 'over_115_chars',
    'redirect_301_external', 'redirect_404_external', 'params_internal', 'trailing_issues', 'non_trailing_issues', 'spammy_comments',
    'low_quality_links', 'redirect_chains', 'title_missing', 'title_duplicate', 'title_over_60', 'title_below_30', 'title_multiple',
    'title_branding', 'title_over_optimized', 'title_headings_compare', 'meta_missing', 'meta_duplicate', 'meta_over_155', 'meta_below_70',
    'meta_multiple', 'h1_missing', 'h1_duplicate', 'h1_over_70', 'h1_multiple', 'images_over_100kb', 'images_missing_alt',
    'images_alt_over_100', 'images_seo_optimized', 'canonical_canonicalized', 'canonical_missing', 'canonical_multiple', 'canonical_non_indexable',
    'schema_errors', 'schema_missing'
  ];
  ids.forEach((id) => { results[id] = item(); });

  const internal = data.internal_html?.rows || [];
  const all = internal.length ? internal : (data.addresses?.rows || []);
  const indexable = all.filter((row) => !row.Indexability || row.Indexability === 'Indexable');
  const detail = (row, key, length) => ({ url: row.Address, value: row[key] || '(empty)', length });

  setResult(results, 'title_missing', indexable, (row) => !String(row['Title 1'] || '').trim(), (row) => detail(row, 'Title 1', number(row, 'Title 1 Length')));
  setResult(results, 'title_over_60', indexable, (row) => number(row, 'Title 1 Length') > 60, (row) => detail(row, 'Title 1', number(row, 'Title 1 Length')));
  setResult(results, 'title_below_30', indexable, (row) => row['Title 1'] && number(row, 'Title 1 Length') < 30, (row) => detail(row, 'Title 1', number(row, 'Title 1 Length')));
  setResult(results, 'meta_missing', indexable, (row) => !String(row['Meta Description 1'] || '').trim(), (row) => detail(row, 'Meta Description 1', number(row, 'Meta Description 1 Length')));
  setResult(results, 'meta_over_155', indexable, (row) => number(row, 'Meta Description 1 Length') > 155, (row) => detail(row, 'Meta Description 1', number(row, 'Meta Description 1 Length')));
  setResult(results, 'meta_below_70', indexable, (row) => row['Meta Description 1'] && number(row, 'Meta Description 1 Length') < 70, (row) => detail(row, 'Meta Description 1', number(row, 'Meta Description 1 Length')));
  setResult(results, 'h1_missing', indexable, (row) => !String(row['H1-1'] || '').trim(), (row) => detail(row, 'H1-1', String(row['H1-1'] || '').length));
  setResult(results, 'h1_over_70', indexable, (row) => String(row['H1-1'] || '').length > 70, (row) => detail(row, 'H1-1', String(row['H1-1'] || '').length));
  setResult(results, 'title_multiple', indexable, (row) => String(row['Title 2'] || '').trim());
  setResult(results, 'meta_multiple', indexable, (row) => String(row['Meta Description 2'] || '').trim());
  setResult(results, 'h1_multiple', indexable, (row) => String(row['H1-2'] || '').trim());

  const duplicate = (id, key, rows) => {
    const groups = Object.groupBy ? Object.groupBy(rows.filter((row) => String(row[key] || '').trim()), (row) => row[key].trim()) : rows.reduce((groups, row) => { const value = String(row[key] || '').trim(); if (value) (groups[value] ||= []).push(row); return groups; }, {});
    const matches = Object.values(groups).filter((group) => group.length > 1).flat();
    results[id] = { count: matches.length, urls: matches.map((row) => row.Address || ''), details: matches.map((row) => detail(row, key, number(row, `${key} Length`) || String(row[key] || '').length)) };
  };
  duplicate('title_duplicate', 'Title 1', indexable);
  duplicate('meta_duplicate', 'Meta Description 1', indexable);
  duplicate('h1_duplicate', 'H1-1', indexable);

  const address = (row) => String(row.Address || '');
  const path = (row) => address(row).replace(/https?:\/\/[^/]+/i, '');
  const contains = (text) => (row) => address(row).toLowerCase().includes(text);
  setResult(results, 'uppercase_urls', all, (row) => address(row) && address(row) !== address(row).toLowerCase());
  setResult(results, 'underscore_urls', all, (row) => path(row).includes('_'));
  setResult(results, 'over_115_chars', all, (row) => address(row).length > 115);
  setResult(results, 'params_internal', all, (row) => address(row).includes('?'));
  setResult(results, 'trailing_issues', all, (row) => path(row) && !path(row).endsWith('/') && !path(row).includes('.'));
  setResult(results, 'redirect_301_internal', all, (row) => number(row, 'Status Code') === 301);
  setResult(results, 'redirect_404_internal', all, (row) => number(row, 'Status Code') === 404);
  setResult(results, 'directory_pages', all, (row) => contains('/directory/')(row) || contains('/listings/')(row));
  setResult(results, 'post_tags', all, contains('/tag/')); setResult(results, 'media_attachments', all, contains('/attachment/')); setResult(results, 'authors', all, contains('/author/'));
  setResult(results, 'thin_empty', all, (row) => number(row, 'Word Count') < 100 && row.Indexability === 'Indexable');
  setResult(results, 'parameters', all, (row) => row.Indexability === 'Indexable' && address(row).includes('?'));
  setResult(results, 'category_pages', all, contains('/category/')); setResult(results, 'pdf_pages', all, (row) => address(row).toLowerCase().endsWith('.pdf'));
  setResult(results, 'search_result', all, (row) => address(row).includes('/search/') || address(row).includes('?s='));
  setResult(results, 'product_tags', all, contains('/product-tag/')); setResult(results, 'account_pages', all, contains('/my-account/'));

  const structured = data.structured_data?.rows || []; const canonicals = data.canonicals?.rows || []; const images = data.images?.rows || []; const external = data.external?.rows || [];
  setResult(results, 'schema_errors', structured, (row) => number(row, 'Errors') > 0); setResult(results, 'schema_missing', structured, (row) => row.Indexability === 'Indexable' && number(row, 'Total Types') === 0);
  setResult(results, 'canonical_missing', canonicals, (row) => row.Indexability === 'Indexable' && !String(row['Canonical Link Element 1'] || '').trim());
  setResult(results, 'canonical_canonicalized', canonicals, (row) => row['Canonical Link Element 1'] && row['Canonical Link Element 1'] !== row.Address);
  setResult(results, 'canonical_non_indexable', canonicals, (row) => row.Indexability === 'Non-Indexable');
  setResult(results, 'images_over_100kb', images, (row) => number(row, 'Size (Bytes)', 'Size (bytes)') > 102400);
  setResult(results, 'images_missing_alt', images, (row) => Object.prototype.hasOwnProperty.call(row, 'Alt Text 1') && !String(row['Alt Text 1'] || '').trim());
  setResult(results, 'images_alt_over_100', images, (row) => String(row['Alt Text 1'] || '').trim().split(/\s+/).length > 100);
  setResult(results, 'redirect_301_external', external, (row) => number(row, 'Status Code') === 301); setResult(results, 'redirect_404_external', external, (row) => number(row, 'Status Code') === 404);
  return results;
}

export function buildScreamingFrogData(text) {
  const parsed = parseScreamingFrogCsv(text);
  const type = detectScreamingFrogFileType(parsed.headers);
  if (!type) return {};
  const mainPageTypes = new Set(['page_titles', 'meta_descriptions', 'h1']);
  return { [mainPageTypes.has(type) ? 'internal_html' : type]: parsed };
}
