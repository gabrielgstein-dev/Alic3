import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('admin')
export class AdminController {
  @Get('invite')
  showInvitePage(@Res() res: Response) {
    let htmlPath = path.join(__dirname, 'views', 'invite.html');
    
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(process.cwd(), 'src', 'admin', 'views', 'invite.html');
    }
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    res.type('text/html').send(htmlContent);
  }
}
