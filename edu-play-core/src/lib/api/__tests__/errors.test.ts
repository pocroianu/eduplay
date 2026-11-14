import { ApiError } from '../errors';

describe('ApiError', () => {
  it('unauthorized() returns code UNAUTHORIZED, status 401, correct message', () => {
    const err = ApiError.unauthorized();
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('forbidden() returns code FORBIDDEN, status 403', () => {
    const err = ApiError.forbidden();
    expect(err.code).toBe('FORBIDDEN');
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('notFound("Game") returns message "Game not found", status 404', () => {
    const err = ApiError.notFound('Game');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Game not found');
  });

  it('validation() returns status 422 with details', () => {
    const details = { fields: { name: ['required'] } };
    const err = ApiError.validation('bad input', details);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(422);
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual(details);
  });

  it('custom new ApiError("CONFLICT", "exists") returns status 409', () => {
    const err = new ApiError('CONFLICT', 'exists');
    expect(err.code).toBe('CONFLICT');
    expect(err.status).toBe(409);
    expect(err.message).toBe('exists');
  });

  it('all ApiError instances are instanceof Error', () => {
    expect(ApiError.unauthorized()).toBeInstanceOf(Error);
    expect(ApiError.forbidden()).toBeInstanceOf(Error);
    expect(ApiError.notFound()).toBeInstanceOf(Error);
    expect(ApiError.validation('x')).toBeInstanceOf(Error);
    expect(new ApiError('CONFLICT', 'x')).toBeInstanceOf(Error);
  });
});
