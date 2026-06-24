const MINI_MODE_RETURN_ROUTE_KEY = 'currentRoute';
const MINI_MODE_PENDING_ROUTE_KEY = 'miniModePendingRoute';

export const rememberMiniModeReturnRoute = (fullPath: string) => {
  localStorage.removeItem(MINI_MODE_PENDING_ROUTE_KEY);
  localStorage.setItem(MINI_MODE_RETURN_ROUTE_KEY, fullPath);
};

export const requestMiniModeNavigation = (targetRoute: string) => {
  localStorage.setItem(MINI_MODE_PENDING_ROUTE_KEY, targetRoute);
};

// 迷你模式退出时优先跳转到用户在迷你窗里新触发的目标页；
// 如果没有新的跳转意图，再退回进入迷你模式前保存的页面上下文。
export const consumeMiniModeRestoreRoute = () => {
  const pendingRoute = localStorage.getItem(MINI_MODE_PENDING_ROUTE_KEY);
  if (pendingRoute) {
    localStorage.removeItem(MINI_MODE_PENDING_ROUTE_KEY);
    localStorage.removeItem(MINI_MODE_RETURN_ROUTE_KEY);
    return pendingRoute;
  }

  const returnRoute = localStorage.getItem(MINI_MODE_RETURN_ROUTE_KEY);
  if (returnRoute) {
    localStorage.removeItem(MINI_MODE_RETURN_ROUTE_KEY);
  }
  return returnRoute;
};
