// Shared domain types for the Connect -> Sense -> Reason -> Verify -> Report pipeline.

export type ScannerTool = "semgrep" | "gitleaks" | "osv-scanner";

export type FindingCategory =
  | "sast"
  | "secret"
  | "dependency"
  | "code-smell";

export interface Finding {
  id: string;
  tool: ScannerTool;
  category: FindingCategory;
  ruleId: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  file: string;
  line?: number;
  message: string;
  snippet?: string;
}

export interface EndpointSummary {
  method?: string;
  route: string;
  file: string;
  line?: number;
  description: string;
}

export interface BusinessLogicNote {
  endpoint: EndpointSummary;
  intendedRule: string;
  concern: string;
  relatedFindingIds: string[];
  confidence: "low" | "medium" | "high";
}

export interface AttackChainStep {
  order: number;
  /** Free-text label (e.g. "recon", "read-intent", "compose", "exploit"). Display-only. */
  action: string;
  description: string;
  findingIds: string[];
}

export type AttackChainType = "race-condition" | "generic-logic-chain";

export interface AttackChain {
  id: string;
  title: string;
  type: AttackChainType;
  narrative: string;
  impact: string;
  steps: AttackChainStep[];
  findingIds: string[];
  businessLogicNoteIndex?: number;
  suggestedFix: {
    summary: string;
    diffHint?: string;
  };
  plannerConfidence: "low" | "medium" | "high";
}

export interface VerificationResult {
  chainId: string;
  verified: boolean;
  method: "dynamic-race-check" | "static-reanalysis" | "skipped";
  summary: string;
  evidence?: Record<string, unknown>;
}

export interface VerifiedAttackChain {
  chain: AttackChain;
  verification: VerificationResult;
}

export interface RepoContext {
  owner: string;
  name: string;
  ref: string;
  localPath: string;
}

export interface SentinelReport {
  repo: RepoContext;
  generatedAt: string;
  findings: Finding[];
  businessLogicNotes: BusinessLogicNote[];
  chains: VerifiedAttackChain[];
}
