import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DonateController } from './donate.controller';
import { DonateService } from './donate.service';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [
    HttpModule,
    DiscordModule,
  ],
  controllers: [DonateController],
  providers: [DonateService],
  exports: [DonateService],
})
export class DonateModule {}
