import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  campaignId: string;

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
