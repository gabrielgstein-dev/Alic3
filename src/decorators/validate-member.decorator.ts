import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GuildMember, Interaction } from 'discord.js';

export const VALIDATE_MEMBER_KEY = 'validateMember';

export const ValidateMember = (memberIdParam: string) => SetMetadata(VALIDATE_MEMBER_KEY, memberIdParam);
