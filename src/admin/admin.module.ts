import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { EmbedBuilderService } from './embed/embed-builder.service';
import { EmbedCommand } from './embed/embed.command';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [DiscordModule],
  controllers: [AdminController],
  providers: [EmbedBuilderService, EmbedCommand],
  exports: [EmbedCommand],
})
export class AdminModule {}
