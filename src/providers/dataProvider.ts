import type { DataProvider } from "@refinedev/core";
import axios from "axios";

export const API_URL = "https://comterback-production.up.railway.app/api/v1";

// Axios instance con JWT automático
export const axiosInstance = axios.create({ baseURL: API_URL });

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const SESSION_MSG_KEY = "auth_message";

function forceLogout() {
  localStorage.clear();
  sessionStorage.setItem(SESSION_MSG_KEY, "Tu sesión expiró. Por favor inicia sesión de nuevo.");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status: number | undefined = error.response?.status;

    if (status === 401) {
      // Evitar loop infinito si el propio refresh falla con 401
      if ((error.config?.url as string | undefined)?.includes("/auth/refresh")) {
        forceLogout();
        return Promise.reject(error);
      }

      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("access_token", data.access_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return axiosInstance.request(error.config);
        } catch {
          forceLogout();
        }
      } else {
        forceLogout();
      }
    }

    if (status === 403) {
      forceLogout();
    }

    return Promise.reject(error);
  }
);

// Mapeo de recursos a rutas de la API
const resourceMap: Record<string, string> = {
  employees: "/employees",
  plants:    "/plants",
  clients:   "/clients",
  projects:  "/projects",
};

const getPath = (resource: string) => resourceMap[resource] ?? `/${resource}`;

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination: _p, filters: _f, sorters: _s }) => {
    const path = getPath(resource);
    const { data } = await axiosInstance.get(path);
    const list = Array.isArray(data) ? data : data.items ?? [];
    return { data: list, total: list.length };
  },

  getOne: async ({ resource, id }) => {
    const path = getPath(resource);
    const { data } = await axiosInstance.get(`${path}/${id}`);
    return { data };
  },

  create: async ({ resource, variables }) => {
    const path = getPath(resource);
    const { data } = await axiosInstance.post(path, variables);
    return { data };
  },

  update: async ({ resource, id, variables }) => {
    const path = getPath(resource);
    const { data } = await axiosInstance.patch(`${path}/${id}`, variables);
    return { data };
  },

  deleteOne: async ({ resource, id }) => {
    const path = getPath(resource);
    await axiosInstance.patch(`${path}/${id}`, { is_active: false });
    return { data: { id } as any };
  },

  getApiUrl: () => API_URL,
};
