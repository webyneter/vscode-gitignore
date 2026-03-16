import assert from 'assert';

import { Cache } from '../../cache';
import { GitignoreProvider, GitignoreTemplate } from '../../interfaces';
import { GithubGitignoreApiProvider } from '../../providers/github-gitignore-api';
import { GithubGitignoreRepositoryProvider } from '../../providers/github-gitignore-repository';
import { GithubContext, GithubSession } from '../../github/session';

const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

const providers: GitignoreProvider[] = [
	new GithubGitignoreRepositoryProvider(new Cache(0), new GithubSession(new GithubContext())),
	new GithubGitignoreApiProvider(new Cache(0), new GithubSession(new GithubContext())),
];

providers.forEach(provider => {

	suite(provider.constructor.name, function () {
		if (!RUN_INTEGRATION_TESTS) {
			test('skipped (set RUN_INTEGRATION_TESTS=true to run)', () => {
				// Explicit skip marker
			});
			return;
		}

		this.timeout(10000);
		let templates: GitignoreTemplate[] = [];

		test('can retrieve a list of templates', async () => {
			templates = await provider.getTemplates();

			assert(templates.length > 0);
			assert(templates.find(t => t.name === 'Clojure') !== undefined);
		});

		test('can download a template as string', async () => {
			const template = templates.find(t => t.name === 'Python');
			assert(template !== undefined, 'Python template not found');

			const content = await provider.downloadAsString(template.path);
			const lines = content.split(/\r?\n/);
			assert(lines[0] === '# Byte-compiled / optimized / DLL files');
			assert(lines[1] === '__pycache__/');
		});
	});

});
