"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const octokit_1 = require("octokit");
const simple_git_1 = require("simple-git");
const fs = require("fs");
const path = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const generative_ai_1 = require("@google/generative-ai");
let AppService = class AppService {
    constructor() {
        this.octokit = new octokit_1.Octokit({ auth: "_" });
        this.git = (0, simple_git_1.default)();
    }
    async getPullRequestWithCommits(owner, repo, pullNumber) {
        try {
            const { data: pr } = await this.octokit.rest.pulls.get({
                owner,
                repo,
                pull_number: pullNumber,
            });
            const { data: commits } = await this.octokit.rest.pulls.listCommits({
                owner,
                repo,
                pull_number: pr.number,
            });
            const commitsWithDiffs = await Promise.all(commits.map(async (commit) => {
                const { data: commitDetails } = await this.octokit.rest.repos.getCommit({
                    owner,
                    repo,
                    ref: commit.sha,
                });
                const fileChanges = commitDetails.files.map((file) => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    changes: file.changes,
                    patch: file.patch,
                }));
                return {
                    sha: commit.sha,
                    message: commit.commit.message,
                    author: {
                        name: commit.commit.author.name,
                        email: commit.commit.author.email,
                        date: commit.commit.author.date,
                    },
                    fileChanges: fileChanges,
                };
            }));
            return {
                id: pr.id,
                number: pr.number,
                state: pr.state,
                title: pr.title,
                author: pr.user.login,
                createdAt: pr.created_at,
                updatedAt: pr.updated_at,
                draft: pr.draft,
                commits: commitsWithDiffs,
            };
        }
        catch (error) {
            console.log(error);
            throw new common_1.HttpException('Failed to fetch pull request', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async cloneRepository(owner, repo, pullNumber) {
        const tmpDir = path.join(__dirname, '..', 'tmp', repo);
        const result = await this.getPullRequestWithCommits(owner, repo, pullNumber);
        const token = '_';
        const repoUrl = `https://${token}@github.com/${owner}/${repo}.git`;
        try {
            await this.createDirectory(tmpDir);
            await this.git.clone(repoUrl, tmpDir);
            console.log('RUNNING BASH SCRIPT');
            await this.runBashScript(tmpDir);
            console.log('GENERATING');
            await this.generate(tmpDir, result);
            return tmpDir;
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to clone repository: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createDirectory(dirPath) {
        const mkdir = (0, util_1.promisify)(fs.mkdir);
        if (!fs.existsSync(dirPath)) {
            await mkdir(dirPath, { recursive: true });
        }
    }
    async runBashScript(clonedDir) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../scripts', 'fr.bash');
            (0, child_process_1.exec)(`bash ${scriptPath} -f`, { cwd: clonedDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing script: ${stderr}`);
                    return reject(new common_1.HttpException(`Script execution failed: ${stderr}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR));
                }
                console.log(`Script output: ${stdout}`);
                resolve();
            });
        });
    }
    async generate(clonedDir, pullRequestWithCommits) {
        try {
            const prompt = fs.readFileSync(path.join(clonedDir, 'script_result', '._output.txt'), 'utf8');
            const googleAI = new generative_ai_1.GoogleGenerativeAI('AIzaSyAOotW26evb9nRRoyQmA3GCD562jsLsZ8I');
            const geminiConfig = {
                temperature: 0.9,
                topP: 1,
                topK: 1,
                maxOutputTokens: 9000,
            };
            const geminiModel = googleAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
            });
            let secondPrompt = `You're a highly experienced software developer with extensive knowledge of code review practices. You have spent over 15 years working in collaborative environments, reviewing countless pull requests to ensure code quality, functionality, and adherence to best practices. Your keen eye for detail enables you to provide constructive feedback and insightful analysis.

Your task is to analyze a pull request for a specific project and determine whether it should be accepted or rejected.As you conduct your review, please keep in mind the following criteria: code readability, functionality, adherence to project guidelines, potential edge cases, and overall improvement to the project. Provide feedback that is constructive and specific.

Additionally, include line-by-line comments on the code changes for only negative written codes, STRICTLY ENFORCE CLEAN CODE RULES. explaining your thought process regarding each line. If a line may cause issues, you could note, "This line may lead to a bug; consider revising."

Please ensure your final output clearly outlines your recommendation regarding the pull request's acceptance or rejection, along with detailed rationale and code comments. Here is pul request data: `;
            secondPrompt += `**Pull Request #${pullRequestWithCommits.number}: ${pullRequestWithCommits.title}**\n`;
            secondPrompt += `Author: ${pullRequestWithCommits.author}\n`;
            secondPrompt += `State: ${pullRequestWithCommits.state}\n`;
            secondPrompt += `Created At: ${pullRequestWithCommits.createdAt}\n`;
            pullRequestWithCommits.commits.forEach(commit => {
                secondPrompt += `\tCommit SHA: ${commit.sha}\n`;
                secondPrompt += `\tMessage: ${commit.message}\n`;
                commit.fileChanges.forEach(file => {
                    secondPrompt += `\t\tFile: ${file.filename} (${file.status})\n`;
                    if (file.patch) {
                        secondPrompt += `\t\tPatch:\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
                    }
                });
            });
            secondPrompt += `\n`;
            const combinedPrompt = prompt + secondPrompt;
            const { totalTokens } = await geminiModel.countTokens(combinedPrompt);
            console.log(`Total tokens used: ${totalTokens}`);
            const result = await geminiModel.generateContent(combinedPrompt);
            const response = result.response;
            const outputPath = path.join(__dirname, '..', 'generated_output.txt');
            fs.writeFileSync(outputPath, response.text(), 'utf8');
            console.log('Result written to generated_output.txt in the project root directory.');
        }
        catch (error) {
            console.error("Error in generate function:", error);
            throw new common_1.HttpException(`Failed to generate analysis: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AppService);
//# sourceMappingURL=app.service.js.map