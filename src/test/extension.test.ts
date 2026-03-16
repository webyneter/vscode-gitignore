import assert from 'assert';
import * as fs from 'fs';

import { writeGitignoreFile } from '../extension';
import { GitignoreOperation, GitignoreOperationType, GitignoreProvider, GitignoreTemplate } from '../interfaces';
import { createTmpTestDir } from './utils';

class GitignoreProviderMock implements GitignoreProvider {
	getTemplates(): Promise<GitignoreTemplate[]> {
		return Promise.resolve([{
			name: 'example',
			path: 'example',
		}]);
	}

	downloadAsString(templatePath: string): Promise<string> {
		return Promise.resolve(templatePath + "\n");
	}

}

function assertLines(path: string, ...expectedLines: string[]) {
	const content = fs.readFileSync(path, {encoding: 'utf8'});
	const lines = content.split(/\r?\n/);

	for (let i = 0; i < lines.length; ++i) {
		const expected = expectedLines[i];
		const got = lines[i];
		assert(expected === got, `Line ${i}: expected "${expected}", got "${got}"`);
	}
}

suite('Extension Test Suite', () => {

	test('can write a new gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;

		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation: GitignoreOperation = {
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		assertLines(path, 'example', '');
	});

	test('can overwrite a gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line");

		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation: GitignoreOperation = {
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		assertLines(path, 'example', '');
	});

	test('can append to a gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line\n");

		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation: GitignoreOperation = {
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Append
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		assertLines(path, 'existing line', '', 'example','');
	});

	test('can write multi-template gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;

		const gitignoreProvider = new GitignoreProviderMock();

		const templateA: GitignoreTemplate = { name: 'Python', path: 'Python' };
		const templateB: GitignoreTemplate = { name: 'Node', path: 'Node' };

		const operation: GitignoreOperation = {
			templates: [templateA, templateB],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		const content = fs.readFileSync(path, {encoding: 'utf8'});
		assert(content.includes('### Python.gitignore ###'));
		assert(content.includes('### Node.gitignore ###'));
		assert(content.includes('Python'));
		assert(content.includes('Node'));
	});

	test('can append multi-template gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line\n");

		const gitignoreProvider = new GitignoreProviderMock();

		const templateA: GitignoreTemplate = { name: 'Python', path: 'Python' };
		const templateB: GitignoreTemplate = { name: 'Node', path: 'Node' };

		const operation: GitignoreOperation = {
			templates: [templateA, templateB],
			path: path,
			type: GitignoreOperationType.Append
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		const content = fs.readFileSync(path, {encoding: 'utf8'});
		assert(content.startsWith('existing line\n'));
		assert(content.includes('### Python.gitignore ###'));
		assert(content.includes('### Node.gitignore ###'));
	});

	test('can write multi-template gitignore file with deduplication', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;

		const dedupProvider: GitignoreProvider = {
			getTemplates: () => Promise.resolve([]),
			downloadAsString: (templatePath: string) => {
				if (templatePath === 'A') {
					return Promise.resolve('node_modules/\n*.log\n');
				}
				return Promise.resolve('*.log\ndist/\n');
			}
		};

		const templateA: GitignoreTemplate = { name: 'A', path: 'A' };
		const templateB: GitignoreTemplate = { name: 'B', path: 'B' };

		const operation: GitignoreOperation = {
			templates: [templateA, templateB],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(dedupProvider, operation);

		const content = fs.readFileSync(path, {encoding: 'utf8'});
		const logOccurrences = content.split('*.log').length - 1;
		assert(logOccurrences === 1, `Expected *.log to appear once but found ${logOccurrences} times`);
		assert(content.includes('node_modules/'));
		assert(content.includes('dist/'));
	});

});

suite('Multi-Template Integration Tests', () => {

	test('generates correct .gitignore from two realistic templates with dedup', async () => {
		const testBaseDir = await createTmpTestDir('integration');
		const path = `${testBaseDir}/.gitignore`;

		const pythonContent = [
			'# Byte-compiled / optimized files',
			'__pycache__/',
			'*.py[cod]',
			'',
			'# Distribution',
			'dist/',
			'build/',
		].join('\n');

		const nodeContent = [
			'# Dependencies',
			'node_modules/',
			'',
			'# Build output',
			'dist/',
			'build/',
		].join('\n');

		const provider: GitignoreProvider = {
			getTemplates: () => Promise.resolve([]),
			downloadAsString: (templatePath: string) => {
				if (templatePath === 'Python.gitignore') {
					return Promise.resolve(pythonContent);
				}
				return Promise.resolve(nodeContent);
			}
		};

		const operation: GitignoreOperation = {
			templates: [
				{ name: 'Python', path: 'Python.gitignore' },
				{ name: 'Node', path: 'Node.gitignore' },
			],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(provider, operation);

		const result = fs.readFileSync(path, { encoding: 'utf8' });

		const expected = [
			'### Python.gitignore ###',
			'# Byte-compiled / optimized files',
			'__pycache__/',
			'*.py[cod]',
			'',
			'# Distribution',
			'dist/',
			'build/',
			'',
			'### Node.gitignore ###',
			'# Dependencies',
			'node_modules/',
			'',
			'# Build output',
		].join('\n');

		assert.strictEqual(result, expected, `Expected:\n${expected}\n\nGot:\n${result}`);

		assert.strictEqual(result.split('dist/').length - 1, 1, 'dist/ should appear once');
		assert.strictEqual(result.split('build/').length - 1, 1, 'build/ should appear once');
	});

	test('generates correct .gitignore from single template (no headers)', async () => {
		const testBaseDir = await createTmpTestDir('integration');
		const path = `${testBaseDir}/.gitignore`;

		const goContent = '# Binaries\n*.exe\n*.dll\n\n# Dependency directories\nvendor/\n';

		const provider: GitignoreProvider = {
			getTemplates: () => Promise.resolve([]),
			downloadAsString: () => Promise.resolve(goContent)
		};

		const operation: GitignoreOperation = {
			templates: [
				{ name: 'Go', path: 'Go.gitignore' },
			],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(provider, operation);

		const result = fs.readFileSync(path, { encoding: 'utf8' });

		assert.strictEqual(result, goContent, 'Single template should produce raw content without section headers');
		assert(!result.includes('### Go.gitignore ###'), 'No section header for single template');
	});
});
