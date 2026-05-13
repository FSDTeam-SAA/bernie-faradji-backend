import * as bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../../core/constants';

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

export const comparePassword = (plain: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(plain, hashed);
