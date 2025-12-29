import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { EmbedBuilderService, EmbedData } from './embed-builder.service';

interface EmbedSession {
  userId: string;
  data: Partial<EmbedData>;
  step: 'basic' | 'advanced' | 'fields' | 'select_channel' | 'preview';
}

@Injectable()
export class EmbedCommand {
  private readonly logger = new Logger(EmbedCommand.name);
  private sessions: Map<string, EmbedSession> = new Map();

  constructor(
    @Inject(Client) private client: Client,
    private configService: ConfigService,
    private embedBuilderService: EmbedBuilderService,
  ) {}

  createEmbedBuilderEmbed() {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎨 Criador de Embed')
      .setDescription(
        '**Crie mensagens embed personalizadas para o servidor!**\n\n' +
        'Clique no botão abaixo para começar a criar sua embed.\n\n' +
        '**Recursos disponíveis:**\n' +
        '• Título e Descrição\n' +
        '• Cores personalizadas\n' +
        '• Imagens e Thumbnails\n' +
        '• Footer e Author\n' +
        '• Campos customizáveis\n' +
        '• Preview antes de enviar\n\n' +
        '⚠️ **Apenas administradores podem usar este comando**'
      )
      .setFooter({ text: 'Embed Builder' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('embed_create_basic')
        .setLabel('🎨 Criar Embed')
        .setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [row] };
  }

  async handleCreateBasic(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('embed_modal_basic')
      .setTitle('Criar Embed - Informações Básicas');

    const titleInput = new TextInputBuilder()
      .setCustomId('embed_title')
      .setLabel('Título da Embed')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Digite o título (opcional)')
      .setRequired(false)
      .setMaxLength(256);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('embed_description')
      .setLabel('Descrição')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Digite a descrição da embed')
      .setRequired(true)
      .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
      .setCustomId('embed_color')
      .setLabel('Cor (hex #RRGGBB ou nome em português)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: #5865F2, azul, verde, vermelho')
      .setRequired(false)
      .setMaxLength(20);

    const imageInput = new TextInputBuilder()
      .setCustomId('embed_image')
      .setLabel('URL da Imagem Grande (opcional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://exemplo.com/imagem.png')
      .setRequired(false);

    const thumbnailInput = new TextInputBuilder()
      .setCustomId('embed_thumbnail')
      .setLabel('URL da Thumbnail (opcional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://exemplo.com/thumb.png')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput),
    );

    await interaction.showModal(modal);
  }

  async handleBasicModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const title = interaction.fields.getTextInputValue('embed_title') || undefined;
    const description = interaction.fields.getTextInputValue('embed_description');
    const color = interaction.fields.getTextInputValue('embed_color') || '#5865F2';
    const image = interaction.fields.getTextInputValue('embed_image') || undefined;
    const thumbnail = interaction.fields.getTextInputValue('embed_thumbnail') || undefined;

    const embedData: Partial<EmbedData> = {
      title,
      description,
      color,
      image,
      thumbnail,
      timestamp: true,
    };

    const validation = this.embedBuilderService.validateEmbedData(embedData);
    if (!validation.valid) {
      await interaction.reply({
        content: `❌ **Erro na validação:**\n${validation.errors.join('\n')}`,
        ephemeral: true,
      });
      return;
    }

    this.sessions.set(interaction.user.id, {
      userId: interaction.user.id,
      data: embedData,
      step: 'select_channel',
    });

    await this.showChannelSelector(interaction);
  }

  private async showChannelSelector(
    interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: '❌ Este comando só pode ser usado em um servidor',
        ephemeral: true,
      });
      return;
    }

    const channels = guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => ({
        label: channel.name,
        value: channel.id,
        description: `ID: ${channel.id}`,
      }))
      .slice(0, 25);

    if (channels.length === 0) {
      await interaction.reply({
        content: '❌ Nenhum canal de texto encontrado',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('embed_select_channel')
      .setPlaceholder('Selecione o canal para enviar a embed')
      .addOptions(channels);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const session = this.sessions.get(interaction.user.id);
    const previewEmbed = this.embedBuilderService.buildEmbed(session.data);

    const method = interaction.isModalSubmit() ? 'reply' : 'update';
    await interaction[method]({
      content: '📝 **Preview da sua embed:**\n\nSelecione o canal onde deseja enviar:',
      embeds: [previewEmbed],
      components: [row],
      ephemeral: true,
    });
  }

  async handleChannelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const session = this.sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({
        content: '❌ Sessão expirada. Por favor, inicie novamente.',
        ephemeral: true,
      });
      return;
    }

    const channelId = interaction.values[0];
    const channel = await interaction.guild.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: '❌ Canal inválido',
        ephemeral: true,
      });
      return;
    }

    try {
      await this.embedBuilderService.sendEmbedToChannel(channel, session.data as EmbedData);
      
      await interaction.update({
        content: `✅ **Embed enviada com sucesso para ${channel}!**`,
        embeds: [],
        components: [],
      });

      this.sessions.delete(interaction.user.id);
    } catch (error) {
      this.logger.error('Erro ao enviar embed', error);
      await interaction.reply({
        content: '❌ Erro ao enviar embed. Verifique as permissões do bot no canal.',
        ephemeral: true,
      });
    }
  }
}
