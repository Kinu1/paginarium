import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";
import { LibraryService } from "./library.service.js";
import { Owner, Public } from "./firebase.guard.js";
import {
  bookInput,
  checkCover,
  CoverInterceptor,
  type UploadedCover,
} from "./book-cover.js";
import {
  createBook,
  parse,
  parseId,
  parseQuery,
  parseWork,
  parseRevision,
  patchBook,
  parseYear,
  updateBook,
  updateYear,
} from "./validation.js";

@Controller("books")
export class BooksController {
  constructor(private readonly library: LibraryService) {}
  @Get() list(@Owner() owner: string) {
    return this.library.list(owner);
  }
  @Post()
  @UseInterceptors(CoverInterceptor)
  async add(
    @Owner() owner: string,
    @Body() body: unknown,
    @Headers("content-type") contentType: string,
    @UploadedFile() file?: UploadedCover,
  ) {
    return this.library.add(
      owner,
      bookInput(contentType, body, createBook),
      await checkCover(file),
    );
  }
  @Patch(":id")
  @UseInterceptors(CoverInterceptor)
  async metadata(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("content-type") contentType: string,
    @UploadedFile() file?: UploadedCover,
  ) {
    return this.library.metadata(
      owner,
      parseId(id),
      bookInput(contentType, body, patchBook),
      await checkCover(file),
    );
  }
  @Get(":id/cover")
  @Header("Cache-Control", "private, no-store")
  async cover(@Owner() owner: string, @Param("id") id: string) {
    const { bytes, mime } = await this.library.cover(owner, parseId(id));
    return new StreamableFile(bytes, { type: mime, length: bytes.byteLength });
  }
  @Delete(":id")
  @HttpCode(204)
  remove(
    @Owner() owner: string,
    @Param("id") id: string,
    @Query("revision") revision: unknown,
  ) {
    return this.library.remove(owner, parseId(id), parseRevision(revision));
  }
  @Put(":id") save(
    @Owner() owner: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.library.save(owner, parseId(id), parse(updateBook, body));
  }
}
@Controller("years")
export class YearsController {
  constructor(private readonly library: LibraryService) {}
  @Get(":year") get(@Owner() owner: string, @Param("year") year: string) {
    return this.library.year(owner, parseYear(year));
  }
  @Put(":year") save(
    @Owner() owner: string,
    @Param("year") year: string,
    @Body() body: unknown,
  ) {
    return this.library.saveYear(
      owner,
      parseYear(year),
      parse(updateYear, body),
    );
  }
}
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() search(@Query("q") q: unknown) {
    return this.catalog.search(parseQuery(q));
  }
  @Get("editions") editions(
    @Query("workKey") key: unknown,
    @Query("author") author: unknown,
  ) {
    return this.catalog.editions(
      parseWork(key),
      parseQuery(author ?? "Autoria não informada"),
    );
  }
}
@Controller("health")
export class HealthController {
  @Public() @Get() health() {
    return { status: "ok" };
  }
}
