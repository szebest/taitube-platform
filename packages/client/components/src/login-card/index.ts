import {
  LoginCardBody,
  LoginCardError,
  LoginCardExpired,
  LoginCardRoot,
  LoginCardTitle,
} from './login-card';

export const LoginCard = {
  Root: LoginCardRoot,
  Title: LoginCardTitle,
  Expired: LoginCardExpired,
  Error: LoginCardError,
  Body: LoginCardBody,
};
export { useLoginCard } from './login-card.context';
export { loginCardStyles } from './login-card.variants';
