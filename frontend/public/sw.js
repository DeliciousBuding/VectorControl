// Service Worker for VectorControl
// 缓存策略：Cache First for static, Network First for API

const CACHE_NAME = 'vectorcontrol-v1';
const STATIC_CACHE = 'vectorcontrol-static-v1';
const API_CACHE = 'vectorcontrol-api-v1';

// 静态资源缓存列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('vectorcontrol-') && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过Vite开发服务器相关请求
  if (url.pathname.includes('/@vite/') || 
      url.pathname.includes('/@fs/') ||
      url.pathname.includes('/src/')) {
    event.respondWith(fetch(request));
    return;
  }

  // API请求 - Network First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // 静态资源 - Cache First
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 其他请求 - 直接网络请求
  event.respondWith(fetch(request));
});

// 判断是否为静态资源
function isStaticAsset(request) {
  const url = new URL(request.url);
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// 处理静态资源请求 - Cache First
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // 后台更新缓存
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {});
    return cached;
  }

  // 缓存未命中，从网络获取
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// 处理API请求 - Network First with Cache Fallback
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  const url = new URL(request.url);

  // 尝试从网络获取
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // 缓存成功的响应
      const responseToCache = networkResponse.clone();

      // 根据API类型设置不同的缓存时间
      const cacheDuration = getCacheDuration(url.pathname);

      const headers = new Headers(responseToCache.headers);
      headers.set('x-sw-cached', 'true');
      headers.set('x-sw-cache-time', new Date().toISOString());
      headers.set('x-sw-cache-duration', String(cacheDuration));

      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      cache.put(request, cachedResponse);
      return networkResponse;
    }

    return networkResponse;
  } catch (error) {
    // 网络失败，尝试从缓存获取
    const cached = await cache.match(request);

    if (cached) {
      // 检查缓存是否过期
      const cacheTime = cached.headers.get('x-sw-cache-time');
      const cacheDuration = parseInt(cached.headers.get('x-sw-cache-duration') || '0', 10);

      if (cacheTime && cacheDuration > 0) {
        const age = Date.now() - new Date(cacheTime).getTime();
        if (age < cacheDuration) {
          console.log('[SW] Serving cached API response:', url.pathname);
          return cached;
        }
      }
    }

    // 缓存未命中或已过期，返回错误
    throw error;
  }
}

// 根据API路径获取缓存时长（毫秒）
function getCacheDuration(pathname) {
  // 基金详情 - 缓存5分钟
  if (pathname.includes('/funds/') && pathname.includes('/full')) {
    return 5 * 60 * 1000;
  }

  // 收益曲线 - 缓存10分钟
  if (pathname.includes('/charts/')) {
    return 10 * 60 * 1000;
  }

  // 持仓估值 - 缓存1分钟（数据变化频繁）
  if (pathname.includes('/estimate')) {
    return 60 * 1000;
  }

  // 交易记录 - 缓存5分钟
  if (pathname.includes('/transactions')) {
    return 5 * 60 * 1000;
  }

  // 其他API - 缓存2分钟
  return 2 * 60 * 1000;
}

// 后台同步（用于离线提交的数据）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-holdings') {
    event.waitUntil(syncHoldings());
  }
});

async function syncHoldings() {
  // 实现离线数据同步逻辑
  console.log('[SW] Syncing holdings...');
}

// 推送通知支持
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'VectorControl', {
      body: data.body || '您有新的通知',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data,
    })
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
