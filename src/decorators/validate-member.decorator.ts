import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GuildMember, Interaction } from 'discord.js';
import { MemberLookupService } from '../lookup/member-lookup.service';
import { MemberErrorHandlerService } from '../handlers/member-error-handler.service';

export const VALIDATE_MEMBER_KEY = 'validateMember';

export const ValidateMember = (memberIdParam: string) => SetMetadata(VALIDATE_MEMBER_KEY, memberIdParam);

export const MemberDecorator = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<GuildMember | null> => {
    const interaction: Interaction = ctx.switchToRpc().getContext().interaction;
    const memberIdOrTag = interaction.fields.getTextInputValue(data as string);

    const memberLookupService = new MemberLookupService();
    const memberErrorHandlerService = new MemberErrorHandlerService();

    const member = await memberLookupService.findMember(interaction.guild, memberIdOrTag);

    const hasErrors = await memberErrorHandlerService.handleMemberErrors(interaction, memberIdOrTag, member);

    return hasErrors ? (member as GuildMember) : null;
  },
);
