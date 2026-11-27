import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { CatalogService } from "./catalog.service.js";
import { configuration } from "./config.js";
import {
  BooksController,
  CatalogController,
  HealthController,
  YearsController,
} from "./controllers.js";
import { DatabaseModule } from "./db.module.js";
import { CompetitionModule } from "./competition/competition.module.js";
import { CommunityModule } from "./community/community.module.js";
import { FirebaseGuard } from "./firebase.guard.js";
import { LibraryService } from "./library.service.js";

@Module({
  imports: [DatabaseModule, CompetitionModule, CommunityModule],
  controllers: [
    HealthController,
    CatalogController,
    BooksController,
    YearsController,
  ],
  providers: [
    LibraryService,
    CatalogService,
    { provide: APP_GUARD, useClass: FirebaseGuard },
  ],
})
class AppModule {}

async function bootstrap() {
  const config = configuration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet());
  app.useBodyParser("json", { limit: "2mb" });
  app.enableCors({
    origin: config.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  await app.listen(config.port, "0.0.0.0");
}
await bootstrap();
