import { Module, Global } from '@nestjs/common';
import { Client, GatewayIntentBits } from 'discord.js';

@Global()
@Module({
  providers: [
    {
      provide: Client,
      useFactory: () => {
        const client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
          ],
        });
        return client;
      },
    },
  ],
  exports: [Client],
})
export class DiscordModule {}
