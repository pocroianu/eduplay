import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, expect, it, vi } from 'vitest';
import { GamePageContent } from './GamePageContent';

vi.mock('@/features/portfolio', () => ({ recordActivityArtifact: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps failed completion saving retryable after replacing the iframe with immediate results', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(null);
  render(<MantineProvider><GamePageContent
    game={{ id: 'game', title: 'Test Activity', game_url: '/games/demo/index.html', category: 'math', difficulty_level: 1, estimated_duration: 1 }}
    progress={null} backUrl="/student/activities" studentId="82323232-3232-4232-8232-323232323232"
    activityId="86363636-3636-4636-8636-363636363636" playerName="Ana"
  /></MantineProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Să începem jocul' }));
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
  await waitFor(() => {
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin, data: { type: 'ACTIVITY_READY' },
    })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
  act(() => window.dispatchEvent(new MessageEvent('message', {
    origin: window.location.origin,
    data: { type: 'GAME_COMPLETE', score: 90, totalSets: 2, timeSpent: 100, reason: 'completed' },
  })));
  await screen.findByRole('button', { name: 'Încearcă salvarea din nou' });
  await waitFor(() => expect(document.querySelector('iframe')).toBeNull());
  await waitFor(() => expect(screen.getByText(/Progresul nu s-a salvat/)).toBeVisible());
  const retry = screen.getByRole('button', { name: 'Încearcă salvarea din nou' });
  const failedBody = fetchMock.mock.calls[1][1]?.body;
  fireEvent.click(retry);
  await screen.findByText('Progres salvat!');
  expect(fetchMock.mock.calls[2][1]?.body).toBe(failedBody);
  expect(JSON.parse(String(failedBody))).toMatchObject({ status: 'completed' });
});
