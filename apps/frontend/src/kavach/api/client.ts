import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _kavachRetried?: boolean;
}

const configuredBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export const apiClient = axios.create({
  baseURL: configuredBaseUrl,
  withCredentials: true,
  timeout: 20_000,
  headers: {Accept: "application/json"},
});

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

function authUrl(path: string) {
  return `${configuredBaseUrl}${path}`;
}

export async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(authUrl("/api/auth/refresh"), {}, {withCredentials: true, timeout: 20_000})
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        const token = payload?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequestConfig | undefined;
    const isAuthRequest = request?.url?.startsWith("/api/auth/");

    if (error.response?.status !== 401 || !request || request._kavachRetried || isAuthRequest) {
      return Promise.reject(error);
    }

    request._kavachRetried = true;
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) return Promise.reject(error);

    request.headers.set("Authorization", `Bearer ${refreshedToken}`);
    return apiClient(request);
  },
);
