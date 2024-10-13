import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getPullRequests(owner: string, repo: string, pullNumber: number): Promise<any>;
}
