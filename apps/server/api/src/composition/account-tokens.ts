import { token } from '@kit/composition';
import type { AccountSecurityService, MyChannelsService } from '../services/index';

export interface AccountServiceSet {
  myChannelsService: MyChannelsService;
  accountSecurityService: AccountSecurityService;
}

export const AccountServices = {
  MyChannelsService: token<MyChannelsService>('MyChannelsService'),
  AccountSecurityService: token<AccountSecurityService>('AccountSecurityService'),
};
