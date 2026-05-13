import { RoleType } from '../../common/enums/role.enum';

export interface IJwtPayload {
  _id: string;
  role: RoleType;
}
