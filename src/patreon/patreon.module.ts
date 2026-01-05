import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PatreonService } from './patreon.service';
import { PatreonNotificationService } from './patreon-notification.service';
import { PatreonSchedulerService } from './patreon-scheduler.service';
import { PatreonController } from './patreon.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DiscordModule } from '../discord/discord.module';
import { AiModule } from '../ai/ai.module';
import { ModDetectionService } from './mod-detection.service';
import { ModNotificationService } from './mod-notification.service';
import { ModInteractionHandler } from './mod-interaction.handler';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    DiscordModule,
    AiModule,
  ],
  controllers: [PatreonController],
  providers: [
    PatreonService,
    PatreonNotificationService,
    PatreonSchedulerService,
    ModDetectionService,
    ModNotificationService,
    ModInteractionHandler,
    GoogleSheetsService,
  ],
  exports: [PatreonService, PatreonSchedulerService, ModDetectionService, ModNotificationService, GoogleSheetsService],
})
export class PatreonModule {}
