import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface SheetRow {
  modName: string;
  version: string;
  lastUpdate: string;
  downloadUrl?: string;
  status?: string;
}

interface SheetChange {
  modName: string;
  oldVersion?: string;
  newVersion: string;
  lastUpdate: string;
  downloadUrl?: string;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('GOOGLE_SHEETS_API_KEY');
    
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_SHEETS_API_KEY not configured - Google Sheets monitoring disabled');
    }
  }

  async getLastModifiedTime(spreadsheetId: string): Promise<Date | null> {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`;
      const params = { 
        key: this.apiKey,
        fields: 'modifiedTime'
      };

      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );

      return response.data.modifiedTime ? new Date(response.data.modifiedTime) : null;
    } catch (error) {
      this.logger.warn(`Failed to get modified time for ${spreadsheetId}: ${error.message}`);
      return null;
    }
  }

  async fetchSheetData(spreadsheetId: string, range: string): Promise<SheetRow[]> {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    try {
      const url = `${this.baseUrl}/${spreadsheetId}/values/${range}`;
      const params = { key: this.apiKey };

      this.logger.log(`Fetching sheet data: ${spreadsheetId}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return [];
      }

      const headers = rows[0];
      const modNameIndex = this.findColumnIndex(headers, ['mod name', 'name', 'mod']);
      const versionIndex = this.findColumnIndex(headers, ['version', 'ver', 'latest version']);
      const updateIndex = this.findColumnIndex(headers, ['last update', 'updated', 'date']);
      const urlIndex = this.findColumnIndex(headers, ['download', 'url', 'link']);
      const statusIndex = this.findColumnIndex(headers, ['status', 'state']);

      const data: SheetRow[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        if (modNameIndex === -1 || !row[modNameIndex]) {
          continue;
        }

        data.push({
          modName: row[modNameIndex]?.toString().trim() || '',
          version: versionIndex !== -1 ? row[versionIndex]?.toString().trim() || '' : '',
          lastUpdate: updateIndex !== -1 ? row[updateIndex]?.toString().trim() || '' : '',
          downloadUrl: urlIndex !== -1 ? row[urlIndex]?.toString().trim() : undefined,
          status: statusIndex !== -1 ? row[statusIndex]?.toString().trim() : undefined,
        });
      }

      this.logger.log(`Fetched ${data.length} rows from sheet ${spreadsheetId}`);
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch sheet ${spreadsheetId}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async detectChanges(
    spreadsheetId: string,
    range: string,
    previousData: Map<string, SheetRow>,
  ): Promise<SheetChange[]> {
    const currentData = await this.fetchSheetData(spreadsheetId, range);
    const changes: SheetChange[] = [];

    for (const row of currentData) {
      if (!row.modName || !row.version) {
        continue;
      }

      const previous = previousData.get(row.modName);

      if (!previous) {
        changes.push({
          modName: row.modName,
          newVersion: row.version,
          lastUpdate: row.lastUpdate,
          downloadUrl: row.downloadUrl,
        });
      } else if (previous.version !== row.version) {
        changes.push({
          modName: row.modName,
          oldVersion: previous.version,
          newVersion: row.version,
          lastUpdate: row.lastUpdate,
          downloadUrl: row.downloadUrl,
        });
      }
    }

    return changes;
  }

  extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  extractSheetGid(url: string): string | null {
    const match = url.match(/[#&]gid=([0-9]+)/);
    return match ? match[1] : null;
  }

  async getSheetTitle(spreadsheetId: string, gid?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key not configured');
    }

    try {
      const url = `${this.baseUrl}/${spreadsheetId}`;
      const params = { key: this.apiKey, fields: 'sheets.properties' };

      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );

      const sheets = response.data.sheets || [];
      
      if (gid) {
        const sheet = sheets.find(s => s.properties.sheetId.toString() === gid);
        return sheet?.properties.title || 'Sheet1';
      }

      return sheets[0]?.properties.title || 'Sheet1';
    } catch (error) {
      this.logger.warn(`Failed to get sheet title, using default: ${error.message}`);
      return 'Sheet1';
    }
  }

  private findColumnIndex(headers: any[], possibleNames: string[]): number {
    const normalizedHeaders = headers.map(h => 
      h?.toString().toLowerCase().trim() || ''
    );

    for (const name of possibleNames) {
      const index = normalizedHeaders.findIndex(h => h.includes(name));
      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  buildDataMap(rows: SheetRow[]): Map<string, SheetRow> {
    const map = new Map<string, SheetRow>();
    for (const row of rows) {
      if (row.modName) {
        map.set(row.modName, row);
      }
    }
    return map;
  }
}
