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
  
  // Play sound first
  await playNotificationSound();

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/images/file.png',
    badge: '/images/file.png',
    silent: true, // We handle the sound manually
    vibrate: [200, 100, 200],
    data: {
      click_action: '/admin_view_dispatch_orders'
    },
    requireInteraction: true // Keep notification until user interacts
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