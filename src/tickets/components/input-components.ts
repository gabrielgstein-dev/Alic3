import { TextInputBuilder, TextInputStyle } from 'discord.js';

export function createTicketSubjectInput() {
  return new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('Informe o assunto do ticket:')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Detalhe o que aconteceu ou sua dúvida aqui!')
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(4000);
}
