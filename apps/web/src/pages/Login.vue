<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ArrowUpRight, Layers, ShieldCheck, Workflow } from "@lucide/vue";
import { useAuth } from "../stores/auth";
const email = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref("");
const auth = useAuth(),
  router = useRouter(),
  route = useRoute();
async function login() {
  busy.value = true;
  error.value = "";
  try {
    await auth.login(email.value, password.value);
    const redirect = route.query.redirect;
    await router.replace(
      typeof redirect === "string" &&
        redirect.startsWith("/") &&
        !redirect.startsWith("//")
        ? redirect
        : "/",
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : "登入失敗";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="login-layout">
    <section class="login-story">
      <a href="/" class="brand"
        ><span class="brand-symbol"><Layers :size="22" /></span>AssetFlow<span
          class="brand-dot"
          >.</span
        ></a
      >
      <div>
        <span class="eyebrow light">IT ASSET LIFECYCLE MANAGEMENT</span>
        <h1>每一項設備，<br>都有清楚的下一步。</h1>
        <p>
          從第一天領用，到最後一次交接。<br>讓企業資產的每個流轉，都值得信任。
        </p>
        <div class="lifecycle-visual">
          <span>入庫</span><i /><span>領用</span><i /><span>歸還</span
          ><i /><span>再出發 <ArrowUpRight :size="16" /></span>
        </div>
      </div>
      <div class="login-foot">
        <ShieldCheck :size="18" /> 安全權限管理
        <Workflow :size="18" /> 完整流轉紀錄
      </div>
    </section>
    <section class="login-form-area">
      <form class="login-form" @submit.prevent="login">
        <span class="eyebrow">WELCOME TO YOUR WORKSPACE</span>
        <h2>登入工作空間</h2>
        <p class="muted">讓資產管理井然有序，從這裡開始。</p>
        <div v-if="route.query.expired" class="notice" role="status">
          登入狀態已到期，請重新登入。
        </div>
        <div class="field">
          <label for="email">電子郵件</label
          ><input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            placeholder="you@company.com"
          >
        </div>
        <div class="field">
          <label for="password">密碼</label
          ><input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            maxlength="128"
            placeholder="輸入你的密碼"
          >
        </div>
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <button class="btn full" :disabled="busy">
          {{ busy ? "正在驗證…" : "登入 AssetFlow" }}<ArrowUpRight :size="18" />
        </button>
        <p class="login-help">
          請使用管理員提供的帳號。<br>隔離展示環境的帳號與設定方式請參閱
          README。
        </p>
      </form>
      <span class="login-copyright"
        >AssetFlow · Built for a better workday.</span
      >
    </section>
  </main>
</template>
