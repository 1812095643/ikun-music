import request from '@/utils/request';

// 获取用户信息
// /user/account
export function getUserDetail() {
  return request.get('/user/account');
}

// 退出登录
// /logout
export function logout() {
  return request.get('/logout');
}
