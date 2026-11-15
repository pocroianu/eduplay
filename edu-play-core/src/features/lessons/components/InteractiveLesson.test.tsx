import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InteractiveLesson } from './InteractiveLesson';

describe('InteractiveLesson controls', () => {
  it('keeps answer selection and submission working after migrating buttons', () => {
    render(<InteractiveLesson title="Numărăm" subject="math" profile={{ full_name: 'Ana' }}
      steps={[{ id: 'count', type: 'multiple-choice', question: 'Cât face 1 + 1?',
        options: [{ id: 'two', label: 'Doi', isCorrect: true }, { id: 'three', label: 'Trei', isCorrect: false }] }]} />);
    const check = screen.getByRole('button', { name: /verifică/i });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Doi' }));
    expect(check).toBeEnabled();
    fireEvent.click(check);
    expect(screen.getByRole('button', { name: /Doi/ })).toBeDisabled();
  });

  it('labels blank inputs and preserves answer validation', () => {
    const onComplete = vi.fn();
    render(<InteractiveLesson title="Numărăm" subject="math" profile={{ full_name: 'Ana' }}
      onComplete={onComplete}
      steps={[{ id: 'blank', type: 'fill-in-the-blank', question: 'Scrie numărul doi',
        blanks: [{ id: 'answer', placeholder: 'Răspunsul tău', acceptedAnswers: ['2'] }] }]} />);
    const input = screen.getByRole('textbox', { name: 'Răspunsul tău' });
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /verifică/i }));
    expect(input).toBeDisabled();
    expect(input).toHaveValue('2');
  });
});
