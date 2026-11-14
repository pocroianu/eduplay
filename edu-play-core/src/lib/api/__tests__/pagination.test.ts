import { parsePagination, toRange, buildMeta } from '../pagination';

describe('parsePagination', () => {
  it('with empty URLSearchParams returns { page: 1, perPage: 20 }', () => {
    const result = parsePagination(new URLSearchParams());
    expect(result).toEqual({ page: 1, perPage: 20 });
  });

  it('with ?page=3&perPage=50 returns { page: 3, perPage: 50 }', () => {
    const result = parsePagination(new URLSearchParams('page=3&perPage=50'));
    expect(result).toEqual({ page: 3, perPage: 50 });
  });
});

describe('toRange', () => {
  it('page 1, perPage 20 returns { from: 0, to: 19 }', () => {
    expect(toRange({ page: 1, perPage: 20 })).toEqual({ from: 0, to: 19 });
  });

  it('page 3, perPage 10 returns { from: 20, to: 29 }', () => {
    expect(toRange({ page: 3, perPage: 10 })).toEqual({ from: 20, to: 29 });
  });
});

describe('buildMeta', () => {
  it('returns correct meta with page 2, perPage 10, total 45', () => {
    const result = buildMeta({ page: 2, perPage: 10 }, 45);
    expect(result).toEqual({ page: 2, perPage: 10, total: 45, totalPages: 5 });
  });

  it('with 0 total returns totalPages: 0', () => {
    const result = buildMeta({ page: 1, perPage: 10 }, 0);
    expect(result).toEqual({ page: 1, perPage: 10, total: 0, totalPages: 0 });
  });
});
