// Central Axios client for the AgroDoc backend.
//
// In development it uses a relative "/api" base URL which Vite proxies to the
// FastAPI backend (see vite.config.ts), keeping the browser on a single secure
// origin (localhost:5173) so the webcam works. In production set
// VITE_API_URL to the absolute backend URL, e.g. https://api.agrodoc.in/api

import axios, { type AxiosInstance } from "axios";
import type {
  DiagnosisResponse,
  Farm,
  TokenResponse,
  User,
  WeatherResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Attach the access token to every request when present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("agrodoc.access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically refresh the access token once on 401, then retry.
let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("agrodoc.refresh_token");
      if (refresh) {
        try {
          refreshing ??= (async () => {
            const { data } = await axios.post<TokenResponse>(
              `${BASE_URL}/auth/refresh`,
              { refresh_token: refresh },
            );
            localStorage.setItem("agrodoc.access_token", data.access_token);
            localStorage.setItem("agrodoc.refresh_token", data.refresh_token);
          })();
          await refreshing;
          refreshing = null;
          original.headers.Authorization = `Bearer ${localStorage.getItem(
            "agrodoc.access_token",
          )}`;
          return api(original);
        } catch {
          refreshing = null;
          localStorage.removeItem("agrodoc.access_token");
          localStorage.removeItem("agrodoc.refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

// --------------------------------------------------------------------------- //
// Auth
// --------------------------------------------------------------------------- //
export const authApi = {
  register: (body: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
    preferred_language?: string;
    state?: string;
  }) => api.post<User>("/auth/register", body).then((r) => r.data),

  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }).then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

// --------------------------------------------------------------------------- //
// Farms
// --------------------------------------------------------------------------- //
export const farmApi = {
  list: () => api.get<Farm[]>("/farms").then((r) => r.data),
  create: (body: Partial<Farm>) => api.post<Farm>("/farms", body).then((r) => r.data),
  get: (id: number) => api.get<Farm>(`/farms/${id}`).then((r) => r.data),
  update: (id: number, body: Partial<Farm>) => api.put<Farm>(`/farms/${id}`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/farms/${id}`),
  addPlot: (farmId: number, body: Partial<Farm["plots"][number]>) =>
    api.post<Farm["plots"][number]>(`/farms/${farmId}/plots`, body).then((r) => r.data),
  updatePlot: (farmId: number, plotId: number, body: Partial<Farm["plots"][number]>) =>
    api.put<Farm["plots"][number]>(`/farms/${farmId}/plots/${plotId}`, body).then((r) => r.data),
  updateBoundary: (farmId: number, plotId: number, body: { boundary_geojson?: string; latitude?: number; longitude?: number }) =>
    api.patch<Farm["plots"][number]>(`/farms/${farmId}/plots/${plotId}/boundary`, body).then((r) => r.data),
  removePlot: (farmId: number, plotId: number) =>
    api.delete(`/farms/${farmId}/plots/${plotId}`),
};

// --------------------------------------------------------------------------- //
// Crop Doctor
// --------------------------------------------------------------------------- //
export const cropDoctorApi = {
  analyze: (file: Blob, metadata: Record<string, string> = {}) => {
    const form = new FormData();
    form.append("file", file, "leaf.jpg");
    for (const [k, v] of Object.entries(metadata)) {
      if (v) form.append(k, v);
    }
    return api
      .post<DiagnosisResponse>("/crop-diagnosis/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  reports: () => api.get<DiagnosisResponse[]>("/crop-diagnosis/reports").then((r) => r.data),
  imageUrl: (id: number) => `${BASE_URL}/crop-diagnosis/images/${id}`,
};

// --------------------------------------------------------------------------- //
// Weather
// --------------------------------------------------------------------------- //
export const weatherApi = {
  byCoords: (lat: number, lon: number) =>
    api.get<WeatherResponse>("/weather", { params: { lat, lon } }).then((r) => r.data),
  byPlot: (plotId: number) =>
    api.get<WeatherResponse>("/weather", { params: { plot_id: plotId } }).then((r) => r.data),
};

// --------------------------------------------------------------------------- //
// AI Farming Assistant
// --------------------------------------------------------------------------- //
export interface ChatMessage { role: "user" | "assistant"; content: string; }
export interface ChatResponse { reply: string; configured: boolean; provider: string; }

export const assistantApi = {
  chat: (messages: ChatMessage[], farmContext?: Record<string, string>) =>
    api.post<ChatResponse>("/assistant/chat", {
      messages,
      farm_context: farmContext ?? null,
    }).then(r => r.data),
};

// --------------------------------------------------------------------------- //
// Tasks / Crop Calendar
// --------------------------------------------------------------------------- //
export interface FarmTask {
  id: number; owner_id: number; plot_id: number | null;
  title: string; description: string | null; category: string;
  due_date: string | null; completed: boolean;
}
export interface TaskCreate { title: string; description?: string; category?: string; due_date?: string; plot_id?: number; }

export const tasksApi = {
  list: () => api.get<FarmTask[]>("/tasks").then(r => r.data),
  create: (body: TaskCreate) => api.post<FarmTask>("/tasks", body).then(r => r.data),
  complete: (id: number) => api.patch<FarmTask>(`/tasks/${id}/complete`).then(r => r.data),
  remove: (id: number) => api.delete(`/tasks/${id}`),
};

// --------------------------------------------------------------------------- //
// Expenses / Income / Harvest
// --------------------------------------------------------------------------- //
export interface Expense {
  id: number; owner_id: number; plot_id: number | null;
  kind: "expense" | "income" | "harvest";
  category: string; amount: number; currency: string;
  note: string | null; date: string;
}
export interface ProfitSummary { total_income: number; total_expense: number; net: number; currency: string; }

export const expensesApi = {
  list: () => api.get<Expense[]>("/expenses").then(r => r.data),
  create: (body: Omit<Expense, "id" | "owner_id">) => api.post<Expense>("/expenses", body).then(r => r.data),
  remove: (id: number) => api.delete(`/expenses/${id}`),
  summary: () => api.get<ProfitSummary>("/expenses/summary").then(r => r.data),
};
export interface MandiPrice {
  commodity: string;
  market: string;
  state: string | null;
  price: string;
  unit: string;
  arrival_date: string;
  source: string;
}
export interface MandiResponse {
  source: string;
  fetched_at: string;
  configured: boolean;
  message: string | null;
  records: MandiPrice[];
}
export const mandiApi = {
  prices: (commodity?: string) =>
    api
      .get<MandiResponse>("/mandi/prices", { params: commodity ? { commodity } : {} })
      .then((r) => r.data),
};
