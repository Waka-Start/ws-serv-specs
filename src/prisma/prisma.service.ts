import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: pg.Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    const pool = new pg.Pool({
      connectionString,
      max: configService.get<number>('DB_POOL_MAX', 20),
      idleTimeoutMillis: configService.get<number>(
        'DB_POOL_IDLE_TIMEOUT',
        30000,
      ),
      connectionTimeoutMillis: configService.get<number>(
        'DB_POOL_CONNECTION_TIMEOUT',
        2000,
      ),
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL connection established');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('PostgreSQL connection closed');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
