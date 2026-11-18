import { describe, it, expect } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import type { ReactElement } from 'react';
import {
  ActionMenu,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterSelect,
  SegmentedTabs,
  TextField,
  TextareaField,
  type DataTableColumn,
} from '@/shared/components/ui/kit';
import { DuoTooltip } from '@/shared/components/ui/kit/DuoTooltip';
import { eduPlayMantineTheme } from '@/shared/theme';

expect.extend(axeMatchers);

// `region` (all content inside a landmark) is a page-level rule; isolated
// components are rendered without landmarks. No other rule is disabled.
const AXE_OPTIONS = { rules: { region: { enabled: false } } };

async function expectNoViolations(ui: ReactElement, target: 'container' | 'body' = 'container') {
  const { container } = render(<MantineProvider theme={eduPlayMantineTheme}>{ui}</MantineProvider>);
  const results = await axe(target === 'body' ? document.body : container, AXE_OPTIONS);
  expect(results).toHaveNoViolations();
}

type Row = { id: string; name: string; progress: number };
const ROWS: Row[] = [
  { id: 'a', name: 'Ana', progress: 80 },
  { id: 'b', name: 'Bogdan', progress: 55 },
];
const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Nume', sortable: true, cell: (r) => r.name },
  { key: 'progress', header: 'Progres', align: 'right', cell: (r) => `${r.progress}%` },
];

describe('kit accessibility (axe)', () => {
  it('Button default', async () => {
    await expectNoViolations(<Button>Salvează</Button>);
  });

  it('Button kid mode', async () => {
    await expectNoViolations(<Button mode="kid" size="lg">Începe jocul</Button>);
  });

  it('Card', async () => {
    await expectNoViolations(
      <Card>
        <h2>Clasa a II-a</h2>
        <p>24 de elevi</p>
      </Card>,
    );
  });

  it('TextField', async () => {
    await expectNoViolations(<TextField label="Email" helper="Adresa de contact" />);
  });

  it('TextField with error', async () => {
    await expectNoViolations(<TextField label="Email" error="Email invalid" />);
  });

  it('TextareaField', async () => {
    await expectNoViolations(<TextareaField label="Descriere" helper="Maxim 200 de caractere" />);
  });

  it('FilterSelect', async () => {
    await expectNoViolations(
      <FilterSelect
        label="Materie"
        value="mate"
        onChange={() => undefined}
        options={[
          { value: 'mate', label: 'Matematică' },
          { value: 'ro', label: 'Română' },
        ]}
      />,
    );
  });

  it('ConfirmDialog (open)', async () => {
    await expectNoViolations(
      <ConfirmDialog open title="Ștergi elevul?" body="Acțiunea nu poate fi anulată." onConfirm={() => undefined} onCancel={() => undefined} />,
      'body',
    );
  });

  it('DataTable with rows', async () => {
    await expectNoViolations(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} sortKey="name" sortDirection="asc" />);
  });

  it('SegmentedTabs', async () => {
    await expectNoViolations(
      <SegmentedTabs
        ariaLabel="Tip cont"
        value="teacher"
        onChange={() => undefined}
        tabs={[
          { value: 'teacher', label: 'Profesor' },
          { value: 'parent', label: 'Părinte' },
        ]}
      />,
    );
  });

  it('Checkbox', async () => {
    await expectNoViolations(<Checkbox label="Țin minte parola" />);
  });

  it('EmptyState', async () => {
    await expectNoViolations(<EmptyState icon="Sparkle" title="Nicio activitate încă" description="Creează prima activitate." />);
  });

  it('ActionMenu trigger', async () => {
    await expectNoViolations(<ActionMenu items={[{ key: 'edit', label: 'Editează', onSelect: () => undefined }]} />);
  });

  it('DuoTooltip', async () => {
    await expectNoViolations(
      <DuoTooltip content="Mai multe detalii">
        <button type="button">Info</button>
      </DuoTooltip>,
    );
  });
});
