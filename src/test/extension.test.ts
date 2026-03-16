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
	downloadToStream(templatePath: string, writeStream: fs.WriteStream): Promise<void> {
		return new Promise((resolve) => {
			writeStream.write(templatePath + "\n");

			writeStream.on('finish', () => {
				writeStream.close();
				resolve();
			});

			writeStream.end();
		});
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

	test('can write multi-template gitignore file with deduplication', async () => {
		const testBaseDir = await createTmpTestDir('download');
		const path = `${testBaseDir}/.gitignore`;

		const dedupProvider: GitignoreProvider = {
			getTemplates: () => Promise.resolve([]),
			downloadToStream: () => Promise.resolve(),
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
