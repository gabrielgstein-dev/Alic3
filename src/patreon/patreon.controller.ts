import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PatreonService } from './patreon.service';
import { PatreonSchedulerService } from './patreon-scheduler.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { PrismaService } from '../prisma/prisma.service';
import { getFeedIdFromPatreon } from './helpers/fetch-feed-id.helper';
import { GoogleSheetsService } from './google-sheets.service';

@Controller('patreon')
export class PatreonController {
  constructor(
    private readonly patreonService: PatreonService,
    private readonly schedulerService: PatreonSchedulerService,
    private readonly prisma: PrismaService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  @Get('feeds')
  async getAllFeeds() {
    return this.patreonService.getAllFeeds();
  }

  @Get('campaigns')
  async getAllCampaigns() {
    return this.patreonService.getAllFeeds();
  }

  @Post('feeds')
  async createFeed(@Body() dto: CreateFeedDto) {
    return this.patreonService.createFeed(dto);
  }

  @Post('campaigns')
  async createCampaign(@Body() dto: CreateFeedDto) {
    return this.patreonService.createFeed(dto);
  }

  @Put('feeds/:sourceId')
  async updateFeed(
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdateFeedDto,
  ) {
    return this.patreonService.updateFeed(sourceId, dto);
  }

  @Put('campaigns/:campaignId')
  @Patch('campaigns/:campaignId')
  async updateCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateFeedDto,
  ) {
    return this.patreonService.updateFeed(campaignId, dto);
  }

  @Delete('feeds/:sourceId')
  async deleteFeed(@Param('sourceId') sourceId: string) {
    await this.patreonService.deleteFeed(sourceId);
    return { message: 'Feed deleted successfully' };
  }

  @Delete('campaigns/:campaignId')
  async deleteCampaign(@Param('campaignId') campaignId: string) {
    await this.patreonService.deleteFeed(campaignId);
    return { message: 'Feed deleted successfully' };
  }

  @Post('feeds/:sourceId/check')
  async checkFeed(@Param('sourceId') sourceId: string) {
    const newPostsCount =
      await this.schedulerService.checkSingleFeed(sourceId);
    return {
      message: 'Check completed',
      newPostsFound: newPostsCount,
    };
  }

  @Post('campaigns/:campaignId/check')
  async checkCampaign(@Param('campaignId') campaignId: string) {
    const newPostsCount =
      await this.schedulerService.checkSingleFeed(campaignId);
    return {
      message: 'Check completed',
      newPostsFound: newPostsCount,
    };
  }

  @Post('check-all')
  async checkAllFeeds() {
    await this.schedulerService.checkAllFeeds();
    return { message: 'All feeds checked' };
  }

  @Get('posts/unnotified')
  async getUnnotifiedPosts() {
    return this.patreonService.getUnnotifiedPosts();
  }

  @Post('fetch-feed-id')
  async fetchFeedId(@Body('patreonUrl') patreonUrl: string) {
    if (!patreonUrl) {
      throw new Error('Patreon URL is required');
    }

    const feedData = await getFeedIdFromPatreon(patreonUrl);
    
    if (!feedData) {
      throw new Error(
        'Não foi possível buscar o Feed ID automaticamente.\n\n' +
        '💡 TENTE ESTAS ALTERNATIVAS:\n\n' +
        '1️⃣ Use URLs com formato /c/:\n' +
        '   ✅ https://www.patreon.com/c/NOME/home\n' +
        '   ❌ https://www.patreon.com/NOME (pode não funcionar)\n\n' +
        '2️⃣ Ou insira o Campaign ID manualmente:\n' +
        '   • Um campo amarelo aparecerá no formulário\n' +
        '   • Cole o Campaign ID lá (ex: 15336996)\n\n' +
        '3️⃣ Ou crie o autor sem Patreon agora:\n' +
        '   • Deixe o campo URL vazio\n' +
        '   • Vincule o feed depois manualmente'
      );
    }

    return feedData;
  }

  @Post('fetch-campaign-id')
  async fetchCampaignId(@Body('patreonUrl') patreonUrl: string) {
    return this.fetchFeedId(patreonUrl);
  }

  @Post('feeds/:sourceId/link-author')
  async linkAuthorToFeed(
    @Param('sourceId') sourceId: string,
    @Body('authorId') authorId: string,
  ) {
    const feed = await this.prisma.contentFeed.findUnique({
      where: { id: sourceId },
    });
    
    if (!feed) {
      throw new Error('Feed not found');
    }

    await this.prisma.modAuthor.update({
      where: { id: authorId },
      data: { feedSourceId: feed.sourceId },
    });
    return { message: 'Author linked successfully' };
  }

  @Post('campaigns/:campaignId/link-author')
  async linkAuthorToCampaign(
    @Param('campaignId') campaignId: string,
    @Body('authorId') authorId: string,
  ) {
    return this.linkAuthorToFeed(campaignId, authorId);
  }

  @Get('authors')
  async getAllAuthors() {
    return this.prisma.modAuthor.findMany({
      include: {
        _count: {
          select: { mods: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('authors')
  async createAuthor(
    @Body('name') name: string,
    @Body('patreonUrl') patreonUrl?: string,
    @Body('notificationChannelId') notificationChannelId?: string,
    @Body('manualCampaignId') manualCampaignId?: string,
  ) {
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');

    let feedSourceId: string | undefined;
    let feedCreated = false;

    if (patreonUrl || manualCampaignId) {
      let campaignId = manualCampaignId;
      let creatorName = name;

      if (patreonUrl && !manualCampaignId) {
        try {
          const feedData = await getFeedIdFromPatreon(patreonUrl);
          if (feedData) {
            campaignId = feedData.campaignId;
            creatorName = feedData.creatorName;
          }
        } catch (error) {
          console.error('Failed to fetch campaign ID:', error);
        }
      }

      if (campaignId && notificationChannelId) {
        try {
          const existingFeed = await this.prisma.contentFeed.findUnique({
            where: { sourceId: campaignId },
          });

          if (!existingFeed) {
            await this.prisma.contentFeed.create({
              data: {
                platform: 'PATREON',
                sourceId: campaignId,
                creatorName,
                notificationChannelId,
                isActive: true,
                checkIntervalMins: 30,
              },
            });
            feedCreated = true;
          }

          feedSourceId = campaignId;
        } catch (error) {
          console.error('Failed to create feed:', error);
        }
      }
    }

    const author = await this.prisma.modAuthor.create({
      data: {
        name,
        slug,
        patreonUrl,
        feedSourceId,
      },
    });

    return {
      ...author,
      _meta: {
        feedCreated,
        feedFetchFailed: patreonUrl && !feedSourceId,
        usedManualId: !!manualCampaignId,
      },
    };
  }

  @Delete('authors/:authorId')
  async deleteAuthor(@Param('authorId') authorId: string) {
    const author = await this.prisma.modAuthor.findUnique({
      where: { id: authorId },
      include: {
        mods: true,
      },
    });

    if (!author) {
      throw new Error('Author not found');
    }

    if (author.feedSourceId) {
      await this.prisma.patreonPost.deleteMany({
        where: { feedSourceId: author.feedSourceId },
      });

      await this.prisma.contentFeed.delete({
        where: { sourceId: author.feedSourceId },
      });
    }

    await this.prisma.modAuthor.delete({
      where: { id: authorId },
    });

    return {
      message: 'Author and associated feed deleted successfully',
      deletedModsCount: author.mods.length,
    };
  }

  @Get('mods')
  async getAllMods() {
    return this.prisma.mod.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        aliases: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('mods')
  async createMod(
    @Body('authorId') authorId: string,
    @Body('primaryName') primaryName: string,
    @Body('curseForgeUrl') curseForgeUrl: string,
  ) {
    const slug = primaryName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');

    return this.prisma.mod.create({
      data: {
        authorId,
        primaryName,
        slug,
        normalizedName: slug,
        curseForgeUrl,
      },
    });
  }

  @Post('mods/import')
  async importMod(
    @Body('authorId') authorId: string,
    @Body('curseForgeUrl') curseForgeUrl: string,
  ) {
    if (!curseForgeUrl.includes('curseforge.com')) {
      throw new Error('Invalid CurseForge URL');
    }

    const urlParts = curseForgeUrl.split('/');
    const modSlugFromUrl =
      urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];

    const modName = modSlugFromUrl
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const slug = modSlugFromUrl.toLowerCase().replace(/[^\w-]/g, '');

    const existingMod = await this.prisma.mod.findFirst({
      where: {
        OR: [{ curseForgeUrl }, { slug }],
      },
    });

    if (existingMod) {
      throw new Error('Mod already exists');
    }

    return this.prisma.mod.create({
      data: {
        authorId,
        primaryName: modName,
        slug,
        normalizedName: slug,
        curseForgeUrl,
      },
    });
  }

  @Patch('mods/:modId')
  async updateMod(
    @Param('modId') modId: string,
    @Body('translatedVersion') translatedVersion?: string,
    @Body('latestVersion') latestVersion?: string,
  ) {
    return this.prisma.mod.update({
      where: { id: modId },
      data: {
        ...(translatedVersion && { translatedVersion }),
        ...(latestVersion && { latestVersion }),
      },
    });
  }

  @Post('mods/:modId/aliases')
  async addModAlias(
    @Param('modId') modId: string,
    @Body('aliasName') aliasName: string,
  ) {
    const normalized = aliasName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_');

    return this.prisma.modAlias.create({
      data: {
        modId,
        name: aliasName,
        normalized,
      },
    });
  }

  @Get('posts/pending-review')
  async getPendingReviewPosts() {
    return this.prisma.patreonPost.findMany({
      where: {
        modAppearances: {
          some: {
            needsReview: true,
          },
        },
      },
      include: {
        modAppearances: {
          where: {
            needsReview: true,
          },
          include: {
            mod: {
              select: {
                id: true,
                primaryName: true,
              },
            },
          },
        },
        feed: {
          select: {
            creatorName: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  @Post('post-mods/:postModId/confirm')
  async confirmPostMod(@Param('postModId') postModId: string) {
    return this.prisma.patreonPostMod.update({
      where: { id: postModId },
      data: { needsReview: false },
    });
  }

  @Post('post-mods/:postModId/ignore')
  async ignorePostMod(@Param('postModId') postModId: string) {
    return this.prisma.patreonPostMod.update({
      where: { id: postModId },
      data: { needsReview: false },
    });
  }

  @Post('sheets/register')
  async registerGoogleSheet(
    @Body('sheetUrl') sheetUrl: string,
    @Body('authorId') authorId: string,
    @Body('notificationChannelId') notificationChannelId: string,
    @Body('range') range?: string,
  ) {
    const spreadsheetId = this.googleSheetsService.extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL');
    }

    const gid = this.googleSheetsService.extractSheetGid(sheetUrl);
    const sheetTitle = await this.googleSheetsService.getSheetTitle(spreadsheetId, gid);
    const sheetRange = range || `${sheetTitle}!A1:Z1000`;

    const author = await this.prisma.modAuthor.findUnique({
      where: { id: authorId },
    });

    if (!author) {
      throw new Error('Author not found');
    }

    const existingFeed = await this.prisma.contentFeed.findUnique({
      where: { sourceId: spreadsheetId },
    });

    if (existingFeed) {
      throw new Error('Google Sheet already registered');
    }

    const initialData = await this.googleSheetsService.fetchSheetData(spreadsheetId, sheetRange);
    const dataMap = this.googleSheetsService.buildDataMap(initialData);

    const feed = await this.prisma.contentFeed.create({
      data: {
        platform: 'GOOGLE_SHEETS',
        sourceId: spreadsheetId,
        creatorName: author.name,
        creatorUrl: sheetUrl,
        description: `Range: ${sheetRange}`,
        notificationChannelId,
        isActive: true,
        checkIntervalMins: 180,
      },
    });

    await this.prisma.sheetSnapshot.create({
      data: {
        feedSourceId: spreadsheetId,
        snapshotData: JSON.stringify(Array.from(dataMap.entries())),
      },
    });

    await this.prisma.modAuthor.update({
      where: { id: authorId },
      data: { feedSourceId: spreadsheetId },
    });

    return {
      feed,
      initialModsCount: initialData.length,
      message: 'Google Sheet registered successfully',
    };
  }

  @Post('sheets/test')
  async testGoogleSheet(
    @Body('sheetUrl') sheetUrl: string,
    @Body('range') range?: string,
  ) {
    const spreadsheetId = this.googleSheetsService.extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL');
    }

    const gid = this.googleSheetsService.extractSheetGid(sheetUrl);
    const sheetTitle = await this.googleSheetsService.getSheetTitle(spreadsheetId, gid);
    const sheetRange = range || `${sheetTitle}!A1:Z1000`;

    const data = await this.googleSheetsService.fetchSheetData(spreadsheetId, sheetRange);

    return {
      spreadsheetId,
      sheetTitle,
      range: sheetRange,
      modsFound: data.length,
      sample: data.slice(0, 5),
    };
  }
}
