import {
  Client,
  Guild,
  TextChannel,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
} from 'discord.js';
import {
  createTicketEmbed,
  createConfirmationEmbed,
} from '../components/embed-components';
import {
  createTicketButtons,
  createTicketLinkButton,
} from '../components/button-components';
import { getPermissionOverwrites } from '../../utils/permissions';

export class TicketBuilder {
  private client: Client;
  private guild: Guild;
  private user: any;
  private subject: string;
  private supportRoleIds: string[];

  constructor(
    client: Client,
    guild: Guild,
    user: any,
    subject: string,
    supportRoleIds: string[],
  ) {
    this.client = client;
    this.guild = guild;
    this.user = user;
    this.subject = subject;
    this.supportRoleIds = supportRoleIds;
  }

  public async createTicketChannel() {
    const permissionOverwrites = getPermissionOverwrites(
      this.guild.id,
      this.user.id,
      this.client.user.id,
      this.supportRoleIds,
    );

    const channel = await this.guild.channels.create({
      name: `suporte-${this.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites,
    });

    return channel as TextChannel;
  }

  public async sendInitialMessage(channel: TextChannel) {
    const embed = createTicketEmbed(this.user.username, this.subject);
    const row = createTicketButtons();

    await channel.send({ embeds: [embed], components: [row] });
  }

  public async sendConfirmation(
    interaction,
    channel: TextChannel,
    selectedCategory: string,
  ) {
    const confirmationEmbed = createConfirmationEmbed(selectedCategory);
    const button = createTicketLinkButton(this.guild.id, channel.id);
    const rowLink = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.editReply({
      content: `${interaction.user}`,
      embeds: [confirmationEmbed],
      components: [rowLink],
    });
  }
}
