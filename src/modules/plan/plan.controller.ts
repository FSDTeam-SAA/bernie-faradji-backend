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
import { PlanService } from './plan.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RoleType } from '../../common/enums/role.enum';
import {
  CreatePlanDto,
  UpdatePlanDto,
  GetPlansQueryDto,
} from './dto/plan.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  // ─── Public: Get All ──────────────────────────────────
  @Public()
  @Get()
  getAll(@Query() query: GetPlansQueryDto) {
    return this.planService.getAll(query);
  }

  // ─── Public: Get Single ───────────────────────────────
  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.planService.getOne(id);
  }

  // ─── Admin: Create ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  // ─── Admin: Update ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }

  // ─── Admin: Delete ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }
}
