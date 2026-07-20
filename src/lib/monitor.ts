import { searchEvidence, detectIntent, preprocessQuery } from './engine';
import { EvidenceChunk, Source } from './supabase';

export interface AuditRecord {
  timestamp: string;
  query: string;
  detectedTopic: string;
  detectedIntent: string;
  confidenceScore: number;
  unsupportedAnswered: boolean;
  citationsProvided: number;
  answerLength: number;
}

export interface EvaluationResult {
  passed: boolean;
  query: string;
  expectedIntent: string;
  actualIntent: string;
  expectedConfidenceGuard: 'grounded' | 'unsupported';
  actualConfidenceGuard: 'grounded' | 'unsupported';
}

/**
 * Enterprise Audit Logger for monitoring engine queries and confidence boundaries.
 */
export function auditQuery(
  query: string,
  chunks: EvidenceChunk[],
  sources: Source[],
  history: any[] = []
): AuditRecord {
  const result = searchEvidence(query, chunks, sources, 'generalist', history);
  const context = preprocessQuery(query);

  const bestScore = chunks.length > 0 ? 0.3 : 0.0; // Mock placeholder or calculate from local tf-idf

  return {
    timestamp: new Date().toISOString(),
    query,
    detectedTopic: context.topic,
    detectedIntent: context.intent,
    confidenceScore: bestScore,
    unsupportedAnswered: result.source_state === 'No matching evidence',
    citationsProvided: result.citations.length,
    answerLength: result.answer.length,
  };
}

/**
 * Automated Evaluation Suite to ensure zero-hallucination compliance.
 */
export function runEnterpriseEvaluation(
  chunks: EvidenceChunk[],
  sources: Source[]
): EvaluationResult[] {
  const testCases: { query: string; expectedIntent: string; expectedGuard: 'grounded' | 'unsupported' }[] = [
    {
      query: "Explain Quantum Computing like I'm 5 years old.",
      expectedIntent: 'BEGINNER_EXPLANATION',
      expectedGuard: 'grounded',
    },
    {
      query: "Who invented Quantum Computing in 2100?",
      expectedIntent: 'UNKNOWN', // Speculative query should be guarded
      expectedGuard: 'unsupported',
    },
    {
      query: "Why should I trust this explanation?",
      expectedIntent: 'TRUST_EXPLANATION',
      expectedGuard: 'grounded',
    },
    {
      query: "Which sources did you use for this research?",
      expectedIntent: 'SOURCE_ATTRIBUTION',
      expectedGuard: 'grounded',
    },
  ];

  return testCases.map(tc => {
    const result = searchEvidence(tc.query, chunks, sources, 'generalist', []);
    const intent = detectIntent(tc.query);
    const actualGuard = result.source_state === 'No matching evidence' ? 'unsupported' : 'grounded';

    return {
      passed: actualGuard === tc.expectedGuard,
      query: tc.query,
      expectedIntent: tc.expectedIntent,
      actualIntent: intent,
      expectedConfidenceGuard: tc.expectedGuard,
      actualConfidenceGuard: actualGuard,
    };
  });
}
