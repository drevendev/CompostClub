// Deterministic structural diagnostics only. Never include response values in feedback.
export const REMOTE_REPAIR_MAX_BYTES = 1024;
export interface LimitIssue {
  path: string;
  rule: 'maxLength' | 'minLength' | 'maxItems' | 'minItems' | 'type' | 'nonblank';
  actual: number;
  limit: number;
}
interface Shape {
  type?: string;
  properties?: Record<string, Shape>;
  items?: Shape;
  oneOf?: Shape[];
  const?: unknown;
  enum?: unknown[];
  maxLength?: number;
  minLength?: number;
  maxItems?: number;
  minItems?: number;
  pattern?: string;
}
export function responseLimitIssues(value: unknown, schema: unknown): LimitIssue[] {
  const issues: LimitIssue[] = [];
  const add = (path: string, rule: LimitIssue['rule'], actual: number, limit: number) => {
    if (issues.length < 8) issues.push({ path, rule, actual, limit });
  };
  const visit = (v: unknown, s: Shape, path: string) => {
    if (issues.length >= 8) return;
    if (s.oneOf) {
      const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
      const branch = s.oneOf.find((b) =>
        Object.entries(b.properties ?? {}).some(
          ([key, p]) => (p.const !== undefined && p.const === o[key]) || p.enum?.includes(o[key]),
        ),
      );
      if (branch) visit(v, branch, path);
      return;
    }
    if (s.type === 'string') {
      if (typeof v !== 'string') {
        add(path, 'type', 0, 0);
        return;
      }
      const n = [...v].length;
      if (s.maxLength !== undefined && n > s.maxLength) add(path, 'maxLength', n, s.maxLength);
      if (s.minLength !== undefined && n < s.minLength) add(path, 'minLength', n, s.minLength);
      if (s.pattern === '\\S' && !v.trim()) add(path, 'nonblank', 0, 1);
    } else if (s.type === 'array') {
      if (!Array.isArray(v)) {
        add(path, 'type', 0, 0);
        return;
      }
      if (s.maxItems !== undefined && v.length > s.maxItems)
        add(path, 'maxItems', v.length, s.maxItems);
      if (s.minItems !== undefined && v.length < s.minItems)
        add(path, 'minItems', v.length, s.minItems);
      if (s.items)
        for (let i = 0; i < Math.min(v.length, (s.maxItems ?? 8) + 1); i++)
          visit(v[i], s.items, path + '[' + i + ']');
    } else if (s.type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      for (const [key, child] of Object.entries(s.properties ?? {})) {
        // Paths come exclusively from the project schema, never model-supplied keys.
        if (key in o) visit(o[key], child, path + '.' + key);
      }
    }
  };
  visit(value, schema as Shape, '$');
  return issues;
}
export function limitMessage(issues: LimitIssue[]) {
  return (
    'Response contract limits: ' +
    issues.map((i) => `${i.path} ${i.rule} ${i.actual}/${i.limit}`).join('; ')
  );
}
export function assertResponseLimits(value: unknown, schema: unknown) {
  const issues = responseLimitIssues(value, schema);
  if (issues.length) throw new Error(limitMessage(issues));
}
export function boundedRepairFeedback(raw: string, schema: unknown): string {
  let detail = 'JSON or domain validation failed; obey all supplied constraints and evidence IDs.';
  try {
    const issues = responseLimitIssues(JSON.parse(raw), schema);
    if (issues.length) detail = limitMessage(issues);
  } catch {
    /* No source/model fragments from JSON errors enter the prompt. */
  }
  const feedback =
    'The previous response failed validation. ' +
    detail +
    ' Regenerate one complete JSON object. Correct EVERY listed violation. Aim below half each string maximum; keep every fixed source rule. Exactly one contribution per parent, no extras. No commentary.';
  if (new TextEncoder().encode(feedback).length > REMOTE_REPAIR_MAX_BYTES)
    throw new Error('Structural repair feedback exceeds its reserved allowance.');
  return feedback;
}
