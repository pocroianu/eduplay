import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentActivitiesLane, type StudentActivityCard } from '../StudentActivitiesLane';

const activities: StudentActivityCard[] = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    typeId: 'drawing-canvas',
    title: 'Desen',
    description: 'O activitate creativă',
    icon: 'Palette',
  },
];

describe('StudentActivitiesLane', () => {
  it('links assigned activities to their player route', () => {
    render(<StudentActivitiesLane activities={activities} />);

    const link = screen.getByRole('link', { name: /desen/i });
    expect(link).toHaveAttribute(
      'href',
      '/student/activities/66666666-6666-4666-8666-666666666666/play',
    );
  });

  it('renders an empty state when no creative activities are assigned', () => {
    render(<StudentActivitiesLane activities={[]} />);

    expect(screen.getByText(/nu ai activități creative/i)).toBeInTheDocument();
  });
});
