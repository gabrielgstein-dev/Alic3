import { IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';

export enum Platform {
  PATREON = 'PATREON',
  KOFI = 'KOFI',
  RSS = 'RSS',
  GITHUB = 'GITHUB',
}

export class CreateFeedDto {
  @IsEnum(Platform)
  @IsOptional()
  platform?: Platform;

  @IsString()
  sourceId: string;

  @IsString()
  creatorName: string;

  @IsString()
  @IsOptional()
  creatorUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  notificationChannelId: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  checkIntervalMins?: number;
}
