import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
@ApiTags('health')
export class HealthController {
  private readonly startTime = Date.now();

  @Get('healthz')
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check' })
  healthz() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
    };
  }
}
