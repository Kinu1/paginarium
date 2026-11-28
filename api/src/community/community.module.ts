import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { DatabaseModule } from "../db.module.js";
import { Owner } from "../firebase.guard.js";
import { parse, parseId } from "../validation.js";
import { participants, revision } from "../competition/competition.module.js";
import { CommunityService } from "./community.service.js";
import { formats, progressSchema, rulesSchema } from "./rules.js";

const create = z.strictObject({ rules: rulesSchema });
const edit = z.strictObject({
  revision,
  rules: rulesSchema,
  progress: progressSchema,
});
const publication = z.strictObject({ revision, published: z.boolean() });
const tournament = z.strictObject({ revision, bookIds: participants });
const pagination = z.strictObject({
  format: formats.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

@Controller("challenges")
class CommunityController {
  constructor(private readonly service: CommunityService) {}
  @Get("mine") mine(@Owner() owner: string) {
    return this.service.mine(owner);
  }
  @Get("templates") catalog(@Query() query: unknown) {
    const { format, page, pageSize } = parse(pagination, query);
    return this.service.catalog(format, page, pageSize);
  }
  @Post() create(@Owner() owner: string, @Body() body: unknown) {
    return this.service.create(owner, parse(create, body).rules);
  }
  @Post("templates/:id/copy") copy(
    @Owner() owner: string,
    @Param("id") id: string,
  ) {
    return this.service.copy(owner, parseId(id));
  }
  @Put(":id") update(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { revision, rules, progress } = parse(edit, body);
    return this.service.edit(owner, parseId(id), revision, rules, progress);
  }
  @Put(":id/publication") publish(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { revision, published } = parse(publication, body);
    return this.service.publication(owner, parseId(id), revision, published);
  }
  @Post(":id/competition") start(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const { revision, bookIds } = parse(tournament, body);
    return this.service.startCompetition(owner, parseId(id), revision, bookIds);
  }
}
@Module({
  imports: [DatabaseModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
