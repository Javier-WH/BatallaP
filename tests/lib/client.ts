import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';

export interface HttpResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, any>;
  ok: boolean;
}

/**
 * Minimal HTTP client with manual cookie jar so we can keep a session
 * across requests without extra dependencies.
 */
export class ApiClient {
  private axios: AxiosInstance;
  private cookies: Map<string, string> = new Map();
  public baseURL: string;
  public sessionUser: any = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.axios = axios.create({
      baseURL: this.baseURL,
      validateStatus: () => true, // never throw on non-2xx; we assert manually
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private buildCookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private storeSetCookies(res: AxiosResponse) {
    const raw = res.headers['set-cookie'];
    if (!raw) return;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const line of list) {
      const kv = line.split(';')[0];
      const eq = kv.indexOf('=');
      if (eq <= 0) continue;
      const name = kv.slice(0, eq).trim();
      const value = kv.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  private async request<T = any>(
    method: string,
    path: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<HttpResponse<T>> {
    const cookie = this.buildCookieHeader();
    const res = await this.axios.request<T>({
      method,
      url: path,
      data,
      ...config,
      headers: {
        ...(config.headers || {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    this.storeSetCookies(res);
    return {
      status: res.status,
      data: res.data,
      headers: res.headers as Record<string, any>,
      ok: res.status >= 200 && res.status < 300
    };
  }

  get<T = any>(path: string, config?: AxiosRequestConfig) {
    return this.request<T>('GET', path, undefined, config);
  }
  post<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
    return this.request<T>('POST', path, data, config);
  }
  put<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
    return this.request<T>('PUT', path, data, config);
  }
  patch<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
    return this.request<T>('PATCH', path, data, config);
  }
  delete<T = any>(path: string, config?: AxiosRequestConfig) {
    return this.request<T>('DELETE', path, undefined, config);
  }

  async login(username: string, password: string): Promise<HttpResponse> {
    const res = await this.post('/auth/login', { username, password });
    if (res.ok) {
      this.sessionUser = res.data.user;
    }
    return res;
  }

  async logout(): Promise<HttpResponse> {
    const res = await this.post('/auth/logout');
    this.sessionUser = null;
    this.cookies.clear();
    return res;
  }

  async me(): Promise<HttpResponse> {
    return this.get('/auth/me');
  }

  hasSession(): boolean {
    return this.sessionUser !== null;
  }

  clone(): ApiClient {
    return new ApiClient(this.baseURL);
  }
}

/**
 * Creates a logged-in client using BASE_URL / USERNAME / PASSWORD env vars.
 */
export async function createAuthenticatedClient(): Promise<ApiClient> {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000/api';
  const username = process.env.USERNAME || 'Javier';
  const password = process.env.PASSWORD || '123456';

  const client = new ApiClient(baseURL);
  const res = await client.login(username, password);
  if (!res.ok) {
    throw new Error(
      `Login failed (HTTP ${res.status}) as user "${username}" at ${baseURL}. ` +
      `Make sure backend is running and credentials are correct. ` +
      `Response: ${JSON.stringify(res.data)}`
    );
  }
  return client;
}
