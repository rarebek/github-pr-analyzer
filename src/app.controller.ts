import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('github/:owner/:repo/pulls/:pullNumber')
  async getPullRequests(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Param('pullNumber') pullNumber: number,
  ) {
    try {
      await this.appService.cloneRepository(owner, repo, pullNumber);

      return await this.appService.getPullRequestWithCommits(owner, repo, pullNumber);
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.getResponse()
          : 'Failed to fetch pull requests';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
