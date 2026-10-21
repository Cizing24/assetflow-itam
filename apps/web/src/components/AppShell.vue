<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Layers,
  LayoutDashboard,
  Package,
  Users,
  ArrowLeftRight,
  Wrench,
  LogOut,
  ClipboardCheck,
  ScrollText,
  UserCog,
  Menu,
  X,
  ChevronRight,
} from "@lucide/vue";
import { roleLabels } from "@assetflow/shared";
import { useAuth } from "../stores/auth";
const auth = useAuth(),
  route = useRoute(),
  router = useRouter(),
  mobileOpen = ref(false),
  error = ref("");
const links = [
  { path: "/", label: "工作總覽", icon: LayoutDashboard, exact: true },
  { path: "/assets", label: "資產管理", icon: Package },
  { path: "/assignments", label: "領用與歸還", icon: ArrowLeftRight },
  { path: "/maintenance", label: "維修工作台", icon: Wrench },
  { path: "/employees", label: "員工目錄", icon: Users },
  { path: "/offboarding", label: "離職交接", icon: ClipboardCheck },
  { path: "/audit", label: "操作紀錄", icon: ScrollText },
];
async function logout() {
  try {
    await auth.logout();
    await router.push("/login");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "登出失敗";
  }
}
</script>
<template>
  <div class="app-layout">
    <a class="skip-link" href="#main">跳至主要內容</a>
    <div
      v-if="mobileOpen"
      class="sidebar-backdrop"
      @click="mobileOpen = false"
    />
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <RouterLink to="/" class="brand" @click="mobileOpen = false">
        <span class="brand-symbol"><Layers :size="22" /></span>AssetFlow<span
          class="brand-dot"
          >.</span
        > </RouterLink
      ><button
        class="mobile-close icon-button"
        aria-label="關閉導覽"
        @click="mobileOpen = false"
      >
        <X :size="20" />
      </button>
      <div class="workspace-label">
        <span class="workspace-avatar">A</span>
        <div><strong>企業工作空間</strong><small>IT 資產管理平台</small></div>
        <span class="live-dot" />
      </div>
      <span class="nav-heading">WORKSPACE</span>
      <nav aria-label="主導覽">
        <RouterLink
          v-for="link in links"
          :key="link.path"
          :to="link.path"
          :class="{
            active: link.exact
              ? route.path === link.path
              : route.path.startsWith(link.path),
          }"
          @click="mobileOpen = false"
        >
          <component :is="link.icon" :size="19" /><span>{{
            link.label
          }}</span> </RouterLink
        ><RouterLink
          v-if="auth.isAdmin"
          to="/users"
          :class="{ active: route.path === '/users' }"
          @click="mobileOpen = false"
        >
          <UserCog :size="19" /><span>使用者管理</span>
        </RouterLink>
      </nav>
      <div class="sidebar-note">
        <span class="live-dot" /><strong>每次流轉，都有跡可循</strong>
        <p>集中管理設備，保留完整歷史。<br />為團隊的每一天做好準備。</p>
      </div>
      <div class="profile">
        <span class="avatar">{{ auth.user?.name.slice(0, 1) }}</span>
        <div>
          <strong>{{ auth.user?.name }}</strong
          ><small>{{ auth.user ? roleLabels[auth.user.role] : "" }}</small>
        </div>
        <button class="icon-button" aria-label="登出" @click="logout">
          <LogOut :size="18" />
        </button>
      </div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <button
          class="mobile-menu icon-button"
          aria-label="開啟導覽"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = !mobileOpen"
        >
          <Menu :size="22" />
        </button>
        <div class="breadcrumbs">
          <span>{{ route.meta.section }}</span
          ><ChevronRight :size="14" /><strong>{{ route.meta.title }}</strong>
        </div>
        <div class="topbar-right">
          <span class="connection"><i /> 工作空間</span
          ><span class="avatar small-avatar">{{
            auth.user?.name.slice(0, 1)
          }}</span>
        </div>
      </header>
      <main id="main" tabindex="-1">
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <RouterView />
      </main>
      <footer class="app-footer">
        <span>AssetFlow · IT Asset Lifecycle Management</span
        ><span>讓資產發揮每一分價值。</span>
      </footer>
    </div>
  </div>
</template>
