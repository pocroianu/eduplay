import { toCamelCase, toSnakeCase, camelCaseKeys, snakeCaseKeys } from '../transform';

describe('toCamelCase', () => {
  it('converts snake_case to camelCase', () => {
    expect(toCamelCase('snake_case')).toBe('snakeCase');
  });

  it('returns already camelCase strings unchanged', () => {
    expect(toCamelCase('already')).toBe('already');
  });
});

describe('toSnakeCase', () => {
  it('converts camelCase to snake_case', () => {
    expect(toSnakeCase('camelCase')).toBe('camel_case');
  });
});

describe('camelCaseKeys', () => {
  it('transforms flat object keys from snake_case to camelCase', () => {
    const input = { full_name: 'John', class_id: '123' };
    expect(camelCaseKeys(input)).toEqual({ fullName: 'John', classId: '123' });
  });

  it('transforms nested objects', () => {
    const input = { user_info: { first_name: 'John', last_name: 'Doe' } };
    expect(camelCaseKeys(input)).toEqual({
      userInfo: { firstName: 'John', lastName: 'Doe' },
    });
  });

  it('transforms arrays of objects', () => {
    const input = [{ full_name: 'John' }, { full_name: 'Jane' }];
    expect(camelCaseKeys(input)).toEqual([
      { fullName: 'John' },
      { fullName: 'Jane' },
    ]);
  });

  it('returns null for null input', () => {
    expect(camelCaseKeys(null)).toBeNull();
  });
});

describe('snakeCaseKeys', () => {
  it('transforms object keys from camelCase to snake_case', () => {
    const input = { fullName: 'John' };
    expect(snakeCaseKeys(input)).toEqual({ full_name: 'John' });
  });
});
