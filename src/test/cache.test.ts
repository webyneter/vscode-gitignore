import assert from 'assert';

import { Cache, CacheItem } from '../cache';


suite('Cache', () => {

	test('is correctly storing an item', () => {
		const cache = new Cache(1);
		cache.add(new CacheItem('foo', {foo: 'bar'}));

		const cachedItem = cache.get('foo');
		assert.deepStrictEqual(cachedItem, {foo: 'bar'});
	});

	test('is correctly expiring an item', (done) => {
		const cache = new Cache(1);
		cache.add(new CacheItem('foo', {foo: 'bar'}));

		setTimeout(() => {
			assert.deepStrictEqual(cache.get('foo'), {foo: 'bar'});
		}, 900);

		setTimeout(() => {
			assert.strictEqual(cache.get('foo'), undefined);
		}, 1100);

		setTimeout(done, 1200);
	});

	test('evicts expired items from the store', () => {
		const cache = new Cache(0);
		cache.add(new CacheItem('foo', 'bar'));

		// Item is expired immediately with 0s TTL
		assert.strictEqual(cache.get('foo'), undefined);
		assert.strictEqual(cache.getCacheItem('foo'), undefined);
	});

	test('generic type safety', () => {
		const cache = new Cache<string>(60);
		cache.add(new CacheItem('key', 'value'));

		const result: string | undefined = cache.get('key');
		assert.strictEqual(result, 'value');
	});

	test('returns undefined for non-existent key', () => {
		const cache = new Cache(60);
		assert.strictEqual(cache.get('nonexistent'), undefined);
		assert.strictEqual(cache.getCacheItem('nonexistent'), undefined);
	});
});

suite('CacheItem', () => {

	test('is correctly setting properties', () => {
		const cacheItem = new CacheItem('foo', 'bar');
		assert.strictEqual(cacheItem.key, 'foo');
		assert.strictEqual(cacheItem.value, 'bar');
	});

	test('isExpired returns false for fresh item', () => {
		const item = new CacheItem('key', 'value');
		assert.strictEqual(item.isExpired(60), false);
	});

	test('isExpired returns true for zero TTL', () => {
		const item = new CacheItem('key', 'value');
		assert.strictEqual(item.isExpired(0), true);
	});
});
