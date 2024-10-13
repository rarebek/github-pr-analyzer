export declare class AppService {
    private octokit;
    private git;
    constructor();
    getPullRequestWithCommits(owner: string, repo: string, pullNumber: number): Promise<any>;
    cloneRepository(owner: string, repo: string, pullNumber: number): Promise<string>;
    private createDirectory;
    private runBashScript;
    generate(clonedDir: string, pullRequestWithCommits: any): Promise<void>;
}
