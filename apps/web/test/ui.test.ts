import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import AsyncState from "../src/components/AsyncState.vue";
import StatusBadge from "../src/components/StatusBadge.vue";
import Pagination from "../src/components/Pagination.vue";
import Login from "../src/pages/Login.vue";
import FormDialog from "../src/components/FormDialog.vue";
import { api, ApiError, setCsrfToken } from "../src/api/client";
import { accessRedirect } from "../src/router";
import { checkinPayload } from "../src/composables/forms";
import { useAuth } from "../src/stores/auth";
// jsdom lacks native dialog methods. Real dialog/focus behavior is covered by Chromium E2E.
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setCsrfToken(null);
  document.body.innerHTML = "";
});
describe("元件狀態與操作", () => {
  it("呈現 Loading 並在完成後呈現內容", async () => {
    const w = mount(AsyncState, {
      props: { loading: true },
      slots: { default: "真實資料" },
    });
    expect(w.get("[role=status]").text()).toContain("正在同步");
    expect(w.text()).not.toContain("真實資料");
    await w.setProps({ loading: false });
    expect(w.text()).toContain("真實資料");
  });
  it("錯誤訊息與重試事件", async () => {
    const w = mount(AsyncState, {
      props: { loading: false, error: "API unavailable" },
    });
    expect(w.get("[role=alert]").text()).toContain("API unavailable");
    await w.get("button").trigger("click");
    expect(w.emitted("retry")).toHaveLength(1);
  });
  it("空狀態不顯示假資料", () => {
    const w = mount(AsyncState, { props: { loading: false, empty: true } });
    expect(w.text()).toContain("沒有符合條件");
  });
  it("狀態名稱可讀且不僅依顏色", () => {
    expect(
      mount(StatusBadge, { props: { status: "MAINTENANCE" } }).text(),
    ).toBe("維修中");
  });
  it("分頁邊界與下一頁事件", async () => {
    const w = mount(Pagination, { props: { page: 1, total: 21 } });
    expect(w.get('[aria-label="上一頁"]').attributes("disabled")).toBeDefined();
    await w.get('[aria-label="下一頁"]').trigger("click");
    expect(w.emitted("update:page")).toEqual([[2]]);
    await w.setProps({ page: 2 });
    expect(w.get('[aria-label="下一頁"]').attributes("disabled")).toBeDefined();
  });
  it("故障歸還驗證拒絕空白故障描述", () => {
    expect(() =>
      checkinPayload({ condition: "DAMAGED", description: "  " }),
    ).toThrow("故障描述");
    expect(checkinPayload({ condition: "GOOD", notes: "" }).condition).toBe(
      "GOOD",
    );
  });
  it("Dialog API 失敗時保持開啟、保留輸入並呈現錯誤", async () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
      function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    );
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
    const submit = vi.fn().mockRejectedValue(new Error("設備已被領用"));
    const w = mount(FormDialog, { attachTo: document.body });
    await w.vm.open({
      title: "確認",
      fields: [{ key: "notes", label: "備註" }],
      onSubmit: submit,
    });
    await w.get("input").setValue("keep me");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("設備已被領用");
    expect(w.get("dialog").attributes("open")).toBeDefined();
    expect((w.get("input").element as HTMLInputElement).value).toBe("keep me");
    w.unmount();
  });
});
describe("API Client", () => {
  it("初次未登入不觸發到期提示；已登入的401才觸發Session到期事件", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: "UNAUTHENTICATED", message: "請先登入" },
            }),
            { status: 401 },
          ),
        ),
      ),
    );
    await expect(api("/auth/session")).rejects.toMatchObject({ status: 401 });
    expect(dispatch).not.toHaveBeenCalled();
    setCsrfToken("known-session");
    await expect(api("/assets")).rejects.toMatchObject({ status: 401 });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "session-expired" }),
    );
  });
  it("傳送 Cookie credentials 與 CSRF，從伺服器讀回資料", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "db-id" }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    setCsrfToken("session-csrf");
    expect(
      await api("/assets", { method: "POST", body: { name: "Asset" } }),
    ).toEqual({ id: "db-id" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/assets",
      expect.objectContaining({
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-Token": "session-csrf" }),
      }),
    );
  });
  it("保留 API 409 錯誤，不顯示假成功", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: "CONFLICT", message: "已借出" } }),
            { status: 409 },
          ),
        ),
    );
    await expect(api("/assignments", { method: "POST" })).rejects.toMatchObject(
      { status: 409, code: "CONFLICT", message: "已借出" },
    );
  });
  it("網路中斷給出可讀訊息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(api("/assets")).rejects.toBeInstanceOf(ApiError);
  });
});
describe("路由與登入表單", () => {
  it("未登入、Viewer 管理員路由與已登入登入頁導向", () => {
    expect(
      accessRedirect({ path: "/assets", fullPath: "/assets", meta: {} }, null),
    ).toEqual({ path: "/login", query: { redirect: "/assets" } });
    expect(
      accessRedirect(
        { path: "/users", fullPath: "/users", meta: { admin: true } },
        { role: "VIEWER" },
      ),
    ).toBe("/");
    expect(
      accessRedirect(
        { path: "/login", fullPath: "/login", meta: {} },
        { role: "ADMIN" },
      ),
    ).toBe("/");
    expect(
      accessRedirect(
        { path: "/assets", fullPath: "/assets", meta: {} },
        { role: "VIEWER" },
      ),
    ).toBe(true);
  });
  it("登入表單使用必填 email/password，登入失敗呈現 API 訊息", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuth();
    vi.spyOn(auth, "login").mockRejectedValue(
      new ApiError(401, "INVALID_CREDENTIALS", "帳號或密碼不正確"),
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/login", component: Login }],
    });
    await router.push("/login");
    const w = mount(Login, { global: { plugins: [pinia, router] } });
    expect(w.get("#email").attributes("type")).toBe("email");
    expect(w.get("#email").attributes("required")).toBeDefined();
    expect(w.get("#password").attributes("autocomplete")).toBe(
      "current-password",
    );
    await w.get("#email").setValue("user@example.test");
    await w.get("#password").setValue("wrong");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("帳號或密碼不正確");
    expect(router.currentRoute.value.path).toBe("/login");
  });
});
