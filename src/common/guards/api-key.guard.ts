import { timingSafeEqual } from "crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers["x-api-key"];
    const expectedKey = this.configService.get<string>("API_KEY");

    if (!expectedKey || expectedKey.length === 0) {
      throw new UnauthorizedException("API_KEY is not configured on server");
    }

    if (!apiKey) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    const apiKeyBuf = Buffer.from(
      typeof apiKey === "string" ? apiKey : apiKey[0],
    );
    const expectedBuf = Buffer.from(expectedKey);

    if (
      apiKeyBuf.length !== expectedBuf.length ||
      !timingSafeEqual(apiKeyBuf, expectedBuf)
    ) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}
