import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

const COLOR = {
  log:     '\x1b[32m',   // green
  error:   '\x1b[31m',   // red
  warn:    '\x1b[33m',   // yellow
  debug:   '\x1b[36m',   // cyan
  verbose: '\x1b[35m',   // magenta
  ts:      '\x1b[90m',   // dark gray
  ctx:     '\x1b[34m',   // blue
  bracket: '\x1b[90m',   // dark gray
};

const LABEL: Record<string, string> = {
  log:     ' LOG ',
  error:   ' ERR ',
  warn:    ' WRN ',
  debug:   ' DBG ',
  verbose: ' VRB ',
};

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable()
export class AppLogger implements LoggerService {
  private context?: string;

  constructor(private readonly configService: ConfigService) {}

  setContext(context: string) {
    this.context = context;
    return this;
  }

  private isDev() {
    return this.configService.get<string>('app.env') !== 'production';
  }

  private print(level: LogLevel, message: any, extra?: string) {
    const ts      = new Date().toISOString();
    const c       = COLOR[level];
    const ctx     = this.context ?? 'App';
    const label   = `${BOLD}${c}${LABEL[level]}${RESET}`;
    const time    = `${COLOR.ts}${ts}${RESET}`;
    const context = `${COLOR.bracket}[${RESET}${COLOR.ctx}${BOLD}${ctx}${RESET}${COLOR.bracket}]${RESET}`;
    const msg     = `${c}${message}${RESET}`;
    const tail    = extra ? `  ${DIM}${extra}${RESET}` : '';

    const line = `${time} ${label} ${context} ${msg}${tail}`;

    if (level === 'error') return console.error(line);
    if (level === 'warn')  return console.warn(line);
    return console.log(line);
  }

  log(message: any, context?: string) {
    if (context) this.context = context;
    this.print('log', message);
  }

  error(message: any, trace?: string) {
    this.print('error', message, undefined);
    if (trace && this.isDev()) console.error(`${COLOR.error}${DIM}${trace}${RESET}`);
  }

  warn(message: any, context?: string) {
    if (context) this.context = context;
    this.print('warn', message);
  }

  debug(message: any, context?: string) {
    if (!this.isDev()) return;
    if (context) this.context = context;
    this.print('debug', message);
  }

  verbose(message: any, context?: string) {
    if (!this.isDev()) return;
    if (context) this.context = context;
    this.print('verbose', message);
  }
}