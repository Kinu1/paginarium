import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { z } from "zod";
import { DatabaseModule } from "../db.module.js";
import { Owner } from "../firebase.guard.js";
import { parse, parseId, uuid } from "../validation.js";
import { CompetitionService } from "./competition.service.js";

export const revision = z.number().int().positive().max(2147483646);
export const participants = z
  .array(uuid)
  .length(22)
  .refine((ids) => new Set(ids).size === 22, {
    message: "Escolha 22 livros diferentes.",
  });
const create = z.strictObject({
  name: z.string().trim().min(1).max(120),
  bookIds: participants,
});
const choice = z.strictObject({
  revision,
  matchId: z.string().regex(/^(P[1-6]|O[1-8]|Q[1-4]|S[12]|F1)$/),
  winnerId: uuid,
});
const replacement = z.strictObject({ revision, bookId: uuid });

@Controller("competitions")
class CompetitionController {
  constructor(private readonly service: CompetitionService) {}
  @Get() list(@Owner() owner: string) {
    return this.service.list(owner);
  }
  @Get(":id") get(@Owner() owner: string, @Param("id") id: string) {
    return this.service.get(owner, parseId(id));
  }
  @Post() add(@Owner() owner: string, @Body() body: unknown) {
    const { name, bookIds } = parse(create, body);
    return this.service.create(owner, name, bookIds);
  }
  @Put(":id/votes") vote(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { revision, matchId, winnerId } = parse(choice, body);
    return this.service.choose(owner, parseId(id), revision, matchId, winnerId);
  }
  @Put(":id/slots/:slot") replace(
    @Owner() owner: string,
    @Param("id") id: string,
    @Param("slot") raw: string,
    @Body() body: unknown,
  ) {
    const { revision, bookId } = parse(replacement, body);
    const slot = parse(
      z
        .string()
        .regex(/^(?:[0-9]|1[0-9]|2[01])$/)
        .transform(Number),
      raw,
    );
    return this.service.replace(owner, parseId(id), revision, slot, bookId);
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [CompetitionController],
  providers: [CompetitionService],
})
export class CompetitionModule {}
