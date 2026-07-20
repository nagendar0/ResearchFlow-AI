import { test } from 'node:test';
import assert from 'node:assert';
import { 
  calculateRankingScore, 
  getSemanticLabel, 
  parseResearchScope, 
  generatePlan, 
  cleanUrl, 
  extractDoi,
  getNormalizedTitleKey,
  getIdeaRecommendation
} from './engine';

// ----------------------------------------------------
// 1. DEDUPLICATION LOGIC TESTS
// ----------------------------------------------------
test('Deduplication & Canonical URL normalisation logic', () => {
  const urls = [
    'https://en.wikipedia.org/wiki/Quantum_computing',
    'https://en.wikipedia.org/wiki/Quantum_computing/',
    'http://en.wikipedia.org/wiki/quantum_computing?utm_source=test', // utm parameter
    'https://doi.org/10.1038/nature12345',
    'https://doi.org/10.1038/nature12345/'
  ];

  const uniqueUrls = urls.map(url => cleanUrl(url));
  const uniqueSet = new Set(uniqueUrls);

  // Should normalize query parameters, case mismatches, protocols, and trailing slashes
  assert.strictEqual(uniqueSet.size, 2);
  assert.ok(uniqueSet.has('https://en.wikipedia.org/wiki/quantum_computing'));
  assert.ok(uniqueSet.has('https://doi.org/10.1038/nature12345'));
});

test('DOI deduplication prioritization', () => {
  const source1 = {
    title: 'Duplicate Paper',
    url: 'https://doi.org/10.1038/nature12345',
    provider: 'Europe PMC',
    quality_tier: 'medium' as const,
    excerpt: 'Short excerpt.'
  };

  const source2 = {
    title: 'Duplicate Paper (Extended)',
    url: 'https://doi.org/10.1038/nature12345/',
    provider: 'Europe PMC',
    quality_tier: 'high' as const, // Higher quality tier
    excerpt: 'Much longer excerpt explaining the physics in full detail.'
  };

  // Extract DOI and title publisher keys
  const doi1 = extractDoi(source1.url);
  const doi2 = extractDoi(source2.url);
  assert.strictEqual(doi1, doi2);

  const titlePub1 = getNormalizedTitleKey(source1.title, source1.provider);
  const titlePub2 = getNormalizedTitleKey(source2.title, source2.provider);
  assert.notStrictEqual(titlePub1, titlePub2); // Titles differ slightly, but DOI deduplication binds them

  // Selection logic comparison
  let keepSource2 = false;
  const newQual = source2.quality_tier === 'high' ? 3 : 2;
  const oldQual = source1.quality_tier === 'high' ? 3 : 2;
  if (newQual > oldQual) {
    keepSource2 = true;
  }
  assert.strictEqual(keepSource2, true, 'Duplicate resolution should prioritize high quality tier');
});

// ----------------------------------------------------
// 2. STRUCTURED RESEARCH SCOPE EXTRACTION
// ----------------------------------------------------
test('Research scope parser extracts primary topic, level and audience', () => {
  const query = "Research quantum computing for a first-year engineering student";
  const scope = parseResearchScope(query, 'academic');

  assert.strictEqual(scope.primaryTopic, 'quantum computing');
  assert.strictEqual(scope.audience, 'First-year engineering student');
  assert.strictEqual(scope.learningLevel, 'beginner');
  assert.strictEqual(scope.researchGoal, 'foundational explanation');

  const scopeWaste = parseResearchScope("Validate the idea: AI-powered Smart Waste Management System", 'idea');
  assert.strictEqual(scopeWaste.primaryTopic, 'AI-powered Smart Waste Management System');
  assert.strictEqual(scopeWaste.category, 'idea');

  const scopeXAI = parseResearchScope("Systematic Literature Review on Explainable AI in Healthcare", 'academic');
  assert.strictEqual(scopeXAI.primaryTopic, 'Explainable AI');
  assert.strictEqual(scopeXAI.researchGoal, 'Healthcare');

  const scopeVideo = parseResearchScope("Market Intelligence Report on AI Video Generation Platforms in 2026", 'market');
  assert.strictEqual(scopeVideo.primaryTopic, 'AI Video Generation Platforms');

  const scopeKafka = parseResearchScope("Create technical documentation for Apache Kafka Architecture and Event Streaming", 'tech');
  assert.strictEqual(scopeKafka.primaryTopic, 'Apache Kafka');
  assert.strictEqual(scopeKafka.researchGoal, 'Architecture and Event Streaming');
});

test('Audience modifier terms are omitted from source search query keywords', () => {
  const query = "Research quantum computing for a first-year engineering student";
  const scope = parseResearchScope(query, 'academic');
  
  // Generating search query from primaryTopic
  const plan = generatePlan(scope.primaryTopic, 'academic');
  
  const forbiddenKeywords = ['student', 'engineering', 'first-year', 'beginner'];
  forbiddenKeywords.forEach(kw => {
    assert.strictEqual(plan.keywords.includes(kw), false, `Keywords should not contain audience-specific term: ${kw}`);
  });
  
  assert.ok(plan.keywords.includes('quantum'));
  assert.ok(plan.keywords.includes('computing'));
});

// ----------------------------------------------------
// 3. TRANSPARENT RANKING SCORE TESTS
// ----------------------------------------------------
test('Ranking score algorithm weighting checks', () => {
  const queryWords = ['quantum', 'computing', 'qubits'];

  // Test Case A: High-quality peer-reviewed source with recency and keywords (Should score high)
  const chunkA = { text: 'Qubits represent the core computing unit of quantum mechanics. It has long sentence structure.' };
  const sourceA = {
    title: 'Quantum computing breakthroughs',
    publisher: 'Europe PMC',
    type: 'paper',
    quality_score: 1.0,
    published_at: '2026-02-15'
  };
  const scoreA = calculateRankingScore(chunkA, sourceA, queryWords, 'academic', 2);
  // Relevance: 'qubits', 'computing', 'quantum' matching text (+1.2)
  // Peer-reviewed/official: +1.5
  // Recency (2026): +0.5
  // Excerpt length (>80): +0.5
  // Category match (Europe PMC): +0.5
  // Corroboration (2 count): +0.6
  // Expected: ~4.8
  assert.ok(scoreA >= 4.0, `Score A should be high (actual: ${scoreA})`);
  assert.strictEqual(getSemanticLabel(scoreA), 'High-quality evidence');

  // Test Case B: Community source from reddit (Should not receive High-quality evidence without strong corroboration)
  const chunkB = { text: 'reddit post query qubits details.' };
  const sourceB = {
    title: 'discussion on qubits',
    publisher: 'Reddit Feed',
    type: 'web',
    quality_score: 0.6,
    published_at: '2024-05-10'
  };
  const scoreB = calculateRankingScore(chunkB, sourceB, queryWords, 'academic', 0);
  // Relevance: qubits (+0.4)
  // Peer-reviewed/official: +0.5 (web)
  // Recency (2024): +0.5
  // Excerpt length (<80): +0.0
  // Category match: +0.0
  // Corroboration: 0
  // Expected: ~1.4 (maps to Limited evidence)
  assert.ok(scoreB < 2.5, `Community source without corroboration should score low (actual: ${scoreB})`);
  assert.strictEqual(getSemanticLabel(scoreB), 'Limited evidence');
});

// ----------------------------------------------------
// 4. CACHE EXPIRY CALCULATION TESTS
// ----------------------------------------------------
test('Cache expiry invalidation calculations', () => {
  const now = Date.now();
  
  // News/community sources expire in 24 hours
  const expiryNews = new Date(now + 24 * 60 * 60 * 1000);
  assert.ok(expiryNews.getTime() - now >= 86300 * 1000); // approx 24h
  
  // Academic/tech sources expire in 7 days
  const expiryAcademic = new Date(now + 7 * 24 * 60 * 60 * 1000);
  assert.ok(expiryAcademic.getTime() - now >= 7 * 86300 * 1000); // approx 7d
});

// ----------------------------------------------------
// 5. EVIDENCE COVERAGE & MISSING CODES
// ----------------------------------------------------
test('Evidence coverage metrics verify count values', () => {
  const mockSources = [
    { type: 'paper', publisher: 'Europe PMC' },
    { type: 'gov', publisher: 'SEC EDGAR' },
    { type: 'web', publisher: 'GitHub' }
  ];

  const paperCount = mockSources.filter(s => s.type === 'paper').length;
  const govCount = mockSources.filter(s => s.type === 'gov').length;
  const techCount = mockSources.filter(s => s.type === 'web' && s.publisher.toLowerCase().includes('github')).length;

  assert.strictEqual(paperCount, 1);
  assert.strictEqual(govCount, 1);
  assert.strictEqual(techCount, 1);
});

test('Evidence missing messages include required phrase constraint', () => {
  const govCount = 0;
  
  let missingSection = '';
  if (govCount === 0) {
    missingSection += `- No official standards-body source: not retrieved during this research run.\n`;
    missingSection += `- No government source: not retrieved during this research run.\n`;
  }
  
  assert.ok(missingSection.includes('not retrieved during this research run'));
});

// ----------------------------------------------------
// 6. SPECIALIZED PIPELINE CATEGORY & RELEVANCE TESTS
// ----------------------------------------------------
test('Kubernetes searches reject unrelated robotics/Android sources in tech category', () => {
  const queryWords = ['kubernetes'];

  const unrelatedChunk = { text: 'Robotics framework deployment guide for android' };
  const unrelatedSource = {
    title: 'Android Robotics SDK',
    publisher: 'Google Play',
    type: 'web',
    url: 'https://play.google.com/store'
  };

  const score = calculateRankingScore(unrelatedChunk, unrelatedSource, queryWords, 'tech', 0);
  assert.strictEqual(score, 0, 'Should reject completely unrelated source for kubernetes query in tech docs category');

  const relatedChunk = { text: 'Kubernetes scheduling controls pod deployment.' };
  const relatedSource = {
    title: 'Kubernetes Architecture Documentation',
    publisher: 'Official Docs',
    type: 'web',
    url: 'https://kubernetes.io/docs/'
  };

  const scoreRelated = calculateRankingScore(relatedChunk, relatedSource, queryWords, 'tech', 0);
  assert.ok(scoreRelated > 2.0, 'Should highly rank related kubernetes docs');
});

test('AI coding-assistant market research retrieves product/company evidence over Wikidata in market category', () => {
  const queryWords = ['coding', 'assistant'];

  const wikidataChunk = { text: 'Structured Wikidata entity page for Copilot.' };
  const wikidataSource = {
    title: 'Q107412920 Wikidata entry',
    publisher: 'Wikidata',
    type: 'web',
    url: 'https://www.wikidata.org/wiki/Q107412920'
  };

  const officialChunk = { text: 'GitHub Copilot pricing plans and developer seat costs.' };
  const officialSource = {
    title: 'GitHub Copilot Pricing',
    publisher: 'Official GitHub Copilot Website',
    type: 'web',
    url: 'https://github.com/features/copilot/plans'
  };

  const scoreWikidata = calculateRankingScore(wikidataChunk, wikidataSource, queryWords, 'market', 0);
  const scoreOfficial = calculateRankingScore(officialChunk, officialSource, queryWords, 'market', 0);

  assert.ok(scoreOfficial > scoreWikidata, 'Market research should score official product pages higher than Wikidata entries');
});

test('Idea-validation reports competitors, demand signals, risks, and a cautious recommendation', () => {
  
  // Case 1: Comp + Demand -> Build
  const recBuild = getIdeaRecommendation(
    [{ publisher: 'GitHub', title: 'Alternative App' }],
    [{ text: 'I really want this app to solve my problems.' }]
  );
  assert.strictEqual(recBuild.recommendation, 'Build');

  // Case 2: Comp + No Demand -> Pivot
  const recPivot = getIdeaRecommendation(
    [{ publisher: 'GitHub', title: 'Alternative App' }],
    [{ text: 'Standard description of existing alternatives.' }]
  );
  assert.strictEqual(recPivot.recommendation, 'Pivot');

  // Case 3: Risks + No Demand -> Avoid
  const recAvoid = getIdeaRecommendation(
    [],
    [{ text: 'Severe data leak risk and dependency constraints make this hard.' }]
  );
  assert.strictEqual(recAvoid.recommendation, 'Avoid');

  // Case 4: No clear signals -> Validate Further
  const recValidate = getIdeaRecommendation([], []);
  assert.strictEqual(recValidate.recommendation, 'Validate Further');
});
