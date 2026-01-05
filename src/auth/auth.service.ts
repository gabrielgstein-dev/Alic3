import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(private readonly sessionService: SessionService) {}

  async validateSession(token: string) {
    return this.sessionService.getSession(token);
  }
}
