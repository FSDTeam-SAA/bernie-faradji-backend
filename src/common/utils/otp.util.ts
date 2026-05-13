import { OTP_LENGTH } from '../../core/constants';

export const generateOtp = (): string =>
  Math.floor(10 ** (OTP_LENGTH - 1) + Math.random() * 9 * 10 ** (OTP_LENGTH - 1)).toString();
