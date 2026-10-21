import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CurrentUser } from "@assetflow/shared";
import { api, ApiError, setCsrfToken } from "../api/client";
interface AuthResponse {
  user: CurrentUser;
  csrfToken: string;
}
export const useAuth = defineStore("auth", () => {
  const user = ref<CurrentUser | null>(null),
    ready = ref(false);
  const canWrite = computed(
    () => user.value?.role === "ADMIN" || user.value?.role === "IT_STAFF",
  );
  const isAdmin = computed(() => user.value?.role === "ADMIN");
  function accept(data: AuthResponse) {
    user.value = data.user;
    setCsrfToken(data.csrfToken);
    ready.value = true;
  }
  async function restore() {
    try {
      accept(await api<AuthResponse>("/auth/session"));
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      user.value = null;
      ready.value = true;
    }
  }
  async function login(email: string, password: string) {
    accept(
      await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    );
  }
  function clear() {
    user.value = null;
    setCsrfToken(null);
    ready.value = true;
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    clear();
  }
  return { user, ready, canWrite, isAdmin, restore, login, logout, clear };
});
