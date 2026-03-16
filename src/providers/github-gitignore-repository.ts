import * as https from 'https';
import * as url from 'url';

import { getAgent } from '../http-client';
import { Cache, CacheItem } from '../cache';
import { GitignoreProvider, GitignoreTemplate } from '../interfaces';
import { GithubSession } from '../github/session';
import { GitHubClient } from '../github/client';


interface GithubRepositoryItem {
	name: string;
	path: string;
	download_url: string;
	type: string;
}

function isGithubRepositoryItemArray(value: unknown): value is GithubRepositoryItem[] {
	return Array.isArray(value) && value.every(
		item => typeof item === 'object' && item !== null && 'name' in item && 'path' in item && 'type' in item
	);
}

/**
 * Github gitignore template provider based on the "/repos" endpoint of the Github REST API
 * https://docs.github.com/en/rest/repos/contents
 */
export class GithubGitignoreRepositoryProvider implements GitignoreProvider {
	private client: GitHubClient;

	constructor(private cache: Cache<GitignoreTemplate[]>, githubSession: GithubSession) {
		this.client = new GitHubClient(githubSession);
	}

	/**
	 * Get all .gitignore templates
	 */
	public async getTemplates(): Promise<GitignoreTemplate[]> {
		// Get lists of .gitignore files from Github
		const result = await Promise.all([
			this.getFiles(),
			this.getFiles('Global')
		]);
		const files = result.flat()
			.sort((a: GitignoreTemplate, b: GitignoreTemplate) => a.name.localeCompare(b.name));
		return files;
	}

	/**
	 * Get all .gitignore files in a directory of the repository
	 */
	private async getFiles(path = ''): Promise<GitignoreTemplate[]> {
		// If cached, return cached content
		const cached = this.cache.get('gitignore/' + path);
		if (cached !== undefined) {
			return cached;
		}

		const fullUrl = new url.URL(path, 'https://api.github.com/repos/github/gitignore/contents/');

		const options: https.RequestOptions = {
			agent: getAgent(),
			method: 'GET',
			headers: {...await this.client.getHeaders(), 'Accept': 'application/vnd.github.v3+json'},
		};

		const responseBody = await this.client.requestString(fullUrl, options);

		const parsed: unknown = JSON.parse(responseBody);
		if (!isGithubRepositoryItemArray(parsed)) {
			throw new Error(`Unexpected GitHub API response shape for path "${path}"`);
		}

		const templates = parsed
			.filter(item => {
				return (item.type === 'file' && item.name.endsWith('.gitignore'));
			})
			.map(item => {
				return {
					name: item.name.replace(/\.gitignore/, ''),
					path: item.path
				};
			});

		// Cache the retrieved gitignore templates
		this.cache.add(new CacheItem('gitignore/' + path, templates));

		return templates;
	}

	public async downloadAsString(templatePath: string): Promise<string> {
		const fullUrl = new url.URL(templatePath, 'https://api.github.com/repos/github/gitignore/contents/');
		const options: https.RequestOptions = {
			agent: getAgent(),
			method: 'GET',
			headers: {...await this.client.getHeaders(), 'Accept': 'application/vnd.github.v3.raw'}
		};
		return this.client.requestString(fullUrl, options);
	}
}
