import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModDetectionService } from '../../patreon/mod-detection.service';
import { Message, EmbedBuilder } from 'discord.js';

@Injectable()
export class ModManagementCommand {
  constructor(
    private prisma: PrismaService,
    private modDetection: ModDetectionService,
  ) {}

  async handleModCommand(message: Message, args: string[]) {
    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'author':
        await this.handleAuthorCommand(message, args.slice(1));
        break;
      case 'add':
        await this.addMod(message, args.slice(1));
        break;
      case 'import':
        await this.importModFromCurseForge(message, args.slice(1));
        break;
      case 'update':
        await this.updateModVersion(message, args.slice(1));
        break;
      case 'alias':
        await this.handleAliasCommand(message, args.slice(1));
        break;
      case 'list':
        await this.listMods(message, args[1]);
        break;
      case 'info':
        await this.modInfo(message, args[1]);
        break;
      case 'review':
        await this.showReview(message);
        break;
      case 'help':
      default:
        await this.showHelp(message);
        break;
    }
  }

  private async handleAuthorCommand(message: Message, args: string[]) {
    const action = args[0]?.toLowerCase();

    switch (action) {
      case 'add':
        await this.addAuthor(message, args.slice(1));
        break;
      case 'list':
        await this.listAuthors(message);
        break;
      case 'link':
        await this.linkAuthorToFeed(message, args.slice(1));
        break;
      default:
        await message.reply('❌ Use: `!mod author add/list/link`');
    }
  }

  private async handleAliasCommand(message: Message, args: string[]) {
    const action = args[0]?.toLowerCase();

    if (action === 'add') {
      await this.addAlias(message, args.slice(1));
    } else {
      await message.reply('❌ Use: `!mod alias add <mod_id> <alias>`');
    }
  }

  private async addAuthor(message: Message, args: string[]) {
    if (args.length < 1) {
      await message.reply('❌ Use: `!mod author add <nome> [patreon_url]`');
      return;
    }

    const name = args.slice(0, args.length - (args[args.length - 1].includes('patreon.com') ? 1 : 0)).join(' ');
    const patreonUrl = args[args.length - 1].includes('patreon.com') ? args[args.length - 1] : null;

    const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

    const author = await this.prisma.modAuthor.create({
      data: {
        name,
        slug,
        patreonUrl,
      },
    });

    await message.reply(`✅ Autor **${name}** criado!\nID: \`${author.id}\``);
  }

  private async listAuthors(message: Message) {
    const authors = await this.prisma.modAuthor.findMany({
      include: {
        _count: {
          select: { mods: true },
        },
      },
    });

    if (authors.length === 0) {
      await message.reply('📭 Nenhum autor cadastrado.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('👥 Autores de Mods')
      .setDescription(
        authors
          .map((a) => `**${a.name}** (\`${a.id}\`)\n└ ${a._count.mods} mod(s)`)
          .join('\n\n'),
      );

    await message.reply({ embeds: [embed] });
  }

  private async linkAuthorToFeed(message: Message, args: string[]) {
    if (args.length < 2) {
      await message.reply('❌ Use: `!mod author link <author_id> <feed_id>`');
      return;
    }

    const [authorId, feedId] = args;

    try {
      const author = await this.prisma.modAuthor.findUnique({
        where: { id: authorId },
      });

      if (!author) {
        await message.reply(`❌ Autor com ID \`${authorId}\` não encontrado.`);
        return;
      }

      const feed = await this.prisma.contentFeed.findUnique({
        where: { sourceId: feedId },
      });

      if (!feed) {
        await message.reply(`❌ Feed com ID \`${feedId}\` não encontrado.\n💡 Crie o feed primeiro via API.`);
        return;
      }

      await this.prisma.modAuthor.update({
        where: { id: authorId },
        data: { feedSourceId: feedId },
      });

      await message.reply(`✅ Autor **${author.name}** vinculado ao feed **${feed.creatorName}**!`);
    } catch (error) {
      await message.reply(`❌ Erro ao vincular: ${error.message}`);
    }
  }

  private async addMod(message: Message, args: string[]) {
    if (args.length < 3) {
      await message.reply('❌ Use: `!mod add <author_id> <nome> <curseforge_url>`');
      return;
    }

    const authorId = args[0];
    const curseForgeUrl = args[args.length - 1];
    const name = args.slice(1, -1).join(' ');

    const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

    try {
      const mod = await this.prisma.mod.create({
        data: {
          authorId,
          primaryName: name,
          slug,
          normalizedName: slug,
          curseForgeUrl,
        },
      });

      await message.reply(`✅ Mod **${name}** criado!\nID: \`${mod.id}\``);
    } catch (error) {
      await message.reply('❌ Erro ao criar mod. Verifique o ID do autor.');
    }
  }

  private async importModFromCurseForge(message: Message, args: string[]) {
    if (args.length < 2) {
      await message.reply('❌ Use: `!mod import <author_id> <curseforge_url>`');
      return;
    }

    const authorId = args[0];
    const curseForgeUrl = args[1];

    if (!curseForgeUrl.includes('curseforge.com')) {
      await message.reply('❌ URL inválida. Use uma URL do CurseForge.');
      return;
    }

    try {
      const author = await this.prisma.modAuthor.findUnique({
        where: { id: authorId },
      });

      if (!author) {
        await message.reply(`❌ Autor com ID \`${authorId}\` não encontrado.`);
        return;
      }

      const urlParts = curseForgeUrl.split('/');
      const modSlugFromUrl = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
      
      const modName = modSlugFromUrl
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const slug = modSlugFromUrl.toLowerCase().replace(/[^\w-]/g, '');

      const existingMod = await this.prisma.mod.findFirst({
        where: {
          OR: [
            { curseForgeUrl },
            { slug },
          ],
        },
      });

      if (existingMod) {
        await message.reply(`⚠️ Mod **${existingMod.primaryName}** já existe!\nID: \`${existingMod.id}\``);
        return;
      }

      const mod = await this.prisma.mod.create({
        data: {
          authorId,
          primaryName: modName,
          slug,
          normalizedName: slug,
          curseForgeUrl,
        },
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Mod Importado com Sucesso!')
        .addFields(
          { name: '📦 Nome', value: modName, inline: true },
          { name: '🆔 ID', value: `\`${mod.id}\``, inline: true },
          { name: '👤 Autor', value: author.name, inline: true },
          { name: '🔗 CurseForge', value: curseForgeUrl, inline: false },
        )
        .setFooter({ text: 'Use !mod update para definir a versão atual' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ Erro ao importar mod: ${error.message}`);
    }
  }

  private async updateModVersion(message: Message, args: string[]) {
    if (args.length < 2) {
      await message.reply('❌ Use: `!mod update <mod_id> <versão>`');
      return;
    }

    const [modIdOrName, version] = args;

    try {
      const mod = await this.prisma.mod.findFirst({
        where: {
          OR: [
            { id: modIdOrName },
            { primaryName: { contains: modIdOrName, mode: 'insensitive' } },
            { slug: modIdOrName },
          ],
        },
      });

      if (!mod) {
        await message.reply(`❌ Mod "${modIdOrName}" não encontrado.`);
        return;
      }

      const normalizedVersion = version.replace(/^v/i, '');

      await this.prisma.mod.update({
        where: { id: mod.id },
        data: {
          translatedVersion: normalizedVersion,
          translatedVersionNormalized: normalizedVersion,
          translationDate: new Date(),
          isUpToDate: true,
        },
      });

      await message.reply(`✅ Mod **${mod.primaryName}** atualizado para v${normalizedVersion}!`);
    } catch (error) {
      await message.reply('❌ Erro ao atualizar versão.');
    }
  }

  private async addAlias(message: Message, args: string[]) {
    if (args.length < 2) {
      await message.reply('❌ Use: `!mod alias add <mod_id> <alias>`');
      return;
    }

    const modId = args[0];
    const alias = args.slice(1).join(' ');
    const normalized = alias.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

    try {
      await this.prisma.modAlias.create({
        data: {
          modId,
          name: alias,
          normalized,
        },
      });

      await message.reply(`✅ Alias "${alias}" adicionado!`);
    } catch (error) {
      await message.reply('❌ Erro ao adicionar alias. Verifique o ID do mod.');
    }
  }

  private async listMods(message: Message, authorIdOrName?: string) {
    const where: any = authorIdOrName
      ? {
          OR: [
            { authorId: authorIdOrName },
            { author: { name: { contains: authorIdOrName, mode: 'insensitive' } } },
          ],
        }
      : {};

    const mods = await this.prisma.mod.findMany({
      where,
      include: {
        author: true,
        _count: {
          select: { aliases: true },
        },
      },
      take: 20,
    });

    if (mods.length === 0) {
      await message.reply('📭 Nenhum mod encontrado.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎮 Mods Cadastrados')
      .setDescription(
        mods
          .map(
            (m) =>
              `**${m.primaryName}** (\`${m.id.substring(0, 8)}\`)\n` +
              `└ Autor: ${m.author.name}\n` +
              `└ Versão traduzida: ${m.translatedVersion || 'N/A'}\n` +
              `└ Status: ${m.isUpToDate ? '✅ Atualizado' : '⚠️ Desatualizado'}\n` +
              `└ Aliases: ${m._count.aliases}`,
          )
          .join('\n\n'),
      );

    await message.reply({ embeds: [embed] });
  }

  private async modInfo(message: Message, modIdOrName: string) {
    if (!modIdOrName) {
      await message.reply('❌ Use: `!mod info <mod_id ou nome>`');
      return;
    }

    const mod = await this.prisma.mod.findFirst({
      where: {
        OR: [
          { id: modIdOrName },
          { primaryName: { contains: modIdOrName, mode: 'insensitive' } },
          { slug: modIdOrName },
        ],
      },
      include: {
        author: true,
        aliases: true,
      },
    });

    if (!mod) {
      await message.reply(`❌ Mod "${modIdOrName}" não encontrado.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎮 ${mod.primaryName}`)
      .addFields(
        { name: 'ID', value: `\`${mod.id}\``, inline: true },
        { name: 'Slug', value: `\`${mod.slug}\``, inline: true },
        { name: 'Autor', value: mod.author.name, inline: true },
        {
          name: 'Versão Traduzida',
          value: mod.translatedVersion || 'N/A',
          inline: true,
        },
        {
          name: 'Última Versão',
          value: mod.latestVersion || 'N/A',
          inline: true,
        },
        {
          name: 'Status',
          value: mod.isUpToDate ? '✅ Atualizado' : '⚠️ Desatualizado',
          inline: true,
        },
      );

    if (mod.curseForgeUrl) {
      embed.addFields({
        name: '🔗 CurseForge',
        value: mod.curseForgeUrl,
        inline: false,
      });
    }

    if (mod.aliases.length > 0) {
      embed.addFields({
        name: '🏷️ Aliases',
        value: mod.aliases.map((a) => `• ${a.name}`).join('\n'),
        inline: false,
      });
    }

    await message.reply({ embeds: [embed] });
  }

  private async showReview(message: Message) {
    const posts = await this.modDetection.getPostsNeedingReview(10);

    if (posts.length === 0) {
      await message.reply('✅ Nenhum post pendente de revisão!');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle('⚠️ Posts Pendentes de Revisão')
      .setDescription(`${posts.length} post(s) aguardando confirmação`);

    for (const post of posts.slice(0, 5)) {
      const modsText = post.modAppearances
        .map((m) => `• ${m.detectedName} (${m.confidence * 100}%)`)
        .join('\n');

      embed.addFields({
        name: `📦 ${post.title}`,
        value: `[Ver Post](${post.url})\n${modsText}`,
        inline: false,
      });
    }

    await message.reply({ embeds: [embed] });
  }

  private async showHelp(message: Message) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📚 Comandos de Gerenciamento de Mods')
      .setDescription('Sistema de detecção e gestão de mods do Patreon')
      .addFields(
        {
          name: '👥 Autores',
          value:
            '`!mod author add <nome> [url]` - Criar autor\n' +
            '`!mod author list` - Listar autores\n' +
            '`!mod author link <author_id> <feed_id>` - Vincular ao feed',
          inline: false,
        },
        {
          name: '🎮 Mods',
          value:
            '`!mod add <author_id> <nome> <url>` - Criar mod\n' +
            '`!mod import <author_id> <url>` - Importar do CurseForge\n' +
            '`!mod update <mod_id> <versão>` - Atualizar versão traduzida\n' +
            '`!mod list [autor]` - Listar mods\n' +
            '`!mod info <mod_id>` - Ver detalhes do mod',
          inline: false,
        },
        {
          name: '🏷️ Aliases',
          value: '`!mod alias add <mod_id> <alias>` - Adicionar nome alternativo',
          inline: false,
        },
        {
          name: '📋 Revisão',
          value: '`!mod review` - Ver posts pendentes de confirmação',
          inline: false,
        },
      );

    await message.reply({ embeds: [embed] });
  }
}
