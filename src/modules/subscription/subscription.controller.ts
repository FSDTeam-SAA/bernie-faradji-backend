import {
  Controller,
  Post,
  Get,
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
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { GetSubscriptionsQueryDto } from './dto/subscription.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ─── User: Buy Plan → get Stripe checkout URL ─────────
  @Post('buy/:planId')
  @HttpCode(HttpStatus.OK)
  createCheckout(
    @CurrentUser('_id') userId: string,
    @Param('planId') planId: string,
  ) {
    return this.subscriptionService.createCheckout(userId, planId);
  }

  // ─── Stripe Webhook (raw body — must be Public) ────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.subscriptionService.handleWebhook(req.rawBody, signature);
  }

  // ─── Admin: Get All Subscribed Users ──────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Get('all')
  getAllSubscriptions(@Query() query: GetSubscriptionsQueryDto) {
    return this.subscriptionService.getAllSubscriptions(query);
  }
}
