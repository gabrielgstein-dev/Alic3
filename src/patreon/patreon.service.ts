import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import {
  PatreonApiResponse,
  PatreonPostData,
  PatreonCampaignConfig,
} from './interfaces/patreon-api.interface';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';

@Injectable()
export class PatreonService {
  private readonly logger = new Logger(PatreonService.name);
  private readonly baseUrl = 'https://www.patreon.com/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async fetchFeedPosts(sourceId: string): Promise<PatreonPostData[]> {
    try {
      const url = `${this.baseUrl}/posts`;
      const params = {
        'filter[campaign_id]': sourceId,
        include: 'attachments,user_defined_tags',
        'fields[post]':
          'content,title,url,published_at,post_type,min_cents_pledged_to_view',
        'sort': '-published_at',
        'filter[is_draft]': 'false',
      };

      this.logger.log(`Fetching posts for feed ${sourceId}`);
      const response = await firstValueFrom(
        this.httpService.get<PatreonApiResponse>(url, { params }),
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch posts for feed ${sourceId}:`,
        error.message,
      );
      throw error;
    }
  }

  async createFeed(dto: CreateFeedDto) {
    const feed = await this.prisma.contentFeed.create({
      data: {
        platform: dto.platform || 'PATREON',
        sourceId: dto.sourceId,
        creatorName: dto.creatorName,
        creatorUrl: dto.creatorUrl,
        description: dto.description,
        notificationChannelId: dto.notificationChannelId,
        checkIntervalMins: dto.checkIntervalMins || 30,
      },
    });

    this.logger.log(`Feed ${dto.creatorName} created successfully`);
    return feed;
  }

  async updateFeed(sourceId: string, dto: UpdateFeedDto) {
    const feed = await this.prisma.contentFeed.update({
      where: { sourceId },
      data: dto,
    });

    this.logger.log(`Feed ${sourceId} updated successfully`);
    return feed;
  }

  async deleteFeed(sourceId: string) {
    await this.prisma.patreonPost.deleteMany({
      where: { feedSourceId: sourceId },
    });

    await this.prisma.contentFeed.delete({
      where: { sourceId },
    });

    this.logger.log(`Feed ${sourceId} deleted successfully`);
  }

  async getAllFeeds() {
    return this.prisma.contentFeed.findMany({
      include: {
        posts: {
          take: 5,
          orderBy: { publishedAt: 'desc' },
        },
      },
    });
  }

  async getActiveFeeds() {
    return this.prisma.contentFeed.findMany({
      where: { isActive: true },
    });
  }

  async checkForNewPosts(sourceId: string): Promise<PatreonPostData[]> {
    try {
      const feed = await this.prisma.contentFeed.findUnique({
        where: { sourceId },
      });

      if (!feed || !feed.isActive) {
        return [];
      }

      const posts = await this.fetchFeedPosts(sourceId);
      const newPosts: PatreonPostData[] = [];

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      for (const post of posts) {
        const publishedAt = new Date(post.attributes.published_at);

        if (publishedAt < tenDaysAgo) {
          this.logger.debug(
            `Skipping old post ${post.attributes.title} (published ${publishedAt.toISOString()})`,
          );
          continue;
        }

        const existingPost = await this.prisma.patreonPost.findUnique({
          where: { postId: post.id },
        });

        if (!existingPost) {
          await this.prisma.patreonPost.create({
            data: {
              postId: post.id,
              feedSourceId: sourceId,
              title: post.attributes.title,
              url: post.attributes.url,
              content: post.attributes.content,
              postType: post.attributes.post_type,
              publishedAt: publishedAt,
              minCentsPledged: post.attributes.min_cents_pledged_to_view,
              isNotified: false,
            },
          });

          newPosts.push(post);
          this.logger.log(
            `New post detected: ${post.attributes.title} (Feed: ${sourceId})`,
          );
        }
      }

      await this.prisma.contentFeed.update({
        where: { sourceId },
        data: { lastCheckedAt: new Date() },
      });

      return newPosts;
    } catch (error) {
      this.logger.error(
        `Error checking feed ${sourceId}:`,
        error.message,
      );
      return [];
    }
  }

  async markPostAsNotified(postId: string) {
    await this.prisma.patreonPost.update({
      where: { postId },
      data: { isNotified: true },
    });
  }

  async getUnnotifiedPosts() {
    return this.prisma.patreonPost.findMany({
      where: { isNotified: false },
      include: { feed: true },
      orderBy: { publishedAt: 'desc' },
    });
  }
}
