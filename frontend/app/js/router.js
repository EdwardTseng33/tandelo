// router.js — hash 路由：#/s/home、#/t/prep、#/s/explain/sq-cross、#/settings

const ROLE_PREFIX = { s: 'student', p: 'parent', t: 'teacher' };

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { key: '', params: [], role: null };
  if (ROLE_PREFIX[parts[0]]) {
    return { key: `${parts[0]}/${parts[1] || ''}`, params: parts.slice(2), role: ROLE_PREFIX[parts[0]] };
  }
  return { key: parts[0], params: parts.slice(1), role: null };
}

export function homeFor(role, state) {
  if (role === 'student') return state && state.student.diag.done ? 's/home' : 's/start';
  if (role === 'parent') return 'p/line';
  if (role === 'teacher') return 't/offer';
  return 'welcome';
}

export function toHash(path) { return path.startsWith('#') ? path : `#/${path}`; }
