// ReviewStep — final summary + full validation. The shell's footer owns the
// gated "Build & apply" button; this step explains readiness.

import { T, SectionTitle, Grid2 } from '../../kit.jsx';

export default function ReviewStep({ ctx }) {
  const { draft, errors, warnings } = ctx;
  const counts = [
    ['Materials', draft.materials.length],
    ['Processes', draft.processes.length],
    ['Stations', draft.stations.length],
    ['Segments', draft.segments.length],
    ['Exits', draft.exits.length],
    ['Carrier pools', draft.carrierPools.length],
    ['Shifts', draft.shifts.length],
    ['Orders', draft.orders.length],
  ];
  return (
    <div>
      <SectionTitle>Review</SectionTitle>
      <Grid2>
        {counts.map(([label, n]) => (
          <div key={label} style={{ border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '8px 10px', background: 'rgba(8,14,28,0.5)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{n}</div>
            <div style={{ fontSize: 11, color: T.textFaint }}>{label}</div>
          </div>
        ))}
      </Grid2>

      <div style={{ marginTop: 14 }}>
        {errors.length > 0 ? (
          <div data-testid="wiz-review-errors" style={{ color: '#fca5a5', fontSize: 12 }}>
            <SectionTitle>Fix before building ({errors.length})</SectionTitle>
            {errors.map((e, i) => <div key={i} style={{ marginBottom: 3 }}>⚠ {e}</div>)}
          </div>
        ) : (
          <div data-testid="wiz-review-ok" style={{ color: T.green, fontSize: 13, fontWeight: 600 }}>✓ Configuration is valid — ready to build.</div>
        )}
        {errors.length === 0 && warnings.length > 0 && (
          <div style={{ color: '#fcd34d', fontSize: 12, marginTop: 8 }}>
            {warnings.map((w, i) => <div key={i}>! {w}</div>)}
          </div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: T.textFaint, marginTop: 14, lineHeight: 1.5 }}>
        Building applies this model to the live twin (a clean re-init) and saves it.
      </p>
    </div>
  );
}
