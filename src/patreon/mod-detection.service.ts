import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from '../ai/groq.service';
import { NormalizationUtil } from '../utils/normalization.util';

interface ModMatchResult {
  modId: string | null;
  confidence: number;
  suggestedModId?: string;
  suggestedModName?: string;
}

@Injectable()
export class ModDetectionService {
  private readonly logger = new Logger(ModDetectionService.name);
  private readonly FUZZY_THRESHOLD = 0.80;

  constructor(
    private prisma: PrismaService,
    private groqService: GroqService,
  ) {}

  async analyzePost(
    postId: string,
    title: string,
    content: string,
    publishedAt: Date,
    feedSourceId: string,
  ): Promise<void> {
    try {
      const hasKeywords = this.checkKeywords(title, content);
      
      if (!hasKeywords) {
        await this.prisma.patreonPost.update({
          where: { postId },
          data: { analyzed: true, needsReview: false },
        });
        return;
      }

      const feed = await this.prisma.contentFeed.findUnique({
        where: { sourceId: feedSourceId },
        include: {
          author: {
            include: {
              mods: {
                where: { isActive: true },
                include: { aliases: true },
              },
            },
          },
        },
      });

      const knownModNames = feed?.author?.mods?.map(m => m.primaryName) || [];

      const analysis = await this.groqService.analyzePatreonPost(
        title,
        content || '',
        knownModNames,
      );

      if (analysis.mods.length === 0) {
        await this.prisma.patreonPost.update({
          where: { postId },
          data: {
            analyzed: true,
            needsReview: false,
            rawAiResponse: analysis as any,
          },
        });
        return;
      }

      const postModPromises = analysis.mods.map(async (detectedMod) => {
        const normalizedName = NormalizationUtil.normalizeModName(detectedMod.name);
        const normalizedVersion = NormalizationUtil.normalizeVersion(
          detectedMod.version,
          publishedAt,
        );

        const matchResult = await this.findModMatch(
          detectedMod.name,
          normalizedName,
          feed?.author?.mods || [],
        );

        const needsUpdate = matchResult.modId
          ? await this.checkIfNeedsUpdate(matchResult.modId, normalizedVersion, publishedAt)
          : false;

        return this.prisma.patreonPostMod.create({
          data: {
            postId,
            modId: matchResult.modId,
            detectedName: detectedMod.name,
            normalizedName,
            detectedVersion: detectedMod.version,
            normalizedVersion,
            isUpdate: detectedMod.isUpdate,
            isNewMod: detectedMod.isNewMod,
            downloadUrl: detectedMod.downloadUrl,
            verified: matchResult.confidence >= 0.95,
            needsReview: matchResult.confidence < 0.95 || !matchResult.modId,
            confidence: matchResult.confidence,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      });

      await Promise.all(postModPromises);

      await this.prisma.patreonPost.update({
        where: { postId },
        data: {
          analyzed: true,
          needsReview: analysis.mods.some(m => !m.isUpdate && m.isNewMod),
          rawAiResponse: analysis as any,
        },
      });

      this.logger.log(`Post ${postId} analyzed: ${analysis.mods.length} mods detected`);

    } catch (error) {
      this.logger.error(`Failed to analyze post ${postId}`, error.stack);
      
      await this.prisma.patreonPost.update({
        where: { postId },
        data: {
          analyzed: true,
          needsReview: true,
          processingError: error.message,
        },
      });
    }
  }

  private checkKeywords(title: string, content: string): boolean {
    const text = `${title} ${content || ''}`.toLowerCase();
    const keywords = ['update', 'mod', 'download', '.package', 'new version', 'fixed', 'released'];
    
    return keywords.some(keyword => text.includes(keyword));
  }

  private async findModMatch(
    originalName: string,
    normalizedName: string,
    mods: any[],
  ): Promise<ModMatchResult> {
    const exactMatch = mods.find(
      m => m.slug === normalizedName || m.normalizedName === normalizedName,
    );

    if (exactMatch) {
      return { modId: exactMatch.id, confidence: 1.0 };
    }

    const aliasMatch = mods.find(m =>
      m.aliases?.some(a => a.normalized === normalizedName),
    );

    if (aliasMatch) {
      return { modId: aliasMatch.id, confidence: 0.95 };
    }

    let bestMatch: ModMatchResult = { modId: null, confidence: 0 };

    for (const mod of mods) {
      const similarity = NormalizationUtil.calculateSimilarity(
        normalizedName,
        mod.normalizedName,
      );

      if (similarity > bestMatch.confidence && similarity >= this.FUZZY_THRESHOLD) {
        bestMatch = {
          modId: null,
          confidence: similarity,
          suggestedModId: mod.id,
          suggestedModName: mod.primaryName,
        };
      }
    }

    return bestMatch;
  }

  private async checkIfNeedsUpdate(
    modId: string,
    newVersion: string,
    publishedAt: Date,
  ): Promise<boolean> {
    const mod = await this.prisma.mod.findUnique({
      where: { id: modId },
    });

    if (!mod) return false;

    if (!mod.translatedVersion) {
      return true;
    }

    const comparison = NormalizationUtil.compareVersions(
      newVersion,
      mod.translatedVersionNormalized || mod.translatedVersion,
    );

    if (comparison > 0) {
      return true;
    }

    if (comparison === 0 && mod.translationDate) {
      return publishedAt > mod.translationDate;
    }

    return false;
  }

  async getPostsNeedingReview(limit = 10) {
    return this.prisma.patreonPost.findMany({
      where: {
        needsReview: true,
        analyzed: true,
      },
      include: {
        modAppearances: {
          where: { needsReview: true },
          include: {
            mod: true,
          },
        },
        feed: {
          include: {
            author: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }
}
