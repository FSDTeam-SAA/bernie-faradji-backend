import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from './token.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import {
  BuyTokenDto,
  SelectWinnerManualDto,
  GetTokensQueryDto,
} from './dto/token.dto';

@Controller('tokens')
@UseGuards(JwtAuthGuard)
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  // ─── User: Buy Tokens → Stripe checkout URL ───────────
  @Post('buy')
  @HttpCode(HttpStatus.OK)
  buyTokens(
    @CurrentUser('_id') userId: string,
    @Body() dto: BuyTokenDto,
  ) {
    return this.tokenService.buyTokens(userId, dto);
  }

  // ─── Stripe Webhook (Public) ──────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.tokenService.handleWebhook(req.rawBody, signature);
  }

  // ─── Public: Get Current Winner ───────────────────────
  @Public()
  @Get('winner/current')
  getCurrentWinner() {
    return this.tokenService.getCurrentWinner();
  }

  // ─── Admin: Get All Token Purchases ───────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Get('all')
  getAllTokens(@Query() query: GetTokensQueryDto) {
    return this.tokenService.getAllTokens(query);
  }

  // ─── Admin: Auto Select Winner ────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Post('winner/auto')
  @HttpCode(HttpStatus.OK)
  autoSelectWinner() {
    return this.tokenService.autoSelectWinner();
  }

  // ─── Admin: Manual Select Winner ─────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN)
  @Post('winner/manual')
  @HttpCode(HttpStatus.OK)
  manualSelectWinner(@Body() dto: SelectWinnerManualDto) {
    return this.tokenService.manualSelectWinner(dto);
  }

  // ─── Admin: Winner History ────────────────────────────
  @Public()
  @Get('winner/history')
  getWinnerHistory(@Query() query: GetTokensQueryDto) {
    return this.tokenService.getWinnerHistory(query);
  }
}
