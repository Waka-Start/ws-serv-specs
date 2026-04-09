import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('healthz', () => {
    it('should return status ok with timestamp and uptime', () => {
      const result = controller.healthz();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return a valid ISO timestamp', () => {
      const result = controller.healthz();
      const parsed = new Date(result.timestamp);

      expect(parsed.toISOString()).toBe(result.timestamp);
    });

    it('should return increasing uptime on successive calls', async () => {
      const first = controller.healthz();
      // Small delay to ensure uptime difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = controller.healthz();

      expect(second.uptime).toBeGreaterThanOrEqual(first.uptime);
    });
  });
});
