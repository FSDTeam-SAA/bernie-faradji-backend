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
import { InsuranceService } from './insurance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RoleType } from '../../common/enums/role.enum';
import {
  CreateInsuranceDto,
  UpdateInsuranceDto,
  GetInsuranceQueryDto,
} from './dto/insurance.dto';


@Controller('insurances')
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  // ─── Public: Get All ──────────────────────────────────
  @Public()
  @Get()
  getAll(@Query() query: GetInsuranceQueryDto) {
    return this.insuranceService.getAll(query);
  }

  // ─── Public: Get Single ───────────────────────────────
  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.insuranceService.getOne(id);
  }

  // ─── Admin: Create ────────────────────────────────────
 @UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInsuranceDto) {
    return this.insuranceService.create(dto);
  }

  // ─── Admin: Update ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInsuranceDto) {
    return this.insuranceService.update(id, dto);
  }

  // ─── Admin: Delete ────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.insuranceService.remove(id);
  }
}
