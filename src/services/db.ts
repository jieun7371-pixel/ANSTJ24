import { AppSettings, OfficialLetterTemplate, SchoolItem, SchoolList } from '../types';

const DB_NAME = 'doc24_manager_db';
const DB_VERSION = 2;

const DEFAULT_SETTINGS: AppSettings = {
  dailyQuota: 50,
  defaultDelaySec: 5,
  testModeDefault: true,
  autoSelectExactMatch: true,
  activeListId: null,
  rowsPerPage: 25,
};

export const DEFAULT_TEMPLATE: OfficialLetterTemplate = {
  id: 'default_template_01',
  title: '2026학년도 {학교명} 교육문화 지원 사업 안내의 건',
  docNumber: '한교문-2026-0501',
  senderName: '사단법인 한국교육문화진흥원장',
  submitterName: '관리담당자',
  notifyPhone: '010-1234-5678',
  useOfficialSeal: true,
  bodyText: `1. 귀 기관의 무궁한 발전을 기원합니다.
2. 2026학년도 학교 교육문화 지원 및 체험 프로그램 안내 공문을 다음과 같이 발송하오니 관련 업무에 참고하여 주시기 바랍니다.

  가. 제    목: 2026학년도 {학교명} 교육문화 지원 안내
  나. 대    상: {지역} {학교명} 교직원 및 학생
  다. 배정순번: #{순번}
  라. 발송일자: {오늘날짜}
  마. 세부내용: 붙임 문서 참조

붙임  1. 2026학년도 세부 운영 계획서 1부.
      2. 기관별 접수 신청서 서식 1부.  끝.`,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('lists')) {
        db.createObjectStore('lists', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('schools')) {
        const schoolStore = db.createObjectStore('schools', { keyPath: 'id' });
        schoolStore.createIndex('listId', 'listId', { unique: false });
        schoolStore.createIndex('originalSeq', 'originalSeq', { unique: false });
        schoolStore.createIndex('listId_seq', ['listId', 'originalSeq'], { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

// ---------------- LISTS ----------------
export async function getAllLists(): Promise<SchoolList[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lists', 'readonly');
    const store = tx.objectStore('lists');
    const req = store.getAll();
    req.onsuccess = () => {
      const lists = (req.result as SchoolList[]) || [];
      // Sort by updatedAt descending
      lists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(lists);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getListById(id: string): Promise<SchoolList | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lists', 'readonly');
    const store = tx.objectStore('lists');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as SchoolList | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveList(list: SchoolList): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lists', 'readwrite');
    const store = tx.objectStore('lists');
    const req = store.put(list);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteList(listId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['lists', 'schools'], 'readwrite');
    const listStore = tx.objectStore('lists');
    const schoolStore = tx.objectStore('schools');

    listStore.delete(listId);

    const index = schoolStore.index('listId');
    const cursorReq = index.openKeyCursor(IDBKeyRange.only(listId));

    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        schoolStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- SCHOOLS ----------------
export async function getSchoolsByListId(listId: string): Promise<SchoolItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('schools', 'readonly');
    const store = tx.objectStore('schools');
    const index = store.index('listId');
    const req = index.getAll(IDBKeyRange.only(listId));

    req.onsuccess = () => {
      const items = (req.result as SchoolItem[]) || [];
      // Always maintain original Excel row order!
      items.sort((a, b) => a.originalSeq - b.originalSeq);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSchools(schools: SchoolItem[]): Promise<void> {
  if (schools.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('schools', 'readwrite');
    const store = tx.objectStore('schools');

    schools.forEach((item) => {
      store.put(item);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateSchool(school: SchoolItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('schools', 'readwrite');
    const store = tx.objectStore('schools');
    const req = store.put({
      ...school,
      updatedAt: new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('schools', 'readwrite');
    const store = tx.objectStore('schools');
    const req = store.delete(schoolId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearSchoolsByListId(listId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('schools', 'readwrite');
    const store = tx.objectStore('schools');
    const index = store.index('listId');
    const cursorReq = index.openKeyCursor(IDBKeyRange.only(listId));

    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- SETTINGS ----------------
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('app_settings');
    req.onsuccess = () => {
      if (req.result && req.result.value) {
        resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
      } else {
        resolve({ ...DEFAULT_SETTINGS });
      }
    };
    req.onerror = () => resolve({ ...DEFAULT_SETTINGS });
  });
}

export async function saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged: AppSettings = { ...current, ...newSettings };
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key: 'app_settings', value: merged });
    req.onsuccess = () => resolve(merged);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- BACKUP & RESTORE ----------------
export interface BackupData {
  version: number;
  exportedAt: string;
  app: string;
  settings: AppSettings;
  lists: SchoolList[];
  schools: SchoolItem[];
}

export async function exportFullBackup(): Promise<string> {
  const db = await getDB();
  const settings = await getSettings();
  const lists = await getAllLists();

  const allSchools: SchoolItem[] = [];
  for (const list of lists) {
    const listSchools = await getSchoolsByListId(list.id);
    allSchools.push(...listSchools);
  }

  const backupPayload: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'doc24_manager',
    settings,
    lists,
    schools: allSchools,
  };

  return JSON.stringify(backupPayload, null, 2);
}

export async function importFullBackup(
  jsonStr: string
): Promise<{ success: boolean; listCount: number; schoolCount: number; error?: string }> {
  try {
    const data = JSON.parse(jsonStr) as BackupData;
    if (!data.lists || !Array.isArray(data.lists)) {
      return { success: false, listCount: 0, schoolCount: 0, error: '유효한 문서24 백업 파일 형식이 아닙니다 (lists 부재).' };
    }
    if (!data.schools || !Array.isArray(data.schools)) {
      return { success: false, listCount: 0, schoolCount: 0, error: '유효한 문서24 백업 파일 형식이 아닙니다 (schools 부재).' };
    }

    const db = await getDB();

    // Clear existing
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['lists', 'schools', 'settings'], 'readwrite');
      tx.objectStore('lists').clear();
      tx.objectStore('schools').clear();
      tx.objectStore('settings').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Save restored lists
    for (const list of data.lists) {
      await saveList(list);
    }

    // Save restored schools
    if (data.schools.length > 0) {
      await saveSchools(data.schools);
    }

    // Save restored settings
    if (data.settings) {
      await saveSettings(data.settings);
    }

    return {
      success: true,
      listCount: data.lists.length,
      schoolCount: data.schools.length,
    };
  } catch (err) {
    return {
      success: false,
      listCount: 0,
      schoolCount: 0,
      error: `파일 파싱 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['lists', 'schools', 'settings', 'templates'], 'readwrite');
    tx.objectStore('lists').clear();
    tx.objectStore('schools').clear();
    tx.objectStore('settings').clear();
    if (tx.objectStoreNames.contains('templates')) {
      tx.objectStore('templates').clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- TEMPLATES ----------------
export async function getAllTemplates(): Promise<OfficialLetterTemplate[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readonly');
    const store = tx.objectStore('templates');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as OfficialLetterTemplate[]) || [];
      if (items.length === 0) {
        // Return default template
        resolve([DEFAULT_TEMPLATE]);
      } else {
        items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(items);
      }
    };
    req.onerror = () => resolve([DEFAULT_TEMPLATE]);
  });
}

export async function saveTemplate(tpl: OfficialLetterTemplate): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.put({
      ...tpl,
      updatedAt: new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTemplate(tplId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    const store = tx.objectStore('templates');
    const req = store.delete(tplId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

