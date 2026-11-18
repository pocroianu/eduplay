// ButtonMatrix — renders one palette's full button state matrix.
// Five button kinds (Primary, Secondary, Ghost, Success, Danger)
// across five states (Default, Hover, Active/pressed, Focused, Disabled)
// plus a Live column where the real :hover and :active states fire so
// the user can feel the transition timing.

function Swatch({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4, background: color,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
      }} />
      <span style={{ fontFamily: 'var(--ss-font-mono)', fontSize: 11, color: '#455661' }}>{label || color}</span>
    </div>
  );
}

// Static state renderer — paints the exact look of one button state
// without needing real hover. Use this to compare states across palettes.
function StateBtn({ kind, state, label, palette }) {
  const tokens = palette[kind];
  const base = {
    fontFamily: 'var(--ss-font-sans)',
    fontWeight: 600,
    fontSize: 13,
    padding: '10px 18px',
    borderRadius: 8,
    border: tokens.border ? `1.5px solid ${tokens.border}` : 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 96,
    transition: 'background-color 180ms cubic-bezier(0.4,0,0.2,1), box-shadow 180ms, transform 100ms',
    background: tokens.base,
    color: tokens.fg,
    boxShadow: 'none',
    transform: 'translateY(0)',
  };

  if (state === 'hover') {
    base.background = tokens.hover;
    base.boxShadow = '0 2px 6px rgba(30,13,3,0.10)';
  } else if (state === 'active') {
    base.background = tokens.active;
    base.transform = 'translateY(1px)';
    base.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.15)';
  } else if (state === 'focus') {
    base.boxShadow = `0 0 0 3px ${tokens.focus}`;
  } else if (state === 'disabled') {
    base.background = kind === 'ghost' || kind === 'secondary' ? base.background : '#E3E8EC';
    base.color = '#7B8993';
    base.border = tokens.border ? '1.5px solid #D3DBE0' : 'none';
    base.cursor = 'not-allowed';
    base.boxShadow = 'none';
  }
  // Selected variant for ghost / secondary — for nav-like buttons
  if (state === 'selected') {
    base.background = tokens.active;
    base.color = tokens.fg === '#fff' ? '#fff' : tokens.fg;
    base.boxShadow = 'inset 0 0 0 1.5px ' + (tokens.border || tokens.base);
  }

  return <button style={base} tabIndex={-1}>{label}</button>;
}

// Interactive button — real CSS-driven hover/active/focus so users can
// feel the timing. Uses inline style + a tiny inline <style> for :hover.
function LiveBtn({ kind, label, palette, paletteKey }) {
  const tokens = palette[kind];
  const id = `lb-${paletteKey}-${kind}`;
  const css = `
    #${id} {
      background: ${tokens.base};
      color: ${tokens.fg};
      ${tokens.border ? `border: 1.5px solid ${tokens.border};` : 'border: 0;'}
      font: 600 13px/1 var(--ss-font-sans);
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      min-width: 96px;
      transition: background-color 180ms cubic-bezier(0.4,0,0.2,1),
                  box-shadow 180ms cubic-bezier(0.4,0,0.2,1),
                  transform 80ms cubic-bezier(0.4,0,0.2,1);
    }
    #${id}:hover {
      background: ${tokens.hover};
      box-shadow: 0 2px 6px rgba(30,13,3,0.10);
    }
    #${id}:active {
      background: ${tokens.active};
      transform: translateY(1px);
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.15);
    }
    #${id}:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px ${tokens.focus};
    }
  `;
  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <button id={id}>{label}</button>
    </React.Fragment>
  );
}

const STATES = [
  ['default', 'Default'],
  ['hover',   'Hover'],
  ['active',  'Pressed'],
  ['focus',   'Focused'],
  ['disabled','Disabled'],
];
const KINDS = [
  ['primary',   'Primary',   'Add'],
  ['secondary', 'Secondary', 'Cancel'],
  ['ghost',     'Ghost',     'View All'],
  ['success',   'Success',   'Post'],
  ['danger',    'Danger',    'Delete'],
];

function ButtonMatrix({ palette }) {
  const key = palette.name.replace(/\s+/g, '-').toLowerCase();
  return (
    <div style={{ padding: 24, background: '#fff', height: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ss-fg)' }}>{palette.name}</h2>
          <div style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--ss-fg-muted)' }}>{palette.sub}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {palette.swatches.map(c => <Swatch key={c} color={c} />)}
          </div>
        </div>
      </header>

      {/* State matrix */}
      <div style={{ display: 'grid',
                    gridTemplateColumns: 'auto repeat(5, 1fr) auto',
                    columnGap: 10, rowGap: 12, alignItems: 'center' }}>
        {/* Header row */}
        <div />
        {STATES.map(([k, n]) => (
          <div key={k} style={hcell}>{n}</div>
        ))}
        <div style={hcell}>Live</div>

        {KINDS.map(([kind, kindLabel, btnLabel]) => (
          <React.Fragment key={kind}>
            <div style={kindCell}>{kindLabel}</div>
            {STATES.map(([state]) => (
              <div key={state} style={{ display: 'flex', justifyContent: 'center' }}>
                <StateBtn kind={kind} state={state} label={btnLabel} palette={palette} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <LiveBtn kind={kind} label={btnLabel} palette={palette} paletteKey={key} />
            </div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--ss-fg-subtle)',
                    borderTop: '1px solid var(--ss-line-200)', paddingTop: 10 }}>
        Transitions: <span style={{ fontFamily: 'var(--ss-font-mono)' }}>background-color · box-shadow · transform</span>,
        180ms / <span style={{ fontFamily: 'var(--ss-font-mono)' }}>cubic-bezier(0.4, 0, 0.2, 1)</span>. Pressed shifts 1px down with an inset shadow.
      </div>
    </div>
  );
}

const hcell = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--ss-fg-muted)',
  textAlign: 'center', paddingBottom: 4,
};
const kindCell = {
  fontSize: 13, fontWeight: 600, color: 'var(--ss-fg)',
  paddingRight: 8, whiteSpace: 'nowrap',
};

Object.assign(window, { ButtonMatrix });
