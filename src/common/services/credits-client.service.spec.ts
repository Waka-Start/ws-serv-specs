import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreditsClientService,
  costCtsToCredits,
} from './credits-client.service';

// ── ConfigService mock ──────────────────────────────────────────────────────

const makeConfigService = (overrides: Record<string, unknown> = {}) => ({
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      CREDITS_SERVICE_URL: 'http://credits-service:3010/api',
      CREDITS_API_SECRET: 'test-api-secret',
      AI_COST_PER_CREDIT_CTS: 10,
      ...overrides,
    };
    return key in config ? config[key] : defaultValue;
  }),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFetchResponse(
  status: number,
  body: unknown,
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CreditsClientService', () => {
  let service: CreditsClientService;
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsClientService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile();

    service = module.get<CreditsClientService>(CreditsClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Case 1 : POST avec body correct ────────────────────────────────────────

  describe('consumeCredits — POST body et headers corrects', () => {
    it('envoie le POST vers /credits/check-and-consume avec x-api-key et body sérialisé', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { consumed: true }));

      await service.consumeCredits({
        customerId: 'cust-001',
        appId: 'app-abc',
        operation: 'AI_SPECS_GENERATE',
        credits: 3,
        idempotencyKey: 'idem-xyz',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

      // URL correcte
      expect(url).toBe('http://credits-service:3010/api/credits/check-and-consume');

      // Header x-api-key
      expect((options.headers as Record<string, string>)['x-api-key']).toBe(
        'test-api-secret',
      );

      // Body sérialisé avec tous les champs attendus
      const parsed = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        customerId: 'cust-001',
        appId: 'app-abc',
        operation: 'AI_SPECS_GENERATE',
        credits: 3,
        idempotencyKey: 'idem-xyz',
      });
    });
  });

  // ── Case 2 : réponse 200 consumed:true → résolution normale ────────────────

  describe('consumeCredits — réponse 200', () => {
    it('résout sans exception lorsque le service retourne { consumed: true }', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { consumed: true, remaining: 42 }));

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_EVALUATE',
          credits: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── Case 3 : réponse 402 → throw HttpException PAYMENT_REQUIRED ────────────

  describe('consumeCredits — réponse 402', () => {
    it('lève HttpException avec status 402 et body métier', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse(402, { consumed: false, available: 0, required: 5 }),
      );

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_GENERATE',
          credits: 5,
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_GENERATE',
          credits: 5,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const e = err as HttpException;
        expect(e.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        const body = e.getResponse() as Record<string, unknown>;
        expect(body.statusCode).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(body.error).toBe('Payment Required');
        expect(body.required).toBe(5);
      }
    });
  });

  // ── Case 4 : erreur réseau / 500 → fire-and-forget (pas de throw) ──────────

  describe('consumeCredits — erreur réseau et 5xx', () => {
    it('ne lève pas d\'exception sur une erreur réseau (ECONNREFUSED)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_VENTILATE',
          credits: 2,
        }),
      ).resolves.toBeUndefined();
    });

    it('ne lève pas d\'exception sur une réponse 500 du service credits', async () => {
      mockFetch.mockResolvedValue(
        makeFetchResponse(500, { message: 'Internal Server Error' }),
      );

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_EVALUATE',
          credits: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('ne lève pas d\'exception sur AbortError (timeout)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_GENERATE',
          credits: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── Case 5 : costCtsToCredits helper ───────────────────────────────────────

  describe('costCtsToCredits — conversion centimes → crédits', () => {
    const CTS_PER_CREDIT = 10;

    it('costCts=0 → 0 crédit', () => {
      expect(costCtsToCredits(0, CTS_PER_CREDIT)).toBe(0);
    });

    it('costCts négatif → 0 crédit', () => {
      expect(costCtsToCredits(-5, CTS_PER_CREDIT)).toBe(0);
    });

    it('costCts=10 → 1 crédit (ceil exact)', () => {
      expect(costCtsToCredits(10, CTS_PER_CREDIT)).toBe(1);
    });

    it('costCts=15 → 2 crédits (ceil arrondi au-dessus)', () => {
      expect(costCtsToCredits(15, CTS_PER_CREDIT)).toBe(2);
    });

    it('costCts=35 → 4 crédits (exemple de la doc)', () => {
      expect(costCtsToCredits(35, CTS_PER_CREDIT)).toBe(4);
    });

    it('costCts=1 → 1 crédit (1 centime = minimum 1 crédit)', () => {
      expect(costCtsToCredits(1, CTS_PER_CREDIT)).toBe(1);
    });
  });

  // ── Cas limites supplémentaires ────────────────────────────────────────────

  describe('consumeCredits — cas limites', () => {
    it('skip silencieux si CREDITS_API_SECRET est absent', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CreditsClientService,
          {
            provide: ConfigService,
            useValue: makeConfigService({ CREDITS_API_SECRET: '' }),
          },
        ],
      }).compile();

      const svc = module.get<CreditsClientService>(CreditsClientService);

      await expect(
        svc.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_GENERATE',
          credits: 2,
        }),
      ).resolves.toBeUndefined();

      // fetch ne doit pas être appelé
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skip silencieux si customerId est absent', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { consumed: true }));

      await expect(
        service.consumeCredits({
          customerId: '',
          operation: 'AI_SPECS_GENERATE',
          credits: 2,
        }),
      ).resolves.toBeUndefined();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skip silencieux si credits <= 0', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { consumed: true }));

      await expect(
        service.consumeCredits({
          customerId: 'cust-001',
          operation: 'AI_SPECS_GENERATE',
          credits: 0,
        }),
      ).resolves.toBeUndefined();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('n\'inclut pas appId dans le body si absent', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(200, { consumed: true }));

      await service.consumeCredits({
        customerId: 'cust-001',
        operation: 'AI_SPECS_EVALUATE',
        credits: 1,
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsed = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('appId');
      expect(parsed).not.toHaveProperty('idempotencyKey');
    });
  });
});
