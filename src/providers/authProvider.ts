import type { AuthProvider } from "@refinedev/core";
import axios from "axios";

const API_URL = "https://comterback-production.up.railway.app/api/v1";

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        employee_no: username,
        password,
      });

      const { access_token, refresh_token, user } = data;

      // Solo admins y supervisores pueden acceder al panel
      if (user.role !== "admin" && user.role !== "supervisor") {
        return {
          success: false,
          error: {
            name: "Acceso denegado",
            message: "Solo administradores y supervisores pueden acceder al panel.",
          },
        };
      }

      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user", JSON.stringify(user));

      return { success: true, redirectTo: "/" };
    } catch (error: any) {
      return {
        success: false,
        error: {
          name: "Error de autenticación",
          message:
            error?.response?.data?.detail ||
            "Número de empleado o contraseña incorrectos",
        },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem("access_token");
    if (token) return { authenticated: true };
    return { authenticated: false, redirectTo: "/login" };
  },

  getPermissions: async () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.role;
  },

  getIdentity: async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) return null;
    return {
      id:     user.id,
      name:   user.name,
      avatar: undefined,
      role:   user.role,
    };
  },

  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },
};
