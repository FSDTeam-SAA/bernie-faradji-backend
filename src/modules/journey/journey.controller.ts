import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JourneyService } from './journey.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { BuyJourneyPassDto, UpdateLateFeeDto, GetJourneysQueryDto } from './dto/journey.dto';

@Controller('journeys')
@UseGuards(JwtAuthGuard)
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  // ─── Public: Get Settings (late fee) ──────────────────
  @Public()
  @Get('settings')
  getSettings() {
    return this.journeyService.getSettings();
  }

  // ─── Stripe Webhook ───────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.journeyService.handleWebhook(req.rawBody, signature);
  }

  // ─── User: Buy Journey Pass ───────────────────────────
  @Post('buy')
  @HttpCode(HttpStatus.OK)
  buyPass(
    @CurrentUser('_id') userId: string,
    @Body() dto: BuyJourneyPassDto,
  ) {
    return this.journeyService.buyPass(userId, dto);
  }

  // ─── User: My Journey History ─────────────────────────
  @Get('my-journeys')
  getMyJourneys(
    @CurrentUser('_id') userId: string,
    @Query() query: GetJourneysQueryDto,
  ) {
    return this.journeyService.getMyJourneys(userId, query);
  }

  // ─── Admin: Update Late Fee ───────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Put('settings/late-fee')
  updateLateFee(@Body() dto: UpdateLateFeeDto) {
    return this.journeyService.updateLateFee(dto);
  }

  // ─── Admin: Get All Journeys ──────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Get('all')
  getAllJourneys(@Query() query: GetJourneysQueryDto) {
    return this.journeyService.getAllJourneys(query);
  }

  // ─── Admin: Get Single Journey ────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.journeyService.getOne(id);
  }

  // ─── Admin: Update Journey Status ─────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.journeyService.updateStatus(id, status);
  }
}