import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useAuth } from './stores/auth';
export function accessRedirect(to: Pick<RouteLocationNormalized, 'path' | 'meta' | 'fullPath'>, user: { role: string } | null) {
  if (!user && to.path !== '/login') return { path: '/login', query: { redirect: to.fullPath } };
  if (user && to.path === '/login') return '/';
  if (to.meta.admin && user?.role !== 'ADMIN') return '/';
  return true;
}
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/login', component: () => import('./pages/Login.vue') },
  { path: '/', component: () => import('./components/AppShell.vue'), children: [
    { path: '', component: () => import('./pages/Dashboard.vue'), meta: { title: '總覽', section: '工作空間' } },
    { path: 'assets', component: () => import('./pages/Assets.vue'), meta: { title: '資產管理', section: '資產生命週期' } },
    { path: 'assets/:id', component: () => import('./pages/AssetDetail.vue'), meta: { title: '資產詳情', section: '資產生命週期' } },
    { path: 'employees', component: () => import('./pages/Employees.vue'), meta: { title: '員工目錄', section: '人員與交接' } },
    { path: 'employees/:id', component: () => import('./pages/EmployeeDetail.vue'), meta: { title: '員工詳情', section: '人員與交接' } },
    { path: 'assignments', component: () => import('./pages/Assignments.vue'), meta: { title: '領用與歸還', section: '資產生命週期' } },
    { path: 'maintenance', component: () => import('./pages/Maintenance.vue'), meta: { title: '維修工作台', section: '資產生命週期' } },
    { path: 'offboarding', component: () => import('./pages/Offboarding.vue'), meta: { title: '離職交接', section: '人員與交接' } },
    { path: 'audit', component: () => import('./pages/Audit.vue'), meta: { title: '操作紀錄', section: '管理與稽核' } },
    { path: 'users', component: () => import('./pages/Users.vue'), meta: { title: '使用者管理', section: '管理與稽核', admin: true } },
    { path: ':pathMatch(.*)*', component: () => import('./pages/NotFound.vue'), meta: { title: '找不到頁面' } },
  ] },
] });
router.beforeEach(async to => { const auth = useAuth(); if (!auth.ready) await auth.restore(); return accessRedirect(to, auth.user); });
if (typeof window !== 'undefined') window.addEventListener('session-expired', () => { const auth = useAuth(); auth.clear(); if (router.currentRoute.value.path !== '/login') void router.replace({ path: '/login', query: { expired: '1' } }); });
