export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
  banner: string | null;
  accent_color: number | null;
  locale: string;
  email: string | null;
  verified: boolean;
  premium_type: number;
  flags: number;
  public_flags: number;
  mfa_enabled: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface DiscordOAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
