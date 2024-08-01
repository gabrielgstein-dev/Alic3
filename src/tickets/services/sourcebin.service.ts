import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SourceBinService {
  constructor(private readonly httpService: HttpService) {}

  async createPaste(
    content: string,
    title: string,
    description: string,
  ): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post('https://sourceb.in/api/bins', {
        files: [{ content }],
        title,
        description,
      }),
    );

    if (response.data.key) {
      return `https://sourceb.in/${response.data.key}`;
    } else {
      throw new Error('Failed to create paste');
    }
  }
}
