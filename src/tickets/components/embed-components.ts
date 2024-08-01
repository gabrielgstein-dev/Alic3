import { ButtonInteraction, EmbedBuilder, User } from 'discord.js';

export function createSystemEmbed() {
  return new EmbedBuilder()
    .setTitle('Sistema de atendimento')
    .setDescription(
      'Escolha uma opção com base no assunto que você deseja discutir com um membro da equipe da cidade através de um ticket:\n\n' +
        '**Observações:**\n' +
        '• Por favor, tenha em mente que cada tipo de ticket é específico para lidar com o assunto selecionado.\n' +
        '• Evite abrir um ticket sem um motivo válido, pois isso pode resultar em punições.',
    )
    .setFooter({ text: 'Atlanta Roleplay © Todos os direitos reservados' })
    .setColor(0xff0000);
}

export function createTicketEmbed(user: string, subject: string) {
  return new EmbedBuilder()
    .setTitle('Atendimento | Chamado de Suporte')
    .setDescription(
      `Olá ${user}, seja muito bem-vindo ao nosso atendimento personalizado.\n\n` +
        `Estamos felizes em tê-lo aqui e faremos o possível para fornecer a ajuda que você precisa. Em breve, um dos nossos staff estará disponível para atendê-lo.\n\n` +
        `**Responsável pelo atendimento:**\n` +
        `**Assunto do atendimento:** ${subject}\n\n` +
        `Agradecemos desde já pelo seu contato. Caso queira realizar alguma alteração no atendimento, fique à vontade para interagir conosco abaixo:`,
    )
    .setThumbnail('https://via.placeholder.com/150') // TODO: Substituir URL com a URL real da imagem em miniatura
    .setFooter({ text: 'Atlanta Roleplay © Todos os direitos reservados' })
    .setColor(0x00ae86);
}

export function createConfirmationEmbed(selectedCategory: string) {
  return new EmbedBuilder()
    .setTitle('Ticket aberto ✅')
    .setDescription(
      `Clique no botão abaixo para ir até seu ticket.\n\n` +
        `**Categoria escolhida:** ${selectedCategory}`,
    )
    .setColor(0x00ae86);
}

export function createTicketClosedEmbed(
  interaction: ButtonInteraction,
  user: User,
  ticketNumber: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('✅ Ticket Finalizado | Alic3')
    .setDescription(
      'Caso você queira ver o que foi conversado ou qual foi a solução que você teve no seu ticket, você pode clicar no botão abaixo.',
    )
    .addFields(
      { name: '🆔 Número do TICKET:', value: ticketNumber, inline: false },
      { name: '👤 Solicitante:', value: `<@${user.id}>`, inline: true },
      {
        name: '🔒 Finalizado por:',
        value: `<@${interaction.user.id}>`,
        inline: true,
      },
    )
    .setFooter({
      text: `Ticket finalizado`,
      iconURL: 'https://via.placeholder.com/150',
    })
    .setColor(0x00ae86)
    .setThumbnail('https://via.placeholder.com/150')
    .setTimestamp();

  return embed;
}
