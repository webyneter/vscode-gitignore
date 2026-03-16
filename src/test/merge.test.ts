import assert from 'assert';
import { mergeTemplates, deduplicateLines } from '../merge';

suite('Merge Module', () => {
	test('single section returns content without header', () => {
		const result = mergeTemplates([{ name: 'Python', content: '*.pyc\n__pycache__/' }], false);
		assert.strictEqual(result, '*.pyc\n__pycache__/');
	});

	test('multiple sections include headers', () => {
		const result = mergeTemplates([
			{ name: 'Python', content: '*.pyc' },
			{ name: 'Node', content: 'node_modules/' }
		], false);

		assert(result.includes('### Python.gitignore ###'));
		assert(result.includes('### Node.gitignore ###'));
		assert(result.includes('*.pyc'));
		assert(result.includes('node_modules/'));
	});

	test('deduplication removes duplicate patterns', () => {
		const result = mergeTemplates([
			{ name: 'A', content: '*.log\nnode_modules/' },
			{ name: 'B', content: '*.log\ndist/' }
		], true);

		const logCount = result.split('*.log').length - 1;
		assert.strictEqual(logCount, 1, `Expected 1 occurrence of *.log but found ${logCount}`);
		assert(result.includes('node_modules/'));
		assert(result.includes('dist/'));
	});

	test('deduplication deduplicates comments and preserves blank lines', () => {
		const content = '# comment\n*.log\n\n# comment\n*.log\n# another comment\n';
		const result = deduplicateLines(content);

		const comments = result.split('# comment').length - 1;
		assert.strictEqual(comments, 1, 'duplicate comments should be removed');
		const anotherComments = result.split('# another comment').length - 1;
		assert.strictEqual(anotherComments, 1);
		const logCount = result.split('*.log').length - 1;
		assert.strictEqual(logCount, 1);
		assert(result.includes('\n\n'), 'blank lines should be preserved');
	});

	test('deduplication preserves section headers', () => {
		const content = '### Python.gitignore ###\n*.pyc\n\n### Node.gitignore ###\n*.pyc';
		const result = deduplicateLines(content);

		assert(result.includes('### Python.gitignore ###'));
		assert(result.includes('### Node.gitignore ###'));
		const pycCount = result.split('*.pyc').length - 1;
		assert.strictEqual(pycCount, 1);
	});

	test('no deduplication keeps all lines', () => {
		const result = mergeTemplates([
			{ name: 'A', content: '*.log' },
			{ name: 'B', content: '*.log' }
		], false);

		const logCount = result.split('*.log').length - 1;
		assert.strictEqual(logCount, 2);
	});

	test('empty content handled correctly', () => {
		const result = mergeTemplates([{ name: 'Empty', content: '' }], false);
		assert.strictEqual(result, '');
	});

	test('empty sections array returns empty string', () => {
		const result = mergeTemplates([], false);
		assert.strictEqual(result, '');
	});

	test('deduplication removes duplicate comments', () => {
		const result = mergeTemplates([
			{ name: 'A', content: '# Compiled source\n*.o' },
			{ name: 'B', content: '# Compiled source\n*.class' }
		], true);

		const commentCount = result.split('# Compiled source').length - 1;
		assert.strictEqual(commentCount, 1, `Expected 1 occurrence of comment but found ${commentCount}`);
	});
});
