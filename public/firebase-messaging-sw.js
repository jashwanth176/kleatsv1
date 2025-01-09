importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB-oOp_rQ6RrzLU3C9VKX7KdzKw6arj9xY",
  authDomain: "kl-eats.firebaseapp.com",
  projectId: "kl-eats",
  storageBucket: "kl-eats.firebasestorage.app",
  messagingSenderId: "288126510969",
  appId: "1:288126510969:web:b149f480c894dd1e2ff1a8",
  measurementId: "G-6GSMC0MBKB"
});

const messaging = firebase.messaging();

// Create audio context in the service worker
const audioContext = new AudioContext();
const audioElement = new Audio('/sounds/notification.mp3');

messaging.onBackgroundMessage(async (payload) => {
  console.log('Received background message:', payload);
  
  try {
    // Play sound
    await audioElement.play();
  } catch (error) {
    console.error('Error playing sound:', error);
  }

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/images/file.png',
    badge: '/images/file.png',
    silent: true, // Important: we're handling the sound manually
    data: {
      click_action: '/admin_view_dispatch_orders'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const payload = event.data?.json() ?? {
    title: 'Default Title',
    body: 'Default message'
  };

  const options = {
    body: payload.notification.body,
    icon: '/images/file.png',
    badge: '/images/file.png',
    vibrate: [200, 100, 200],
    data: {
      click_action: '/admin_view_dispatch_orders'
    },
    // Remove sound from here as it doesn't work in service worker
  };

  event.waitUntil(
    self.registration.showNotification(payload.notification.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/admin_view_dispatch_orders')
  );
}); 