import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrizeService } from './prize.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { CreatePrizeDto, UpdatePrizeDto, GetPrizesQueryDto } from './dto/prize.dto';

@Controller('prizes')
@UseGuards(JwtAuthGuard)
export class PrizeController {
  constructor(private readonly prizeService: PrizeService) {}

  // ─── Public: Get All ──────────────────────────────────
  @Public()
  @Get()
  getAll(@Query() query: GetPrizesQueryDto) {
    return this.prizeService.getAll(query);
  }

  // ─── Public: Get Single ───────────────────────────────
  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.prizeService.getOne(id);
  }

  // ─── Admin: Create ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePrizeDto) {
    return this.prizeService.create(dto);
  }

  // ─── Admin: Update ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrizeDto) {
    return this.prizeService.update(id, dto);
  }

  // ─── Admin: Delete ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.prizeService.remove(id);
  }
}