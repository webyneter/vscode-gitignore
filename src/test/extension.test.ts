// import * as assert from 'assert';

// import * as vscode from 'vscode';
import { writeGitignoreFile } from '../extension';
import { GitignoreOperation, GitignoreOperationType, GitignoreProvider, GitignoreTemplate } from '../interfaces';
import * as fs from 'fs';
import { createTmpTestDir } from './utils';
import assert from 'assert';

class GitignoreProviderMock implements GitignoreProvider {
	getTemplates(): Promise<GitignoreTemplate[]> {
		return Promise.resolve([<GitignoreTemplate>{
			download_url :'',
			name: 'example',
			path: 'example',
			type: 'foo'
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
		console.log(`excepted: "${expected}", got: "${got}"`);
		assert(expected === got);
	}
}

suite('Extension Test Suite', () => {

	// test('Sample test', async () => {
	// 	//await vscode.commands.executeCommand('gitignore.addgitignore');
	// });


	test('can write a new gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;


		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation = <GitignoreOperation>{
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		const content = fs.readFileSync(path, {encoding: 'utf8'});
		console.log(content);

		assertLines(path, 'example', '');

		// Cleanup
		// if(fs.existsSync(path)) {
		// 	fs.unlinkSync(path);
		// }
	});

	test('can overwrite a gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line");


		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation = <GitignoreOperation>{
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		assertLines(path, 'example', '');

		// Cleanup
		if(fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});

	test('can append to a gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line\n");

		const gitignoreProvider = new GitignoreProviderMock();
		const templates = await gitignoreProvider.getTemplates();

		const operation = <GitignoreOperation>{
			templates: [templates[0]],
			path: path,
			type: GitignoreOperationType.Append
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		assertLines(path, 'existing line', '', 'example','');

		// Cleanup
		if(fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});

	test('can write multi-template gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;

		const gitignoreProvider = new GitignoreProviderMock();

		const templateA = <GitignoreTemplate>{ name: 'Python', path: 'Python', download_url: '', type: 'file' };
		const templateB = <GitignoreTemplate>{ name: 'Node', path: 'Node', download_url: '', type: 'file' };

		const operation = <GitignoreOperation>{
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

		if(fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});

	test('can append multi-template gitignore file', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;
		fs.writeFileSync(path, "existing line\n");

		const gitignoreProvider = new GitignoreProviderMock();

		const templateA = <GitignoreTemplate>{ name: 'Python', path: 'Python', download_url: '', type: 'file' };
		const templateB = <GitignoreTemplate>{ name: 'Node', path: 'Node', download_url: '', type: 'file' };

		const operation = <GitignoreOperation>{
			templates: [templateA, templateB],
			path: path,
			type: GitignoreOperationType.Append
		};

		await writeGitignoreFile(gitignoreProvider, operation);

		const content = fs.readFileSync(path, {encoding: 'utf8'});
		assert(content.startsWith('existing line\n'));
		assert(content.includes('### Python.gitignore ###'));
		assert(content.includes('### Node.gitignore ###'));

		if(fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
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

		const templateA = <GitignoreTemplate>{ name: 'A', path: 'A', download_url: '', type: 'file' };
		const templateB = <GitignoreTemplate>{ name: 'B', path: 'B', download_url: '', type: 'file' };

		const operation = <GitignoreOperation>{
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

		if(fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
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

		const operation = <GitignoreOperation>{
			templates: [
				<GitignoreTemplate>{ name: 'Python', path: 'Python.gitignore', download_url: '', type: 'file' },
				<GitignoreTemplate>{ name: 'Node', path: 'Node.gitignore', download_url: '', type: 'file' },
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

		if (fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});

	test('generates correct .gitignore from single template (no headers)', async () => {
		const testBaseDir = await createTmpTestDir('integration');
		const path = `${testBaseDir}/.gitignore`;

		const goContent = '# Binaries\n*.exe\n*.dll\n\n# Dependency directories\nvendor/\n';

		const provider: GitignoreProvider = {
			getTemplates: () => Promise.resolve([]),
			downloadAsString: () => Promise.resolve(goContent)
		};

		const operation = <GitignoreOperation>{
			templates: [
				<GitignoreTemplate>{ name: 'Go', path: 'Go.gitignore', download_url: '', type: 'file' },
			],
			path: path,
			type: GitignoreOperationType.Overwrite
		};

		await writeGitignoreFile(provider, operation);

		const result = fs.readFileSync(path, { encoding: 'utf8' });

		assert.strictEqual(result, goContent, 'Single template should produce raw content without section headers');
		assert(!result.includes('### Go.gitignore ###'), 'No section header for single template');

		if (fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});
});
