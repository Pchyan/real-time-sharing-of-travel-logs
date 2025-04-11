// 請在這裡貼上您從 Firebase 控制台複製的設定程式碼
// 例如：
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCkGU-ZRLjaPnhEkMpd9GZImMMOPTO7hyY", // 請保留您貼上的真實值
  authDomain: "real-time-sharing.firebaseapp.com", // 請保留您貼上的真實值
  databaseURL: "https://real-time-sharing-default-rtdb.firebaseio.com", // 如果您主要用 Firestore，這行可以移除或保留
  projectId: "real-time-sharing", // 請保留您貼上的真實值
  storageBucket: "real-time-sharing.firebasestorage.app", // 請保留您貼上的真實值
  messagingSenderId: "541248625192", // 請保留您貼上的真實值
  appId: "1:541248625192:web:c161957735f6e2173db31d", // 請保留您貼上的真實值
  measurementId: "G-39EZPWVGRX" // 如果您目前不需要 Analytics，這行可以移除
};


// --- 使用 Compat SDK 初始化 Firebase ---

// 宣告全域變數以便其他腳本使用
let db;
let auth;

try {
  // 檢查 firebase 物件是否存在 (由 compat SDK 提供)
  if (typeof firebase !== 'undefined') {
    // 初始化 Firebase App
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Compat SDK Initialized successfully!");

    // 根據您啟用的服務取得實例
    // 請確認您在 Firebase 控制台啟用了 Firestore 和 Authentication

    // 取得 Realtime Database 實例
    db = firebase.database();
    console.log("Realtime Database instance obtained.");

    // 取得 Auth 實例
    auth = firebase.auth();
    console.log("Auth instance obtained.");

    // 如果您需要 Realtime Database:
    // const rtdb = firebase.database();
    // console.log("Realtime Database instance obtained.");

    // 如果您需要 Analytics (需在 index.html 加入對應的 compat sdk):
    // if (firebase.analytics) {
    //   firebase.analytics();
    //   console.log("Firebase Analytics enabled.");
    // }

  } else {
    console.error("Firebase Compat SDK is not loaded. Check script tags in index.html.");
  }

} catch (error) {
  console.error("Firebase initialization failed:", error);
  // 可以在這裡顯示錯誤訊息給使用者
}

// --- 清理掉舊的或不必要的程式碼 ---
// (原本 Modular SDK 的 import 和初始化已被移除)
// (原本重複的 Compat 初始化已被移除)
// (原本註解掉的 db = firebase.firestore() 和 auth = firebase.auth() 已被啟用並移至 try 區塊)


// --- 重要 --- 
// 請務必將上面註解中的 YOUR_... 替換成您真實的 Firebase 設定值
// 並確保 firebase.initializeApp(firebaseConfig); 這一行有被執行
// (Firebase 提供的程式碼片段通常會包含這行) 