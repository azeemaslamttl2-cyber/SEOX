const DB_NAME = "seox-audit-data";
const DB_VERSION = 1;
const METADATA_STORE = "metadata";
const PROJECT_STATE_STORE = "projectStates";
const CRAWL_METADATA_KEY = "crawl";

let databasePromise = null;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("IndexedDB transaction was aborted"));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(PROJECT_STATE_STORE)) {
        database.createObjectStore(PROJECT_STATE_STORE, { keyPath: "projectId" });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Could not open audit storage"));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Audit storage upgrade is blocked by another tab"));
    };
  });

  return databasePromise;
}

export async function loadCrawlStorage() {
  const database = await openDatabase();
  const transaction = database.transaction(
    [METADATA_STORE, PROJECT_STATE_STORE],
    "readonly"
  );
  const metadataRequest = transaction
    .objectStore(METADATA_STORE)
    .get(CRAWL_METADATA_KEY);
  const statesRequest = transaction.objectStore(PROJECT_STATE_STORE).getAll();
  const [metadataRecord, stateRecords] = await Promise.all([
    requestToPromise(metadataRequest),
    requestToPromise(statesRequest),
    transactionToPromise(transaction),
  ]);

  return {
    metadata: metadataRecord?.value || null,
    projectStates: Object.fromEntries(
      (stateRecords || []).map((record) => [record.projectId, record.state])
    ),
  };
}

export async function saveCrawlMetadata(metadata) {
  const database = await openDatabase();
  const transaction = database.transaction(METADATA_STORE, "readwrite");
  transaction.objectStore(METADATA_STORE).put({
    key: CRAWL_METADATA_KEY,
    value: metadata,
    updatedAt: new Date(),
  });
  await transactionToPromise(transaction);
}

export async function saveCrawlProjectStates(entries) {
  if (!entries.length) return;

  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STATE_STORE, "readwrite");
  const store = transaction.objectStore(PROJECT_STATE_STORE);
  const updatedAt = new Date();

  entries.forEach(([projectId, state]) => {
    store.put({ projectId, state, updatedAt });
  });

  await transactionToPromise(transaction);
}

export async function deleteCrawlProjectState(projectId) {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECT_STATE_STORE, "readwrite");
  transaction.objectStore(PROJECT_STATE_STORE).delete(projectId);
  await transactionToPromise(transaction);
}

export async function requestDurableCrawlStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
