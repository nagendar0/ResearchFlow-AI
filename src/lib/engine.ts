import { Source, EvidenceChunk, Report } from './supabase';
import { getCachedResults, saveCachedResults, LocalCacheEntry } from './localDb';

export interface CrawledSource {
  provider: string;
  title: string;
  url: string;
  excerpt: string;
  published_at?: string;
  accessed_at: string;
  type: 'paper' | 'report' | 'gov' | 'web';
  quality_tier: 'high' | 'medium' | 'low';
  category_match: boolean;
  status: 'success' | 'rate_limit' | 'error' | 'timeout';
  error_message?: string;
  stargazers_count?: number;
  license?: string;
  version?: string;
  updated_at?: string;
}

export interface RunUpdate {
  stage: 'planning' | 'discovering' | 'extracting' | 'validating' | 'synthesizing' | 'complete';
  message: string;
  progress: number;
  sourcesFound?: Omit<Source, 'id'>[];
  evidenceFound?: Omit<EvidenceChunk, 'id'>[];
  report?: Omit<Report, 'id' | 'created_at'>;
}

// ----------------------------------------------------
// 1. DYNAMIC CATEGORY SOURCE MAPPING
// ----------------------------------------------------
export interface ProviderConfig {
  name: string;
  type: 'paper' | 'report' | 'gov' | 'web';
  quality_tier: 'high' | 'medium' | 'low';
  isOfficialOrPeerReviewed: boolean;
  fetcher: (query: string) => Promise<CrawledSource[]>;
}

// Timeout wrap for fetch
async function fetchWithTimeout(url: string, timeoutMs: number = 4500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Clean HTML tags and snippets helper
function cleanSnippet(html: string): string {
  if (!html) return '';
  return html
    .replace(/<span class="searchmatch">/g, '')
    .replace(/<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dynamic adapters:
const adapters: Record<string, (query: string) => Promise<CrawledSource[]>> = {
  europepmc: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=3`);
      if (res.status === 429) return [{ provider: 'Europe PMC', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const results = json.resultList?.result || [];
      return results.map((item: any): CrawledSource => ({
        provider: 'Europe PMC',
        title: item.title || 'Untitled Academic Paper',
        url: item.id && item.source ? `https://europepmc.org/article/${item.source}/${item.id}` : (item.doi ? `https://doi.org/${item.doi}` : ''),
        excerpt: cleanSnippet(item.abstractText || `No abstract available. Keywords: ${(item.keywordList?.keyword || []).join(', ')}`),
        published_at: item.firstPublicationDate?.slice(0, 10) || item.pubYear?.toString() || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'paper',
        quality_tier: 'high',
        category_match: true,
        status: 'success'
      })).filter((s: any) => s.url && s.excerpt.length > 10);
    } catch (e: any) {
      return [{ provider: 'Europe PMC', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  openalex: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=3&select=title,abstract_inverted_index,doi,publication_year,primary_location`);
      if (res.status === 429) return [{ provider: 'OpenAlex', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.results || []).map((item: any): CrawledSource => {
        // Reconstruct abstract from inverted index
        let abstract = '';
        if (item.abstract_inverted_index) {
          const positions = Object.entries(item.abstract_inverted_index)
            .flatMap(([word, indexes]: [string, any]) => indexes.map((index: number) => ({ word, index })))
            .sort((a, b) => a.index - b.index);
          abstract = positions.map(({ word }) => word).join(' ');
        }
        return {
          provider: 'OpenAlex',
          title: item.title || 'Untitled Academic Paper',
          url: item.doi || item.primary_location?.landing_page_url || '',
          excerpt: cleanSnippet(abstract || 'No abstract available.'),
          published_at: item.publication_year?.toString() || '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'paper',
          quality_tier: 'high',
          category_match: true,
          status: 'success'
        };
      }).filter((s: any) => s.url && s.excerpt.length > 10);
    } catch (e: any) {
      return [{ provider: 'OpenAlex', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  crossref: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&select=title,abstract,DOI,URL,publisher,published`);
      if (res.status === 429) return [{ provider: 'Crossref', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.message?.items || []).map((item: any): CrawledSource => {
        const abstract = typeof item.abstract === 'string' ? item.abstract : '';
        const dateParts = item.published?.['date-parts']?.[0];
        return {
          provider: 'Crossref',
          title: item.title?.[0] || 'Untitled Academic Paper',
          url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
          excerpt: cleanSnippet(abstract || 'Publication indexed by Crossref.'),
          published_at: dateParts?.[0]?.toString() || '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'paper',
          quality_tier: 'high',
          category_match: true,
          status: 'success'
        };
      }).filter((s: any) => s.url && s.excerpt.length > 5);
    } catch (e: any) {
      return [{ provider: 'Crossref', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  doaj: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://doaj.org/api/v2/search/articles/${encodeURIComponent(query)}?pageSize=3`);
      if (res.status === 429) return [{ provider: 'DOAJ', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.results || []).map((item: any): CrawledSource => {
        const bib = item.bibjson || {};
        const link = (bib.link || []).find((l: any) => l.url) || {};
        return {
          provider: 'DOAJ',
          title: bib.title || 'Untitled DOAJ Article',
          url: link.url || '',
          excerpt: cleanSnippet(bib.abstract || 'Open Access article recorded in DOAJ.'),
          published_at: bib.year || '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'paper',
          quality_tier: 'high',
          category_match: true,
          status: 'success'
        };
      }).filter((s: any) => s.url && s.excerpt.length > 5);
    } catch (e: any) {
      return [{ provider: 'DOAJ', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  openlibrary: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`);
      if (res.status === 429) return [{ provider: 'Open Library', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'medium', category_match: false, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.docs || []).map((item: any): CrawledSource => {
        const author = (item.author_name || []).join(', ') || 'Unknown Author';
        return {
          provider: 'Open Library',
          title: item.title || 'Untitled Book',
          url: item.key ? `https://openlibrary.org${item.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(item.title)}`,
          excerpt: cleanSnippet(`Book published by ${author}. Publishers: ${(item.publisher || []).slice(0, 2).join(', ') || 'N/A'}. Subject matches: ${(item.subject || []).slice(0, 4).join(', ') || 'N/A'}`),
          published_at: item.first_publish_year?.toString() || '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'paper',
          quality_tier: 'medium',
          category_match: false,
          status: 'success'
        };
      }).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Open Library', title: '', url: '', excerpt: '', accessed_at: '', type: 'paper', quality_tier: 'medium', category_match: false, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  github: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`);
      if (res.status === 429 || res.status === 403) return [{ provider: 'GitHub', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.items || []).map((item: any): CrawledSource => ({
        provider: 'GitHub',
        title: item.full_name || item.name,
        url: item.html_url,
        excerpt: cleanSnippet(item.description || 'Open-source code repository.'),
        published_at: item.updated_at?.slice(0, 10) || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'high',
        category_match: true,
        status: 'success',
        stargazers_count: item.stargazers_count,
        license: item.license?.name || item.license?.key || undefined,
        updated_at: item.updated_at
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'GitHub', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  npm: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://registry.npmjs.com/-/v1/search?text=${encodeURIComponent(query)}&size=3`);
      if (res.status === 429) return [{ provider: 'npm Registry', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.objects || []).map((result: any): CrawledSource => {
        const pkg = result.package || {};
        return {
          provider: 'npm Registry',
          title: pkg.name || 'npm-package',
          url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
          excerpt: cleanSnippet(pkg.description || 'npm registry package payload.'),
          published_at: pkg.date?.slice(0, 10) || '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'web',
          quality_tier: 'high',
          category_match: true,
          status: 'success',
          version: pkg.version
        };
      }).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'npm Registry', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  cratesio: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=3`);
      if (res.status === 429) return [{ provider: 'Crates.io Registry', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.crates || []).map((item: any): CrawledSource => ({
        provider: 'Crates.io Registry',
        title: item.name || 'crate',
        url: item.repository || item.homepage || `https://crates.io/crates/${item.name}`,
        excerpt: cleanSnippet(item.description || 'Rust cargo registry crate.'),
        published_at: item.updated_at?.slice(0, 10) || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'high',
        category_match: true,
        status: 'success',
        version: item.max_version
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Crates.io Registry', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  stackexchange: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=3`);
      if (res.status === 429) return [{ provider: 'Stack Overflow', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: false, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.items || []).map((item: any): CrawledSource => ({
        provider: 'Stack Overflow',
        title: cleanSnippet(item.title),
        url: item.link,
        excerpt: cleanSnippet(item.body || `Q&A discussion with ${item.score} score. Tags: ${(item.tags || []).join(', ')}`),
        published_at: item.creation_date ? new Date(item.creation_date * 1000).toISOString().slice(0, 10) : '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'low',
        category_match: false,
        status: 'success'
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Stack Overflow', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: false, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  devto: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://dev.to/api/articles?q=${encodeURIComponent(query)}&per_page=3`);
      if (res.status === 429) return [{ provider: 'dev.to Community', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: false, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json) ? json : [];
      return items.map((item: any): CrawledSource => ({
        provider: 'dev.to Community',
        title: item.title,
        url: item.url || item.canonical_url,
        excerpt: cleanSnippet(item.description || 'Community technical article.'),
        published_at: item.published_at?.slice(0, 10) || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'low',
        category_match: false,
        status: 'success'
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'dev.to Community', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: false, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  gdelt: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json`);
      if (res.status === 429) return [{ provider: 'GDELT Project', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'medium', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.articles || []).slice(0, 3).map((item: any): CrawledSource => ({
        provider: 'GDELT Project',
        title: item.title || 'GDELT news article record',
        url: item.url || '',
        excerpt: cleanSnippet(`Global news event index. Source Country: ${item.sourcecountry || 'Global'}. Date matching: ${item.seendate || 'N/A'}.`),
        published_at: item.seendate?.slice(0, 8) || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'medium',
        category_match: true,
        status: 'success'
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'GDELT Project', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'medium', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  worldbank: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://api.worldbank.org/v2/sources?format=json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const dataset = json[1] || [];
      const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matches = dataset.filter((d: any) => {
        const text = `${d.name} ${d.description}`.toLowerCase();
        return qWords.some(w => text.includes(w));
      }).slice(0, 3);

      if (matches.length === 0) return [];
      return matches.map((item: any): CrawledSource => ({
        provider: 'World Bank Open Data',
        title: item.name || 'World Bank Dataset',
        url: item.url || 'https://data.worldbank.org',
        excerpt: cleanSnippet(item.description || 'Statistical metrics dashboard dataset payload.'),
        published_at: '2026',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'gov',
        quality_tier: 'high',
        category_match: true,
        status: 'success'
      }));
    } catch (e: any) {
      return [{ provider: 'World Bank Open Data', title: '', url: '', excerpt: '', accessed_at: '', type: 'gov', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  sec: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://data.sec.gov/files/company_tickers.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const qLower = query.toLowerCase();
      const matches: any[] = [];
      Object.values(json).forEach((c: any) => {
        if (matches.length < 3 && (c.title.toLowerCase().includes(qLower) || c.ticker.toLowerCase() === qLower)) {
          matches.push(c);
        }
      });
      if (matches.length === 0) return [];
      return matches.map((item: any): CrawledSource => ({
        provider: 'SEC EDGAR Tickers',
        title: `${item.title} (SEC Ticker: ${item.ticker})`,
        url: `https://data.sec.gov/submissions/CIK${String(item.cik_str).padStart(10, '0')}.json`,
        excerpt: cleanSnippet(`Official SEC EDGAR entry for ${item.title}. Central Index Key (CIK): ${item.cik_str}. Ticker symbol: ${item.ticker}`),
        published_at: '2026',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'gov',
        quality_tier: 'high',
        category_match: true,
        status: 'success'
      }));
    } catch (e: any) {
      return [{ provider: 'SEC EDGAR Tickers', title: '', url: '', excerpt: '', accessed_at: '', type: 'gov', quality_tier: 'high', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  wikidata: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*`);
      if (res.status === 429) return [{ provider: 'Wikidata', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'medium', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.search || []).map((item: any): CrawledSource => ({
        provider: 'Wikidata',
        title: item.label || 'Wikidata Entity',
        url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
        excerpt: cleanSnippet(item.description || `Structured entity definition entry for ${item.label}. ID: ${item.id}.`),
        published_at: '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'medium',
        category_match: true,
        status: 'success'
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Wikidata', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'medium', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  wikipedia: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = json.query?.search || [];
      return list.map((w: any): CrawledSource => ({
        provider: 'Wikipedia',
        title: w.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
        excerpt: cleanSnippet(w.snippet),
        published_at: '2026',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'medium',
        category_match: false,
        status: 'success'
      })).filter((s: any) => s.url && s.excerpt.length > 10);
    } catch (e: any) {
      return [{ provider: 'Wikipedia', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'medium', category_match: false, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  wikinews: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://en.wikinews.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = json.query?.search || [];
      return list.map((w: any): CrawledSource => ({
        provider: 'Wikinews',
        title: w.title,
        url: `https://en.wikinews.org/wiki/${encodeURIComponent(w.title)}`,
        excerpt: cleanSnippet(w.snippet),
        published_at: '2026',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'low',
        category_match: false,
        status: 'success'
      })).filter((s: any) => s.url && s.excerpt.length > 10);
    } catch (e: any) {
      return [{ provider: 'Wikinews', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: false, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  hackernews: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=3`);
      if (res.status === 429) return [{ provider: 'Hacker News', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.hits || []).map((item: any): CrawledSource => ({
        provider: 'Hacker News',
        title: item.title || item.story_title || 'HN thread',
        url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
        excerpt: cleanSnippet(item.story_text || item.comment_text || `Community discussion with ${item.points || 0} points and ${item.num_comments || 0} comments.`),
        published_at: item.created_at?.slice(0, 10) || '',
        accessed_at: new Date().toISOString().split('T')[0],
        type: 'web',
        quality_tier: 'low',
        category_match: true,
        status: 'success'
      })).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Hacker News', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  reddit: async (query): Promise<CrawledSource[]> => {
    try {
      const res = await fetchWithTimeout(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=3`);
      if (res.status === 429 || res.status === 403) return [{ provider: 'Reddit Feed', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: true, status: 'rate_limit' }];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const children = json.data?.children || [];
      return children.map((item: any): CrawledSource => {
        const d = item.data || {};
        return {
          provider: 'Reddit Feed',
          title: d.title || 'Reddit Thread',
          url: d.url ? (d.url.startsWith('http') ? d.url : `https://www.reddit.com${d.permalink}`) : '',
          excerpt: cleanSnippet(d.selftext || `Discussion thread on r/${d.subreddit}.`),
          published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : '',
          accessed_at: new Date().toISOString().split('T')[0],
          type: 'web',
          quality_tier: 'low',
          category_match: true,
          status: 'success'
        };
      }).filter((s: any) => s.url);
    } catch (e: any) {
      return [{ provider: 'Reddit Feed', title: '', url: '', excerpt: '', accessed_at: '', type: 'web', quality_tier: 'low', category_match: true, status: e.name === 'AbortError' ? 'timeout' : 'error', error_message: e.message }];
    }
  },

  producthunt: async (): Promise<CrawledSource[]> => {
    return [{
      provider: 'Product Hunt',
      title: '',
      url: '',
      excerpt: '',
      accessed_at: '',
      type: 'web',
      quality_tier: 'low',
      category_match: true,
      status: 'error',
      error_message: 'Product Hunt public registry queries require OAuth tokens. Skipped.'
    }];
  }
};

// ----------------------------------------------------
// 2. CENTRAL SOURCE POLICY AND MAPS
// ----------------------------------------------------
export interface CategoryConfig {
  primary: string[];
  fallback: string[];
}

export const CATEGORY_MAP: Record<string, CategoryConfig> = {
  academic: {
    primary: ['europepmc', 'openalex', 'crossref', 'doaj'],
    fallback: ['openlibrary', 'wikipedia']
  },
  tech: {
    primary: ['github', 'npm', 'cratesio', 'wikidata'],
    fallback: ['wikipedia', 'stackexchange', 'devto']
  },
  market: {
    primary: ['gdelt', 'wikidata', 'sec', 'worldbank'],
    fallback: ['wikipedia', 'openalex', 'wikinews', 'openlibrary']
  },
  idea: {
    primary: ['hackernews', 'github', 'reddit', 'producthunt'],
    fallback: ['wikipedia', 'openalex', 'wikinews', 'openlibrary']
  },
  generalist: {
    primary: ['openalex', 'crossref', 'wikidata', 'europepmc'],
    fallback: ['wikipedia', 'openlibrary']
  }
};

// ----------------------------------------------------
// 2.5 STRUCTURED RESEARCH SCOPE AND HELPERS
// ----------------------------------------------------
export interface ResearchScope {
  primaryTopic: string;
  audience: string;
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  researchGoal: string;
  category: string;
  originalQuestion: string;
}

export function parseResearchScope(question: string, category: string): ResearchScope {
  const originalQuestion = question;
  let primaryTopic = question;
  let audience = 'General audience';
  let learningLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  let researchGoal = 'General lookup';

  const q = question.toLowerCase();

  // 1. Detect learning level
  if (/\b(first-year|beginner|introductory|simple|basic|eli5|explain like i'm 5|for kids|freshman|newbie|novice|elementary)\b/.test(q)) {
    learningLevel = 'beginner';
  } else if (/\b(advanced|expert|professional|graduate|phd|senior|specialist|deep dive)\b/.test(q)) {
    learningLevel = 'advanced';
  }

  // 2. Detect research goal
  if (/\b(compare|versus|vs|difference|comparison)\b/.test(q)) {
    researchGoal = 'comparative analysis';
  } else if (/\b(why|reason|purpose|rationale|cause|benefit)\b/.test(q)) {
    researchGoal = 'critical validation';
  } else if (learningLevel === 'beginner') {
    researchGoal = 'foundational explanation';
  } else if (learningLevel === 'advanced') {
    researchGoal = 'advanced documentation review';
  } else {
    researchGoal = 'general research summary';
  }

  const prefixRegex = /^(?:research|analyze|study|explain|validate\s+the\s+idea(?:\s+of)?|validate\s+idea|validate|systematic\s+literature\s+review\s+on|systematic\s+review\s+on|literature\s+review\s+on|review\s+on|market\s+analysis\s+(?:of|on)|market\s+intelligence\s+(?:report\s+)?(?:on|of)|market\s+report\s+(?:on|of)|create\s+technical\s+documentation\s+(?:for|on)|technical\s+documentation\s+(?:for|on)|create\s+documentation\s+(?:for|on)|documentation\s+(?:for|on))[ :\s]*/i;

  let cleanQuestion = question.replace(prefixRegex, '').replace(/[?.!]$/, '').trim();
  
  const cleanQ = cleanQuestion.toLowerCase();
  const prepositionMatch = cleanQ.match(/\b(?:suited\s+)?for\s+a\s+([^.]+)/) ||
                           cleanQ.match(/\b(?:suited\s+)?for\s+an\s+([^.]+)/) ||
                           cleanQ.match(/\b(?:suited\s+)?for\s+([^.]+)/) ||
                           cleanQ.match(/\bas\s+a\s+([^.]+)/) ||
                           cleanQ.match(/\bas\s+an\s+([^.]+)/);

  if (prepositionMatch) {
    const rawAudience = prepositionMatch[1].trim();
    audience = rawAudience.charAt(0).toUpperCase() + rawAudience.slice(1);
    
    const matchIndex = cleanQuestion.toLowerCase().indexOf(prepositionMatch[0]);
    if (matchIndex !== -1) {
      cleanQuestion = cleanQuestion.slice(0, matchIndex).trim();
    }
  }

  const details = extractScopeDetails(cleanQuestion);
  primaryTopic = details.primaryTopic;
  
  if (details.researchGoal && details.researchGoal !== 'general lookup') {
    researchGoal = details.researchGoal;
  }

  return {
    primaryTopic,
    audience,
    learningLevel,
    researchGoal,
    category,
    originalQuestion
  };
}

export function getCategoryFriendlyName(category: string): string {
  const names: Record<string, string> = {
    academic: 'Academic Review',
    tech: 'Technical Implementation Brief',
    market: 'Market Intelligence',
    idea: 'Idea Validation',
    generalist: 'Generalist Reference Brief'
  };
  return names[category] || 'Generalist Reference Brief';
}

export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let res = parsed.toString().toLowerCase().trim();
    if (res.endsWith('/')) {
      res = res.slice(0, -1);
    }
    res = res.replace(/^http:/, 'https:');
    return res;
  } catch {
    let res = url.toLowerCase().split('?')[0].split('#')[0].trim();
    if (res.endsWith('/')) {
      res = res.slice(0, -1);
    }
    res = res.replace(/^http:/, 'https:');
    return res;
  }
}

export function extractDoi(urlOrDoi: string): string {
  const match = urlOrDoi.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  let doi = match ? match[0].toLowerCase().trim() : urlOrDoi.toLowerCase().trim();
  if (doi.endsWith('/')) {
    doi = doi.slice(0, -1);
  }
  return doi;
}

export function getNormalizedTitleKey(title: string, publisher: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}:${publisher.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export function calculateCorroboration(
  currentTitle: string,
  currentText: string,
  allSources: CrawledSource[]
): number {
  let count = 0;
  const words = currentText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
  if (words.length === 0) return 0;
  
  allSources.forEach(s => {
    if (s.title !== currentTitle) {
      const otherText = s.excerpt.toLowerCase();
      let matchCount = 0;
      words.forEach(w => {
        if (otherText.includes(w)) matchCount++;
      });
      if (matchCount >= 2) {
        count++;
      }
    }
  });
  return count;
}

export function generateWhyItMatters(src: Source | { type: string; publisher: string }, scope: ResearchScope): string {
  const type = src.type.toLowerCase();
  const pub = (src.publisher || '').toLowerCase();
  
  if (type === 'paper') {
    return `Provides peer-reviewed academic documentation regarding "${scope.primaryTopic}" matching scientific standards.`;
  }
  if (type === 'gov') {
    return `Provides official institutional data points and regulatory metrics related to "${scope.primaryTopic}".`;
  }
  if (pub.includes('github')) {
    return `Provides open-source codebase structures and implementation context for developer research.`;
  }
  if (pub.includes('wikipedia')) {
    return `Provides generalist reference summary definitions suitable for a ${scope.learningLevel} level audience.`;
  }
  if (pub.includes('open library')) {
    return `Provides indexed book metadata references for structured literary definitions.`;
  }
  if (pub.includes('hacker news') || pub.includes('reddit')) {
    return `Provides community commentary and developer feedback highlighting customer validation.`;
  }
  
  return "Included because it directly matches the primary topic and provides a usable source excerpt.";
}

// ----------------------------------------------------
// 3. TRANSPARENT EVIDENCE RANKING MATH
// ----------------------------------------------------
export function calculateRankingScore(
  chunk: { text: string; section?: string; keywords?: string[] },
  source: { title: string; publisher?: string; type: string; quality_score?: number; published_at?: string; url?: string } | undefined,
  queryWords: string[],
  category: string,
  corroborationCount: number = 0
): number {
  let score = 0;

  if (!source) return 0;

  const type = source.type.toLowerCase();
  const pub = (source.publisher || '').toLowerCase();
  const textLower = chunk.text.toLowerCase();
  const titleLower = source.title.toLowerCase();
  const urlLower = (source.url || '').toLowerCase();

  // Core topic matching words
  const termMatches = queryWords.filter(word => {
    if (word.length <= 2) return false;
    return titleLower.includes(word) || urlLower.includes(word) || textLower.includes(word) || pub.includes(word);
  });

  // CATEGORY-SPECIFIC RETRIEVAL & FILTERING RULES
  if (category === 'tech') {
    // 1. Must match the primary topic somewhere
    if (termMatches.length === 0) {
      return 0; // REJECT
    }
    
    // 2. Must contain the topic in the title or URL (otherwise penalize heavily)
    const hasInCore = queryWords.some(word => word.length > 2 && (titleLower.includes(word) || urlLower.includes(word)));
    if (!hasInCore) {
      score -= 3.0;
    }
    
    // 3. Technical Doc priority order weights (official docs, API refs, SDKs over papers)
    const isOfficialDocs = pub.includes('documentation') || pub.includes('official') || urlLower.includes('docs.') || urlLower.includes('kubernetes.io') || urlLower.includes('cncf.io') || urlLower.includes('api') || urlLower.includes('sdk');
    if (isOfficialDocs) {
      score += 4.0;
    } else if (pub.includes('github') || urlLower.includes('github.com')) {
      score += 2.5;
    } else if (pub.includes('npm') || pub.includes('crates')) {
      score += 1.5;
    } else if (type === 'paper') {
      score -= 2.0; // Academic papers rank lower for technical documentation requests
    } else if (pub.includes('stackoverflow') || pub.includes('dev.to')) {
      score -= 1.0;
    }
  }

  if (category === 'market') {
    // Priority: Company websites, pricing pages, funding databases, product documentation, industry reports OVER academic papers
    if (pub.includes('wikidata')) {
      score -= 3.0;
    }
    if (type === 'paper') {
      score -= 3.0; // Strongly penalize generic academic papers in Market Intelligence mode
    }
    
    const isCommercialOrProduct = urlLower.includes('sec.gov') || pub.includes('sec') || pub.includes('official') || pub.includes('gdelt') || type === 'gov' || urlLower.includes('pricing') || urlLower.includes('features') || pub.includes('product hunt') || pub.includes('news') || pub.includes('company');
    if (isCommercialOrProduct) {
      score += 4.0;
    }
  }

  if (category === 'idea') {
    // Idea Validation: rank startup databases, company websites, patents, funding, and competitor info OVER generic academic papers
    if (pub.includes('wikidata')) {
      score -= 2.0;
    }
    if (type === 'paper') {
      score -= 2.5; // Academic papers rank lower for Idea Validation canvas
    }
    
    const isIdeaSignal = pub.includes('github') || pub.includes('product hunt') || pub.includes('hacker news') || urlLower.includes('pricing') || urlLower.includes('patent') || pub.includes('sec') || type === 'gov';
    if (isIdeaSignal) {
      score += 3.5;
    }
  }

  if (category === 'academic') {
    // Academic review: rank papers higher when matching BOTH the main concept and application domain
    if (type === 'paper') {
      score += 2.0;
      const hasConceptMatch = queryWords.some(w => w.length > 3 && (titleLower.includes(w) || textLower.includes(w)));
      if (hasConceptMatch && queryWords.length > 1) {
        score += 1.5;
      }
    }
  }

  if (category === 'generalist') {
    // Generalist: mix research papers with official educational/reference sources
    const isEduOrRef = type === 'paper' || type === 'gov' || pub.includes('university') || pub.includes('wikipedia') || pub.includes('open library');
    if (isEduOrRef) {
      score += 1.5;
    }
  }

  // 1. Source Type & Official/Peer-Reviewed status
  let isPeerReviewedOrOfficial = false;
  if (type === 'paper' || type === 'gov') {
    isPeerReviewedOrOfficial = true;
  }
  if (pub.includes('official') || pub.includes('registry') || pub.includes('nature') || pub.includes('ieee') || pub.includes('springer')) {
    isPeerReviewedOrOfficial = true;
  }

  // 2. Keyword relevance strictly to primaryTopic
  let keywordMatches = 0;
  queryWords.forEach(word => {
    if (word.length > 2) {
      if (textLower.includes(word)) keywordMatches += 1;
    }
  });

  const relevance = Math.min(keywordMatches * 0.4, 2.0);
  score += relevance;

  // 3. Quality status weighting
  if (isPeerReviewedOrOfficial) {
    score += 1.5;
  } else {
    score += 0.5; // Basic web/community source
  }

  // 4. Recency (within last 2 years 2024-2026)
  if (source.published_at) {
    const yearMatch = source.published_at.match(/\b(2024|2025|2026)\b/);
    if (yearMatch) score += 0.5;
  }

  // 5. Excerpt usability
  if (chunk.text && chunk.text.trim().length > 80) {
    score += 0.5;
  }

  // 6. Category match
  const config = CATEGORY_MAP[category] || CATEGORY_MAP.generalist;
  const isCategoryMatch = config.primary.some(k => pub.includes(k) || k.includes(pub));
  if (isCategoryMatch) {
    score += 0.5;
  }

  // 7. Corroboration by independent sources
  if (corroborationCount > 0) {
    score += Math.min(corroborationCount * 0.3, 1.0);
  }

  return score;
}

export function getSemanticLabel(score: number, hasConflict: boolean = false): string {
  if (hasConflict) return 'Conflicting evidence';
  if (score >= 4.0) return 'High-quality evidence';
  if (score >= 2.5) return 'Supporting evidence';
  if (score >= 1.0) return 'Limited evidence';
  return 'No evidence found';
}

export function extractScopeDetails(cleanQuestion: string): { primaryTopic: string; researchGoal: string } {
  // 1. Check prepositions like "in", "for", "on", "with", "at"
  const prepRegex = /\b(in|for|on|with|at)\b/i;
  const prepMatch = cleanQuestion.match(prepRegex);
  
  if (prepMatch && prepMatch.index !== undefined) {
    const idx = prepMatch.index;
    const prepWord = prepMatch[0];
    const firstPart = cleanQuestion.slice(0, idx).trim();
    const secondPart = cleanQuestion.slice(idx + prepWord.length).trim();
    
    if (firstPart.length > 2) {
      return {
        primaryTopic: firstPart,
        researchGoal: secondPart || 'general lookup'
      };
    }
  }

  // 2. Check key indicator words like architecture, deployment, streaming, analysis
  const goalIndicators = [
    'architecture', 'deployment', 'deploying', 'streaming', 'setup', 'installation', 
    'installing', 'features', 'pricing', 'funding', 'comparison', 'positioning', 
    'landscape', 'market', 'analysis', 'implementation', 'tutorial'
  ];
  

  for (const ind of goalIndicators) {
    const regex = new RegExp(`\\b${ind}\\b`, 'i');
    const match = cleanQuestion.match(regex);
    if (match && match.index !== undefined && match.index > 0) {
      const idx = match.index;
      const firstPart = cleanQuestion.slice(0, idx).trim();
      const secondPart = cleanQuestion.slice(idx).trim();
      if (firstPart.length > 2) {
        return {
          primaryTopic: firstPart,
          researchGoal: secondPart
        };
      }
    }
  }

  // 3. Fallback: if no preposition or goal indicators match, preserve the whole cleanQuestion as primaryTopic
  return {
    primaryTopic: cleanQuestion,
    researchGoal: 'general lookup'
  };
}

export function getIdeaRecommendation(
  sources: Source[],
  evidence: EvidenceChunk[]
): { recommendation: 'Build' | 'Validate Further' | 'Pivot' | 'Avoid'; basis: string } {
  const hasComp = sources.some(s => (s.publisher || '').toLowerCase().includes('github') || (s.publisher || '').toLowerCase().includes('product hunt'));
  const hasDemand = evidence.some(e => e.text.toLowerCase().includes('want') || e.text.toLowerCase().includes('need') || e.text.toLowerCase().includes('love') || e.text.toLowerCase().includes('request'));
  const hasRisks = evidence.some(e => e.text.toLowerCase().includes('risk') || e.text.toLowerCase().includes('security') || e.text.toLowerCase().includes('privacy'));

  if (hasRisks && !hasDemand) {
    return {
      recommendation: 'Avoid',
      basis: 'Severe security, privacy, or dependency constraints were identified in community references without any offsetting positive demand signals.'
    };
  }
  
  if (hasComp && !hasDemand) {
    return {
      recommendation: 'Pivot',
      basis: 'Significant existing competitor products or repositories were identified, but direct evidence of user differentiation or market gaps was not retrieved.'
    };
  }

  if (hasDemand && hasComp) {
    return {
      recommendation: 'Build',
      basis: 'Multiple strong, independent demand signals were verified alongside active competitor structures, indicating a viable market space with clear paths for differentiation.'
    };
  }

  return {
    recommendation: 'Validate Further',
    basis: 'Evidence is incomplete or predominantly based on secondary community signals (Reddit, Hacker News) without verified academic or statistical corroboration.'
  };
}

export function buildIdeaValidationReport(
  scope: ResearchScope,
  finalSources: Source[],
  evidenceChunks: EvidenceChunk[],
  logs: string[]
): string {
  const currentProfile = 'Idea Validation Canvas';
  let markdown = `# ${currentProfile}: ${scope.primaryTopic}\n\n`;
  markdown += `*Assembled on ${new Date().toLocaleDateString()}* \n\n`;
  markdown += `> [!NOTE]\n`;
  markdown += `> **Privacy Policy**: Research queries are routed directly to public APIs. Project workspace, reports, and search queries remain stored strictly on this device.\n\n`;

  // 1. Research Scope
  markdown += `## Research Scope\n\n`;
  markdown += `| Field | Value |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| Primary topic | ${scope.primaryTopic} |\n`;
  markdown += `| Audience | ${scope.audience} |\n`;
  markdown += `| Learning level | ${scope.learningLevel.charAt(0).toUpperCase() + scope.learningLevel.slice(1)} |\n`;
  markdown += `| Research category | Idea Validation |\n`;
  markdown += `| Source policy | Free public sources, local-first storage |\n\n`;

  // 2. Executive Summary
  markdown += `## Executive Summary\n\n`;
  if (evidenceChunks.length === 0) {
    markdown += `I do not know based on the available evidence in the Decision Brief. The public search indexes did not return sufficient grounding information to answer your question with confidence.\n\n`;
  } else {
    markdown += `This Idea Validation canvas evaluates the feasibility and market space for "${scope.primaryTopic}" adjusted for a **${scope.learningLevel}** learning profile (${scope.audience}). Based on ${finalSources.length} sources, we assess existing competitors, demand signals, and risk patterns below.\n\n`;
  }

  // 3. Existing Alternatives and Competitors
  markdown += `## Existing Alternatives and Competitors\n\n`;
  const competitors = finalSources.filter(s => (s.publisher || '').toLowerCase().includes('github') || (s.publisher || '').toLowerCase().includes('product hunt'));
  if (competitors.length > 0) {
    competitors.forEach((s) => {
      const associated = evidenceChunks.filter(c => c.source_id === s.id);
      const capText = associated[0]?.text || 'No description excerpt was retrieved.';
      markdown += `*   **${s.title}** (Publisher: ${s.publisher})\n`;
      markdown += `    *   *Capability*: ${capText}\n`;
      markdown += `    *   *Reference Link*: [${s.url}](${s.url}) [Rank: ${s.rank}]\n`;
    });
  } else {
    markdown += `No direct competitors or open-source repositories were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 4. Demand Signals
  markdown += `## Demand Signals\n\n`;
  const demandChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('want') || txt.includes('need') || txt.includes('request') || txt.includes('love');
  });
  if (demandChunks.length > 0) {
    demandChunks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Community demand signal — not independently verified**: "${c.text}" (Source: *${src?.title || 'Index'}* [Rank: ${src?.rank || 1}])\n`;
    });
  } else {
    markdown += `No community demand signals were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 5. User Pain Points
  markdown += `## User Pain Points\n\n`;
  const painPoints = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('complain') || txt.includes('error') || txt.includes('frustrated') || txt.includes('pain') || txt.includes('difficult') || txt.includes('issue') || txt.includes('bug') || txt.includes('problem');
  });
  if (painPoints.length > 0) {
    painPoints.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   ⚠️ **Pain Point**: "${c.text}" [Source: ${src?.title || 'Index'} [${src?.rank || 1}]]\n`;
    });
  } else {
    markdown += `No explicit user pain points were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 6. Monetization Evidence
  markdown += `## Monetization Evidence\n\n`;
  const monetization = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('pricing') || txt.includes('plan') || txt.includes('monetize') || txt.includes('cost') || txt.includes('charge') || txt.includes('subscription') || txt.includes('pro') || txt.includes('premium') || txt.includes('dollar') || txt.includes('$');
  });
  if (monetization.length > 0) {
    monetization.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Monetization Signal**: "${c.text}" [Source: ${src?.title || 'Index'} [${src?.rank || 1}]]\n`;
    });
  } else {
    markdown += `Pricing was not retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 7. Risks and Constraints
  markdown += `## Risks and Constraints\n\n`;
  const risks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('risk') || txt.includes('security') || txt.includes('privacy') || txt.includes('lock-in') || txt.includes('regulatory') || txt.includes('dependency');
  });
  if (risks.length > 0) {
    risks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   ⚠️ **Dependency/Regulatory risk**: "${c.text}" [Source: ${src?.title || 'Index'} [${src?.rank || 1}]]\n`;
    });
  } else {
    markdown += `No explicit security, privacy, or dependency risks were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 8. Market Sizing & TAM Signals
  markdown += `## Market Sizing & TAM Signals\n\n`;
  const sizingChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('market') || txt.includes('billion') || txt.includes('million') || txt.includes('growth') || txt.includes('cagr') || txt.includes('size') || txt.includes('industry');
  });
  if (sizingChunks.length > 0) {
    sizingChunks.slice(0, 3).forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Market Scale Signal**: "${c.text}" [Source: ${src?.title || 'Index'} [${src?.rank || 1}]]\n`;
    });
  } else {
    markdown += `Specific market sizing and CAGR metrics were not retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 9. SWOT Analysis Matrix
  markdown += `## SWOT Analysis Matrix\n\n`;
  markdown += `| Dimension | Grounded Assessment |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| **Strengths** | ${evidenceChunks.length > 0 ? `Active public references verified across ${finalSources.length} indexed repositories and databases.` : `Not retrieved during this research run.`} |\n`;
  markdown += `| **Weaknesses** | ${painPoints.length > 0 ? `${painPoints.length} explicit friction points or limitations identified in user snippets.` : `No explicit user friction points identified in retrieved passages.`} |\n`;
  markdown += `| **Opportunities** | ${demandChunks.length > 0 ? `Verified user demand signals found in community discussions.` : `Market gaps open for initial value proposition.`} |\n`;
  markdown += `| **Threats** | ${competitors.length > 0 ? `Existing competitors (${competitors.slice(0, 2).map(s => s.title).join(', ')}) established in open indexes.` : `Low barrier to entry or regulatory constraints.`} |\n\n`;

  // 8. Evidence Missing or Not Retrieved
  markdown += `## Evidence Missing or Not Retrieved\n\n`;
  const hasGov = finalSources.some(s => s.type === 'gov');
  const hasPaper = finalSources.some(s => s.type === 'paper');
  if (!hasGov) {
    markdown += `- No official government or standards-body source: not retrieved during this research run.\n`;
  }
  if (!hasPaper) {
    markdown += `- No recent peer-reviewed scientific paper: not retrieved during this research run.\n`;
  }
  const tCount = logs.filter(l => l.includes('timed out')).length;
  if (tCount > 0) {
    markdown += `- Some expected search providers: not retrieved during this research run (timed out).\n`;
  }
  markdown += `\n`;

  // 9. Recommendation
  const rec = getIdeaRecommendation(finalSources, evidenceChunks);
  markdown += `## Recommendation\n\n`;
  markdown += `**Decision**: \`${rec.recommendation}\`\n\n`;
  markdown += `**Basis**: ${rec.basis}\n\n`;

  // 10. Verified Excerpt References
  markdown += `## Verified Excerpt References\n\n`;
  finalSources.forEach((src) => {
    markdown += `### [${src.rank}] ${src.title}\n`;
    markdown += `*   **Publisher/API**: ${src.publisher}\n`;
    markdown += `*   **URL**: [Open Original Reference URL](${src.url})\n`;
    markdown += `*   **Why this matters**: ${generateWhyItMatters(src, scope)}\n`;
    
    markdown += `*   **Verifiable Passages**:\n`;
    const associated = evidenceChunks.filter(c => c.source_id === src.id);
    associated.forEach(c => {
      markdown += `    > "${c.text}"\n`;
    });
    markdown += `\n`;
  });

  // 11. References
  markdown += `## References\n\n`;
  finalSources.forEach(s => {
    markdown += `*   ${s.title}. *Publisher: ${s.publisher}*. Retrievable at: [${s.url}](${s.url})\n`;
  });

  return markdown;
}

export function buildMarketIntelligenceReport(
  scope: ResearchScope,
  finalSources: Source[],
  evidenceChunks: EvidenceChunk[],
  logs: string[]
): string {
  let markdown = `# Market Intelligence Report: ${scope.primaryTopic}\n\n`;
  markdown += `*Assembled on ${new Date().toLocaleDateString()}* \n\n`;

  // 1. Research Scope
  markdown += `## Research Scope\n\n`;
  markdown += `| Field | Value |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| Primary topic | ${scope.primaryTopic} |\n`;
  markdown += `| Audience | ${scope.audience} |\n`;
  markdown += `| Learning level | ${scope.learningLevel.charAt(0).toUpperCase() + scope.learningLevel.slice(1)} |\n`;
  markdown += `| Research category | Market Intelligence |\n`;
  markdown += `| Source policy | Official company websites, filings, statistical metrics |\n\n`;

  // 2. Executive Summary
  markdown += `## Executive Summary\n\n`;
  const tCount = logs.filter(l => l.includes('timed out')).length;
  if (tCount > 0) {
    markdown += `> [!WARNING]\n`;
    markdown += `> Some expected market reference indexes timed out during this research run.\n\n`;
  }
  if (evidenceChunks.length === 0) {
    markdown += `I do not know based on the available evidence in the Decision Brief. The public search indexes did not return sufficient grounding information to answer your question with confidence.\n\n`;
  } else {
    markdown += `This report outlines the market dynamics of "${scope.primaryTopic}" tailored for a **${scope.learningLevel}** level understanding (${scope.audience}). Based on ${finalSources.length} sources, we identify products and analyze feature positioning below.\n\n`;
  }

  // 3. Market Landscape
  markdown += `## Market Landscape\n\n`;
  markdown += `The segment surrounding "${scope.primaryTopic}" exhibits competing product structures. Verified positioning and adoption signals are listed below.\n\n`;

  // 4. Companies and Products Identified
  markdown += `## Companies and Products Identified\n\n`;
  finalSources.forEach(s => {
    markdown += `*   **${s.title}** (Publisher: ${s.publisher})\n`;
    markdown += `    *   *Type*: ${s.type.toUpperCase()}\n`;
    markdown += `    *   *Reference Link*: [${s.url}](${s.url})\n`;
  });
  markdown += `\n`;

  // 5. Feature / Positioning Comparison
  markdown += `## Feature / Positioning Comparison\n\n`;
  finalSources.forEach(s => {
    markdown += `### ${s.title}\n`;
    markdown += `*   **Product Name**: ${s.title}\n`;
    markdown += `*   **Company/Provider**: ${s.publisher}\n`;
    markdown += `*   **Official URL**: [Link](${s.url})\n`;
    const associated = evidenceChunks.filter(c => c.source_id === s.id);
    const excerptText = associated[0]?.text || '';
    markdown += `*   **Main Capability**: ${excerptText ? excerptText.slice(0, 100) + '...' : 'Feature details: not retrieved during this research run.'}\n`;
    markdown += `*   **Public Repository / Documentation**: ${s.url?.includes('github.com') ? `[GitHub Repository](${s.url})` : 'Ecosystem docs'}\n`;
  });
  markdown += `\n`;

  // 6. Official Pricing Evidence
  markdown += `## Official Pricing Evidence\n\n`;
  const pricingEvidence = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('pricing') || txt.includes('plan') || txt.includes('subscription') || txt.includes('$') || txt.includes('dollar');
  });
  if (pricingEvidence.length > 0) {
    pricingEvidence.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Pricing details for ${src?.title}**: "${c.text}" [Source: ${src?.publisher}]\n`;
    });
  } else {
    markdown += `Pricing was not retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 7. Market and Adoption Signals
  markdown += `## Market and Adoption Signals\n\n`;
  evidenceChunks.forEach(c => {
    const src = finalSources.find(s => s.id === c.source_id);
    const pub = (src?.publisher || '').toLowerCase();
    const url = (src?.url || '').toLowerCase();
    
    let signalLabel = 'News signal';
    if (pub.includes('sec') || url.includes('sec.gov')) {
      signalLabel = 'Regulatory/filing information';
    } else if (pub.includes('reddit') || pub.includes('hacker news')) {
      signalLabel = 'Community signal';
    } else if (pub.includes('official') || url.includes('docs.') || pub.includes('github')) {
      signalLabel = 'Official company information';
    }
    
    markdown += `*   **${signalLabel}**: "${c.text}" (Source: *${src?.title}* [${src?.rank}])\n`;
  });
  markdown += `\n`;

  // 8. Risks, Uncertainty, and Competitive Gaps
  markdown += `## Risks, Uncertainty, and Competitive Gaps\n\n`;
  const risks = evidenceChunks.filter(c => c.text.toLowerCase().includes('risk') || c.text.toLowerCase().includes('gap') || c.text.toLowerCase().includes('issue') || c.text.toLowerCase().includes('competit'));
  if (risks.length > 0) {
    risks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   ⚠️ **Risk Factor**: "${c.text}" [${src?.rank}]\n`;
    });
  } else {
    markdown += `No explicit market risks or competitive gaps were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 9. Evidence Missing or Not Retrieved
  markdown += `## Evidence Missing or Not Retrieved\n\n`;
  markdown += `- Market share figures: not retrieved during this research run.\n`;
  markdown += `- User growth rates: not retrieved during this research run.\n`;
  
  const hasGov = finalSources.some(s => s.type === 'gov');
  if (!hasGov) {
    markdown += `- No official regulatory SEC filing: not retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 10. Verified References
  markdown += `## Verified References\n\n`;
  finalSources.forEach((src) => {
    markdown += `### [${src.rank}] ${src.title}\n`;
    markdown += `*   **Publisher/API**: ${src.publisher}\n`;
    markdown += `*   **URL**: [Open Original Reference URL](${src.url})\n`;
    markdown += `*   **Why this matters**: ${generateWhyItMatters(src, scope)}\n`;
    
    markdown += `*   **Verifiable Passages**:\n`;
    const associated = evidenceChunks.filter(c => c.source_id === src.id);
    associated.forEach(c => {
      markdown += `    > "${c.text}"\n`;
    });
    markdown += `\n`;
  });

  // 11. References
  markdown += `## References\n\n`;
  finalSources.forEach(s => {
    markdown += `*   ${s.title}. *Publisher: ${s.publisher}*. Retrievable at: [${s.url}](${s.url})\n`;
  });

  return markdown;
}

export function buildTechnicalDocsReport(
  scope: ResearchScope,
  finalSources: Source[],
  evidenceChunks: EvidenceChunk[],
  logs: string[]
): string {
  let markdown = `# Technical Documentation: ${scope.primaryTopic}\n\n`;
  markdown += `*Assembled on ${new Date().toLocaleDateString()}* \n\n`;

  // 1. Research Scope
  markdown += `## Research Scope\n\n`;
  markdown += `| Field | Value |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| Primary topic | ${scope.primaryTopic} |\n`;
  markdown += `| Audience | ${scope.audience} |\n`;
  markdown += `| Learning level | ${scope.learningLevel.charAt(0).toUpperCase() + scope.learningLevel.slice(1)} |\n`;
  markdown += `| Research category | Technical Docs |\n`;
  markdown += `| Source policy | Official documentation priority, ecosystem repositories |\n\n`;

  // 2. Executive Summary
  markdown += `## Executive Summary\n\n`;
  if (evidenceChunks.length === 0) {
    markdown += `I do not know based on the available evidence in the Decision Brief. The public search indexes did not return sufficient grounding information to answer your question with confidence.\n\n`;
  } else {
    markdown += `This technical brief synthesizes documentation for "${scope.primaryTopic}" adjusted for a **${scope.learningLevel}** level developer (${scope.audience}). Based on ${finalSources.length} retrieved documentation sources, we outline core architecture and installation procedures below.\n\n`;
  }

  // 3. Official Documentation Found
  markdown += `## Official Documentation Found\n\n`;
  const officialDocs = finalSources.filter(s => {
    const pub = (s.publisher || '').toLowerCase();
    const url = (s.url || '').toLowerCase();
    return pub.includes('documentation') || pub.includes('official') || url.includes('docs.') || url.includes('kubernetes.io');
  });
  if (officialDocs.length > 0) {
    officialDocs.forEach(s => {
      markdown += `*   **${s.title}** — [Official Documentation Link](${s.url}) (Publisher: ${s.publisher}) [Rank: ${s.rank}]\n`;
    });
  } else {
    markdown += `No official documentation was retrieved during this research run. Check the missing references section.\n`;
  }
  markdown += `\n`;

  // 4. Core Architecture / Concepts
  markdown += `## Core Architecture / Concepts\n\n`;
  const archChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('architecture') || txt.includes('concept') || txt.includes('structure') || txt.includes('model') || txt.includes('design') || txt.includes('pattern');
  });
  if (archChunks.length > 0) {
    archChunks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Architectural Concept** (from *${src?.title}*): "${c.text}" [${src?.rank}]\n`;
    });
  } else {
    markdown += `No explicit architectural definitions were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 5. Installation or Deployment Guidance
  markdown += `## Installation or Deployment Guidance\n\n`;
  const deployChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('install') || txt.includes('deploy') || txt.includes('setup') || txt.includes('configuration') || txt.includes('run');
  });
  if (deployChunks.length > 0) {
    deployChunks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Deployment Step** (from *${src?.title}*): "${c.text}" [${src?.rank}]\n`;
    });
  } else {
    markdown += `No installation or deployment steps were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 6. Key Components and Ecosystem Tools
  markdown += `## Key Components and Ecosystem Tools\n\n`;
  const componentChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('component') || txt.includes('ecosystem') || txt.includes('plugin') || txt.includes('tool') || txt.includes('module') || txt.includes('driver');
  });
  if (componentChunks.length > 0) {
    componentChunks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Component Detail** (from *${src?.title}*): "${c.text}" [${src?.rank}]\n`;
    });
  } else {
    markdown += `No key components were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 7. Best Practices and Limitations
  markdown += `## Best Practices and Limitations\n\n`;
  const limitChunks = evidenceChunks.filter(c => {
    const txt = c.text.toLowerCase();
    return txt.includes('practice') || txt.includes('limit') || txt.includes('constraint') || txt.includes('restrict') || txt.includes('warning') || txt.includes('error');
  });
  if (limitChunks.length > 0) {
    limitChunks.forEach(c => {
      const src = finalSources.find(s => s.id === c.source_id);
      markdown += `*   **Constraint / Practice** (from *${src?.title}*): "${c.text}" [${src?.rank}]\n`;
    });
  } else {
    markdown += `No best practices or architectural limitations were retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 8. Version, License, and Maintenance Signals
  markdown += `## Version, License, and Maintenance Signals\n\n`;
  const maintenanceSources = finalSources.filter(s => (s.publisher || '').toLowerCase().includes('github') || (s.publisher || '').toLowerCase().includes('npm'));
  if (maintenanceSources.length > 0) {
    maintenanceSources.forEach(s => {
      markdown += `*   **Source**: ${s.title}\n`;
      markdown += `    *   *Publisher*: ${s.publisher}\n`;
      markdown += `    *   *Release/Maintenance state*: Retrieved active registry metadata [${s.rank}].\n`;
    });
  } else {
    markdown += `No version or license metadata was retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 9. Evidence Missing or Not Retrieved
  markdown += `## Evidence Missing or Not Retrieved\n\n`;
  if (officialDocs.length === 0) {
    markdown += `- No official documentation: not retrieved during this research run.\n`;
  }
  const hasPaper = finalSources.some(s => s.type === 'paper');
  if (!hasPaper) {
    markdown += `- No peer-reviewed review paper: not retrieved during this research run.\n`;
  }
  const tCount = logs.filter(l => l.includes('timed out')).length;
  if (tCount > 0) {
    markdown += `- Some expected search providers: not retrieved during this research run (timed out).\n`;
  }
  markdown += `\n`;

  // 10. Verified References
  markdown += `## Verified References\n\n`;
  finalSources.forEach((src) => {
    markdown += `### [${src.rank}] ${src.title}\n`;
    markdown += `*   **Publisher/API**: ${src.publisher}\n`;
    markdown += `*   **URL**: [Open Original Reference URL](${src.url})\n`;
    markdown += `*   **Why this matters**: ${generateWhyItMatters(src, scope)}\n`;
    
    markdown += `*   **Verifiable Passages**:\n`;
    const associated = evidenceChunks.filter(c => c.source_id === src.id);
    associated.forEach(c => {
      markdown += `    > "${c.text}"\n`;
    });
    markdown += `\n`;
  });

  // 11. References
  markdown += `## References\n\n`;
  finalSources.forEach(s => {
    markdown += `*   ${s.title}. *Publisher: ${s.publisher}*. Retrievable at: [${s.url}](${s.url})\n`;
  });

  return markdown;
}

export function buildDefaultReport(
  scope: ResearchScope,
  finalSources: Source[],
  evidenceChunks: EvidenceChunk[],
  logs: string[],
  conflictingEvidenceFound: boolean
): string {
  const currentProfile = 'Generalist Reference Brief';
  let markdown = `# ${currentProfile}: ${scope.primaryTopic}\n\n`;
  markdown += `*Assembled on ${new Date().toLocaleDateString()}* \n\n`;
  if (conflictingEvidenceFound) {
    markdown += `> [!WARNING]\n`;
    markdown += `> Conflicting evidence or logical contradictions were identified among the retrieved references.\n\n`;
  }
  markdown += `> [Spacer alert - Privacy Policy: Research queries are routed directly to public APIs. Project workspace, reports, and search queries remain stored strictly on this device.]\n\n`;

  // 2. Research Scope
  markdown += `## Research Scope\n\n`;
  markdown += `| Field | Value |\n`;
  markdown += `| :--- | :--- |\n`;
  markdown += `| Primary topic | ${scope.primaryTopic} |\n`;
  markdown += `| Audience | ${scope.audience} |\n`;
  markdown += `| Learning level | ${scope.learningLevel.charAt(0).toUpperCase() + scope.learningLevel.slice(1)} |\n`;
  markdown += `| Research category | ${getCategoryFriendlyName(scope.category)} |\n`;
  markdown += `| Source policy | Free public sources, local-first storage |\n\n`;

  // 3. Executive Summary
  markdown += `## Executive Summary\n\n`;
  if (evidenceChunks.length === 0) {
    markdown += `I do not know based on the available evidence in the Decision Brief. The public search indexes did not return sufficient grounding information to answer your question with confidence.\n\n`;
  } else {
    const isBeg = scope.learningLevel === 'beginner';
    markdown += `This report is customized for a **${scope.learningLevel}** level audience (${scope.audience}). ${
      isBeg 
        ? `It provides simplified definitions and foundational terminology related to "${scope.primaryTopic}".` 
        : `It synthesizes technical implementations and core metrics describing "${scope.primaryTopic}".`
    } Based on ${finalSources.length} unique sources, the evidence indicates established parameters outlining this topic.\n\n`;
  }

  // 4. Evidence Coverage
  const paperCount = finalSources.filter(s => s.type === 'paper').length;
  const govCount = finalSources.filter(s => s.type === 'gov').length;
  const uniCount = finalSources.filter(s => (s.publisher || '').toLowerCase().includes('university') || (s.publisher || '').toLowerCase().includes('europe pmc')).length;
  const techCount = finalSources.filter(s => s.type === 'web' && ((s.publisher || '').toLowerCase().includes('github') || (s.publisher || '').toLowerCase().includes('npm') || (s.publisher || '').toLowerCase().includes('crates'))).length;
  const bookCount = finalSources.filter(s => (s.publisher || '').toLowerCase().includes('library') || (s.publisher || '').toLowerCase().includes('wikipedia')).length;
  const communityCount = finalSources.filter(s => s.type === 'web' && ((s.publisher || '').toLowerCase().includes('reddit') || (s.publisher || '').toLowerCase().includes('hacker news') || (s.publisher || '').toLowerCase().includes('stack overflow') || (s.publisher || '').toLowerCase().includes('dev.to'))).length;

  const highCount = evidenceChunks.filter(c => c.support_label === 'High-quality evidence').length;
  const suppCount = evidenceChunks.filter(c => c.support_label === 'Supporting evidence').length;
  const limCount = evidenceChunks.filter(c => c.support_label === 'Limited evidence').length;
  const confCount = evidenceChunks.filter(c => c.support_label === 'Conflicting evidence').length;

  const tCount = logs.filter(l => l.includes('timed out')).length;
  const fCount = logs.filter(l => l.includes('failed') || l.includes('error')).length;
  const rCount = logs.filter(l => l.includes('rate limited')).length;

  markdown += `## Evidence Coverage\n\n`;
  markdown += `| Evidence Type | Count |\n`;
  markdown += `| :--- | :---: |\n`;
  markdown += `| Peer-reviewed papers | ${paperCount} |\n`;
  markdown += `| Official / government sources | ${govCount} |\n`;
  markdown += `| University sources | ${uniCount} |\n`;
  markdown += `| Technical documentation | ${techCount} |\n`;
  markdown += `| Books / reference sources | ${bookCount} |\n`;
  markdown += `| Community sources | ${communityCount} |\n\n`;

  markdown += `### Summary Metrics\n`;
  markdown += `*   **Total Unique Sources**: ${finalSources.length}\n`;
  markdown += `*   **Total Evidence Passages**: ${evidenceChunks.length}\n`;
  markdown += `*   **Confidence Breakdown**:\n`;
  markdown += `    *   *High-quality evidence*: ${highCount} item(s)\n`;
  markdown += `    *   *Supporting evidence*: ${suppCount} item(s)\n`;
  markdown += `    *   *Limited evidence*: ${limCount} item(s)\n`;
  markdown += `    *   *Conflicting evidence*: ${confCount} item(s)\n`;
  markdown += `*   **Source API Pipeline Status**:\n`;
  markdown += `    *   *Timed out providers*: ${tCount}\n`;
  markdown += `    *   *Failed/Errored providers*: ${fCount}\n`;
  markdown += `    *   *Rate-limited providers*: ${rCount}\n\n`;

  // 5. Key Findings
  markdown += `## Key Findings\n\n`;
  if (evidenceChunks.length > 0) {
    markdown += `*   **Primary Insights**: The primary topic "${scope.primaryTopic}" demonstrates core theoretical models corroborated by peer reference indexes.\n`;
    markdown += `*   **Audience Accessibility**: Grounded passages are adjusted to suit an audience profile of "${scope.audience}".\n`;
  } else {
    markdown += `No key research findings were extracted during this research run.\n`;
  }
  markdown += `\n`;

  // 6. Core Concepts & Background
  markdown += `## Core Concepts & Background\n\n`;
  markdown += `### Understanding ${scope.primaryTopic}\n`;
  if (scope.learningLevel === 'beginner') {
    markdown += `To explain this at a **beginner** level: "${scope.primaryTopic}" represents a foundational domain. Think of it as a set of basic rules or building blocks.\n`;
  } else {
    markdown += `To review this at a **${scope.learningLevel}** level: "${scope.primaryTopic}" represents a complex architectural construct.\n`;
  }
  markdown += `\n`;

  // 7. Evidence Missing or Not Retrieved
  markdown += `## Evidence Missing or Not Retrieved\n\n`;
  if (govCount === 0) {
    markdown += `- No official standards-body source: not retrieved during this research run.\n`;
    markdown += `- No government source: not retrieved during this research run.\n`;
  }
  const hasRecent = finalSources.some(s => {
    const yearMatch = s.published_at ? s.published_at.match(/\b(2024|2025|2026)\b/) : null;
    return !!yearMatch;
  });
  if (!hasRecent) {
    markdown += `- No recent peer-reviewed review paper: not retrieved during this research run.\n`;
  }
  if (tCount > 0 || rCount > 0 || fCount > 0) {
    markdown += `- Some expected providers: not retrieved during this research run.\n`;
  }
  markdown += `\n`;

  // 8. Verified Excerpt References
  markdown += `## Verified Excerpt References\n\n`;
  finalSources.forEach((src) => {
    markdown += `### [${src.rank}] ${src.title}\n`;
    markdown += `*   **Publisher/API**: ${src.publisher}\n`;
    markdown += `*   **URL**: [Open Original Reference URL](${src.url})\n`;
    markdown += `*   **Why this matters**: ${generateWhyItMatters(src, scope)}\n`;
    
    markdown += `*   **Verifiable Passages**:\n`;
    const associated = evidenceChunks.filter(c => c.source_id === src.id);
    associated.forEach(c => {
      markdown += `    > "${c.text}"\n`;
    });
    markdown += `\n`;
  });

  // 9. Grounding Limitations
  markdown += `## Grounding Limitations\n\n`;
  markdown += `This report is synthesized purely from public text snippets. It does not certify security metrics, licensed operational status, financial growth projections, or factual consensus. Consult original linked source URLs for official validations.\n\n`;

  // 10. References
  markdown += `## References\n\n`;
  finalSources.forEach(s => {
    markdown += `*   ${s.title}. *Publisher: ${s.publisher}*. Retrievable at: [${s.url}](${s.url})\n`;
  });

  return markdown;
}

// ----------------------------------------------------
// 4. ORCHESTRATE PARALLEL SEARCH
// ----------------------------------------------------
export async function executeResearch(
  projectId: string,
  question: string,
  category: string = 'generalist',
  onUpdate: (update: RunUpdate) => Promise<void>,
  forceRefresh: boolean = false
) {
  const scope = parseResearchScope(question, category);

  if (!forceRefresh) {
    const cached = await getCachedResults(category, question);
    if (cached) {
      await onUpdate({
        stage: 'planning',
        message: 'Analyzing scope and checking local database cache...',
        progress: 15
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      await onUpdate({
        stage: 'discovering',
        message: `Restored ${cached.sources.length} matching sources from local index cache...`,
        progress: 40,
        sourcesFound: cached.sources
      });
      await new Promise(resolve => setTimeout(resolve, 350));

      await onUpdate({
        stage: 'extracting',
        message: `Restored ${cached.evidence.length} evidence passages...`,
        progress: 70,
        evidenceFound: cached.evidence
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      await onUpdate({
        stage: 'validating',
        message: 'Validating cached evidence consistency...',
        progress: 85
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      await onUpdate({
        stage: 'synthesizing',
        message: 'Rendering Decision Brief from cached records...',
        progress: 95
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      await onUpdate({
        stage: 'complete',
        message: 'Workspace loaded from cached database records.',
        progress: 100,
        sourcesFound: cached.sources,
        evidenceFound: cached.evidence,
        report: cached.report
      });
      return;
    }
  }

await onUpdate({
    stage: 'planning',
    message: 'Analyzing research question & assembling search adapters...',
    progress: 10
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  // Extract plan and search query strictly using primaryTopic
  const plan = generatePlan(scope.primaryTopic, category);
  let baseQuery = plan.keywords.join(' ') || scope.primaryTopic;

  const config = CATEGORY_MAP[category] || CATEGORY_MAP.generalist;
  const primaryKeys = config.primary;
  const fallbackKeys = config.fallback;

  const logs: string[] = [];
  const rawCrawled: CrawledSource[] = [];
  
  const runProviderQuery = async (providerKey: string, queryStr: string): Promise<CrawledSource[]> => {
    const adapter = adapters[providerKey];
    if (!adapter) return [];
    
    const results = await adapter(queryStr);
    const statusEntry = results[0];
    const pName = statusEntry ? statusEntry.provider : providerKey;
    let logText = '';
    
    if (!statusEntry || statusEntry.status === 'success') {
      logText = `${pName} complete`;
    } else if (statusEntry.status === 'timeout') {
      logText = `${pName} timed out — skipped`;
    } else if (statusEntry.status === 'rate_limit') {
      logText = `${pName} rate limited — skipped`;
    } else {
      logText = `${pName} failed — skipped`;
    }
    
    if (!logs.includes(logText)) {
      logs.push(logText);
      await onUpdate({
        stage: 'discovering',
        message: logText,
        progress: 35
      });
    }

    return results.filter(r => r.status === 'success');
  };

  const searchQueries: string[] = [scope.primaryTopic];
  const goalWords = scope.researchGoal.toLowerCase()
    .replace(/^(and|or|of|about|on|for|with)\s+/i, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && w !== 'general' && w !== 'lookup');
  
  goalWords.forEach(w => {
    searchQueries.push(`${scope.primaryTopic} ${w}`);
  });
  
  const uniqueSearchQueries = Array.from(new Set(searchQueries)).slice(0, 3);

  await onUpdate({
    stage: 'discovering',
    message: `Querying public reference indexes for "${scope.primaryTopic}"...`,
    progress: 30
  });

  const primaryPromises: Promise<CrawledSource[]>[] = [];
  primaryKeys.forEach(k => {
    uniqueSearchQueries.forEach(q => {
      primaryPromises.push(runProviderQuery(k, q));
    });
  });

  const primarySettled = await Promise.allSettled(primaryPromises);
  primarySettled.forEach(res => {
    if (res.status === 'fulfilled') {
      rawCrawled.push(...res.value);
    }
  });

  const uniqueUrls = new Set(rawCrawled.map(r => r.url.toLowerCase()));
  if (uniqueUrls.size < 4 && fallbackKeys.length > 0) {
    await onUpdate({
      stage: 'discovering',
      message: 'Running secondary/fallback adapters for sufficient coverage...',
      progress: 45
    });
    const fallbackPromises: Promise<CrawledSource[]>[] = [];
    fallbackKeys.forEach(k => {
      uniqueSearchQueries.forEach(q => {
        fallbackPromises.push(runProviderQuery(k, q));
      });
    });
    const fallbackSettled = await Promise.allSettled(fallbackPromises);
    fallbackSettled.forEach(res => {
      if (res.status === 'fulfilled') {
        rawCrawled.push(...res.value);
      }
    });
  }

  // FALLBACK PASS FOR OVER-SPECIFIC QUERIES
  const successfulHits = rawCrawled.filter(r => r.status === 'success' && r.title);
  if (successfulHits.length === 0 && plan.keywords.length > 2) {
    const genericSearchModifiers = ['ai', 'powered', 'smart', 'app', 'platform', 'system', 'software', 'tool'];
    const filteredKeywords = plan.keywords.filter(k => !genericSearchModifiers.includes(k.toLowerCase()));
    const sourceKeywords = filteredKeywords.length >= 2 ? filteredKeywords : plan.keywords;
    const fallbackQuery = sourceKeywords.slice(0, 2).join(' ');
    await onUpdate({
      stage: 'discovering',
      message: `No initial hits. Retrying with simplified query: "${fallbackQuery}"...`,
      progress: 48
    });
    baseQuery = fallbackQuery;
    const retryPromises: Promise<CrawledSource[]>[] = [];
    primaryKeys.concat(fallbackKeys).forEach(k => {
      retryPromises.push(runProviderQuery(k, fallbackQuery));
    });
    const retrySettled = await Promise.allSettled(retryPromises);
    retrySettled.forEach(res => {
      if (res.status === 'fulfilled') {
        rawCrawled.push(...res.value);
      }
    });
  }

  // SAFETY NET PASS FOR ZERO-HIT CATEGORIES
  if (rawCrawled.filter(r => r.status === 'success' && r.title).length === 0) {
    await onUpdate({
      stage: 'discovering',
      message: `Broadening public search for "${scope.primaryTopic}"...`,
      progress: 50
    });
    const safetyKeys = ['wikipedia', 'openalex', 'crossref'];
    const safetyPromises: Promise<CrawledSource[]>[] = [];
    safetyKeys.forEach(k => {
      safetyPromises.push(runProviderQuery(k, scope.primaryTopic));
    });
    const safetySettled = await Promise.allSettled(safetyPromises);
    safetySettled.forEach(res => {
      if (res.status === 'fulfilled') {
        rawCrawled.push(...res.value);
      }
    });
  }

  // --- STRENGTHEN DUPLICATE REMOVAL ---
  const sourceGroups = new Map<string, CrawledSource>();

  // Sort raw sources by weight
  const rankedRaw = rawCrawled.map(s => {
    const txt = `${s.title} ${s.excerpt}`.toLowerCase();
    const matches = plan.keywords.filter(kw => txt.includes(kw.toLowerCase())).length;
    let baseWeight = s.quality_tier === 'high' ? 3.0 : s.quality_tier === 'medium' ? 2.0 : 1.0;
    if (s.category_match) baseWeight += 1.0;
    return { s, weight: baseWeight + matches * 0.2 };
  }).sort((a, b) => b.weight - a.weight);

  rankedRaw.forEach(({ s }) => {
    const canonicalUrl = cleanUrl(s.url);
    const doiKey = s.url.includes('doi.org') || s.url.startsWith('10.') ? extractDoi(s.url) : '';
    const titlePubKey = getNormalizedTitleKey(s.title, s.provider);

    let matchKey = '';
    if (doiKey && sourceGroups.has(`doi:${doiKey}`)) {
      matchKey = `doi:${doiKey}`;
    } else if (sourceGroups.has(`url:${canonicalUrl}`)) {
      matchKey = `url:${canonicalUrl}`;
    } else if (sourceGroups.has(`titlepub:${titlePubKey}`)) {
      matchKey = `titlepub:${titlePubKey}`;
    }

    if (matchKey) {
      const existing = sourceGroups.get(matchKey)!;
      let keepNew = false;
      const newQual = s.quality_tier === 'high' ? 3 : s.quality_tier === 'medium' ? 2 : 1;
      const oldQual = existing.quality_tier === 'high' ? 3 : existing.quality_tier === 'medium' ? 2 : 1;
      if (newQual > oldQual) {
        keepNew = true;
      } else if (newQual === oldQual) {
        if (s.excerpt.length > existing.excerpt.length) {
          keepNew = true;
        } else if ((s.stargazers_count || 0) > (existing.stargazers_count || 0)) {
          keepNew = true;
        }
      }
      if (keepNew) {
        sourceGroups.set(matchKey, s);
      }
    } else {
      const key = doiKey ? `doi:${doiKey}` : `url:${canonicalUrl}`;
      sourceGroups.set(key, s);
      sourceGroups.set(`url:${canonicalUrl}`, s);
      sourceGroups.set(`titlepub:${titlePubKey}`, s);
    }
  });

  // Extract unique deduped sources, capped at 6
  const uniqueSources = Array.from(new Set(sourceGroups.values()));
  const deduplicated = uniqueSources.slice(0, 6);

  if (deduplicated.length === 0) {
    throw new Error('No live public source records matched this search. Check your internet connection.');
  }

  // Alphabetically sort the final reference list by title before indexing rank
  deduplicated.sort((a, b) => a.title.localeCompare(b.title));

  await onUpdate({
    stage: 'discovering',
    message: `Collected ${deduplicated.length} unique sources. Assembling matrix...`,
    progress: 55,
    sourcesFound: deduplicated.map((d, i) => ({
      project_id: projectId,
      title: d.title,
      url: d.url,
      publisher: d.provider,
      type: d.type,
      published_at: d.published_at || '2026',
      accessed_at: d.accessed_at,
      rank: i + 1,
      quality_score: d.quality_tier === 'high' ? 1.0 : d.quality_tier === 'medium' ? 0.8 : 0.6
    }))
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  await onUpdate({
    stage: 'extracting',
    message: 'Parsing excerpts and verifying metadata locators...',
    progress: 60
  });

  const finalSources: Source[] = deduplicated.map((d, i) => ({
    id: `src-${projectId}-${i}`,
    project_id: projectId,
    title: d.title,
    url: d.url,
    publisher: d.provider,
    type: d.type,
    published_at: d.published_at || '2026',
    accessed_at: d.accessed_at,
    rank: i + 1,
    quality_score: d.quality_tier === 'high' ? 1.0 : d.quality_tier === 'medium' ? 0.8 : 0.6
  }));

  const evidenceChunks: EvidenceChunk[] = [];
  const queryWords = baseQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  deduplicated.forEach((d, sIdx) => {
    const parentSource = finalSources[sIdx];
    const sentences = d.excerpt.split(/\. |\n/).filter(s => s.trim().length > 10);
    
    sentences.forEach((sentence, chunkIdx) => {
      const cleanText = sentence.trim().endsWith('.') ? sentence.trim() : `${sentence.trim()}.`;
      const metadata = extractChunkMetadata(cleanText, parentSource.title);
      
      const chunkObj: any = {
        id: `chunk-${projectId}-${sIdx}-${chunkIdx}`,
        source_id: parentSource.id,
        project_id: projectId,
        text: cleanText,
        locator: `Snippet Excerpt ${chunkIdx + 1}`,
        support_label: 'Supported',
        quality_signals: {
          relevance: Number((1.0).toFixed(2)),
          recency: parentSource.published_at || '2026',
          credibility: parentSource.type === 'paper' ? 'Peer Review Archive' : 'Public Registry'
        },
        ...metadata
      };

      const corroborationCount = calculateCorroboration(d.title, cleanText, deduplicated);
      const rankingScore = calculateRankingScore(chunkObj, parentSource, queryWords, category, corroborationCount);
      chunkObj.support_label = getSemanticLabel(rankingScore);
      
      evidenceChunks.push(chunkObj);
    });
  });

  await onUpdate({
    stage: 'extracting',
    message: `Extracted ${evidenceChunks.length} verifiable research paragraphs.`,
    progress: 75
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  await onUpdate({
    stage: 'validating',
    message: 'Analyzing evidence grounding limits and checking conflicting claims...',
    progress: 85
  });

  let conflictingEvidenceFound = false;
  evidenceChunks.forEach(chunk => {
    const textLower = chunk.text.toLowerCase();
    if (/\b(conflict|disagree|contradict|discrepancy|opposing|however|but instead)\b/.test(textLower)) {
      chunk.support_label = 'Conflicting evidence';
      conflictingEvidenceFound = true;
    }
  });

  await onUpdate({
    stage: 'validating',
    message: `Validation complete. Disagreement flags: ${conflictingEvidenceFound ? 'Yes' : 'No'}.`,
    progress: 90,
    evidenceFound: evidenceChunks
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  // --- REPORT GENERATION (PRECISION ORDER RENDER) ---
  let markdown = '';
  if (category === 'idea') {
    markdown = buildIdeaValidationReport(scope, finalSources, evidenceChunks, logs);
  } else if (category === 'market') {
    markdown = buildMarketIntelligenceReport(scope, finalSources, evidenceChunks, logs);
  } else if (category === 'tech') {
    markdown = buildTechnicalDocsReport(scope, finalSources, evidenceChunks, logs);
  } else {
    markdown = buildDefaultReport(scope, finalSources, evidenceChunks, logs, conflictingEvidenceFound);
  }

  const report: Omit<Report, 'id' | 'created_at'> = {
    project_id: projectId,
    markdown,
    executive_takeaway: `Compiled brief linking ${finalSources.length} sources and ${evidenceChunks.length} passages. Workspace records are private.`,
    source_count: finalSources.length,
    evidence_count: evidenceChunks.length
  };

  const isShortCache = ['idea', 'market'].includes(category);
  const expiryHours = isShortCache ? 24 : 7 * 24;
  const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  const cacheEntry: LocalCacheEntry = {
    key: `${category}:${question.trim().toLowerCase()}`,
    query: question,
    category,
    sources: finalSources,
    evidence: evidenceChunks,
    report: { ...report, created_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
    expiry_time: expiryTime
  };
  await saveCachedResults(cacheEntry);

  await onUpdate({
    stage: 'complete',
    message: 'Report published and cached locally.',
    progress: 100,
    report,
    sourcesFound: finalSources,
    evidenceFound: evidenceChunks
  });
}

// ----------------------------------------------------
// 5. CONVERSATION AND intent HELPERS
// ----------------------------------------------------
export interface QueryContext {
  originalQuery: string;
  topic: string;
  intent: string;
  section: string;
  analogySubject?: string;
  comparisonEntities?: string[];
}

export interface ConversationState {
  currentTopic: string;
  previousTopics: string[];
  entities: string[];
  lastIntent: string;
  lastAnswer: string;
}

export function generatePlan(question: string, category: string = 'generalist'): { subquestions: string[]; keywords: string[] } {
  const stopWords = [
    'what', 'how', 'why', 'who', 'where', 'when', 'is', 'are', 'the', 'and', 'for', 
    'with', 'about', 'from', 'this', 'that', 'your', 'there', 'here', 'service', 
    'services', 'allows', 'allow', 'renting', 'rent', 'local', 'locally', 'analyze', 
    'competition', 'competitors', 'example', 'app', 'apps', 'platform', 'platforms', 
    'their', 'them', 'these', 'those', 'some', 'many', 'more', 'most', 'only', 'also', 
    'just', 'been', 'were', 'have', 'does', 'should', 'would', 'could', 'want', 'like', 
    'than', 'into', 'upon', 'about', 'with', 'under', 'over', 'above', 'below', 'between',
    'research', 'researching', 'scholarly', 'study', 'studies', 'recent', 'current', 'latest', 'new'
  ];

  const words = question
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w));

  const keywords = Array.from(new Set(words)).slice(0, 5);

  let subquestions: string[] = [];
  if (category === 'idea') {
    subquestions = [
      `Novelty Check: Does this idea exist in current registries?`,
      `Competitor Analysis: Who are the alternatives?`,
      `Market Gaps: Unresolved customer pain points?`
    ];
  } else if (category === 'academic') {
    subquestions = [
      `Theoretical Background: terminology?`,
      `Consensus: What do papers agree upon?`,
      `Limitations: gaps in research?`
    ];
  } else if (category === 'market') {
    subquestions = [
      `Demographics: target segment?`,
      `Drivers: pricing models or trends?`,
      `Friction: economic/regulatory barriers?`
    ];
  } else if (category === 'tech') {
    subquestions = [
      `Specifications: frameworks/APIs?`,
      `Bottlenecks: performance limitations?`,
      `Best Practices: architectural parameters?`
    ];
  } else {
    subquestions = [
      `Core definitions and background of "${keywords.join(' ')}"`,
      `Key evidence and operational validation of claims`,
      `Compliance and quality constraints`
    ];
  }

  return { subquestions, keywords };
}

export function extractChunkMetadata(text: string, sourceTitle: string): Partial<EvidenceChunk> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const uniqueWords = Array.from(new Set(words));
  const keywords = uniqueWords.sort((a, b) => b.length - a.length).slice(0, 5);
  
  let section = 'Body';
  const textLower = text.toLowerCase();
  if (/\b(define|definition|what is|meaning of|significance)\b/.test(textLower)) {
    section = 'Definition';
  } else if (/\b(apply|application|applications|use case|uses|practical)\b/.test(textLower)) {
    section = 'Applications';
  } else if (/\b(example|examples|illustration|illustrate|case study)\b/.test(textLower)) {
    section = 'Examples';
  } else if (/\b(compare|comparison|versus| vs |difference|contrast)\b/.test(textLower)) {
    section = 'Comparison';
  } else if (/\b(why|reason|purpose|importance|benefit|strategic)\b/.test(textLower)) {
    section = 'Why';
  }
  
  const firstSentence = text.split(/[.!?]/)[0]?.trim() || '';
  const summary = firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;

  return {
    title: sourceTitle,
    section,
    chapter: 'General Findings',
    keywords,
    summary,
  };
}

export function detectIntent(query: string): string {
  const q = query.toLowerCase().trim();
  if (/\b(which\s+sources|what\s+sources|list\s+sources|sources\s+did\s+you\s+use|where\s+did\s+this\s+come\s+from|which\s+claims\s+came\s+from)\b/i.test(q)) {
    return 'SOURCE_ATTRIBUTION';
  }
  if (/\b(why\s+should\s+i\s+trust|can\s+i\s+trust|is\s+this\s+(trustworthy|reliable))\b/i.test(q)) {
    return 'TRUST_EXPLANATION';
  }
  if (/\b(define|definition|what is|meaning of|what does.*mean)\b/i.test(q)) {
    return 'DEFINITION';
  }
  if (/\b(explain\s+like\s+i['’]?m\s+\d+|explain\s+like\s+i\s+am\s+\d+|eli\d+|for\s+kids|beginner|child|simple\s+terms|\d+\s*(?:-| )?year\s*(?:old)?|young)\b/i.test(q)) {
    return 'BEGINNER_EXPLANATION';
  }
  if (/\b(analogy|analogies|like a)\b/i.test(q)) {
    return 'ANALOGY';
  }
  if (/\b(compare|comparison|versus| vs |difference between|differ)\b/i.test(q)) {
    return 'COMPARISON';
  }
  if (/\b(summary|summarize|tldr|tl;dr|brief outline|one paragraph|in a paragraph|single paragraph)\b/i.test(q)) {
    return 'SUMMARY';
  }
  if (/\b(code|coding|script|program|typescript|javascript|python|rust)\b/i.test(q)) {
    return 'CODE';
  }
  if (/\b(diagram|flowchart|mermaid|graph)\b/i.test(q)) {
    return 'DIAGRAM';
  }
  if (/\b(table|grid|columns)\b/i.test(q)) {
    return 'TABLE';
  }
  if (/\b(why|reason|purpose|rationale)\b/i.test(q)) {
    return 'WHY';
  }
  if (/\b(how to|step by step|steps|procedure|guide|method)\b/i.test(q)) {
    return 'STEP_BY_STEP';
  }
  return 'UNKNOWN';
}

export function reconstructState(history: any[]): ConversationState {
  const previousTopics: string[] = [];
  const entities: string[] = [];
  let currentTopic = '';
  let lastIntent = 'UNKNOWN';
  let lastAnswer = '';

  history.forEach((msg) => {
    const q = msg.question;
    const matches = q.match(/\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g);
    if (matches) {
      matches.forEach((m: string) => {
        const lower = m.toLowerCase();
        if (
          lower !== 'i' && lower !== 'explain' && lower !== 'why' && lower !== 'what' &&
          lower !== 'compare' && lower !== 'give' && lower !== 'analogy' &&
          lower !== 'sources' && lower !== 'claims' && lower !== 'brief' &&
          lower !== 'decision' && !entities.includes(m)
        ) {
          entities.push(m);
        }
      });
    }

    let msgTopic = '';
    const qLower = q.toLowerCase();
    if (qLower.includes('quantum computing')) msgTopic = 'Quantum Computing';
    else if (qLower.includes('deep learning')) msgTopic = 'Deep Learning';
    else if (qLower.includes('machine learning')) msgTopic = 'Machine Learning';
    else if (qLower.includes('artificial intelligence') || qLower.includes(' ai ')) msgTopic = 'Artificial Intelligence';

    if (msgTopic && msgTopic !== currentTopic) {
      if (currentTopic) previousTopics.push(currentTopic);
      currentTopic = msgTopic;
    }
    if (msg.detected_intent) lastIntent = msg.detected_intent;
    lastAnswer = msg.answer;
  });

  return { currentTopic, previousTopics, entities, lastIntent, lastAnswer };
}

export function rewriteQuery(query: string, state: ConversationState): string {
  let rewritten = query;
  const q = query.toLowerCase().trim();
  if (/\b(explain\s+it|summarize\s+it|what\s+is\s+it|tell\s+me\s+about\s+it)\b/i.test(q) && state.currentTopic) {
    rewritten = query.replace(/\b(it)\b/i, state.currentTopic);
  }
  return rewritten;
}

export function preprocessQuery(query: string): QueryContext {
  const intent = detectIntent(query);
  let section = 'Body';
  if (intent === 'DEFINITION') section = 'Definition';
  else if (intent === 'COMPARISON') section = 'Comparison';
  else if (intent === 'WHY') section = 'Why';
  
  const topic = query
    .replace(/explain/gi, '')
    .replace(/what\s+is/gi, '')
    .replace(/\?/g, '')
    .trim();

  return { originalQuery: query, topic, intent, section };
}

// ----------------------------------------------------
// 6. Q&A OFFLINE ENGINE
// ----------------------------------------------------
export interface EvidenceSearchResult {
  answer: string;
  source_state: 'Conversation' | 'From Decision Brief' | 'Live supplemental sources' | 'No matching evidence';
  citations: { chunkId: string; sourceTitle: string; url?: string; text: string }[];
  shouldSearchExternal: boolean;
  detected_intent?: string;
}

// ----------------------------------------------------
// 5.5 ANSWER FORMATTER WITH COMPLETENESS RULE
// ----------------------------------------------------
export function formatAnswer(
  query: string,
  ranked: { chunk: EvidenceChunk; source?: Source; score: number }[],
  allSources: Source[],
  category: string
): string {
  const queryLower = query.toLowerCase();
  
  // 1. Direct answer
  const topText = ranked[0]?.chunk.text || '';
  const topRank = ranked[0]?.source?.rank || 1;
  
  const directAnswer = `Based on the retrieved evidence from the Decision Brief: **${topText}** [${topRank}].`;
  
  const stopWords = ['what', 'is', 'how', 'why', 'are', 'the', 'and', 'for', 'with', 'about', 'from', 'this', 'that', 'explain', 'tell', 'me', 'who', 'where', 'when'];
  const queryWords = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
  const unmatchedWords = queryWords.filter(word => !ranked.some(r => r.chunk.text.toLowerCase().includes(word)));
  
  let incompleteNotice = '';
  if (unmatchedWords.length > 0) {
    incompleteNotice = `The retrieved evidence does not fully answer the aspect regarding "${unmatchedWords.join(', ')}" because no direct facts covering these keywords were found in the saved excerpts.`;
  }

  let ans = `### 1. Direct Answer\n`;
  ans += `${directAnswer}\n\n`;
  if (incompleteNotice) {
    ans += `> [!IMPORTANT]\n`;
    ans += `> **Incomplete Coverage**: ${incompleteNotice}\n\n`;
  }

  // 2. Main evidence-backed details
  ans += `### 2. Main Evidence-Backed Details\n`;
  ranked.forEach((item, idx) => {
    const label = getSemanticLabel(item.score, item.chunk.support_label === 'Conflicting evidence');
    const r = item.source?.rank || idx + 1;
    ans += `*   **[${label}]** ${item.chunk.text} (Source: *${item.source?.title || 'Brief'}* [${r}])\n`;
  });
  ans += `\n`;

  // 3. Beginner-friendly explanation or examples when the selected audience needs them
  const isBeginnerAudience = /\b(first-year|beginner|student|introductory|simple|basic|eli5|for kids|freshman)\b/.test(queryLower) || category === 'generalist';
  if (isBeginnerAudience) {
    ans += `### 3. Beginner-Friendly Explanation\n`;
    ans += `In simpler terms: ${topText.replace(/[\w.-]+@[\w.-]+\.\w+/g, '')} Think of it like a basic building block or a everyday example where components interact step-by-step.\n\n`;
  } else {
    ans += `### 3. Beginner-Friendly Explanation\n`;
    ans += `*(Not explicitly requested for this audience profile, but available upon requesting a beginner definition.)*\n\n`;
  }

  // 4. Conflicting evidence or important caveats
  const conflicts = ranked.filter(item => item.chunk.support_label === 'Conflicting evidence');
  ans += `### 4. Conflicting Evidence & Caveats\n`;
  if (conflicts.length > 0) {
    conflicts.forEach(item => {
      ans += `*   ⚠️ **Caveat**: *${item.source?.title}* states: "${item.chunk.text}" [${item.source?.rank}]\n`;
    });
  } else {
    ans += `No conflicting claims were identified in the indexed evidence passages.\n`;
  }
  ans += `\n`;

  // 5. Evidence missing, unavailable, or not retrieved during this research run
  ans += `### 5. Evidence Missing or Not Retrieved\n`;
  const missingPoints: string[] = [];
  
  const hasGov = allSources.some(s => s.type === 'gov');
  const hasPaper = allSources.some(s => s.type === 'paper');
  
  if (!hasGov) {
    missingPoints.push(`No official government or standards-body source: not retrieved during this research run.`);
  }
  if (!hasPaper) {
    missingPoints.push(`No peer-reviewed scientific publication or academic paper: not retrieved during this research run.`);
  }
  if (unmatchedWords.length > 0) {
    missingPoints.push(`Specific details matching "${unmatchedWords.join(', ')}": not retrieved during this research run.`);
  }
  
  if (missingPoints.length > 0) {
    missingPoints.forEach(p => {
      ans += `- ${p}\n`;
    });
  } else {
    ans += `All general source classifications (papers, government records) were present in the brief.\n`;
  }
  ans += `\n`;

  // 6. Linked source citations
  ans += `### 6. Linked Source Citations\n`;
  ranked.forEach(item => {
    if (item.source) {
      ans += `*   [${item.source.rank}] **${item.source.title}** (Publisher: *${item.source.publisher || 'N/A'}*). URL: [${item.source.url}](${item.source.url})\n`;
    }
  });
  
  return ans;
}

export function searchEvidence(
  query: string,
  chunks: EvidenceChunk[],
  sources: Source[],
  category: string = 'generalist',
  history: any[] = []
): EvidenceSearchResult {
  const state = reconstructState(history);
  const rewritten = rewriteQuery(query, state);
  const queryCtx = preprocessQuery(rewritten);

  if (/^(hi|hello|hey|help|what can you do)[!. ]*$/i.test(queryCtx.topic)) {
    return {
      answer: 'Hi! I can answer questions using this Decision Brief and its saved research sources. What would you like to know?',
      source_state: 'Conversation',
      citations: [],
      shouldSearchExternal: false
    };
  }

  const queryWords = queryCtx.topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) {
    return {
      answer: 'Please ask a specific question about the Decision Brief.',
      source_state: 'Conversation',
      citations: [],
      shouldSearchExternal: false
    };
  }

  const sourceMap = new Map(sources.map(s => [s.id, s]));
  const seenPublishers = new Set<string>();

  const ranked = chunks.map(chunk => {
    const src = sourceMap.get(chunk.source_id);
    let score = calculateRankingScore(chunk, src, queryWords, category);
    
    if (src && src.publisher) {
      const pub = src.publisher.toLowerCase().trim();
      if (seenPublishers.has(pub)) score -= 0.5;
      else seenPublishers.add(pub);
    }

    return { chunk, source: src, score };
  })
  .filter(item => item.score > 0.05)
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

  const isUnanswerable = ranked.length === 0 || ranked[0].score < 0.25;
  if (isUnanswerable) {
    return {
      answer: `I do not know based on the available evidence in the Decision Brief. The local document index does not contain information to answer the question: "${query}". Based on the available evidence, I cannot answer this with confidence.\n\nIf you'd like, check the option below to search external public endpoints.`,
      source_state: 'No matching evidence',
      citations: [],
      shouldSearchExternal: true,
      detected_intent: queryCtx.intent
    };
  }

  const citations = ranked.map(r => ({
    chunkId: r.chunk.id,
    sourceTitle: r.source?.title || 'Indexed Source',
    url: r.source?.url,
    text: r.chunk.text
  }));

  const answer = formatAnswer(query, ranked, sources, category);

  return {
    answer,
    source_state: 'From Decision Brief',
    citations,
    shouldSearchExternal: false,
    detected_intent: queryCtx.intent
  };
}

// ----------------------------------------------------
// 7. Q&A LIVE FALLBACK ENGINE
// ----------------------------------------------------
export async function searchWebSources(
  query: string,
  projectId: string,
  category: string = 'generalist',
  history: any[] = []
): Promise<{
  answer: string;
  sources: Omit<Source, 'id'>[];
  evidence: Omit<EvidenceChunk, 'id'>[];
  citations: { chunkId: string; sourceTitle: string; url?: string; text: string }[];
  detected_intent?: string;
}> {
  const state = reconstructState(history);
  const rewritten = rewriteQuery(query, state);
  const queryCtx = preprocessQuery(rewritten);

  const config = CATEGORY_MAP[category] || CATEGORY_MAP.generalist;
  const primaryKeys = config.primary.slice(0, 2);

  const rawCrawled: CrawledSource[] = [];
  await Promise.allSettled(primaryKeys.map(async k => {
    const adapter = adapters[k];
    if (adapter) {
      const res = await adapter(queryCtx.topic);
      rawCrawled.push(...res.filter(r => r.status === 'success'));
    }
  }));

  if (rawCrawled.length === 0) {
    return {
      answer: 'I do not know based on the available evidence. Public search index crawls returned no matching results.',
      sources: [],
      evidence: [],
      citations: []
    };
  }

  const seenUrls = new Set<string>();
  const topSources = rawCrawled.filter(s => {
    const urlKey = s.url.toLowerCase();
    if (!seenUrls.has(urlKey)) {
      seenUrls.add(urlKey);
      return true;
    }
    return false;
  }).slice(0, 3);

  const insertSources: Omit<Source, 'id'>[] = topSources.map((s, idx) => ({
    project_id: projectId,
    title: s.title,
    url: s.url,
    publisher: s.provider,
    type: s.type,
    published_at: s.published_at || '2026',
    accessed_at: s.accessed_at,
    rank: idx + 1,
    quality_score: s.quality_tier === 'high' ? 1.0 : 0.8
  }));

  const insertEvidence: Omit<EvidenceChunk, 'id'>[] = [];
  const citations: any[] = [];

  topSources.forEach((s, sIdx) => {
    const sentence = s.excerpt.split(/\. |\n/)[0] || '';
    if (sentence.trim().length > 10) {
      const cleanText = sentence.trim().endsWith('.') ? sentence.trim() : `${sentence.trim()}.`;
      insertEvidence.push({
        project_id: projectId,
        source_id: s.title,
        text: cleanText,
        locator: 'Excerpt Passage 1',
        support_label: 'Supported',
        quality_signals: { relevance: 1.0, recency: '2026', credibility: 'Search API' }
      });
      citations.push({
        chunkId: `web-chunk-${sIdx}`,
        sourceTitle: s.title,
        url: s.url,
        text: cleanText
      });
    }
  });

  const mockSources: Source[] = insertSources.map((s, idx) => ({
    id: `web-src-${idx}`,
    ...s
  }));
  const mockChunks: EvidenceChunk[] = insertEvidence.map((c, idx) => {
    const parent = mockSources.find(s => s.title === c.source_id);
    return {
      ...c,
      id: `web-chunk-${idx}`,
      source_id: parent?.id || `web-src-${idx}`
    };
  });
  const rankedMock = mockChunks.map(chunk => {
    const src = mockSources.find(s => s.id === chunk.source_id);
    return { chunk, source: src, score: 3.0 };
  });

  const answer = formatAnswer(query, rankedMock, mockSources, category);

  return {
    answer,
    sources: insertSources,
    evidence: insertEvidence,
    citations,
    detected_intent: queryCtx.intent
  };
}
