// Web Push 수신 전용 서비스 워커
self.addEventListener('push', (e) => {
  const { title, body } = e.data ? e.data.json() : { title: '우리 캘린더', body: '' }
  e.waitUntil(self.registration.showNotification(title, { body, icon: '/favicon.svg' }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : clients.openWindow('/')))
  )
})
