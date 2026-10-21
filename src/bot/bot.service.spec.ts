import { EventEmitter } from 'events';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Client } from 'discord.js';
import { BotService } from './bot.service';
import { TicketsService } from '../tickets/tickets.service';
import { DonateCommand } from './commands/donate.command';
import { EmbedCommand } from '../admin/embed/embed.command';

describe('BotService', () => {
  let service: BotService;
  let client: EventEmitter & { login: jest.Mock; channels: { cache: Map<string, unknown> } };

  beforeEach(async () => {
    client = Object.assign(new EventEmitter(), {
      login: jest.fn().mockResolvedValue('ok'),
      channels: { cache: new Map() },
    });
    const config = { get: (k: string) => ({ DISCORD_TOKEN: 'token-de-teste' } as Record<string, string>)[k] };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: Client, useValue: client },
        { provide: ConfigService, useValue: config },
        { provide: TicketsService, useValue: {} },
        { provide: DonateCommand, useValue: {} },
        { provide: EmbedCommand, useValue: {} },
      ],
    }).compile();
    service = module.get<BotService>(BotService);
    await service.onModuleInit();
  });

  const mensagem = (content: string) => ({ content, reply: jest.fn(), member: null, channel: {} });

  it('faz login com o token da configuração', () => {
    expect(client.login).toHaveBeenCalledWith('token-de-teste');
  });

  it('!ping continua respondendo', async () => {
    const m = mensagem('!ping');
    client.emit('messageCreate', m);
    await new Promise((r) => setImmediate(r));
    expect(m.reply).toHaveBeenCalledWith('Pong!');
  });

  it('!mod não existe mais (acompanhamento de mods saiu do bot)', async () => {
    const m = mensagem('!mod list');
    client.emit('messageCreate', m);
    await new Promise((r) => setImmediate(r));
    expect(m.reply).not.toHaveBeenCalled();
  });
});
