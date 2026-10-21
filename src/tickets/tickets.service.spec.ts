import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { TicketMessageService } from './services/ticket-message.service';
import { TicketInteractionService } from './services/ticket-interaction.service';
import { TicketCloseService } from './services/ticket-close.service';

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: TicketMessageService, useValue: {} },
        { provide: TicketInteractionService, useValue: {} },
        { provide: TicketCloseService, useValue: {} },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
