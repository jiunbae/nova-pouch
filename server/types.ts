import type { JWTPayload } from 'jose';

export interface AuthTokenPayload extends JWTPayload {
  sub: string;
  provider?: string;
  username?: string;
  type?: 'refresh';
}

export type AppBindings = {
  Variables: {
    user?: AuthTokenPayload;
  };
};
