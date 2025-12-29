import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LivepixController } from './livepix.controller';
import { LivepixService } from './livepix.service';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [
    HttpModule,
    DiscordModule,
  ],
  controllers: [LivepixController],
  providers: [LivepixService],
  exports: [LivepixService],
})
export class LivepixModule {}
