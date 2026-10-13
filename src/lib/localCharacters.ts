export type LocalCharacter = { id: string; name: string; url: string; path: string };

type StoredCharacter = { id: string; name: string; blob: Blob; createdAt: number };
const DB_NAME = 'animate-text-studio';
const STORE_NAME = 'characters';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open character storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Character storage request failed.'));
  });
}

async function optimizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Please choose an image smaller than 20 MB.');
  const bitmap = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Your browser could not prepare this image.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const optimized = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not prepare this image.')),
      'image/webp',
      0.86,
    );
  });
  return optimized;
}

export async function loadSavedCharacters(): Promise<LocalCharacter[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(tx.objectStore(STORE_NAME).getAll() as IDBRequest<StoredCharacter[]>);
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      url: URL.createObjectURL(record.blob),
      path: '',
    }));
  } finally {
    db.close();
  }
}

export async function saveCharacterImage(file: File): Promise<LocalCharacter> {
  const blob = await optimizeImage(file);
  const id = crypto.randomUUID();
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 48) || 'My character';
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, name, blob, createdAt: Date.now() } satisfies StoredCharacter);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save this character.'));
      tx.onabort = () => reject(tx.error ?? new Error('Character save was cancelled.'));
    });
  } finally {
    db.close();
  }
  return { id, name, url: URL.createObjectURL(blob), path: '' };
}

export async function deleteSavedCharacter(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not delete this character.'));
      tx.onabort = () => reject(tx.error ?? new Error('Character deletion was cancelled.'));
    });
  } finally {
    db.close();
  }
}
