import { LocalProgramStatus, OfficialLetterTemplate, SchoolItem } from '../types';

const LOCAL_AGENT_DEFAULT_URL = 'http://127.0.0.1:24000';

export class LocalApiService {
  private baseUrl: string;
  private timeoutMs: number;
  private authToken: string | null = null;

  constructor(baseUrl: string = LOCAL_AGENT_DEFAULT_URL, timeoutMs: number = 2500) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  private async fetchWithTimeout(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.authToken) {
      headers['X-Doc24-Token'] = this.authToken;
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * GET /api/status
   * Checks full 8 status indicators of local Python program, Chrome browser, and Document24
   */
  async getStatus(): Promise<LocalProgramStatus> {
    try {
      const res = await this.fetchWithTimeout('/api/status', { method: 'GET' });
      if (!res.ok) {
        return {
          connected: false,
          chromeRunning: false,
          chromeConnected: false,
          doc24Connected: false,
          doc24LoggedIn: false,
          todayCompletedCount: 0,
          todayRemainingCount: 0,
          message: `로컬 프로그램 응답 오류 (HTTP ${res.status})`,
          lastChecked: new Date().toLocaleTimeString('ko-KR'),
        };
      }
      const data = await res.json();
      if (data.authToken) {
        this.authToken = data.authToken;
      }
      return {
        connected: Boolean(data.connected),
        chromeRunning: Boolean(data.chromeRunning),
        chromeConnected: Boolean(data.chromeConnected),
        doc24Connected: Boolean(data.doc24Connected),
        doc24LoggedIn: Boolean(data.doc24LoggedIn),
        doc24LoginState: data.doc24LoginState || (data.doc24LoggedIn ? 'logged_in' : 'logged_out'),
        authToken: data.authToken || null,
        launchSteps: data.launchSteps || undefined,
        doc24UserName: data.doc24UserName || null,
        currentTargetSchool: data.currentTargetSchool || null,
        todayCompletedCount: data.todayCompletedCount || 0,
        todayRemainingCount: data.todayRemainingCount || 0,
        chromePath: data.chromePath || null,
        currentUrl: data.currentUrl || null,
        batchRunning: Boolean(data.batchRunning),
        batchPaused: Boolean(data.batchPaused),
        consecutiveErrors: data.consecutiveErrors || 0,
        lastError: data.lastError || null,
        logs: data.logs || [],
        version: data.version,
        message: data.message || '로컬 프로그램 연결됨',
        lastChecked: new Date().toLocaleTimeString('ko-KR'),
      };
    } catch {
      return {
        connected: false,
        chromeRunning: false,
        chromeConnected: false,
        doc24Connected: false,
        doc24LoggedIn: false,
        doc24LoginState: 'logged_out',
        todayCompletedCount: 0,
        todayRemainingCount: 0,
        message: '로컬 자동화 프로그램 미연결 (PC에서 run.bat 실행 필요)',
        lastChecked: new Date().toLocaleTimeString('ko-KR'),
      };
    }
  }

  /**
   * POST /api/chrome/launch
   * Launches Chrome with remote debugging on dedicated isolated profile
   */
  async launchChrome(): Promise<{ success: boolean; message: string; steps?: any }> {
    try {
      const res = await this.fetchWithTimeout('/api/chrome/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    } catch (err: any) {
      return {
        success: false,
        message: `Chrome 실행 요청 실패: ${err.message || '로컬 프로그램에 연결할 수 없습니다.'}`,
      };
    }
  }

  /**
   * POST /api/chrome/close
   */
  async closeChrome(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithTimeout('/api/chrome/close', {
        method: 'POST',
      });
      return res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * POST /api/send/batch
   * Initiates batch dispatch with template and school list
   */
  async startBatch(
    schools: SchoolItem[],
    template: OfficialLetterTemplate,
    testMode: boolean
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithTimeout('/api/send/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schools, template, testMode }),
      });
      return res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * POST /api/send/pause
   */
  async pauseBatch(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithTimeout('/api/send/pause', { method: 'POST' });
      return res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * POST /api/send/resume
   */
  async resumeBatch(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithTimeout('/api/send/resume', { method: 'POST' });
      return res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * POST /api/send/stop
   */
  async stopBatch(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithTimeout('/api/send/stop', { method: 'POST' });
      return res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

export const localApi = new LocalApiService();
