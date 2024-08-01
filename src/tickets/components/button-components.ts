import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export function createTicketButtons() {
  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Fechar')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔒'); // Ícone de cadeado

  const addMemberButton = new ButtonBuilder()
    .setCustomId('add_member')
    .setLabel('Adicionar Membro')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('➕'); // Ícone de mais

  const removeMemberButton = new ButtonBuilder()
    .setCustomId('remove_member')
    .setLabel('Remover Membro')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('➖'); // Ícone de menos

  const configButton = new ButtonBuilder()
    .setCustomId('config_ticket')
    .setLabel('Configurações')
    .setStyle(ButtonStyle.Success)
    .setEmoji('⚙️'); // Ícone de engrenagem

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    closeButton,
    addMemberButton,
    removeMemberButton,
    configButton,
  );
}

export function createTicketLinkButton(guildId: string, channelId: string) {
  return new ButtonBuilder()
    .setLabel('Iniciar para sala do ticket')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/channels/${guildId}/${channelId}`)
    .setEmoji('🔗');
}

export function createTicketHistoryButton(
  url: string,
): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setLabel('Abrir histórico da conversa')
    .setStyle(ButtonStyle.Link)
    .setURL(url)
    .setEmoji('🔗');

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}
