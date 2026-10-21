import type { Generation } from '../domain/generation';

export function InferenceHistory({ runs }: { runs: Generation[] }) {
  return (
    <div className="inference-history">
      <p>
        Original responses, including invalid outputs and no blend, stay unchanged. Structural
        validity does not certify usefulness. Older backups may have no transcripts.
      </p>
      {!runs.length && <p>No inference transcripts have been saved in this garden.</p>}
      {runs.map((run) => (
        <details key={run.id}>
          <summary>
            {run.status} · {run.model} · {run.language}
          </summary>
          <p>
            {run.backend === 'replay' ? 'Recorded demo — no live AI' : `Local ${run.backend}`} ·{' '}
            {new Date(run.createdAt).toLocaleString()}
          </p>
          <p>
            Request: {run.id}
            <br />
            Model revision: {run.modelRevision}
            <br />
            Prompt: {run.promptVersion}
          </p>
          <p>
            A, revision {run.parents[0].revision}: {run.parents[0].text}
          </p>
          <p>
            B, revision {run.parents[1].revision}: {run.parents[1].text}
          </p>
          {run.error && <p>{run.error}</p>}
          {!run.responses.length && <p>No model response was received.</p>}
          {run.responses.map((response, i) => (
            <section key={i}>
              <h3>{response.phase === 'primary' ? 'Primary response' : 'Repair response'}</h3>
              <p>{response.validationError ?? 'Structure valid; usefulness not certified.'}</p>
              <pre>{response.raw}</pre>
            </section>
          ))}
        </details>
      ))}
    </div>
  );
}
