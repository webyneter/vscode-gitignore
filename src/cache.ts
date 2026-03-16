export class CacheItem<T> {
	private _key: string;
	private _value: T;
	private storeDate: Date;

	get key() {
		return this._key;
	}

	get value() {
		return this._value;
	}

	constructor(key: string, value: T) {
		this._key = key;
		this._value = value;
		this.storeDate = new Date();
	}

	public isExpired(expirationInterval: number) {
		return this.storeDate.getTime() + expirationInterval * 1000 <= Date.now();
	}
}

export class Cache<T = unknown> {
	private _store: Map<string, CacheItem<T>>;
	private _cacheExpirationInterval: number;

	constructor(cacheExpirationInterval: number) {
		this._store = new Map();
		this._cacheExpirationInterval = cacheExpirationInterval;
	}

	public add(item: CacheItem<T>) {
		this._store.set(item.key, item);
	}

	public get(key: string): T | undefined {
		const item = this._store.get(key);

		if (!item) {
			return undefined;
		}

		if (item.isExpired(this._cacheExpirationInterval)) {
			this._store.delete(key);
			return undefined;
		}

		return item.value;
	}

	public getCacheItem(key: string): CacheItem<T> | undefined {
		const item = this._store.get(key);

		if (!item) {
			return undefined;
		}

		if (item.isExpired(this._cacheExpirationInterval)) {
			this._store.delete(key);
			return undefined;
		}

		return item;
	}
}
