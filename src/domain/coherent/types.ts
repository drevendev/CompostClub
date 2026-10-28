import type { ProviderConfig, ProviderSnapshot } from './provider';
import type { Workspace as LegacyWorkspace } from '../experiment';
import type { Garden as LegacyGarden } from '../garden';
import type { Admission } from './admission';

export type Profile = 'game' | 'application' | 'story' | 'custom' | 'unknown';
export type Origin =
  | 'user-authored'
  | 'imported assertion'
  | 'deterministic extraction'
  | 'local-model proposal'
  | 'remote-model proposal';
export interface Entry {
  at: number;
  timezone: string | null;
  offset: number | null;
}
export interface Identity {
  garden: string;
  kind: 'source' | 'candidate' | 'growth';
  id: string;
  revision: number;
}
export interface Span {
  id: string;
  start: number;
  end: number;
  text: string;
}
export interface Facet {
  id: string;
  field: string;
  value: string | null;
  origin: Origin;
  approved: boolean;
  sourceRevision: number;
  spans: string[];
  inheritedFrom: Identity | null;
}
export interface Alias {
  id: string;
  original: string;
  meaning: string;
  span: string;
  approved: boolean;
  essential: boolean;
}
export interface Preparation {
  revision: number;
  selected: string[];
  essential: string[];
  missingMechanism: boolean;
  facets: Facet[];
  aliases: Alias[];
  references: string[];
}
export interface SourceRevision {
  revision: number;
  title: string;
  text: string;
  hash: string;
  entry: Entry;
  spans: Span[];
  links: string[];
  preparation: Preparation;
}
export interface Source {
  sample?: boolean;
  id: string;
  garden: string;
  revisions: SourceRevision[];
  participating: boolean;
  tags: string[];
  fileId: string | null;
  origin: Origin;
  ancestry: Identity[];
}
export interface Document {
  id: string;
  name: string;
  text: string;
  bytesBase64: string;
  hash: string;
  decoding: string;
  entry: Entry;
}
export interface Reference {
  id: string;
  revision: number;
  garden: string;
  name: string;
  url: string;
  fileId: string | null;
  property: string;
  differ: string;
  status:
    | 'uninspected link'
    | 'imported assertion'
    | 'user-confirmed property'
    | 'source-supported property';
  essential: boolean;
  removed: boolean;
  source: Identity | null;
  spans: string[];
}
export interface Preference {
  id: string;
  revision: number;
  garden: string | null;
  text: string;
  approved: boolean;
  enabled: boolean;
  reviews: string[];
  origin: Origin;
}
export interface Garden {
  id: string;
  name: string;
  profile: Profile;
  profileRevision: number;
  objective: string;
  background: boolean;
  interval: number;
  nextAt: number;
  lastServed: number;
  credits: { balance: number; at: number; cap?: number };
  policy: { revision: number; probability: number; donors: string[]; donate: boolean };
  plan: SelectionPlan | null;
  legacy: LegacyGarden | null;
}
export interface SelectionPlan {
  blocked?: { fingerprint: string; reason: string };
  id: string;
  garden: string;
  seed: number;
  draw: number;
  route: 'local' | 'cross';
  manual: boolean;
  policyRevision: number;
  parents: Identity[];
  reason: string;
  override: string | null;
}
export interface Evidence {
  id: string;
  parent: Identity | null;
  originalSpan: string | null;
  text: string;
  status: string;
}
export interface ContextPack {
  version: 'context-1';
  hash: string;
  payload: string;
  evidence: Evidence[];
  omissions: { parent: Identity; spans: string[]; reason: string }[];
  fingerprints: { key: string; hash: string }[];
  counting: 'utf8-byte-upper-bound';
  inputUpperBound: number;
  contextLimit: number;
  outputReserve: 900;
  framingReserve: 512;
}
export interface Candidate {
  outcome: 'candidate';
  title: string;
  summary: string;
  target: Exclude<Profile, 'unknown'>;
  experience: string;
  core: string;
  example: string;
  contributions: { parent: string; text: string; evidence: string[] }[];
  interaction: string;
  references: { id: string; property: string; difference: string; evidence: string[] }[];
  unknowns: string[];
  nextQuestion: string;
  preservedCore: string;
  delta: string;
  changedAssumption: string;
  test: string;
}
export interface Negative {
  outcome: 'no_blend' | 'no_growth' | 'needs_context';
  reason: string;
  missing: string[];
}
export type Draft = Candidate | Negative;
export interface Finding {
  field: string;
  issue: string;
  evidence: string[];
  missing: string;
}
export interface Assessment {
  decision: 'pass' | 'needs_revision' | 'needs_context';
  findings: Finding[];
  limitations: string;
  revisionHash: string;
  contextHash: string;
  model: string;
  at: number;
  raw: string;
  observed: boolean;
}
export type Stage =
  | 'prepared'
  | 'generating'
  | 'draft retained'
  | 'screening'
  | 'screened'
  | 'needs_revision'
  | 'needs_context'
  | 'negative'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'proposal'
  | 'accepted'
  | 'rejected';
export type Operation = 'blend' | 'growth' | 'check' | 'dna' | 'preferences' | 'revise';
export const DIRECTIONS = [
  'clarify core action',
  'add one constraint',
  'resolve a contradiction',
  'answer a question',
  'explore an alternative',
  'propose a small test',
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export interface Job {
  provider?: ProviderSnapshot;
  remoteConsent?: { contextHash: string; providerHash: string; at: number; expires: number };
  admission?: Admission;
  trigger?: 'scheduled' | 'eureka' | 'manual';
  requestId?: string;
  id: string;
  operation: Operation;
  garden: string;
  parents: Identity[];
  snapshots: SourceRevision[];
  plan: SelectionPlan;
  pack: ContextPack;
  date: string;
  entry: Entry;
  stage: Stage;
  history: { stage: Stage; at: number }[];
  heldCalls: number;
  creditHeld: boolean;
  repairUsed: boolean;
  calls: string[];
  dispatches?: {
    id: string;
    stage: string;
    at: number;
    prompt: string;
    schema: string;
    schemaHash: string;
    outputTokens: number;
    timeoutMs: number;
    inputByteUpperBound: number;
    promptTokensObserved: number | null;
    outputTokensObserved: number | null;
    doneReason: string | null;
    counting?: 'utf8-byte-upper-bound';
    framingReserve?: number;
    admissionVersion?: string;
    promptVersion?: string;
    schemaVersion?: string;
    completedAt?: number;
    durationMs?: number;
    error?: string;
    remote?: {
      reportedModel: string | null;
      requestId: string | null;
      promptTokens: number | null;
      outputTokens: number | null;
      finishReason: string | null;
      httpStatus: number;
      retryAfter: string | null;
    };
  }[];
  attemptCharged: boolean;
  candidateCharged: boolean;
  manualPermit: boolean;
  epoch: number;
  model: string;
  modelDigest: string;
  promptVersion:
    | 'provider-2'
    | 'provider-1'
    | 'coherent-2'
    | 'coherent-3'
    | 'coherent-4'
    | 'coherent-5'
    | 'coherent-6';
  schemaVersion: 'candidate-5' | 'candidate-4' | 'candidate-1' | 'candidate-2' | 'candidate-3';
  language: 'ru' | 'en';
  direction: Direction | null;
  question: string;
  previousJob: string | null;
  targetRevision?: Identity;
  draft: Draft | null;
  assessment: Assessment | null;
  raw: { stage: string; raw: string; at: number }[];
  primaryFailure: string;
  repairRefusal: string;
  observed: boolean;
}
export interface Revision {
  job?: string;
  assessments?: Assessment[];
  references?: Reference[];
  revision: number;
  content: Candidate;
  hash: string;
  origin: Origin;
  entry: Entry;
  assessment: Assessment | null;
}
export interface Decision {
  id: string;
  revision: number;
  state: 'kept' | 'rejected' | 'later' | 'new';
  reasons: string[];
  note: string;
  at: number;
  override: boolean;
}
export interface Node {
  recorded?: boolean;
  id: string;
  garden: string;
  kind: 'candidate' | 'growth';
  parents: Identity[];
  job: string;
  revisions: Revision[];
  decisions: Decision[];
  accepted: boolean;
  creditHeld: boolean;
  imported: boolean;
  references: Reference[];
}
export interface Call {
  id: string;
  job: string;
  date: string;
  at: number;
  stage: string;
}
export interface Daily {
  attempts: string[];
  candidates: string[];
}
export interface Lifecycle {
  id: string;
  session: string;
  job: string | null;
  kind:
    | 'launch'
    | 'pause requested'
    | 'remote wait drained'
    | 'stage drained'
    | 'release confirmed'
    | 'release failed'
    | 'shutdown prepared'
    | 'shutdown failed'
    | 'evidence gap';
  at: number;
  elapsed: number;
  error: string;
}
export interface Workspace {
  provider?: ProviderConfig;
  claudeExecutable?: string;
  requests?: {
    id: string;
    fingerprint: string;
    garden: string;
    job: string | null;
    at: number;
    state: 'blocked' | 'started' | 'settled' | 'uncertain';
    reason: string;
  }[];
  schemaVersion: 3;
  revision: number;
  gardens: Garden[];
  sources: Source[];
  documents: Document[];
  references: Reference[];
  preferences: Preference[];
  jobs: Job[];
  nodes: Node[];
  consumed: { key: string; node: string }[];
  calls: Call[];
  daily: Record<string, Daily>;
  settings: {
    attempts: number;
    candidates: number;
    calls: number;
    backlog: number;
    timezone: string;
    language: 'ru' | 'en';
    exportScope: 'kept' | 'all' | 'filtered';
  };
  runtime: LegacyWorkspace['runtime'];
  exportDirectory: string;
  paused: boolean;
  epoch: number;
  failures: number;
  attention: string;
  latestDate: string;
  lastObservedAt: number;
  lifecycle: Lifecycle[];
  legacy: LegacyWorkspace | null;
}
