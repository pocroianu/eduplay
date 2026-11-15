import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectPill, SUBJECT_KEYS, SUBJECT_LABEL } from './SubjectPill';

describe('SubjectPill', () => {
  it('renders children', () => {
    render(<SubjectPill>Matematica</SubjectPill>);
    expect(screen.getByText('Matematica')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<SubjectPill>Label</SubjectPill>);
    const el = screen.getByText('Label').closest('.mantine-Badge-root')!;
    expect(el.tagName).toBe('SPAN');
  });

  it('applies correct background for tone="math"', () => {
    render(<SubjectPill tone="math">Math</SubjectPill>);
    const el = screen.getByText('Math').closest('.mantine-Badge-root')!;
    expect(el).toHaveStyle({
      backgroundColor: 'var(--color-blue-soft)',
      color: 'var(--color-blue-deep)',
    });
  });

  it('applies correct background for tone="coral"', () => {
    render(<SubjectPill tone="coral">Coral</SubjectPill>);
    const el = screen.getByText('Coral').closest('.mantine-Badge-root')!;
    expect(el).toHaveStyle({
      backgroundColor: 'var(--color-coral-soft)',
      color: 'var(--color-coral-deep)',
    });
  });

  it('applies correct background for tone="romana"', () => {
    render(<SubjectPill tone="romana">Romana</SubjectPill>);
    const el = screen.getByText('Romana').closest('.mantine-Badge-root')!;
    expect(el).toHaveStyle({
      backgroundColor: 'var(--color-coral-soft)',
      color: 'var(--color-coral-deep)',
    });
  });

  it('defaults to green tone', () => {
    render(<SubjectPill>Default</SubjectPill>);
    const el = screen.getByText('Default').closest('.mantine-Badge-root')!;
    expect(el).toHaveStyle({
      backgroundColor: 'var(--color-primary-soft)',
      color: 'var(--color-primary-deep)',
    });
  });

  it('applies custom className', () => {
    render(<SubjectPill className="extra-class">Pill</SubjectPill>);
    expect(screen.getByText('Pill').closest('.mantine-Badge-root')).toHaveClass('extra-class');
  });

  it('exposes the canonical 6-subject Romanian taxonomy', () => {
    expect([...SUBJECT_KEYS]).toEqual([
      'romana',
      'math',
      'stiinte',
      'arte',
      'muzica',
      'sport',
    ]);
  });

  it.each([
    ['romana', 'Română'],
    ['math', 'Matematică'],
    ['stiinte', 'Științe'],
    ['arte', 'Arte'],
    ['muzica', 'Muzică'],
    ['sport', 'Sport'],
  ] as const)('SUBJECT_LABEL[%s] uses correct Romanian diacritics', (key, label) => {
    expect(SUBJECT_LABEL[key]).toBe(label);
  });

  it.each(SUBJECT_KEYS)('renders a styled pill for subject key=%s', (key) => {
    render(<SubjectPill tone={key}>{SUBJECT_LABEL[key]}</SubjectPill>);
    const el = screen.getByText(SUBJECT_LABEL[key]).closest<HTMLElement>('.mantine-Badge-root')!;
    expect(el.tagName).toBe('SPAN');
    expect(el.style.backgroundColor).not.toBe('');
    expect(el.style.color).not.toBe('');
  });
  it('uses a primary selected ring instead of black ink for interactive pills', () => {
    render(
      <SubjectPill interactive selected>
        Selectat
      </SubjectPill>,
    );

    const el = screen.getByRole('button', { name: 'Selectat' });
    expect(el).toHaveClass('ring-primary');
    expect(el).not.toHaveClass('ring-ink');
  });
});
