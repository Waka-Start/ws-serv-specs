import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: { get: jest.Mock };

  const createMockContext = (apiKey?: string): ExecutionContext => {
    const headers: Record<string, string | undefined> = {
      'x-api-key': apiKey,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    configService = { get: jest.fn() };
    guard = new ApiKeyGuard(configService as unknown as ConfigService);
  });

  it('should return true when a valid API key is provided', () => {
    configService.get.mockReturnValue('secret-key');
    const context = createMockContext('secret-key');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when no API key is provided', () => {
    configService.get.mockReturnValue('secret-key');
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when wrong API key is provided', () => {
    configService.get.mockReturnValue('secret-key');
    const context = createMockContext('wrong-key');

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when API_KEY is not configured', () => {
    configService.get.mockReturnValue(undefined);
    const context = createMockContext('any-key');

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(context)).toThrow(
      'API_KEY is not configured on server',
    );
  });
});
