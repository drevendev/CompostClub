import { sourceRevisions, type Scrap } from '../domain/garden';

export function SourceHistory({ scrap }: { scrap: Scrap }) {
  const revisions = sourceRevisions(scrap);
  const first = revisions[0]!.revision;
  return (
    <div className="source-history">
      <p>
        Saved raw inputs, including whitespace and Unicode spelling. Older sprouts keep their exact
        source snapshots.
      </p>
      {first > 1 && (
        <p>
          Revisions before {first} were not saved in the older record. Their original raw text is
          unavailable.
        </p>
      )}
      {revisions.toReversed().map((revision) => (
        <section key={revision.revision}>
          <h3>
            {revision.revision === scrap.revision ? 'Current revision' : 'Revision'}{' '}
            {revision.revision}
          </h3>
          <p>Source: {revision.origin}</p>
          <pre>{revision.raw}</pre>
        </section>
      ))}
    </div>
  );
}
