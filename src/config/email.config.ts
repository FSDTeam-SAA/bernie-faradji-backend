import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  address: process.env.EMAIL_ADDRESS,
  pass: process.env.EMAIL_PASS,
  from: process.env.EMAIL_FROM,
}));
