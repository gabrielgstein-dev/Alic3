import axios from 'axios';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('PatreonFeedFetcher');

export interface PatreonFeedData {
  campaignId: string;
  creatorName: string;
  creatorUrl: string;
}

export async function fetchFeedIdFromUrl(
  patreonUrl: string,
): Promise<PatreonFeedData | null> {
  try {
    const username = extractUsername(patreonUrl);
    if (!username) {
      logger.warn(`Invalid Patreon URL: ${patreonUrl}`);
      return null;
    }

    logger.debug(`Extracted username: ${username} from URL: ${patreonUrl}`);

    const apiUrl = `https://www.patreon.com/api/campaigns/${username}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    if (response.data?.data?.id) {
      logger.log(`API method successful for ${username}`);
      return {
        campaignId: response.data.data.id,
        creatorName: response.data.data.attributes?.creation_name || username,
        creatorUrl: patreonUrl,
      };
    }

    logger.warn(`No campaign data found in API response for: ${username}`);
    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.debug(
        `API method failed for ${patreonUrl}: ${error.response?.status} - ${error.message}`,
      );
    } else {
      logger.error(`Unexpected error fetching campaign: ${error}`);
    }
    return null;
  }
}

function extractUsername(patreonUrl: string): string | null {
  try {
    const url = new URL(patreonUrl);
    
    if (!url.hostname.includes('patreon.com')) {
      return null;
    }

    const pathname = url.pathname;
    const parts = pathname.split('/').filter((p) => p.length > 0);

    if (parts.length === 0) {
      return null;
    }

    if (parts[0] === 'posts') {
      return 'post';
    }

    if (parts[0] === 'c' && parts.length > 1) {
      return parts[1];
    }

    return parts[0];
  } catch (error) {
    logger.error(`Invalid URL: ${patreonUrl}`);
    return null;
  }
}

export async function fetchFeedIdFromCreatorPage(
  patreonUrl: string,
): Promise<PatreonFeedData | null> {
  try {
    const username = extractUsername(patreonUrl);
    if (!username) {
      return null;
    }

    logger.debug(`Attempting page scraping for: ${patreonUrl}`);
    const pageUrl = username === 'post' ? patreonUrl : `https://www.patreon.com/${username}`;
    const response = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    
    const tempFile = path.join('/tmp', `patreon-${username}-${Date.now()}.html`);
    fs.writeFileSync(tempFile, html);
    logger.log(`HTML saved to: ${tempFile}`);
    
    let campaignId = null;
    let creatorName = username;

    logger.log(`Searching for campaign ID in HTML (${html.length} chars)...`);
    
    const bootstrapMatch = html.match(/window\.patreon\s*=\s*({[\s\S]*?});/);
    logger.log(`Bootstrap match found: ${!!bootstrapMatch}`);
    
    if (bootstrapMatch) {
      try {
        const bootstrapJson = bootstrapMatch[1];
        const bootstrapDataMatch = bootstrapJson.match(/"bootstrap"\s*:\s*({[\s\S]*?})\s*[,}]/);
        logger.log(`Bootstrap data match found: ${!!bootstrapDataMatch}`);
        
        if (bootstrapDataMatch) {
          const bootstrapData = JSON.parse(bootstrapDataMatch[1]);
          logger.log(`Bootstrap parsed, campaign data: ${!!bootstrapData?.campaign}`);
          
          if (bootstrapData?.campaign?.data?.id) {
            campaignId = bootstrapData.campaign.data.id;
            logger.log(`Campaign ID from bootstrap: ${campaignId}`);
          }
          
          if (bootstrapData?.campaign?.data?.attributes?.creator_name) {
            creatorName = bootstrapData.campaign.data.attributes.creator_name;
          } else if (bootstrapData?.campaign?.included) {
            const creatorUser = bootstrapData.campaign.included.find((item: any) => item.type === 'user');
            if (creatorUser?.attributes?.full_name) {
              creatorName = creatorUser.attributes.full_name;
            }
          }
        }
      } catch (e) {
        logger.warn(`Failed to parse bootstrap JSON: ${e.message}`);
      }
    } else {
      logger.warn('No window.patreon found in HTML, trying alternative patterns...');
    }

    if (!campaignId) {
      logger.log('Trying Next.js v13 data extraction (deep search)...');
      
      const nextDataMatches = html.matchAll(/self\.__next_f\.push\(\[1,"([^"]+)"\]\)/g);
      for (const match of nextDataMatches) {
        try {
          let jsonStr = match[1]
            .replace(/\\n/g, '')
            .replace(/\\t/g, '')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
          
          const patterns = [
            /"value"\s*:\s*{[^}]*"campaign"\s*:\s*{[^}]*"data"\s*:\s*{[^}]*"id"\s*:\s*"?(\d+)"?/,
            /"campaign"\s*:\s*{[^}]*"data"\s*:\s*{[^}]*"id"\s*:\s*"?(\d+)"?[^}]*"type"\s*:\s*"campaign"/,
            /"type"\s*:\s*"campaign"[^}]*"id"\s*:\s*"?(\d+)"?/,
            /"id"\s*:\s*"?(\d+)"?[^}]*"type"\s*:\s*"campaign"/,
          ];
          
          for (const pattern of patterns) {
            const m = jsonStr.match(pattern);
            if (m) {
              campaignId = m[1];
              logger.log(`Found campaign ID in Next.js data (pattern match): ${campaignId}`);
              break;
            }
          }
          
          if (campaignId) break;
        } catch (e) {
          continue;
        }
      }
    }

    if (!campaignId) {
      logger.log('Trying regex patterns...');
      const patterns = [
        /"campaign_id"\s*:\s*"?(\d+)"?/,
        /"campaignId"\s*:\s*"?(\d+)"?/,
        /data-campaign-id="(\d+)"/,
        /"id"\s*:\s*"?(\d+)"?[^}]*"type"\s*:\s*"campaign"/,
        /"type"\s*:\s*"campaign"[^}]*"id"\s*:\s*"?(\d+)"?/,
        /campaign['"]\s*:\s*{[^}]*['"]id['"]\s*:\s*['"]?(\d+)['"]?/,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          campaignId = match[1];
          logger.log(`Found campaign ID with regex: ${campaignId}`);
          break;
        }
      }
    }

    if (!creatorName || creatorName === username) {
      const creatorNamePatterns = [
        /"full_name"\s*:\s*"([^"]+)"/,
        /"creator_name"\s*:\s*"([^"]+)"/,
        /"name"\s*:\s*"([^"]+)"[^}]*"type"\s*:\s*"user"/,
        /"vanity"\s*:\s*"[^"]*"\s*,\s*"full_name"\s*:\s*"([^"]+)"/,
      ];

      for (const pattern of creatorNamePatterns) {
        const match = html.match(pattern);
        if (match) {
          creatorName = match[1];
          break;
        }
      }
    }

    if (campaignId) {
      logger.log(`Successfully extracted campaign ID ${campaignId} for ${creatorName}`);
      return {
        campaignId,
        creatorName,
        creatorUrl: patreonUrl,
      };
    }

    logger.warn(`Could not extract campaign ID from page: ${pageUrl}`);
    logger.debug(`HTML length: ${html.length} characters`);
    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.warn(`Page scraping failed: ${error.response?.status} - ${error.message}`);
    } else {
      logger.error(`Failed to scrape campaign page: ${error}`);
    }
    return null;
  }
}

export async function getFeedIdFromPatreon(
  patreonUrl: string,
): Promise<PatreonFeedData | null> {
  logger.log(`Starting feed ID fetch for: ${patreonUrl}`);
  
  let result = await fetchFeedIdFromUrl(patreonUrl);

  if (!result) {
    logger.debug('API method failed, trying page scraping...');
    result = await fetchFeedIdFromCreatorPage(patreonUrl);
  }

  if (!result) {
    logger.error(`All methods failed to fetch feed ID for: ${patreonUrl}`);
    logger.log('Tip: Try using the direct Patreon creator page URL format: https://www.patreon.com/username');
  }

  return result;
}

export const getCampaignIdFromPatreon = getFeedIdFromPatreon;
