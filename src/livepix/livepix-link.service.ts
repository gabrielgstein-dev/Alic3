import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UserLink {
  discordId: string;
  livepixUsername?: string;
  livepixEmail?: string;
  linkedAt: Date;
}

@Injectable()
export class LivepixLinkService {
  private readonly logger = new Logger(LivepixLinkService.name);
  private userLinks: Map<string, UserLink> = new Map();

  constructor(private configService: ConfigService) {}

  linkUser(discordId: string, livepixIdentifier: string): void {
    const isEmail = livepixIdentifier.includes('@');
    
    const link: UserLink = {
      discordId,
      linkedAt: new Date(),
    };

    if (isEmail) {
      link.livepixEmail = livepixIdentifier.toLowerCase();
    } else {
      link.livepixUsername = livepixIdentifier.toLowerCase();
    }

    this.userLinks.set(discordId, link);
    this.logger.log(`Usuário ${discordId} vinculado ao Livepix: ${livepixIdentifier}`);
  }

  unlinkUser(discordId: string): boolean {
    const removed = this.userLinks.delete(discordId);
    if (removed) {
      this.logger.log(`Usuário ${discordId} desvinculado do Livepix`);
    }
    return removed;
  }

  findDiscordIdByLivepixUsername(username: string): string | null {
    const normalizedUsername = username.toLowerCase();
    
    for (const [discordId, link] of this.userLinks.entries()) {
      if (link.livepixUsername === normalizedUsername) {
        return discordId;
      }
    }
    
    return null;
  }

  findDiscordIdByLivepixEmail(email: string): string | null {
    const normalizedEmail = email.toLowerCase();
    
    for (const [discordId, link] of this.userLinks.entries()) {
      if (link.livepixEmail === normalizedEmail) {
        return discordId;
      }
    }
    
    return null;
  }

  getUserLink(discordId: string): UserLink | null {
    return this.userLinks.get(discordId) || null;
  }

  getAllLinks(): UserLink[] {
    return Array.from(this.userLinks.values());
  }
}
