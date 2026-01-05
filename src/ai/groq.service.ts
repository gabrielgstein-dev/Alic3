import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface DetectedMod {
  name: string;
  version: string | null;
  isUpdate: boolean;
  isNewMod: boolean;
  downloadUrl: string | null;
}

interface GroqAnalysisResult {
  mods: DetectedMod[];
  confidence: number;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY');
    
    this.client = axios.create({
      baseURL: 'https://api.groq.com/openai/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async analyzePatreonPost(
    title: string,
    content: string,
    knownMods: string[] = [],
  ): Promise<GroqAnalysisResult> {
    const truncatedContent = content?.substring(0, 2500) || '';
    
    const prompt = this.buildPrompt(title, truncatedContent, knownMods);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.post('/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a JSON extraction bot. You MUST respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        });

        const messageContent = response.data.choices[0]?.message?.content;
        
        if (!messageContent) {
          throw new Error('Empty response from Groq');
        }

        const parsed = this.parseAndValidateResponse(messageContent);
        
        this.logger.log(`Successfully analyzed post. Found ${parsed.mods.length} mods`);
        
        return parsed;

      } catch (error) {
        this.logger.warn(`Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          this.logger.error('All retry attempts failed', error.stack);
          return { mods: [], confidence: 0 };
        }

        await this.sleep(this.retryDelay * attempt);
      }
    }

    return { mods: [], confidence: 0 };
  }

  private buildPrompt(title: string, content: string, knownMods: string[]): string {
    const modsContext = knownMods.length > 0 
      ? `\n\nKnown mods in database: ${knownMods.join(', ')}`
      : '';

    return `Analyze this Patreon post and extract ONLY information about The Sims 4 mods that are being updated or released.

POST TITLE: ${title}

POST CONTENT: ${content}
${modsContext}

STRICT RULES:
1. Return ONLY a valid JSON object
2. Identify ONLY mods being updated/released (ignore mentions of other creators or thanks)
3. Extract exact mod name (prefer names from known mods list if similar)
4. Extract version as numbers and dots only (e.g., "1.2.3")
5. If no version found, use null
6. Determine if it's an update (existing mod) or new mod
7. Extract direct download URL if present

REQUIRED JSON FORMAT:
{
  "mods": [
    {
      "name": "Exact Mod Name",
      "version": "1.2.3" or null,
      "isUpdate": true/false,
      "isNewMod": true/false,
      "downloadUrl": "https://..." or null
    }
  ]
}

Return ONLY the JSON, no explanations.`;
  }

  private parseAndValidateResponse(content: string): GroqAnalysisResult {
    let cleaned = content.trim();
    
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed.mods || !Array.isArray(parsed.mods)) {
      throw new Error('Invalid response structure: missing mods array');
    }

    for (const mod of parsed.mods) {
      if (!mod.name || typeof mod.name !== 'string') {
        throw new Error('Invalid mod structure: missing or invalid name');
      }
      if (mod.version !== null && typeof mod.version !== 'string') {
        throw new Error('Invalid mod structure: invalid version type');
      }
      if (typeof mod.isUpdate !== 'boolean') {
        throw new Error('Invalid mod structure: missing isUpdate boolean');
      }
      if (typeof mod.isNewMod !== 'boolean') {
        throw new Error('Invalid mod structure: missing isNewMod boolean');
      }
    }

    const confidence = parsed.mods.length > 0 ? 0.8 : 0;

    return { mods: parsed.mods, confidence };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
