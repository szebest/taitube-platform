declare module "*.module.scss";
declare module "*.png";

declare module 'react-current-page-fallback';

/**
 * CRA substitutes `process.env.REACT_APP_*` and `NODE_ENV` at build time; there is no
 * `process` in the browser. Declaring only this keeps @types/node out of the client tier,
 * so a Node builtin stays a compile error here.
 */
declare const process: { env: Record<string, string | undefined> };
