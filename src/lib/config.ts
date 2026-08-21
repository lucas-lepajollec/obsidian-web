export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function booleanFromEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export interface AuthConfig {
  password: string;
  sessionSecret: string;
  publicRead: boolean;
  authDisabled: boolean;
  secureCookies: boolean;
}

export function getAuthConfig(): AuthConfig {
  const authDisabled = booleanFromEnv(process.env.SHARDNOTE_AUTH_DISABLED);
  if (authDisabled && process.env.NODE_ENV === 'production') {
    throw new ConfigurationError('SHARDNOTE_AUTH_DISABLED cannot be enabled in production.');
  }

  if (authDisabled) {
    return {
      password: '',
      sessionSecret: '',
      publicRead: true,
      authDisabled: true,
      secureCookies: false,
    };
  }

  const password = process.env.SHARDNOTE_PASSWORD?.trim() ?? '';
  const sessionSecret = process.env.SHARDNOTE_SESSION_SECRET?.trim() ?? '';

  if (password.length < 12) {
    throw new ConfigurationError('SHARDNOTE_PASSWORD must contain at least 12 characters.');
  }
  if (sessionSecret.length < 32) {
    throw new ConfigurationError('SHARDNOTE_SESSION_SECRET must contain at least 32 characters.');
  }

  return {
    password,
    sessionSecret,
    publicRead: booleanFromEnv(process.env.SHARDNOTE_PUBLIC_READ),
    authDisabled: false,
    secureCookies: process.env.SHARDNOTE_SECURE_COOKIES === undefined
      ? process.env.NODE_ENV === 'production'
      : booleanFromEnv(process.env.SHARDNOTE_SECURE_COOKIES),
  };
}
