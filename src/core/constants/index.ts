/** Fields always excluded from user queries (guard / auth layer) */
export const USER_SELECT_FIELDS = '-password -refreshToken -__v';

/** Fields excluded in list/detail responses (service layer) */
export const USER_LIST_FIELDS   = '-password -createdAt -updatedAt -__v';

export const DEFAULT_PAGE       = 1;
export const DEFAULT_LIMIT      = 10;
export const BCRYPT_ROUNDS      = 10;
export const OTP_LENGTH         = 6;
