/**
 * Circle for Life - API Client Configuration
 * Axios instance with auth interceptors, retry logic, and base URL config
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

// Base URL - use env var in production
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string) ||
  'https://api.circleforlife.app/v1';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export type TokenGetter = () => string | null;

let tokenGetter: TokenGetter | null = null;

export const setTokenGetter = (getter: TokenGetter) => {
  tokenGetter = getter;
};

export const clearTokenGetter = () => {
  tokenGetter = null;
};

/**
 * Creates a delay for retry backoff (exponential)
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) return true; // Network error - retry
  const status = error.response.status;
  return RETRYABLE_STATUS_CODES.includes(status);
};

/**
 * Request interceptor - inject auth token
 */
const onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const token = tokenGetter?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Content-Type'] = 'application/json';
  return config;
};

/**
 * Response interceptor - handle 401 refresh (placeholder for token refresh flow)
 */
const onResponseError = async (error: AxiosError): Promise<never> => {
  const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
  const retryCount = originalRequest._retryCount ?? 0;

  if (retryCount < MAX_RETRIES && isRetryableError(error)) {
    originalRequest._retryCount = retryCount + 1;
    const backoff = RETRY_DELAY_MS * Math.pow(2, retryCount);
    await delay(backoff);
    return apiClient.request(originalRequest);
  }

  // Extract API error format
  if (error.response?.data) {
    const apiError = (error.response.data as ApiErrorResponse).error;
    if (apiError) {
      error.message = apiError.message || error.message;
    }
  }

  return Promise.reject(error);
};

/**
 * Main API client instance
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Version': '1.0.0',
  },
});

apiClient.interceptors.request.use(onRequest, Promise.reject);
apiClient.interceptors.response.use((res) => res, onResponseError);

/**
 * Helper to extract API error from AxiosError
 */
export const getApiError = (error: unknown): ApiError | null => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as ApiErrorResponse;
    return data.error ?? null;
  }
  return null;
};

export { API_BASE_URL };
