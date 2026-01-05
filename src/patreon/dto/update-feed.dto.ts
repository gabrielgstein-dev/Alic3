import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class UpdateFeedDto {
  @IsString()
  @IsOptional()
  creatorName?: string;

  @IsString()
  @IsOptional()
  creatorUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  notificationChannelId?: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  checkIntervalMins?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
