import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

interface ModalComponent {
  customId: string;
  title: string;
}

export function createModalMemberName({ customId, title }: ModalComponent) {
  const modal = new ModalBuilder()
    .setCustomId(customId) //addMemberModal
    .setTitle(title);

  const memberIdInput = new TextInputBuilder()
    .setCustomId('memberId')
    .setLabel('ID ou Nome do Membro (ex: Usuario#1234)')
    .setStyle(TextInputStyle.Short);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    memberIdInput,
  );

  modal.addComponents(actionRow);
  return modal;
}
