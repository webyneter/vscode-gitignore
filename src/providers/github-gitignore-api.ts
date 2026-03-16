import * as https from 'https';
import * as url from 'url';


import { Cache, CacheItem } from '../cache';
import { GitignoreProvider, GitignoreTemplate} from '../interfaces';
import { getAgent } from '../http-client';
import { GithubSession } from '../github/session';
import { GitHubClient } from '../github/client';

/**
 * Github gitignore template provider based on "/gitignore/templates" endpoint of the Github REST API
 * https://docs.github.com/en/rest/gitignore
 *
 * This provider is an alternative to GithubGitignoreRepositoryProvider. It does not support
 * subdirectory templates (e.g., Global/). Kept as a fallback and for integration testing.
 */
export class GithubGitignoreApiProvider implements GitignoreProvider {
	private client: GitHubClient;

	constructor(private cache: Cache<GitignoreTemplate[]>, githubSession: GithubSession) {
		this.client = new GitHubClient(githubSession);
	}

	/**
	 * Get all .gitignore templates
	 */
	public async getTemplates(): Promise<GitignoreTemplate[]> {
		// If cached, return cached content
		const cached = this.cache.get('gitignore');
		if (cached !== undefined) {
			return cached;
		}

		const url = 'https://api.github.com/gitignore/templates';
		const options: https.RequestOptions = {
			agent: getAgent(),
			method: 'GET',
			headers: {...await this.client.getHeaders(), 'Accept': 'application/vnd.github.v3+json'},
		};

		const responseBody = await this.client.requestString(url, options);
		const parsed: unknown = JSON.parse(responseBody);
		if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
			throw new Error('Unexpected GitHub API response shape for /gitignore/templates');
		}
		const templates = parsed.map(t => ({ name: t, path: t }));

		// Cache the retrieved gitignore files
		this.cache.add(new CacheItem('gitignore', templates));

		return templates;
	}

	public async downloadAsString(templatePath: string): Promise<string> {
		const fullUrl = new url.URL(templatePath, 'https://api.github.com/gitignore/templates/');
		const options: https.RequestOptions = {
			agent: getAgent(),
			method: 'GET',
			headers: {...await this.client.getHeaders(), 'Accept': 'application/vnd.github.v3.raw'}
		};
		return this.client.requestString(fullUrl, options);
	}
}
