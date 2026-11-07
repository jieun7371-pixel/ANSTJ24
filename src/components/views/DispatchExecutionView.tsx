import React, { useState, useEffect } from 'react';
import {
  AppSettings,
  LocalProgramStatus,
  OfficialLetterTemplate,
  SchoolItem,
  SchoolList,
} from '../../types';
import { localApi } from '../../services/localApi';
import { getAllTemplates, saveTemplate, DEFAULT_TEMPLATE } from '../../services/db';
import { downloadAutomationPackageZip } from '../../services/agentDownloader';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Send,
  Play,
  Pause,
  Square,
  RefreshCw,
  Cpu,
  Globe,
  Lock,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  SlidersHorizontal,
  X,
  Eye,
  Save,
  Download,
  Stamp,
  Phone,
  FileCheck2,
} from 'lucide-react';

interface DispatchExecutionViewProps {
  activeList: SchoolList | null;
  schools: SchoolItem[];
  settings: AppSettings;
  localStatus: LocalProgramStatus;
  isCheckingStatus: boolean;
  onRefreshStatus: () => void;
  onLaunchChrome: () => Promise<void>;
  onBatchUpdateSchools: (updatedSchools: SchoolItem[]) => Promise<void>;
  onNavigate: (tab: any) => void;
}

export const DispatchExecutionView: React.FC<DispatchExecutionViewProps> = ({
  activeList,
  schools,
  settings,
  localStatus,
  isCheckingStatus,
  onRefreshStatus,
  onLaunchChrome,
  onBatchUpdateSchools,
  onNavigate,
}) => {
  // Templates state
  const [templates, setTemplates] = useState<OfficialLetterTemplate[]>([DEFAULT_TEMPLATE]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATE.id);

  // Active Template Form inputs (Section 4 requirements)
  const [docTitle, setDocTitle] = useState<string>(DEFAULT_TEMPLATE.title);
  const [docNumber, setDocNumber] = useState<string>(DEFAULT_TEMPLATE.docNumber);
  const [senderName, setSenderName] = useState<string>(DEFAULT_TEMPLATE.senderName);
  const [submitterName, setSubmitterName] = useState<string>(DEFAULT_TEMPLATE.submitterName);
  const [notifyPhone, setNotifyPhone] = useState<string>(DEFAULT_TEMPLATE.notifyPhone);
  const [useOfficialSeal, setUseOfficialSeal] = useState<boolean>(DEFAULT_TEMPLATE.useOfficialSeal);
  const [bodyText, setBodyText] = useState<string>(DEFAULT_TEMPLATE.bodyText);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Safety & Mode Controls
  const [isTestMode, setIsTestMode] = useState<boolean>(settings.testModeDefault ?? true);
  const [isLaunchingChrome, setIsLaunchingChrome] = useState<boolean>(false);
  const [chromeNotice, setChromeNotice] = useState<string | null>(null);

  // Modals
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewSchoolIdx, setPreviewSchoolIdx] = useState<number>(0);
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState<boolean>(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');

  // Execution State & Real-time Console Logs
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'paused' | 'stopped' | 'completed'>('idle');
  const [currentProcessingSeq, setCurrentProcessingSeq] = useState<number | null>(null);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);

  // Load templates from IndexedDB
  useEffect(() => {
    getAllTemplates().then((tpls) => {
      setTemplates(tpls);
      if (tpls.length > 0) {
        applyTemplate(tpls[0]);
      }
    });
  }, []);

  const applyTemplate = (tpl: OfficialLetterTemplate) => {
    setSelectedTemplateId(tpl.id);
    setDocTitle(tpl.title);
    setDocNumber(tpl.docNumber);
    setSenderName(tpl.senderName);
    setSubmitterName(tpl.submitterName);
    setNotifyPhone(tpl.notifyPhone);
    setUseOfficialSeal(tpl.useOfficialSeal);
    setBodyText(tpl.bodyText);
  };

  const handleSaveCurrentAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const newTpl: OfficialLetterTemplate = {
      id: `tpl_${Date.now()}`,
      title: docTitle,
      docNumber,
      senderName,
      submitterName,
      notifyPhone,
      useOfficialSeal,
      bodyText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTemplate(newTpl);
    const updated = await getAllTemplates();
    setTemplates(updated);
    setSelectedTemplateId(newTpl.id);
    setIsSaveTemplateOpen(false);
    setNewTemplateName('');
    alert('새 본문서식 템플릿이 성공적으로 저장되었습니다.');
  };

  if (!activeList || schools.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 mb-1">등록된 명단이 없습니다.</h3>
        <p className="text-xs text-slate-500 mb-4">
          발송을 준비하려면 먼저 학교 명단 관리 화면에서 엑셀 파일을 업로드해 주세요.
        </p>
      </div>
    );
  }

  // Calculate today's batch range (50 quota)
  const quota = settings.dailyQuota || 50;
  const waitingSchools = schools.filter((s) => s.dispatchStatus === 'waiting');
  const firstWaitingSeq = waitingSchools.length > 0 ? waitingSchools[0].originalSeq : 1;
  const currentBatchNum = Math.ceil(firstWaitingSeq / quota) || 1;

  const startSeq = (currentBatchNum - 1) * quota + 1;
  const endSeq = Math.min(currentBatchNum * quota, schools.length);

  const todaySchools = schools.filter(
    (s) => s.originalSeq >= startSeq && s.originalSeq <= endSeq
  );

  const firstSchool = todaySchools.length > 0 ? todaySchools[0] : null;
  const lastSchool = todaySchools.length > 0 ? todaySchools[todaySchools.length - 1] : null;

  // Replacement helper for template variables
  const formatDocumentForSchool = (school: SchoolItem) => {
    const todayStr = new Date().toLocaleDateString('ko-KR');
    const replaceVars = (text: string) => {
      return text
        .replace(/\{학교명\}/g, school.schoolName)
        .replace(/\{지역\}/g, school.region)
        .replace(/\{순번\}/g, String(school.originalSeq))
        .replace(/\{오늘날짜\}/g, todayStr);
    };

    return {
      renderedTitle: replaceVars(docTitle),
      renderedBody: replaceVars(bodyText),
    };
  };

  // Chrome Launch Action
  const handleLaunchChromeClick = async () => {
    setIsLaunchingChrome(true);
    setChromeNotice(null);
    try {
      const res = await localApi.launchChrome();
      setChromeNotice(res.message);
      await onRefreshStatus();
    } catch (err: any) {
      setChromeNotice(`실행 오류: ${err.message}`);
    } finally {
      setIsLaunchingChrome(false);
    }
  };

  // File attach handler
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Start Dispatch Process
  const handleStartClick = () => {
    if (isTestMode) {
      // In Test Mode: start immediately
      startExecutionFlow(true);
    } else {
      // In Real Mode: safety checks
      if (!localStatus.connected) {
        alert('로컬 자동화 프로그램이 미연결 상태입니다. PC에서 run.bat을 실행해 주세요.');
        return;
      }
      if (!localStatus.chromeRunning) {
        alert('Chrome 브라우저가 실행되지 않았습니다. [Chrome 실행] 버튼을 먼저 눌러주세요.');
        return;
      }
      if (!localStatus.doc24LoggedIn) {
        alert('문서24에 로그인이 확인되지 않았습니다. Chrome에서 문서24에 로그인 후 진행해 주세요.');
        return;
      }
      // Open Final Confirmation Modal
      setIsFinalConfirmOpen(true);
    }
  };

  const startExecutionFlow = async (testMode: boolean) => {
    setExecutionState('running');
    setProcessedCount(0);

    const nowStr = new Date().toLocaleTimeString('ko-KR');
    setLogs((prev) => [
      ...prev,
      `[${nowStr}] ${testMode ? '[모의 테스트 모드]' : '[실제 발송 모드]'} 공문 일괄 발송이 시작되었습니다.`,
      `[${nowStr}] 대상 학교: ${todaySchools.length}개교 (#${startSeq} ~ #${endSeq})`,
      `[${nowStr}] 기본 공문 제목: ${docTitle}`,
      `[${nowStr}] 직인 날인 설정: ${useOfficialSeal ? '날인 신청' : '미날인'}`,
    ]);

    // REAL AUTOMATION MODE: Local Python agent is connected
    if (localStatus.connected) {
      try {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString('ko-KR')}] 로컬 자동화 에이전트(Doc24 Agent)로 작업을 전송합니다...`,
        ]);
        const startRes = await localApi.startBatch(
          todaySchools,
          {
            id: selectedTemplateId,
            title: docTitle,
            docNumber,
            senderName,
            submitterName,
            notifyPhone,
            useOfficialSeal,
            bodyText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          testMode
        );

        if (!startRes.success) {
          setLogs((prev) => [...prev, `[오류] 발송 시작 실패: ${startRes.message}`]);
          setExecutionState('stopped');
          return;
        }

        // Poll agent status in real-time
        let isDone = false;
        let lastErrorAlert = false;
        const updatedSchools = [...todaySchools];

        while (!isDone) {
          await new Promise((r) => setTimeout(r, 1500));
          const currentStatus = await localApi.getStatus();

          // Sync logs from agent
          if (currentStatus.logs && currentStatus.logs.length > 0) {
            setLogs(currentStatus.logs);
          }

          // Update active school and processed count
          if (currentStatus.currentTargetSchool) {
            const activeSchool = todaySchools.find((s) => s.schoolName === currentStatus.currentTargetSchool);
            if (activeSchool) {
              setCurrentProcessingSeq(activeSchool.originalSeq);
            }
          }

          setProcessedCount(currentStatus.todayCompletedCount || 0);

          // Check consecutive errors rule
          if ((currentStatus.consecutiveErrors || 0) >= 3 && !lastErrorAlert) {
            lastErrorAlert = true;
            setExecutionState('stopped');
            alert('안내: 연속 3회 오류가 발생하여 발송이 자동 중단되었습니다. 문서24 화면을 점검해 주세요.');
            break;
          }

          if (!currentStatus.batchRunning) {
            isDone = true;
          }
        }

        // Reflect completed count on schools
        const finalStatus = await localApi.getStatus();
        const doneCount = Math.min(finalStatus.todayCompletedCount, updatedSchools.length);
        for (let i = 0; i < doneCount; i++) {
          updatedSchools[i].dispatchStatus = 'success';
          updatedSchools[i].dispatchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
          updatedSchools[i].memo = testMode
            ? '문서24 사전 점검 및 미리보기 검증 완료 (실제 전송요청 미수행)'
            : '문서24 실제 전송요청 접수 완료';
        }
        await onBatchUpdateSchools(updatedSchools);
        setExecutionState('completed');
        setCurrentProcessingSeq(null);
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString('ko-KR')}] 로컬 에이전트 발송 작업이 완료되었습니다. (완료: ${doneCount}건)`,
        ]);
        return;
      } catch (err: any) {
        setLogs((prev) => [...prev, `[오류] 로컬 에이전트 통신 오류: ${err.message}`]);
        setExecutionState('stopped');
        return;
      }
    }

    // SIMULATION TEST MODE (Only allowed when isTestMode is true)
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString('ko-KR')}] [화면 모의 시뮬레이션] 로컬 에이전트 미연결 상태로 화면상 치환 및 배치를 검증합니다.`,
    ]);
    const updatedSchools = [...todaySchools];

    for (let i = 0; i < updatedSchools.length; i++) {
      const school = updatedSchools[i];
      setCurrentProcessingSeq(school.originalSeq);

      const stepTime = new Date().toLocaleTimeString('ko-KR');
      setLogs((prev) => [
        ...prev,
        `[${stepTime}] [#${school.originalSeq}] [${school.region}] ${school.schoolName} 검증 중... (수신처 조회 및 본문 서식 자동 입력)`,
      ]);

      await new Promise((r) => setTimeout(r, 1000));

      school.dispatchStatus = 'success';
      school.dispatchedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
      school.memo = '웹 브라우저 모의 검증 완료 (서식 치환 및 미리보기 확인)';

      setProcessedCount(i + 1);
    }

    await onBatchUpdateSchools(updatedSchools);
    setExecutionState('completed');
    setCurrentProcessingSeq(null);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString('ko-KR')}] 모의 시뮬레이션 (${updatedSchools.length}개교) 검증이 완료되었습니다.`,
    ]);
  };

  const handlePause = async () => {
    setExecutionState('paused');
    if (localStatus.connected) await localApi.pauseBatch();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ko-KR')}] 사용자에 의해 일시정지되었습니다.`]);
  };

  const handleResume = async () => {
    setExecutionState('running');
    if (localStatus.connected) await localApi.resumeBatch();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ko-KR')}] 발송 작업이 재개되었습니다.`]);
  };

  const handleStop = async () => {
    setExecutionState('stopped');
    if (localStatus.connected) await localApi.stopBatch();
    setCurrentProcessingSeq(null);
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ko-KR')}] 사용자에 의해 즉시 중단되었습니다.`]);
  };

  const currentPreviewSchool = todaySchools[previewSchoolIdx] || todaySchools[0] || schools[0];
  const { renderedTitle, renderedBody } = formatDocumentForSchool(currentPreviewSchool);

  return (
    <div className="space-y-6">
      {/* Title & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">발송 실행 패널</h1>
          <p className="text-xs text-slate-500 mt-1">
            공문 본문 서식 작성, 학교별 변수 치환 미리보기 및 하루 50개 발송 제어
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switch Button */}
          <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-xs">
            <button
              onClick={() => setIsTestMode(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                isTestMode
                  ? 'bg-amber-100 text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              테스트 모드 (기본 권장)
            </button>
            <button
              onClick={() => setIsTestMode(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                !isTestMode
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              실제 발송 모드
            </button>
          </div>
        </div>
      </div>

      {chromeNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg flex items-center justify-between">
          <span>{chromeNotice}</span>
          <button onClick={() => setChromeNotice(null)} className="text-blue-700 underline font-semibold text-[11px]">
            닫기
          </button>
        </div>
      )}

      {/* Safety Notice Banner */}
      <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
        isTestMode
          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
          : 'bg-rose-50/80 border-rose-200 text-rose-900'
      }`}>
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert className="w-4 h-4" />
          {isTestMode
            ? '안전 테스트 모드 가동 중 (실제 전송요청 미수행)'
            : '경고: 실제 발송 모드 (최종 승인 후 문서24 전송요청이 실행됩니다)'}
        </div>
        <p>
          {isTestMode
            ? '테스트 모드에서는 수신기관 검색 및 본문서식 입력, 첨부파일 확인, 미리보기까지만 검증하고 실제 공문 전송은 실행하지 않습니다.'
            : '실제 발송 모드는 PC에 로컬 에이전트와 Chrome이 연결되고 문서24에 직접 로그인된 상태에서만 안전하게 실행됩니다.'}
        </p>
      </div>

      {/* Main Grid: Form Setup & Execution Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Template & Document Composition Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Target 50-Batch Summary */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                  {currentBatchNum}일차 배치
                </span>
                <h3 className="text-sm font-bold text-slate-900">오늘의 발송 대상 요약</h3>
              </div>
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Eye className="w-3.5 h-3.5" />
                학교별 본문 실시간 미리보기
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">선택 명단</span>
                <span className="font-semibold text-slate-800 truncate block">{activeList.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">오늘 대상 수량</span>
                <span className="font-bold text-blue-600 tabular-nums">{todaySchools.length}개교</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">첫 번째 학교</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {firstSchool ? `#${firstSchool.originalSeq} ${firstSchool.schoolName}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">마지막 학교</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {lastSchool ? `#${lastSchool.originalSeq} ${lastSchool.schoolName}` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Document Form: Official Letter Composition (Section 4 Requirements) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">공문 본문 서식 편집기</h3>
              </div>

              {/* Template selector & Save template button */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const found = templates.find((t) => t.id === e.target.value);
                    if (found) applyTemplate(found);
                  }}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      서식: {tpl.title.slice(0, 18)}...
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsSaveTemplateOpen(true)}
                  className="p-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 border border-slate-200"
                  title="현재 작성한 본문을 새 템플릿으로 저장"
                >
                  <Save className="w-3.5 h-3.5" />
                  서식 저장
                </button>
              </div>
            </div>

            {/* Variable guide note */}
            <div className="p-2.5 bg-blue-50/70 rounded-lg text-xs text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                치환 변수 지원: <strong>{'{학교명}'}</strong>, <strong>{'{지역}'}</strong>, <strong>{'{순번}'}</strong>, <strong>{'{오늘날짜}'}</strong>를
                제목과 본문에 넣으면 각 학교별 발송 시 자동 치환 반영됩니다.
              </span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                <span className="text-rose-500 mr-1">*</span>공문 제목
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500"
                placeholder="예: 2026학년도 {학교명} 교육문화 지원 사업 안내의 건"
              />
            </div>

            {/* Meta Row: Document Number & Submitter & Sender */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">문서번호</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  placeholder="예: 한교문-2026-0501"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">발신자명</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  placeholder="예: 사단법인 한국교육문화진흥원장"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">제출자(담당자)명</label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  placeholder="예: 홍길동 팀장"
                />
              </div>
            </div>

            {/* Meta Row 2: Notify phone and Stamp Checkbox */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-center p-3 bg-slate-50 rounded-lg">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  알림수신번호 (휴대폰 번호)
                </label>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={notifyPhone}
                    onChange={(e) => setNotifyPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-1.5 font-mono bg-white"
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="stampCheck"
                  checked={useOfficialSeal}
                  onChange={(e) => setUseOfficialSeal(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                />
                <label htmlFor="stampCheck" className="text-xs font-semibold text-slate-800 flex items-center gap-1 cursor-pointer">
                  <Stamp className="w-3.5 h-3.5 text-rose-600" />
                  문서24 공식 직인 날인 여부 확인
                </label>
              </div>
            </div>

            {/* Body Text Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">
                  <span className="text-rose-500 mr-1">*</span>공문 본문 서식 내용
                </label>
                <span className="text-[11px] text-slate-400">
                  문서24 표준 공문 형식(1. 귀 기관의 무궁한 발전을...)
                </span>
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={10}
                className="w-full text-xs font-sans leading-relaxed border border-slate-300 rounded-lg p-3 focus:ring-1 focus:ring-blue-500 font-mono"
                placeholder="공문 본문 내용을 입력하세요."
              />
            </div>

            {/* Attachment File Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">
                  첨부파일 등록 ({attachedFiles.length}개)
                </label>
                <label className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shadow-xs">
                  파일 추가
                  <input type="file" multiple onChange={handleFileAttach} className="hidden" />
                </label>
              </div>

              {attachedFiles.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-400 bg-slate-50">
                  등록된 첨부파일이 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{f.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-600 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Status, Execution Controls & Real-time Console */}
        <div className="space-y-5">
          {/* Quick Chrome & Agent Status Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>로컬 실행 환경</span>
              <button onClick={onRefreshStatus} className="text-slate-400 hover:text-slate-600" title="새로고침">
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">로컬 에이전트</span>
                <span className={`font-semibold ${localStatus.connected ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {localStatus.connected ? '정상 가동' : '미연결'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Chrome 브라우저</span>
                <span className={`font-semibold ${localStatus.chromeRunning ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {localStatus.chromeRunning ? '실행 중' : '미실행'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">문서24 로그인</span>
                <span className={`font-semibold ${localStatus.doc24LoggedIn ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {localStatus.doc24LoggedIn ? '로그인 완료' : '로그인 필요'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={handleLaunchChromeClick}
                disabled={isLaunchingChrome || !localStatus.connected}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5" />
                {isLaunchingChrome ? '기동 중...' : 'Chrome 실행'}
              </button>

              <button
                onClick={downloadAutomationPackageZip}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                title="로컬 에이전트 설치 파일(.zip) 다운로드"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress & Batch Execution Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">발송 실행 제어</h3>

            {/* Progress metric */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-slate-500">오늘 배치 진행률</span>
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {todaySchools.length > 0 ? Math.round((processedCount / todaySchools.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${todaySchools.length > 0 ? (processedCount / todaySchools.length) * 100 : 0}%` }}
                  className="bg-blue-600 h-full transition-all duration-300"
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                <span>처리 완료: {processedCount}개교</span>
                <span>총 대상: {todaySchools.length}개교</span>
              </div>
            </div>

            {currentProcessingSeq && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <span className="font-semibold block">현재 처리 중:</span>
                <span>#{currentProcessingSeq}번 학교</span>
              </div>
            )}

            {/* Buttons: Start / Pause / Resume / Stop */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {executionState === 'idle' || executionState === 'stopped' || executionState === 'completed' ? (
                <button
                  onClick={handleStartClick}
                  className={`w-full py-3 px-4 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                    isTestMode
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {isTestMode ? '테스트 모드 시작 (모의 점검)' : '실제 공문 발송 시작'}
                </button>
              ) : executionState === 'running' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePause}
                    className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Pause className="w-4 h-4" />
                    일시정지
                  </button>
                  <button
                    onClick={handleStop}
                    className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Square className="w-4 h-4" />
                    즉시 중단
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleResume}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4" />
                    재개
                  </button>
                  <button
                    onClick={handleStop}
                    className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Square className="w-4 h-4" />
                    즉시 중단
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Operation Console */}
          <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 mb-2 border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>동작 로그 및 실행 콘솔</span>
              <span className="text-[10px] text-slate-500">실시간</span>
            </div>
            <div className="h-56 overflow-y-auto space-y-1.5 text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-6 text-center">
                  발송 시작 대기 중입니다...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="text-slate-300">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Real-time Live Document Preview by School */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="공문 본문 실시간 미리보기 (학교별 변수 치환)"
          subtitle="각 학교마다 변수({학교명}, {지역}, {순번}, {오늘날짜})가 어떻게 채워지는지 확인합니다."
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* School selector */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-bold text-slate-800">미리보기 대상 학교 선택:</span>
              <select
                value={previewSchoolIdx}
                onChange={(e) => setPreviewSchoolIdx(Number(e.target.value))}
                className="text-xs border border-slate-300 rounded-lg p-1.5 font-semibold bg-white"
              >
                {todaySchools.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    #{s.originalSeq} [{s.region}] {s.schoolName}
                  </option>
                ))}
              </select>
            </div>

            {/* Official Letter Paper Mockup */}
            <div className="border border-slate-300 rounded-xl p-6 bg-white shadow-xs space-y-4 text-xs">
              <div className="text-center border-b border-slate-200 pb-4">
                <span className="text-lg font-bold text-slate-900 tracking-wide block">
                  {senderName || '발신기관명'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  문서번호: {docNumber} · 발송일자: {new Date().toLocaleDateString('ko-KR')}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <strong className="text-slate-600 mr-2">수    신:</strong>
                  <span className="font-bold text-blue-700">
                    {currentPreviewSchool.doc24OrgName || currentPreviewSchool.schoolName}장
                  </span>
                </div>
                <div>
                  <strong className="text-slate-600 mr-2">제    목:</strong>
                  <span className="font-bold text-slate-900">{renderedTitle}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-lg whitespace-pre-line leading-relaxed font-sans text-slate-800 border border-slate-100">
                {renderedBody}
              </div>

              {attachedFiles.length > 0 && (
                <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                  <strong className="block mb-1 text-slate-800">붙임 서류 ({attachedFiles.length}건):</strong>
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-slate-500">
                      <span>{i + 1}. {f.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                <span>제출자: {submitterName} (연락처: {notifyPhone})</span>
                <span className="font-semibold text-rose-600">
                  {useOfficialSeal ? '[공식 직인 날인]' : '[직인 생략]'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Save Template */}
      {isSaveTemplateOpen && (
        <Modal
          isOpen={isSaveTemplateOpen}
          onClose={() => setIsSaveTemplateOpen(false)}
          title="새 공문 본문서식 템플릿으로 저장"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                템플릿 명칭
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="예: 초등학교용 체험활동 안내 서식"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSaveTemplateOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentAsTemplate}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                저장
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Final Explicit Confirmation Modal for Real Dispatch (Section 6 Requirement) */}
      {isFinalConfirmOpen && (
        <ConfirmModal
          isOpen={isFinalConfirmOpen}
          onClose={() => setIsFinalConfirmOpen(false)}
          onConfirm={() => startExecutionFlow(false)}
          title="문서24 실제 공문 전송 최종 승인"
          message={`[경고: 실제 발송 모드]\n\n오늘 배치 대상: 총 ${todaySchools.length}개교 (#${startSeq} ~ #${endSeq})\n공문 제목: ${docTitle}\n첨부파일: ${attachedFiles.length}개\n\n최종 승인 시 전용 Chrome을 통해 문서24 공식 사이트에 실제 공문 접수 및 전송요청이 실행됩니다.\n정말로 최종 발송을 진행하시겠습니까?`}
          confirmLabel="최종 전송 승인 및 발송"
          isDestructive={true}
        />
      )}
    </div>
  );
};
