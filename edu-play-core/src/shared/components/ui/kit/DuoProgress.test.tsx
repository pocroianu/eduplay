import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DuoProgress, DuoProgressRing } from './DuoProgress';

describe('DuoProgress', () => {
  it('has role="progressbar" with aria-valuenow', () => {
    render(<DuoProgress value={42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps value below 0 to 0', () => {
    render(<DuoProgress value={-10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps value above 100 to 100', () => {
    render(<DuoProgress value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders fill bar at correct width percentage', () => {
    const { container } = render(<DuoProgress value={75} />);
    const fill = container.querySelector('[class*="absolute left-0"]') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(0.75)');
  });

  it('showPercent displays the percentage text', () => {
    render(<DuoProgress value={63} showPercent />);
    expect(screen.getByText('63%')).toBeInTheDocument();
  });

  it('does not display percentage text when showPercent is false', () => {
    render(<DuoProgress value={63} />);
    expect(screen.queryByText('63%')).not.toBeInTheDocument();
  });

  it('rounds displayed percentage', () => {
    render(<DuoProgress value={33.7} showPercent />);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<DuoProgress value={50} className="my-bar" />);
    expect(screen.getByRole('progressbar')).toHaveClass('my-bar');
  });

  it('respects custom height', () => {
    render(<DuoProgress value={50} height={20} />);
    expect(screen.getByRole('progressbar').style.height).toBe('20px');
  });
});

describe('DuoProgressRing', () => {
  it('has role="progressbar" with aria-valuenow', () => {
    render(<DuoProgressRing value={55} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveAttribute('aria-valuenow', '55');
    expect(ring).toHaveAttribute('aria-valuemin', '0');
    expect(ring).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders as an SVG element', () => {
    render(<DuoProgressRing value={50} />);
    const ring = screen.getByRole('progressbar');
    expect(ring.querySelector('svg')).toBeInTheDocument();
  });

  it('clamps value below 0 to 0', () => {
    render(<DuoProgressRing value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps value above 100 to 100', () => {
    render(<DuoProgressRing value={200} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('respects custom size', () => {
    render(<DuoProgressRing value={50} size={80} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveStyle({ width: '80px', height: '80px' });
  });

  it('defaults to size 48', () => {
    render(<DuoProgressRing value={50} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('forwards className', () => {
    render(<DuoProgressRing value={50} className="my-ring" />);
    expect(screen.getByRole('progressbar')).toHaveClass('my-ring');
  });
});
