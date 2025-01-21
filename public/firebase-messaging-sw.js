importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB-oOp_rQ6RrzLU3C9VKX7KdzKw6arj9xY",
  authDomain: "kl-eats.firebaseapp.com",
  projectId: "kl-eats",
  storageBucket: "kl-eats.firebasestorage.app",
  messagingSenderId: "288126510969",
  appId: "1:288126510969:web:6dfff551e3b01c5c2ff1a8",
  measurementId: "G-3JG81ZE51M"
});

const messaging = firebase.messaging();

// Preload the audio file
let audio = null;

// Function to ensure audio is loaded
async function ensureAudioLoaded() {
  if (!audio) {
    audio = new Audio('/sounds/notification.mp3');
    await audio.load(); // Preload the audio
  }
  return audio;
}

// Function to play sound
async function playNotificationSound() {
  try {
    const sound = await ensureAudioLoaded();
    sound.currentTime = 0; // Reset to start
    await sound.play();
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

messaging.onBackgroundMessage(async (payload) => {
  console.log('Received background message:', payload);

  // Use the actual notification data from the payload
  const notificationTitle = payload.notification.title || 'Order Received';
  const notificationOptions = {
    body: payload.notification.body || 'New order waiting to be dispatched',
    icon: '/images/file.png',
    badge: '/images/file.png',
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    // Preload the audio file during service worker installation
    ensureAudioLoaded()
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/admin_view_dispatch_orders')
  );
}); 