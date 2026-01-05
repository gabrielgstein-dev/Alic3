import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DiscordOAuthService } from './discord-oauth.service';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, DiscordOAuthService, SessionService, PrismaService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
