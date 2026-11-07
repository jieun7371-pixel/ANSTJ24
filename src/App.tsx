import React, { useState, useEffect, useCallback } from 'react';
import { ActiveTab, AppSettings, LocalProgramStatus, SchoolItem, SchoolList } from './types';
import {
  getAllLists,
  getSchoolsByListId,
  saveList,
  deleteList,
  saveSchools,
  updateSchool as dbUpdateSchool,
  deleteSchool as dbDeleteSchool,
  clearSchoolsByListId,
  getSettings,
  saveSettings as dbSaveSettings,
} from './services/db';
import { localApi } from './services/localApi';
import { SAMPLE_LIST_META, getSampleSchools } from './data/sampleData';

import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';

import { DashboardView } from './components/views/DashboardView';
import { ListManagementView } from './components/views/ListManagementView';
import { PrecheckView } from './components/views/PrecheckView';
import { DailyBatchView } from './components/views/DailyBatchView';
import { DispatchExecutionView } from './components/views/DispatchExecutionView';
import { DispatchResultsView } from './components/views/DispatchResultsView';
import { SettingsView } from './components/views/SettingsView';
import { UserGuideView } from './components/views/UserGuideView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // App data state
  const [lists, setLists] = useState<SchoolList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    dailyQuota: 50,
    defaultDelaySec: 5,
    testModeDefault: true,
    autoSelectExactMatch: true,
    activeListId: null,
    rowsPerPage: 25,
  });

  // Local automation status
  const [localStatus, setLocalStatus] = useState<LocalProgramStatus>({
    connected: false,
    chromeRunning: false,
    chromeConnected: false,
    doc24Connected: false,
    doc24LoggedIn: false,
    doc24LoginState: 'logged_out',
    currentTargetSchool: null,
    todayCompletedCount: 0,
    todayRemainingCount: 0,
    message: '연결 확인 전 (새로고침을 눌러 확인하세요)',
    lastChecked: '',
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const handleLaunchChrome = async () => {
    try {
      await localApi.launchChrome();
      await refreshLocalStatus();
    } catch (err) {
      console.error('Launch Chrome error:', err);
    }
  };

  // Check local agent status (non-blocking)
  const refreshLocalStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const status = await localApi.getStatus();
      setLocalStatus(status);
    } catch {
      setLocalStatus({
        connected: false,
        chromeRunning: false,
        chromeConnected: false,
        doc24Connected: false,
        doc24LoggedIn: false,
        doc24LoginState: 'logged_out',
        currentTargetSchool: null,
        todayCompletedCount: 0,
        todayRemainingCount: 0,
        message: '로컬 프로그램 미연결',
        lastChecked: new Date().toLocaleTimeString('ko-KR'),
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  // Initial load
  const loadInitialData = useCallback(async () => {
    try {
      const [storedSettings, storedLists] = await Promise.all([
        getSettings(),
        getAllLists(),
      ]);

      setSettings(storedSettings);
      setLists(storedLists);

      // Determine active list
      let targetListId = storedSettings.activeListId;
      if (!targetListId && storedLists.length > 0) {
        targetListId = storedLists[0].id;
      }

      if (targetListId) {
        const found = storedLists.find((l) => l.id === targetListId);
        if (found) {
          setActiveListId(targetListId);
          const listSchools = await getSchoolsByListId(targetListId);
          setSchools(listSchools);
        } else if (storedLists.length > 0) {
          setActiveListId(storedLists[0].id);
          const listSchools = await getSchoolsByListId(storedLists[0].id);
          setSchools(listSchools);
        } else {
          setActiveListId(null);
          setSchools([]);
        }
      } else {
        setActiveListId(null);
        setSchools([]);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    refreshLocalStatus();
  }, [loadInitialData, refreshLocalStatus]);

  // Select another list
  const handleSelectList = async (listId: string) => {
    setActiveListId(listId);
    await dbSaveSettings({ activeListId: listId });
    setSettings((prev) => ({ ...prev, activeListId: listId }));
    const items = await getSchoolsByListId(listId);
    setSchools(items);
  };

  // Load sample dataset
  const handleLoadSample = async () => {
    const sampleSchools = getSampleSchools(SAMPLE_LIST_META.id);
    await saveList(SAMPLE_LIST_META);
    await saveSchools(sampleSchools);
    await handleSelectList(SAMPLE_LIST_META.id);
    const updatedLists = await getAllLists();
    setLists(updatedLists);
  };

  // Save new list
  const handleSaveNewList = async (newList: SchoolList, items: SchoolItem[]) => {
    await saveList(newList);
    await saveSchools(items);
    const updatedLists = await getAllLists();
    setLists(updatedLists);
    await handleSelectList(newList.id);
  };

  // Append items to existing list
  const handleAppendToList = async (listId: string, items: SchoolItem[]) => {
    await saveSchools(items);
    const targetList = lists.find((l) => l.id === listId);
    if (targetList) {
      const updatedMeta: SchoolList = {
        ...targetList,
        totalCount: targetList.totalCount + items.length,
        updatedAt: new Date().toISOString(),
      };
      await saveList(updatedMeta);
      const updatedLists = await getAllLists();
      setLists(updatedLists);
    }
    const currentItems = await getSchoolsByListId(listId);
    setSchools(currentItems);
  };

  // Replace existing list
  const handleReplaceList = async (listId: string, items: SchoolItem[]) => {
    await clearSchoolsByListId(listId);
    await saveSchools(items);
    const targetList = lists.find((l) => l.id === listId);
    if (targetList) {
      const updatedMeta: SchoolList = {
        ...targetList,
        totalCount: items.length,
        updatedAt: new Date().toISOString(),
      };
      await saveList(updatedMeta);
      const updatedLists = await getAllLists();
      setLists(updatedLists);
    }
    const currentItems = await getSchoolsByListId(listId);
    setSchools(currentItems);
  };

  // Rename list
  const handleRenameList = async (listId: string, newName: string) => {
    const targetList = lists.find((l) => l.id === listId);
    if (targetList) {
      const updated = { ...targetList, name: newName, updatedAt: new Date().toISOString() };
      await saveList(updated);
      const updatedLists = await getAllLists();
      setLists(updatedLists);
    }
  };

  // Delete list
  const handleDeleteList = async (listId: string) => {
    await deleteList(listId);
    const remaining = await getAllLists();
    setLists(remaining);
    if (activeListId === listId) {
      if (remaining.length > 0) {
        await handleSelectList(remaining[0].id);
      } else {
        setActiveListId(null);
        setSchools([]);
      }
    }
  };

  // Single School operations
  const handleUpdateSchool = async (school: SchoolItem) => {
    await dbUpdateSchool(school);
    setSchools((prev) => prev.map((s) => (s.id === school.id ? school : s)));
  };

  const handleAddSchool = async (schoolData: Omit<SchoolItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!activeListId) return;
    const newId = `${activeListId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullSchool: SchoolItem = {
      ...schoolData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSchools([fullSchool]);
    // update list count
    const targetList = lists.find((l) => l.id === activeListId);
    if (targetList) {
      const updatedMeta = { ...targetList, totalCount: targetList.totalCount + 1, updatedAt: new Date().toISOString() };
      await saveList(updatedMeta);
      const updatedLists = await getAllLists();
      setLists(updatedLists);
    }
    const currentItems = await getSchoolsByListId(activeListId);
    setSchools(currentItems);
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!activeListId) return;
    await dbDeleteSchool(schoolId);
    const targetList = lists.find((l) => l.id === activeListId);
    if (targetList && targetList.totalCount > 0) {
      const updatedMeta = { ...targetList, totalCount: targetList.totalCount - 1, updatedAt: new Date().toISOString() };
      await saveList(updatedMeta);
      const updatedLists = await getAllLists();
      setLists(updatedLists);
    }
    const currentItems = await getSchoolsByListId(activeListId);
    setSchools(currentItems);
  };

  const handleBatchUpdateSchools = async (updatedSchools: SchoolItem[]) => {
    await saveSchools(updatedSchools);
    if (activeListId) {
      const currentItems = await getSchoolsByListId(activeListId);
      setSchools(currentItems);
    }
  };

  // Extract failed schools to new list
  const handleExtractFailedAsNewList = async (failedItems: SchoolItem[], listName: string) => {
    const newListId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Re-index originalSeq starting from 1 for the new batch
    const reindexed: SchoolItem[] = failedItems.map((item, idx) => ({
      ...item,
      id: `${newListId}_${Date.now()}_${idx + 1}`,
      listId: newListId,
      originalSeq: idx + 1,
      dispatchStatus: 'waiting',
      batchNumber: Math.ceil((idx + 1) / (settings.dailyQuota || 50)),
      memo: `이전 발송 오류에서 재처리 명단으로 생성됨 (기존 메모: ${item.memo || '없음'})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const newListMeta: SchoolList = {
      id: newListId,
      name: listName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCount: reindexed.length,
      sourceFileName: '재발송 추출',
    };

    await saveList(newListMeta);
    await saveSchools(reindexed);
    const updatedLists = await getAllLists();
    setLists(updatedLists);
    await handleSelectList(newListId);
    setCurrentTab('batch');
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    const saved = await dbSaveSettings(newSettings);
    setSettings(saved);
  };

  const activeList = lists.find((l) => l.id === activeListId) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeList={activeList}
        totalListsCount={lists.length}
      />

      {/* Top Header */}
      <TopHeader
        collapsed={sidebarCollapsed}
        activeList={activeList}
        lists={lists}
        onSelectList={handleSelectList}
        localStatus={localStatus}
        isCheckingStatus={isCheckingStatus}
        onRefreshStatus={refreshLocalStatus}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-200 ease-in-out pt-20 pb-12 px-6 ${
          sidebarCollapsed ? 'ml-18' : 'ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              activeList={activeList}
              schools={schools}
              settings={settings}
              localStatus={localStatus}
              isCheckingStatus={isCheckingStatus}
              onRefreshStatus={refreshLocalStatus}
              onLaunchChrome={handleLaunchChrome}
              onNavigate={setCurrentTab}
              onLoadSample={handleLoadSample}
            />
          )}

          {currentTab === 'lists' && (
            <ListManagementView
              lists={lists}
              activeList={activeList}
              schools={schools}
              onSelectList={handleSelectList}
              onSaveNewList={handleSaveNewList}
              onAppendToList={handleAppendToList}
              onReplaceList={handleReplaceList}
              onRenameList={handleRenameList}
              onDeleteList={handleDeleteList}
              onUpdateSchool={handleUpdateSchool}
              onAddSchool={handleAddSchool}
              onDeleteSchool={handleDeleteSchool}
              onLoadSample={handleLoadSample}
            />
          )}

          {currentTab === 'precheck' && (
            <PrecheckView
              activeList={activeList}
              schools={schools}
              localStatus={localStatus}
              onUpdateSchool={handleUpdateSchool}
              onBatchUpdateSchools={handleBatchUpdateSchools}
            />
          )}

          {currentTab === 'batch' && (
            <DailyBatchView
              activeList={activeList}
              schools={schools}
              settings={settings}
              onUpdateSchool={handleUpdateSchool}
              onBatchUpdateSchools={handleBatchUpdateSchools}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'execution' && (
            <DispatchExecutionView
              activeList={activeList}
              schools={schools}
              settings={settings}
              localStatus={localStatus}
              isCheckingStatus={isCheckingStatus}
              onRefreshStatus={refreshLocalStatus}
              onLaunchChrome={handleLaunchChrome}
              onBatchUpdateSchools={handleBatchUpdateSchools}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'results' && (
            <DispatchResultsView
              activeList={activeList}
              schools={schools}
              onUpdateSchool={handleUpdateSchool}
              onDeleteSchool={handleDeleteSchool}
              onExtractFailedAsNewList={handleExtractFailedAsNewList}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              lists={lists}
              onSaveSettings={handleSaveSettings}
              onReloadAllData={loadInitialData}
            />
          )}

          {currentTab === 'guide' && <UserGuideView />}
        </div>
      </main>
    </div>
  );
}
