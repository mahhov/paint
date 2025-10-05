export default class Storage {
	private static readonly db: Promise<IDBDatabase> =
		new Promise((resolve, reject) => {
			let openRequest = indexedDB.open('myDatabase');
			openRequest.onupgradeneeded = () => {
				if (!openRequest.result.objectStoreNames.contains('myTable'))
					openRequest.result.createObjectStore('myTable');
			};
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onerror = event => reject((event.target as IDBTransaction).error);
		});

	// todo this is taking 120ms
	static write(key: string, value: any): Promise<void> {
		return new Promise(async (resolve, reject) => {
			let transaction = (await Storage.db).transaction('myTable', 'readwrite');
			transaction.oncomplete = () => resolve();
			transaction.onerror = event => reject((event.target as IDBTransaction).error);
			let objectStore = transaction.objectStore('myTable');
			let request = objectStore.put(value, key);
			// request.onsuccess = () => 0;
		});
	}

	static read(key: string): Promise<any> {
		return new Promise(async (resolve, reject) => {
			let transaction = (await Storage.db).transaction('myTable', 'readonly');
			// transaction.oncomplete = () => 0;
			transaction.onerror = event => reject((event.target as IDBTransaction).error);
			let objectStore = transaction.objectStore('myTable');
			let request = objectStore.get(key);
			request.onsuccess = () => resolve(request.result);
		});
	}
}
