// StartStep — choose how to seed the wizard: blank, a template, or the current
// scenario. Picking one resets the wizard's draft + links.

import { T, Button, SectionTitle, Badge } from '../../kit.jsx';

const TEMPLATES = [
  { key: 'linearLine', label: 'Linear line', desc: 'M800 value stream — a straight conveyor chain.' },
  { key: 'assemblyLine', label: 'Assembly + QC', desc: 'Two feeds assembled, then inspected (ship/scrap).' },
  { key: 'carrierLine', label: 'Carrier (AMR)', desc: 'A middle link moved by an AMR carrier pool.' },
];

export default function StartStep({ ctx }) {
  const { start, mode, reason } = ctx;
  return (
    <div>
      <SectionTitle>Start from</SectionTitle>
      <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5, margin: '0 0 12px' }}>
        Build a factory step by step. The wizard generates the transport network for
        you from the order of your stations — you never have to draw nodes or segments.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row title="Blank factory" desc="Start empty and add everything yourself." onClick={() => start('blank')} testid="start-blank" />
        <Row title="Edit current scenario" desc="Load the scenario that's running now and tweak it." onClick={() => start('current')} testid="start-current" />
        <SectionTitle>Or from a template</SectionTitle>
        {TEMPLATES.map((t) => (
          <Row key={t.key} title={t.label} desc={t.desc} onClick={() => start(t.key)} testid={`start-${t.key}`} />
        ))}
      </div>

      {mode === 'advanced' && (
        <div data-testid="wizard-advanced-note" style={{ marginTop: 14, padding: 10, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: `1px solid ${T.amber}`, color: '#fcd34d', fontSize: 11.5, lineHeight: 1.5 }}>
          <Badge color={T.amber} bg="rgba(245,158,11,0.15)">Advanced</Badge>{' '}
          This network isn't a simple line ({reason}). You can still edit materials,
          processes, station parameters, shifts and orders here — but topology changes
          go through the Network panel.
        </div>
      )}
    </div>
  );
}

function Row({ title, desc, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{ textAlign: 'left', background: 'rgba(8,14,28,0.5)', border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: '10px 12px', cursor: 'pointer', color: T.text }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textDim }}>{title}</div>
      <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{desc}</div>
    </button>
  );
}
