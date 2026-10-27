import { isRemote } from './provider';
import { bytes, canonical, hash } from './hash';
import { generationPrompt, screeningPrompt, schemaForJob, schemaForAssessment } from './contract';
import { key } from './prepare';
import type { Candidate, Job } from './types';

export const CONTEXT_LIMIT = 4096;
export const TEMPLATE_RESERVE = 512;
export const GENERATION_TOKENS = 1400;
export const SCREENING_TOKENS = 640;
export const STAGE_TIMEOUT_MS = 180000;
export const STOP_TIMEOUT_MS = 20000;
// The repair never repeats unbounded provider text. The original parser error is
// retained separately. This exact instruction is reserved before either stage.
export const FORMAT_REPAIR =
  'Return only valid JSON matching the supplied schema and declared byte limit. Resolve all citations. No commentary.';
const COMPACT_REPAIR =
  'Shorten each field to its schema maxLength. One e-ID per parent. Empty unused fields. Valid JSON only; no extra prose.';
export interface Admission {
  version:
    | 'provider-admission-1'
    | 'job-admission-1'
    | 'job-admission-2'
    | 'job-admission-3'
    | 'job-admission-4';
  representation: 'screening-tuple-1';
  counting: 'utf8-byte-upper-bound';
  tokenizer: null;
  contextLimit: number;
  framingReserve: 512;
  generationTokens: number;
  screeningTokens: number;
  maxDraftBytes: number;
  generationUpperBound: number;
  screeningUpperBound: number;
  repairInstruction: string;
  contextHash: string;
  exactDraftHash: string | null;
  omissions: string[];
}

export function compactContext(j: Job): string {
  const p = JSON.parse(j.pack.payload) as { target: string; objective: string; request: string };
  let request: unknown = p.request;
  if (['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion)) {
    try {
      const r = JSON.parse(p.request) as { previousDraft?: unknown; question?: string };
      if (r.previousDraft) request = { question: r.question, previousDraft: r.previousDraft };
    } catch {
      /* A plain creative request remains exact text. */
    }
  }
  if (j.promptVersion === 'coherent-5') {
    const statuses = [...new Set(j.pack.evidence.map((e) => e.status))];
    return canonical([
      p.target,
      p.objective,
      request,
      j.parents.length,
      statuses,
      j.pack.evidence.map((e) => [
        e.id,
        e.parent ? 'p' + j.parents.findIndex((p) => key(p) === key(e.parent!)) : null,
        e.parent && e.parent.kind !== 'source' ? compactParent(e.text) : e.text,
        statuses.indexOf(e.status),
      ]),
    ]);
  }
  return canonical({
    v: ['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion)
      ? 'context-tuple-2'
      : 'context-tuple-1',
    target: p.target,
    objective: p.objective,
    request,
    // Full identities, original spans, omissions and fingerprints remain in pack.
    // pN is a reversible alias, never a different source or revision.
    parents: j.parents.map((_, i) => 'p' + i),
    evidence: j.pack.evidence.map((e) => [
      e.id,
      e.parent ? 'p' + j.parents.findIndex((p) => key(p) === key(e.parent!)) : null,
      ['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion) &&
      e.parent &&
      e.parent.kind !== 'source'
        ? compactParent(e.text)
        : e.text,
      e.status,
    ]),
  });
}
function compactParent(raw: string): unknown {
  const c = JSON.parse(raw) as Candidate;
  if (c.outcome !== 'candidate') return raw;
  // The accepted revision's ancestor identities remain in its immutable full
  // evidence text. aN is its reversible contribution index, not a new ancestor.
  return {
    candidateTuple: [
      ...DRAFT_FIELDS.map((f) => c[f]),
      c.contributions.map((p, i) => ['a' + i, p.text, p.evidence]),
      c.references.map((r) => [r.id, r.property, r.difference, r.evidence]),
    ],
  };
}
export const DRAFT_FIELDS = [
  'title',
  'summary',
  'target',
  'experience',
  'core',
  'example',
  'interaction',
  'unknowns',
  'nextQuestion',
  'preservedCore',
  'delta',
  'changedAssumption',
  'test',
] as const;
export function compactDraft(j: Job, draft = j.draft): string {
  if (draft?.outcome !== 'candidate') throw new Error('A retained candidate is required.');
  return canonical([
    ...DRAFT_FIELDS.map((f) => draft[f]),
    draft.contributions.map((c) => [
      'p' + j.parents.findIndex((p) => key(p) === c.parent),
      c.text,
      c.evidence,
    ]),
    draft.references.map((r) => [r.id, r.property, r.difference, r.evidence]),
  ]);
}
// Four bytes per Unicode code point bounds well-formed, control-free JSON text.
// Quotes/backslashes and the permitted tab/newline/return cost only two bytes.
// Parent/citation enums and fixed fields are counted in the tuple skeleton.
export function draftLimits(j: Job): Record<string, number> {
  const fields: Record<string, number> = {
    title: 1,
    summary: 1,
    experience: 1,
    core: 5,
    example: 5,
    interaction: 2,
    contribution: j.parents.length,
    ...(j.operation === 'growth'
      ? { preservedCore: 1, delta: 2, changedAssumption: 1, test: 2 }
      : {}),
  };
  const longestId =
    j.pack.evidence
      .map((e) => e.id)
      .sort((a, b) => bytes(JSON.stringify(b)) - bytes(JSON.stringify(a)))[0] ?? '';
  const skeleton = canonical([
    '',
    '',
    'application',
    '',
    '',
    '',
    '',
    [],
    '',
    '',
    '',
    '',
    '',
    j.parents.map((_, i) => ['p' + i, '', [longestId]]),
    [],
  ]);
  const units = Math.max(0, Math.floor(((j.admission?.maxDraftBytes ?? 0) - bytes(skeleton)) / 4));
  const weight = Object.values(fields).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(fields).map(([field, share]) => [
      field,
      Math.floor((units * (field === 'contribution' ? 1 : share)) / weight),
    ]),
  );
}
export function planAdmission(j: Job, exactDraft?: Candidate): Admission {
  if (isRemote(j.provider)) {
    const a: Admission = {
      version: 'provider-admission-1',
      representation: 'screening-tuple-1',
      counting: 'utf8-byte-upper-bound',
      tokenizer: null,
      contextLimit: j.provider!.contextLimit,
      framingReserve: 512,
      generationTokens: 3072,
      screeningTokens: 2048,
      maxDraftBytes: 7600,
      generationUpperBound: 0,
      screeningUpperBound: 0,
      repairInstruction: FORMAT_REPAIR,
      contextHash: j.pack.hash,
      exactDraftHash: exactDraft ? hash(canonical(exactDraft)) : null,
      omissions: [],
    };
    const probe = { ...j, admission: a, draft: exactDraft ?? null };
    a.generationUpperBound =
      bytes(generationPrompt(probe, FORMAT_REPAIR)) +
      bytes(JSON.stringify(schemaForJob(probe))) +
      128 +
      512 +
      a.generationTokens;
    a.screeningUpperBound =
      bytes(screeningPrompt({ ...probe, draft: null }, FORMAT_REPAIR)) +
      bytes(JSON.stringify(schemaForAssessment(probe))) +
      128 +
      a.maxDraftBytes +
      512 +
      a.screeningTokens;
    if (a.generationUpperBound > a.contextLimit || a.screeningUpperBound > a.contextLimit)
      throw new Error(
        'admission: Selected context and complete two-stage API pipeline exceed the declared allowance.',
      );
    if (exactDraft && bytes(compactDraft(j, exactDraft)) > a.maxDraftBytes)
      throw new Error('admission: Exact retained draft exceeds API allowance.');
    return a;
  }
  const a: Admission = {
    version:
      j.promptVersion === 'coherent-6'
        ? 'job-admission-4'
        : j.promptVersion === 'coherent-5'
          ? 'job-admission-3'
          : j.promptVersion === 'coherent-4'
            ? 'job-admission-2'
            : 'job-admission-1',
    representation: 'screening-tuple-1',
    counting: 'utf8-byte-upper-bound',
    tokenizer: null,
    contextLimit: CONTEXT_LIMIT,
    framingReserve: TEMPLATE_RESERVE,
    generationTokens: GENERATION_TOKENS,
    screeningTokens: ['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion)
      ? SCREENING_TOKENS
      : 480,
    maxDraftBytes: 0,
    generationUpperBound: 0,
    screeningUpperBound: 0,
    repairInstruction: ['coherent-5', 'coherent-6'].includes(j.promptVersion)
      ? COMPACT_REPAIR
      : FORMAT_REPAIR,
    contextHash: j.pack.hash,
    exactDraftHash: exactDraft ? hash(canonical(exactDraft)) : null,
    omissions: [
      'Repeated JSON field names use the documented tuple order.',
      'Parent identities use reversible pN aliases; full identities and original span mapping remain in the saved pack.',
      'Constant candidate outcome is implicit. All creative text, reference claims, evidence and constraints are retained.',
    ],
  };
  if (['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion))
    a.omissions.push(
      'For targeted revisions, redundant request provenance/omission metadata is kept in the full pack; selected previousDraft and user question are sent exactly.',
    );
  if (
    ['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion) &&
    j.parents.some((p) => p.kind !== 'source')
  )
    a.omissions.push(
      'Accepted-parent evidence uses the same candidateTuple field order and aN contribution aliases; full original identities remain in its exact saved evidence text.',
    );
  const probe: Job = { ...j, admission: a, draft: null };
  const screenBase = bytes(screeningPrompt(probe, a.repairInstruction));
  // The numeric limit itself is in the generation instruction. Four decimal
  // digits bound its representation, independent of the selected capacity.
  a.maxDraftBytes = Math.min(
    2300,
    CONTEXT_LIMIT - TEMPLATE_RESERVE - a.screeningTokens - screenBase,
  );
  const generationInput = bytes(generationPrompt(probe, a.repairInstruction)) + TEMPLATE_RESERVE;
  if (['coherent-4', 'coherent-5', 'coherent-6'].includes(j.promptVersion))
    a.generationTokens = Math.min(GENERATION_TOKENS, CONTEXT_LIMIT - generationInput);
  a.generationUpperBound = generationInput + a.generationTokens;
  a.screeningUpperBound = screenBase + a.maxDraftBytes + TEMPLATE_RESERVE + a.screeningTokens;
  if (
    a.maxDraftBytes < 1100 ||
    (j.operation !== 'check' &&
      (a.generationUpperBound > CONTEXT_LIMIT || a.generationTokens < 900))
  )
    throw new Error(
      'admission: Не удалось подготовить запрос в пределах модели. Выберите меньше необязательных полных разделов или сократите цель сада; оригиналы сохранятся.',
    );
  if (exactDraft && bytes(compactDraft(j, exactDraft)) > a.maxDraftBytes)
    throw new Error(
      'admission: Не удалось подготовить запрос в пределах модели: прежний точный черновик и обязательные доказательства не помещаются. Подготовьте явную новую попытку; прежний текст сохранён.',
    );
  return a;
}
export function assertAdmission(j: Job) {
  const a = j.admission;
  if (!a) return; // Historical jobs retain their original contract and accounting.
  const expected = planAdmission(
    j,
    a.exactDraftHash && j.draft?.outcome === 'candidate' ? j.draft : undefined,
  );
  if (canonical(a) !== canonical(expected)) throw new Error('Invalid whole-job admission plan.');
}
