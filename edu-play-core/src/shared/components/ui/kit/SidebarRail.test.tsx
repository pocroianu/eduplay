import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarRail } from './SidebarRail';

const profile = { name: 'Maria Popescu', subtitle: 'Profesor', initials: 'MP' };

function renderSidebar(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const navItems = [
  { href: '/teacher', label: 'Panou', icon: 'SquaresFour' as const, active: true },
  { href: '/teacher/activities/generate', label: 'Generează activitate', icon: 'Sparkle' as const, badge: 'Nou' },
  { href: '/teacher/libraries/explore', label: 'Biblioteci', icon: 'Storefront' as const, dot: true },
] as const;

describe('SidebarRail', () => {
  it('renders Seesaw-style sidebar sections and active navigation', () => {
    renderSidebar(
      <SidebarRail
        brandLabel="EduPlay"
        profile={profile}
        navItems={navItems}
        classItems={[{ href: '/teacher/classes/class-1', label: 'Clasa I', icon: 'Users' as const, initials: 'CI' }]}
        utilityItems={[{ href: '/scan', label: 'Scanare', icon: 'Camera' as const }]}
        onProfileClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'EduPlay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deschide meniul contului/i })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: /navigare principală/i });
    const active = within(navigation).getByRole('link', { name: /panou/i });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAttribute('data-active');
    expect(screen.getByText('Nou')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-dot-Biblioteci')).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: /biblioteci/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /clasa i/i })).toHaveAttribute('href', '/teacher/classes/class-1');
    expect(within(screen.getByRole('link', { name: /clasa i/i })).getByText('CI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /scanare/i })).toHaveAttribute('href', '/scan');
  });

  it('preserves accessible labels when collapsed and exposes the collapse toggle', () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar(
      <SidebarRail
        brandLabel="EduPlay"
        collapsed
        profile={profile}
        navItems={navItems}
        utilityItems={[{ href: '/settings', label: 'Setări', icon: 'SlidersHorizontal' as const }]}
        onToggleCollapsed={onToggleCollapsed}
        onProfileClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'EduPlay' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Panou' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /generează activitate nou/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /biblioteci notificare nouă/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Setări' })).toBeInTheDocument();
    expect(screen.queryByText('Nou')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /extinde navigarea/i });
    toggle.click();
    expect(onToggleCollapsed).toHaveBeenCalledOnce();

    const accountButton = screen.getByRole('button', { name: /deschide meniul contului/i });
    expect(accountButton).toHaveStyle({
      width: '44px',
      height: '44px',
      padding: '0px',
    });
    expect(accountButton).toHaveStyle({ borderStyle: 'none' });

    expect(screen.getByRole('link', { name: 'Panou' })).toHaveStyle({
      width: '44px',
      height: '44px',
      padding: '0px',
    });

    const activeCollapsedLink = screen.getByRole('link', { name: 'Panou' });
    expect(activeCollapsedLink.querySelector('.mantine-NavLink-body')).not.toBeInTheDocument();
    expect(activeCollapsedLink.querySelector('.mantine-NavLink-section')).not.toBeInTheDocument();
  });

  it('does not force a layout reflow width transition', () => {
    const { container } = renderSidebar(
      <SidebarRail brandLabel="EduPlay" navItems={navItems} />,
    );

    const rail = container.querySelector('aside');
    expect(rail).toBeInTheDocument();
    expect(rail?.getAttribute('style')).not.toContain('transition: width');
    expect(rail?.getAttribute('style')).toContain('--sidebar-rail-transition');
  });
});
