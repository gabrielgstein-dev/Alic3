import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BotModule } from './bot/bot.module';
import { TicketsModule } from './tickets/tickets.module';
import { LivepixModule } from './livepix/livepix.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BotModule,
    TicketsModule,
    LivepixModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
