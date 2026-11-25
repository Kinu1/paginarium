import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const Public = () => SetMetadata("publicRoute", true);
export const Owner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().owner as string,
);

@Injectable()
export class FirebaseGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>("publicRoute", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
    if (!match)
      throw new UnauthorizedException(
        "Entre na sua conta para acessar o diário.",
      );
    const app =
      getApps().find((app) => app.name === "paginarium") ??
      initializeApp(
        { projectId: process.env.FIREBASE_PROJECT_ID },
        "paginarium",
      );
    try {
      const token = await getAuth(app).verifyIdToken(match[1]);
      req.owner = token.uid;
      return true;
    } catch {
      throw new UnauthorizedException("Sessão inválida. Entre novamente.");
    }
  }
}
