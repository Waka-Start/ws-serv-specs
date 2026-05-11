import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiCreditsOperation =
  | 'AI_SPECS_GENERATE'
  | 'AI_SPECS_VENTILATE'
  | 'AI_SPECS_EVALUATE';

export interface ConsumeCreditsInput {
  customerId: string;
  /** appId est optionnel en V1 — sera obligatoire à partir de Phase B */
  appId?: string;
  operation: AiCreditsOperation;
  /**
   * Nombre de crédits à débiter.
   * Convention de conversion : 1 crédit = AI_COST_PER_CREDIT_CTS centimes USD.
   * Défaut : 10 cts = 1 crédit.
   * Formule : Math.ceil(estimatedCostCts / AI_COST_PER_CREDIT_CTS)
   * Exemple : 35 cts → ceil(35/10) = 4 crédits.
   */
  credits: number;
  /** Clé d'idempotence (jobWid ou autre UUID) — optionnel Phase A, obligatoire Phase B */
  idempotencyKey?: string;
}

export interface ConsumeCreditsResult {
  consumed: boolean;
  remaining?: number;
}

export interface InsufficientCreditsError {
  consumed: false;
  available: number;
  required: number;
}

/**
 * Convertit un coût en centimes USD en crédits unitaires à débiter.
 * Convention : 1 crédit = costPerCreditCts centimes (défaut 10).
 * Math.ceil garantit que même 1 centime consomme au moins 1 crédit.
 */
export function costCtsToCredits(
  costCts: number,
  costPerCreditCts: number,
): number {
  if (costCts <= 0) return 0;
  return Math.ceil(costCts / costPerCreditCts);
}

@Injectable()
export class CreditsClientService {
  private readonly logger = new Logger(CreditsClientService.name);

  private readonly creditsServiceUrl: string;
  private readonly creditsApiSecret: string;
  /** 1 crédit = N centimes USD (configurable via AI_COST_PER_CREDIT_CTS, défaut 10) */
  readonly costPerCreditCts: number;

  constructor(private readonly configService: ConfigService) {
    this.creditsServiceUrl =
      this.configService.get<string>('CREDITS_SERVICE_URL') ??
      'http://ws-serv-credits:3010/api';
    this.creditsApiSecret =
      this.configService.get<string>('CREDITS_API_SECRET') ?? '';
    this.costPerCreditCts = this.configService.get<number>(
      'AI_COST_PER_CREDIT_CTS',
      10,
    );

    if (!this.creditsApiSecret) {
      this.logger.warn(
        'CREDITS_API_SECRET is not configured — credits consumption will be skipped',
      );
    }
  }

  /**
   * Débite des crédits chez ws-serv-credits après un appel Anthropic réussi.
   *
   * Comportement :
   * - 200 consumed=true  : débit OK, rien à faire.
   * - 402 consumed=false : crédits insuffisants → lève PaymentRequiredException
   *   (HTTP 402) remonté à l'utilisateur.
   * - Réseau/5xx         : fire-and-forget (warn + log), ne bloque JAMAIS
   *   la réponse Anthropic déjà produite.
   * - customerId absent  : warn + skip (ne bloque pas).
   * - CREDITS_API_SECRET absent : skip silencieux.
   *
   * Phase B/C : un vrai check pré-consommation sera ajouté.
   */
  async consumeCredits(input: ConsumeCreditsInput): Promise<void> {
    if (!this.creditsApiSecret) {
      this.logger.debug(
        `consumeCredits: CREDITS_API_SECRET not set — skipping (operation=${input.operation})`,
      );
      return;
    }

    if (!input.customerId) {
      this.logger.warn(
        `consumeCredits: customerId is missing — skipping (operation=${input.operation})`,
      );
      return;
    }

    if (input.credits <= 0) {
      this.logger.debug(
        `consumeCredits: credits=0, nothing to debit (operation=${input.operation})`,
      );
      return;
    }

    const url = `${this.creditsServiceUrl}/credits/check-and-consume`;
    const body: Record<string, unknown> = {
      customerId: input.customerId,
      operation: input.operation,
      credits: input.credits,
    };
    if (input.appId) body['appId'] = input.appId;
    if (input.idempotencyKey) body['idempotencyKey'] = input.idempotencyKey;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.creditsApiSecret,
        },
        body: JSON.stringify(body),
        // Timeout court — ne pas bloquer la réponse utilisateur sur une lenteur credits
        signal: AbortSignal.timeout(5000),
      });

      if (response.status === 402) {
        const data = (await response.json().catch(() => ({}))) as Partial<InsufficientCreditsError>;
        this.logger.warn(
          `consumeCredits: 402 insufficient credits — customerId=${input.customerId} ` +
            `operation=${input.operation} required=${input.credits} ` +
            `available=${data.available ?? 'unknown'}`,
        );
        // 402 est une erreur métier intentionnelle → remonter à l'utilisateur
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'Payment Required',
            message: `Crédits insuffisants pour l'opération ${input.operation}.`,
            available: data.available ?? 0,
            required: data.required ?? input.credits,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      if (!response.ok) {
        // 5xx / timeout côté credits : best-effort, ne PAS bloquer la réponse
        const text = await response.text().catch(() => '');
        this.logger.warn(
          `consumeCredits: upstream error HTTP ${response.status} — ` +
            `customerId=${input.customerId} operation=${input.operation} body="${text.slice(0, 200)}"`,
        );
        return;
      }

      const result = (await response.json().catch(() => ({ consumed: true }))) as ConsumeCreditsResult;
      this.logger.log(
        `consumeCredits: OK — customerId=${input.customerId} operation=${input.operation} ` +
          `credits=${input.credits} remaining=${result.remaining ?? 'unknown'}`,
      );
    } catch (error) {
      // Remonter uniquement le 402 (HttpException avec PAYMENT_REQUIRED)
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.PAYMENT_REQUIRED
      ) {
        throw error;
      }

      // Tout autre erreur (réseau, ECONNREFUSED, AbortError timeout) : fire-and-forget
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `consumeCredits: network/unexpected error (fire-and-forget) — ` +
          `customerId=${input.customerId} operation=${input.operation} error="${msg}"`,
      );
    }
  }
}
