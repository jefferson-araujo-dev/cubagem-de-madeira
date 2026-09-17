import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  writeBatch,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { isSupportedWoodItem } from "./schema.js";

let items = [];
let useLocalStorage = false;
let db = null;
let currentUser = null;
let unsubscribe = null;
let onDataChangedCallback = null;

export function initStore(firestoreDb) {
  db = firestoreDb;
}

export function setStoreUser(user) {
  currentUser = user;
}

export function setLocalMode(isLocal) {
  useLocalStorage = isLocal;
}

export function isLocalMode() {
  return useLocalStorage;
}

export function getItems() {
  return items;
}

export function setOnDataChanged(callback) {
  onDataChangedCallback = callback;
}

function notifyDataChanged() {
  if (onDataChangedCallback) onDataChangedCallback();
}

// Filtra registros que não atendem ao contrato v1 (ex.: dados legados
// gravados antes deste schema). Eles não são migrados nem apagados
// automaticamente, apenas ignorados pelo fluxo operacional, para não
// derrubar a renderização com campos ausentes/incompatíveis.
function filterSupportedItems(rawItems, source) {
  const supported = [];
  let ignoredCount = 0;
  for (const item of rawItems) {
    if (isSupportedWoodItem(item)) {
      supported.push(item);
    } else {
      ignoredCount++;
    }
  }
  if (ignoredCount > 0) {
    console.warn(
      `[store] ${ignoredCount} registro(s) incompatível(is) com o schema v1 ignorado(s) (origem: ${source}).`,
    );
  }
  return supported;
}

export function loadLocalData() {
  const data = localStorage.getItem("cubagempro_local_v1");
  const rawItems = data ? JSON.parse(data) : [];
  items = filterSupportedItems(rawItems, "localStorage");
  notifyDataChanged();
}

function saveLocal() {
  try {
    localStorage.setItem("cubagempro_local_v1", JSON.stringify(items));
  } catch (error) {
    console.error("Armazenamento local cheio:", error);
    throw new Error("local_storage_full");
  }
  notifyDataChanged();
}

export function setupRealtimeSync(userId, onError) {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, "users", userId, "cubagem_items"));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rawItems = [];
      snapshot.forEach((doc) => {
        rawItems.push({ id: doc.id, ...doc.data() });
      });
      items = filterSupportedItems(rawItems, "Firestore");
      notifyDataChanged();
    },
    (error) => {
      if (onError) onError(error);
    },
  );
}

export function stopRealtimeSync() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function addItem(itemData) {
  if (useLocalStorage) {
    items.push(itemData);
    saveLocal();
  } else {
    const colPath = ["users", currentUser.uid, "cubagem_items"];
    const docRef = doc(db, ...colPath, itemData.id);
    await setDoc(docRef, itemData);
  }
}

export async function updateItem(id, itemData) {
  if (useLocalStorage) {
    const idx = items.findIndex((i) => i.id == id);
    if (idx !== -1) items[idx] = { ...items[idx], ...itemData };
    saveLocal();
  } else {
    const colPath = ["users", currentUser.uid, "cubagem_items"];
    const docRef = doc(db, ...colPath, id);
    await updateDoc(docRef, itemData);
  }
}

export async function deleteItemFromStore(id) {
  if (useLocalStorage) {
    items = items.filter((i) => i.id != id);
    saveLocal();
  } else {
    const colPath = ["users", currentUser.uid, "cubagem_items"];
    await deleteDoc(doc(db, ...colPath, id));
  }
}

export async function clearAllItems() {
  if (useLocalStorage) {
    items = [];
    saveLocal();
  } else {
    const batch = writeBatch(db);
    const q = query(collection(db, "users", currentUser.uid, "cubagem_items"));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
