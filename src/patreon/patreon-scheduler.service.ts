import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PatreonService } from './patreon.service';
import { PatreonNotificationService } from './patreon-notification.service';
import { ModDetectionService } from './mod-detection.service';
import { ModNotificationService } from './mod-notification.service';
import { GoogleSheetsService } from './google-sheets.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatreonSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PatreonSchedulerService.name);
  private isChecking = false;

  constructor(
    private readonly patreonService: PatreonService,
    private readonly notificationService: PatreonNotificationService,
    private readonly modDetectionService: ModDetectionService,
    private readonly modNotificationService: ModNotificationService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Patreon Monitor initialized');
    await this.checkAllFeeds();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    if (this.isChecking) {
      this.logger.warn('Previous check still running, skipping...');
      return;
    }

    await this.checkAllFeeds();
  }

  async checkAllFeeds() {
    this.isChecking = true;
    this.logger.log('Starting feed check...');

    try {
      const feeds = await this.patreonService.getActiveFeeds();
      this.logger.log(`Found ${feeds.length} active feeds to check`);

      for (const feed of feeds) {
        const shouldCheck = this.shouldCheckFeed(
          feed.lastCheckedAt,
          feed.checkIntervalMins,
        );

        if (!shouldCheck) {
          this.logger.debug(
            `Skipping feed ${feed.creatorName} - checked recently`,
          );
          continue;
        }

        this.logger.log(`Checking feed: ${feed.creatorName}`);

        if (feed.platform === 'GOOGLE_SHEETS') {
          await this.checkGoogleSheetFeed(feed);
          continue;
        }

        const newPosts = await this.patreonService.checkForNewPosts(
          feed.sourceId,
        );

        if (newPosts.length > 0) {
          this.logger.log(
            `Found ${newPosts.length} new posts for ${feed.creatorName}`,
          );

          for (const post of newPosts) {
            try {
              await this.modDetectionService.analyzePost(
                post.id,
                post.attributes.title,
                post.attributes.content || '',
                new Date(post.attributes.published_at),
                feed.sourceId,
              );
              
              this.logger.log(`Post ${post.id} analyzed for mods`);

              await this.modNotificationService.notifyModsDetected(post.id);
            } catch (error) {
              this.logger.error(
                `Failed to analyze post ${post.id}:`,
                error.message,
              );
            }

            await this.notificationService.sendNewPostNotification(
              feed.notificationChannelId,
              post,
              feed.creatorName,
            );

            await this.patreonService.markPostAsNotified(post.id);
            
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      this.logger.log('Feed check completed');
    } catch (error) {
      this.logger.error('Error during feed check:', error.message);
    } finally {
      this.isChecking = false;
    }
  }

  async checkAllCampaigns() {
    return this.checkAllFeeds();
  }

  async checkSingleFeed(sourceId: string): Promise<number> {
    this.logger.log(`Manual check for feed: ${sourceId}`);
    const newPosts = await this.patreonService.checkForNewPosts(sourceId);

    if (newPosts.length > 0) {
      const feed = await this.patreonService
        .getAllFeeds()
        .then((feeds) =>
          feeds.find((f) => f.sourceId === sourceId),
        );

      if (feed) {
        for (const post of newPosts) {
          try {
            await this.modDetectionService.analyzePost(
              post.id,
              post.attributes.title,
              post.attributes.content || '',
              new Date(post.attributes.published_at),
              feed.sourceId,
            );
            
            this.logger.log(`Post ${post.id} analyzed for mods`);

            await this.modNotificationService.notifyModsDetected(post.id);
          } catch (error) {
            this.logger.error(
              `Failed to analyze post ${post.id}:`,
              error.message,
            );
          }

          await this.notificationService.sendNewPostNotification(
            feed.notificationChannelId,
            post,
            feed.creatorName,
          );

          await this.patreonService.markPostAsNotified(post.id);
          
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    return newPosts.length;
  }

  async checkSingleCampaign(campaignId: string): Promise<number> {
    return this.checkSingleFeed(campaignId);
  }

  private async checkGoogleSheetFeed(feed: any): Promise<void> {
    try {
      const range = feed.description?.replace('Range: ', '') || 'Sheet1!A1:Z1000';
      
      const modifiedTime = await this.googleSheetsService.getLastModifiedTime(feed.sourceId);
      
      if (modifiedTime && feed.lastCheckedAt) {
        if (modifiedTime <= feed.lastCheckedAt) {
          this.logger.debug(`Sheet ${feed.creatorName} not modified since last check, skipping`);
          await this.prisma.contentFeed.update({
            where: { sourceId: feed.sourceId },
            data: { lastCheckedAt: new Date() },
          });
          return;
        }
      }
      
      const latestSnapshot = await this.prisma.sheetSnapshot.findFirst({
        where: { feedSourceId: feed.sourceId },
        orderBy: { createdAt: 'desc' },
      });

      const previousData = latestSnapshot
        ? new Map(JSON.parse(latestSnapshot.snapshotData as string))
        : new Map();

      const changes = await this.googleSheetsService.detectChanges(
        feed.sourceId,
        range,
        previousData,
      );

      if (changes.length > 0) {
        this.logger.log(`Found ${changes.length} mod updates in ${feed.creatorName}'s sheet`);

        for (const change of changes) {
          this.logger.log(
            `${change.oldVersion ? 'Update' : 'New'}: ${change.modName} -> ${change.newVersion}`,
          );
        }

        const currentData = await this.googleSheetsService.fetchSheetData(
          feed.sourceId,
          range,
        );
        const dataMap = this.googleSheetsService.buildDataMap(currentData);

        await this.prisma.sheetSnapshot.create({
          data: {
            feedSourceId: feed.sourceId,
            snapshotData: JSON.stringify(Array.from(dataMap.entries())),
          },
        });
      }

      await this.prisma.contentFeed.update({
        where: { sourceId: feed.sourceId },
        data: { lastCheckedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Error checking Google Sheet ${feed.creatorName}:`,
        error.message,
      );
    }
  }

  private shouldCheckFeed(
    lastCheckedAt: Date | null,
    intervalMins: number,
  ): boolean {
    if (!lastCheckedAt) return true;

    const now = new Date();
    const diffMinutes =
      (now.getTime() - lastCheckedAt.getTime()) / 1000 / 60;

    return diffMinutes >= intervalMins;
  }
}
