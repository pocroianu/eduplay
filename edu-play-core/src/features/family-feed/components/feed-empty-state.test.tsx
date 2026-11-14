import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { FeedEmptyState } from './feed-empty-state';

const resources = {
  en: {
    parent: {
      feed: {
        empty: {
          noneHeadline: 'No new activity yet',
          noneBody:
            'Teacher posts and finished games will appear here in the order they happen.',
          childHeadline: 'No recent moments for {{name}}',
          childBody:
            'This will appear as soon as a teacher posts work or the child finishes a game.',
        },
      },
    },
  },
} as const;

describe('FeedEmptyState', () => {
  it('renders the cross-child copy when no filter is active', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedEmptyState filteredChildName={null} />
      </I18nProvider>,
    );
    expect(screen.getByText('No new activity yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Teacher posts and finished games will appear here/i),
    ).toBeInTheDocument();
  });

  it('personalizes the headline with the filtered child first name', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedEmptyState filteredChildName="Ana Popescu" />
      </I18nProvider>,
    );
    expect(screen.getByText('No recent moments for Ana')).toBeInTheDocument();
  });

  it('handles a single-word name without crashing', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <FeedEmptyState filteredChildName="Bogdan" />
      </I18nProvider>,
    );
    expect(screen.getByText('No recent moments for Bogdan')).toBeInTheDocument();
  });
});
