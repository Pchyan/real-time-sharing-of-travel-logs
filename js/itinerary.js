/* ------------------------
 * 旅行記錄應用 - UI/UX Enhanced
 * ------------------------ */
console.log("itinerary.js loaded (UI/UX Enhanced Version)");

// *** 主題選擇功能 ***
function setupThemeToggle() {
    const themeSelect = document.getElementById('theme-select');
    const htmlElement = document.documentElement;
    
    // 檢查 localStorage 中儲存的主題偏好
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-theme', savedTheme);
    
    // 設置選擇器的預設值為已儲存的主題
    if (themeSelect) {
        themeSelect.value = savedTheme;
        
        // 監聽主題變更
        themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value;
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            console.log(`主題已切換至: ${newTheme}`);
            showNotification(`已套用${themeSelect.options[themeSelect.selectedIndex].text}`, 'success', 2000);
        });
    } else {
        console.warn("找不到主題選擇器元素");
    }
}

// *** 通知系統優化 ***
function showNotification(message, type = 'info', duration = 5000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;
    
    // 清除任何現有通知
    notificationArea.innerHTML = '';
    notificationArea.style.display = 'block';
    
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `alert ${type}`;
    notification.setAttribute('role', 'alert');
    
    // 加入適當的圖示
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="fa-solid fa-circle-check"></i> '; break;
        case 'error': icon = '<i class="fa-solid fa-circle-exclamation"></i> '; break;
        case 'warning': icon = '<i class="fa-solid fa-triangle-exclamation"></i> '; break;
        default: icon = '<i class="fa-solid fa-circle-info"></i> ';
    }
    
    notification.innerHTML = `${icon}${message}`;
    notificationArea.appendChild(notification);
    
    // 設定自動關閉計時器
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notificationArea.style.display = 'none';
            }, 300);
        }, duration);
    }
}

// *** 連線狀態顯示優化 ***
function updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    statusElement.className = isOnline ? 'badge online' : 'badge offline';
    statusElement.textContent = isOnline ? '線上' : '離線';
    
    console.log(`Firebase Realtime Database: ${isOnline ? 'Online' : 'Offline'}`);
}

// *** DOM 載入後初始化 UI 增強功能 ***
document.addEventListener('DOMContentLoaded', function() {
    setupThemeToggle();
    
    // 原有程式碼繼續執行...
});

// 等待 DOM 完全載入
document.addEventListener('DOMContentLoaded', () => {
    console.log("itinerary.js loaded (UI/UX Improvements Version)");

    // 檢查 Firebase Realtime Database 是否已初始化
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof firebase.database === 'undefined') {
        console.error("Firebase or Realtime Database is not initialized correctly.");
        // 初始化的錯誤比較嚴重，還是用 alert
        alert("無法連接到資料庫，請重新載入頁面或稍後再試。");
        return;
    }

    // *** 修改：延遲註冊 Quill 模組 ***
    setTimeout(() => {
        try {
            // 註冊字型
            const Font = Quill.import('formats/font');
            const fontNames = ['sans-serif', 'serif', 'monospace', 'noto-sans-tc', 'noto-serif-tc'];
            Font.whitelist = fontNames;
            Quill.register(Font, true);
            console.log("Quill Font module registered.");

        } catch (error) {
            console.error("Failed to register Quill modules:", error);
            showNotification("初始化編輯器模組失敗。", "error");
        }
    }, 0); // 使用 0 毫秒延遲，讓瀏覽器有機會完成其他任務

    // --- 全域變數 ---
    let activeTripId = null;
    let itineraryListenerRef = null;
    let notificationTimeout = null; // 用於追蹤通知消失的計時器
    let sortableInstance = null; // *** 新增：SortableJS 實例 ***
    let isOnline = true; // *** 新增：假設初始在線 ***
    let pendingWritesCount = 0; // *** 新增：待同步計數器 ***
    const SAVED_TRIPS_KEY = 'savedTrips'; // localStorage key for saved trips
    const LAST_TRIP_KEY = 'lastActiveTripId'; // localStorage key for last trip
    const IMGBB_API_KEY_STORAGE_KEY = 'imgbbApiKey'; // localStorage Key

    // *** 新增：獲取筆記 Modal 相關元素 ***
    const notesModal = document.getElementById('notes-modal');
    const notesEditorContainer = document.getElementById('notes-editor'); // Quill 將附加到這裡
    const saveNotesBtn = document.getElementById('save-notes-btn');
    const cancelNotesBtn = document.getElementById('cancel-notes-btn');
    const notesItemIdInput = document.getElementById('notes-item-id');

    // *** 新增：Quill 編輯器實例變數 ***
    let quill = null;
    // *** 新增：追蹤筆記是否有未儲存的變更 ***
    let notesChangedSinceLoad = false;

    // --- 取得 HTML 元素 ---
    // 行程管理區
    const tripNameInput = document.getElementById('trip-name');
    const createTripBtn = document.getElementById('create-trip-btn');
    const tripIdInput = document.getElementById('trip-id-input');
    const loadTripBtn = document.getElementById('load-trip-btn');
    const currentTripIdSpan = document.getElementById('current-trip-id');
    const currentTripNameSpan = document.getElementById('current-trip-name'); // *** 新增 ***
    const savedTripsSelect = document.getElementById('saved-trips-select'); // *** 新增 ***
    const deleteSelectedTripBtn = document.getElementById('delete-selected-trip-btn'); // *** 新增 ***
    const itineraryContentDiv = document.getElementById('itinerary-content');
    const loadingIndicator = document.getElementById('loading-indicator'); // *** 新增 ***
    const notificationArea = document.getElementById('notification-area'); // *** 新增 ***

    // QR Code 相關元素
    const scanQrBtn = document.getElementById('scan-qr-btn'); // *** 新增 ***
    const toggleQrCodeBtn = document.getElementById('toggle-qrcode-btn');
    const qrCodeContainer = document.getElementById('qrcode-container');

    // QR Code 掃描 Modal 元素
    const scanModal = document.getElementById('scan-modal'); // *** 新增 ***
    const scanVideo = document.getElementById('scan-video'); // *** 新增 ***
    const scanCanvas = document.getElementById('scan-canvas'); // *** 新增 ***
    const scanCanvasContext = scanCanvas.getContext('2d'); // *** 新增 ***
    const cancelScanBtn = document.getElementById('cancel-scan-btn'); // *** 新增 ***
    const scanFeedback = document.getElementById('scan-feedback'); // *** 新增 ***

    // 行程內容區
    const itineraryForm = document.getElementById('itinerary-form');
    const itineraryList = document.getElementById('itinerary-list');

    // 編輯 Modal 元素
    const editModal = document.getElementById('edit-item-modal');
    const editForm = document.getElementById('edit-itinerary-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editItemIdInput = document.getElementById('edit-item-id');
    const editItemDateInput = document.getElementById('edit-item-date');
    const editItemTypeInput = document.getElementById('edit-item-type');
    const editItemDescriptionInput = document.getElementById('edit-item-description');
    const editItemLocationInput = document.getElementById('edit-item-location');
    const editItemCostInput = document.getElementById('edit-item-cost');

    // 連線狀態元素
    const connectionStatusSpan = document.getElementById('connection-status');
    const pendingWritesIndicator = document.getElementById('pending-writes-indicator');

    // *** 新增：獲取設定 Modal 相關元素 ***
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const imgbbApiKeyInput = document.getElementById('imgbb-api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn'); // 已在 form submit 中處理
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

    // *** 新增：獲取拍照 Modal 相關元素 ***
    const cameraModal = document.getElementById('camera-modal');
    const cameraView = document.getElementById('camera-view');
    const cameraCanvas = document.getElementById('camera-canvas');
    const cameraFeedback = document.getElementById('camera-feedback');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');

    // --- 全域變數 ---
    let currentCameraStream = null; // *** 新增：追蹤目前相機流 ***

    // --- 通知函式 ---
    function showNotification(message, type = 'success') { // type 可以是 'success' 或 'error'
        if (notificationTimeout) {
            clearTimeout(notificationTimeout); // 清除之前的計時器
        }
        
        // *** 根據類型選擇圖示 ***
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = '<i class="fa-solid fa-check-circle"></i> ';
        } else if (type === 'error') {
            iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i> ';
        }
        
        // *** 設定包含圖示的內容 ***
        notificationArea.innerHTML = iconHtml + message; 
        notificationArea.className = ''; // 清除舊 class
        notificationArea.classList.add(type); // 添加新 class
        notificationArea.style.display = 'block';
        notificationArea.style.opacity = 1; // 確保顯示

        // 設定一段時間後自動消失
        notificationTimeout = setTimeout(() => {
            notificationArea.style.opacity = 0;
            // 等待淡出動畫結束後再隱藏
            setTimeout(() => {
                notificationArea.style.display = 'none';
            }, 500); // 配合 CSS transition 的時間
        }, 3000); // 顯示 3 秒
    }

    // --- 待同步操作 UI 更新 --- 
    function updatePendingWritesUI() {
        if (pendingWritesCount > 0 && !isOnline) {
            // 加上圖示
            pendingWritesIndicator.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> (${pendingWritesCount} 項待同步)`; 
            pendingWritesIndicator.style.display = 'inline';
        } else {
            pendingWritesIndicator.style.display = 'none';
        }
    }

    // --- 增加待同步計數器 --- 
    function incrementPendingWrites() {
        if (!isOnline) {
            pendingWritesCount++;
            updatePendingWritesUI();
            console.log("Pending writes incremented:", pendingWritesCount);
        }
    }

    // --- 連線狀態監聽 --- 
    function setupConnectionListener() {
        const connectedRef = firebase.database().ref(".info/connected");
        connectedRef.on("value", (snap) => {
            isOnline = !!snap.val();
            updateConnectionStatus(isOnline); // 使用新的連線狀態顯示函式
            
            if (isOnline && pendingWritesCount > 0) {
                console.log("重新連線，擱置的寫入操作將被同步。");
                pendingWritesCount = 0; // 在線上時重置計數器
                updatePendingWritesUI();
            }
        });
    }

    // --- 行程管理事件監聽 ---

    createTripBtn.addEventListener('click', () => {
        const tripName = tripNameInput.value.trim();
        tripNameInput.classList.remove('input-error'); // 清除舊的錯誤樣式
        if (!tripName) {
            showNotification("請輸入行程名稱！", 'error');
            tripNameInput.classList.add('input-error'); // 高亮輸入框
            tripNameInput.focus(); // 聚焦輸入框
            return;
        }
        createNewTrip(tripName);
    });

    loadTripBtn.addEventListener('click', () => {
        const tripIdToLoad = tripIdInput.value.trim();
        tripIdInput.classList.remove('input-error'); // 清除舊的錯誤樣式
        if (!tripIdToLoad) {
            showNotification("請輸入要載入的行程 ID！", 'error');
            tripIdInput.classList.add('input-error'); // 高亮輸入框
            tripIdInput.focus(); // 聚焦輸入框
            return;
        }
        loadTrip(tripIdToLoad);
    });

    // --- 行程操作函式 ---

    function createNewTrip(name) {
        console.log(`嘗試建立新行程: ${name}`);
        // *** 禁用按鈕 ***
        createTripBtn.disabled = true;
        createTripBtn.setAttribute('aria-busy', 'true'); // Pico.css 載入狀態

        const tripsRef = db.ref('trips');
        const newTripRef = tripsRef.push();
        const newTripId = newTripRef.key;
        const tripMetadata = {
            name: name,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        newTripRef.child('metadata').set(tripMetadata)
            .then(() => {
                console.log(`新行程建立成功，ID: ${newTripId}`);
                showNotification(`新行程 "${name}" 建立成功！`, 'success');
                tripNameInput.value = '';
                // *** 直接設定當前名稱並儲存 ***
                currentTripNameSpan.textContent = name; 
                saveTripInfo(newTripId, name);
                loadTripData(newTripId); // 載入其他資料並設定監聽
            })
            .catch((error) => {
                console.error("建立新行程時發生錯誤: ", error);
                showNotification("建立行程失敗，請稍後再試。", 'error');
            })
            .finally(() => {
                 // *** 啟用按鈕 ***
                 createTripBtn.disabled = false;
                 createTripBtn.removeAttribute('aria-busy');
            });
    }

    function loadTrip(tripId) {
        console.log(`嘗試載入行程 ID: ${tripId}`);
        const tripRef = db.ref(`trips/${tripId}`);
        // *** 禁用按鈕和輸入框，設置載入狀態 ***
        loadingIndicator.style.display = 'inline';
        loadTripBtn.disabled = true;
        loadTripBtn.setAttribute('aria-busy', 'true'); // Pico.css 載入狀態
        tripIdInput.disabled = true;
        scanQrBtn.disabled = true; // 同時禁用掃描按鈕
        savedTripsSelect.disabled = true; // 禁用下拉選單
        deleteSelectedTripBtn.disabled = true; // 禁用刪除按鈕

        tripRef.get().then((snapshot) => {
            if (snapshot.exists()) {
                const tripData = snapshot.val();
                const tripName = tripData.metadata?.name || '未命名行程'; // 安全地獲取名稱
                console.log(`行程 ${tripId} (${tripName}) 存在，開始載入資料...`);
                showNotification(`已載入行程: ${tripName}`, 'success');
                tripIdInput.value = '';
                // *** 儲存行程資訊 ***
                saveTripInfo(tripId, tripName); 
                // *** 載入資料 (包含設定名稱) ***
                loadTripData(tripId, tripName); 
            } else {
                console.warn(`行程 ID: ${tripId} 不存在。`);
                showNotification(`找不到行程 ID: ${tripId}，請確認 ID 是否正確。`, 'error');
                if (localStorage.getItem(LAST_TRIP_KEY) === tripId) {
                    localStorage.removeItem(LAST_TRIP_KEY);
                    console.log('已清除無效的 lastActiveTripId');
                }
                // 同時檢查並從已存列表中移除無效ID
                removeSavedTrip(tripId);
            }
        }).catch((error) => {
            console.error("載入行程 metadata 時發生錯誤: ", error);
            showNotification("載入行程時發生錯誤，請稍後再試。", 'error');
        }).finally(() => {
            // *** 啟用按鈕和輸入框，移除載入狀態 ***
            loadingIndicator.style.display = 'none';
            loadTripBtn.disabled = false;
            loadTripBtn.removeAttribute('aria-busy');
            tripIdInput.disabled = false;
            scanQrBtn.disabled = false; // 啟用掃描按鈕
            savedTripsSelect.disabled = false; // 啟用下拉選單
            // 刪除按鈕狀態由下拉選單決定，這裡不用改
            if (savedTripsSelect.value) {
                 deleteSelectedTripBtn.disabled = false;
            }
        });
    }

    function loadTripData(tripId, tripName) {
        activeTripId = tripId;
        currentTripIdSpan.textContent = activeTripId;
        currentTripNameSpan.textContent = tripName; // *** 設定行程名稱 ***
        console.log(`目前作用中: ${tripName} (${activeTripId})`);

        try {
            localStorage.setItem(LAST_TRIP_KEY, activeTripId);
            console.log(`已將 ${activeTripId} 儲存到 localStorage (${LAST_TRIP_KEY})`);
        } catch (e) {
            console.warn("無法儲存 lastActiveTripId 到 localStorage: ", e);
        }

        toggleQrCodeBtn.style.display = 'inline-block';
        qrCodeContainer.innerHTML = '';
        qrCodeContainer.style.display = 'none';
        itineraryList.innerHTML = '<li>載入中...</li>';
        setupItineraryListener(activeTripId);
        itineraryContentDiv.style.display = 'block';
    }

    // 清除目前行程的顯示和狀態
    function clearCurrentTripDisplay() {
         activeTripId = null;
         currentTripIdSpan.textContent = '尚未載入';
         currentTripNameSpan.textContent = '';
         itineraryContentDiv.style.display = 'none';
         toggleQrCodeBtn.style.display = 'none';
         qrCodeContainer.innerHTML = '';
         qrCodeContainer.style.display = 'none';
         // 移除舊的監聽器 (如果存在)
         if (itineraryListenerRef) {
            itineraryListenerRef.off('value');
            itineraryListenerRef = null;
            console.log("已移除行程監聽器 (clear display)");
         }
         itineraryList.innerHTML = ''; // 清空列表
    }

    // --- QR Code 相關 ---
    toggleQrCodeBtn.addEventListener('click', () => {
        if (qrCodeContainer.style.display === 'none') {
            if (activeTripId) {
                qrCodeContainer.innerHTML = '';
                try {
                    new QRCode(qrCodeContainer, {
                        text: activeTripId,
                        width: 128,
                        height: 128,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });
                    qrCodeContainer.style.display = 'block';
                    console.log(`已產生行程 ID ${activeTripId} 的 QR Code`);
                    toggleQrCodeBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>'; // 切換為隱藏圖示
                } catch (error) {
                    console.error("產生 QR Code 時發生錯誤: ", error);
                    // alert("產生 QR Code 失敗。");
                    showNotification("產生 QR Code 失敗。", 'error'); // *** 修改 ***
                }
            } else {
                // alert("尚未載入行程，無法產生 QR Code。");
                showNotification("尚未載入行程，無法產生 QR Code。", 'error'); // *** 修改 ***
            }
        } else {
            qrCodeContainer.style.display = 'none';
            qrCodeContainer.innerHTML = '';
            console.log("隱藏 QR Code");
            toggleQrCodeBtn.innerHTML = '<i class="fa-solid fa-qrcode"></i>'; // 切換回顯示圖示
        }
    });

    // --- QR Code 掃描相關 --- 
    let mediaStream = null;
    let rafId = null;

    scanQrBtn.addEventListener('click', startScan);
    cancelScanBtn.addEventListener('click', stopScan);

    // 開始掃描
    function startScan() {
        console.log("開始掃描 QR Code");
        
        // 使用 dialog 的 showModal 方法打開 Modal (新版)
        if (scanModal.showModal) {
            scanModal.showModal();
        } else {
            // 舊版顯示方式 (保留相容性)
            scanModal.style.display = 'block';
        }
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                .then(function(stream) {
                    scanVideo.srcObject = stream;
                    scanVideo.setAttribute("playsinline", true); // iOS 需要
                    scanVideo.play();
                    
                    // 定時執行掃描
                    scanInterval = setInterval(tick, 100);
                    
                    console.log("掃描相機已啟動");
                })
                .catch(function(error) {
                    console.error("無法存取相機: ", error);
                    
                    if (error.name === 'NotAllowedError') {
                        alert("無法啟動掃描功能：相機權限被拒絕。請在瀏覽器設定中允許相機存取。");
                    } else if (error.name === 'NotFoundError') {
                        alert("無法啟動掃描功能：找不到相機裝置。");
                    } else {
                        alert(`無法啟動掃描功能：${error.message}`);
                    }
                    
                    stopScan();
                });
        } else {
            alert("很抱歉，您的裝置不支援相機存取功能，無法使用 QR Code 掃描。");
            stopScan();
        }
    }

    // QR 掃描處理函數
    function tick() {
        // 檢查視訊是否已準備好
        if (!scanVideo || !scanVideo.videoWidth) return;
        
        // 調整畫布大小以匹配視訊
        if (scanCanvas.width !== scanVideo.videoWidth) {
            scanCanvas.width = scanVideo.videoWidth;
            scanCanvas.height = scanVideo.videoHeight;
        }
        
        // 將視訊畫面繪製到畫布上
        scanCanvasContext.drawImage(scanVideo, 0, 0, scanCanvas.width, scanCanvas.height);
        
        // 取得影像資料
        const imageData = scanCanvasContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        
        try {
            // 使用 jsQR 分析影像中的 QR Code
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            // 如果找到 QR Code
            if (qrCode) {
                console.log("QR Code 掃描成功:", qrCode.data);
                
                // 停止掃描
                stopScan();
                
                // 將掃描結果填入 tripId 輸入欄位
                if (qrCode.data && qrCode.data.trim()) {
                    const tripIdInput = document.getElementById('trip-id-input');
                    if (tripIdInput) {
                        tripIdInput.value = qrCode.data.trim();
                        // 提示使用者
                        const feedback = document.getElementById('scan-feedback');
                        if (feedback) {
                            feedback.textContent = "已掃描到 QR Code!";
                        }
                        
                        showNotification("QR Code 掃描成功，請點擊「載入」按鈕載入行程", "success");
                    }
                } else {
                    showNotification("掃描到的 QR Code 沒有包含有效資料", "error");
                }
            }
        } catch (error) {
            console.error("QR Code 掃描處理錯誤:", error);
            showNotification("QR Code 處理發生錯誤", "error");
            stopScan();
        }
    }

    function stopScan() {
        console.log("停止掃描");
        if (scanVideo.srcObject) {
            const tracks = scanVideo.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            scanVideo.srcObject = null;
        }
        
        // 關閉舊版 scan-modal div 模式
        if (scanModal.style) {
            scanModal.style.display = "none";
        }
        
        // 關閉新版 dialog 模式
        if (scanModal.close) {
            scanModal.close();
        }
        
        scanInterval = null;
    }

    // --- 行程項目相關 ---

    function setupItineraryListener(tripId) {
        if (itineraryListenerRef) {
            itineraryListenerRef.off('value');
            console.log("已移除舊的行程監聽器。");
        }
        // *** 如果 SortableJS 實例存在，先銷毀 ***
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
            console.log("已銷毀舊的 SortableJS 實例。");
        }

        // 設定新的監聽路徑，並按照 order 排序
        const currentItineraryRef = db.ref(`trips/${tripId}/itineraries`).orderByChild('order'); // *** 修改排序欄位 ***
        itineraryListenerRef = currentItineraryRef;
        console.log(`開始監聽路徑: trips/${tripId}/itineraries，按 order 排序`);

        itineraryListenerRef.on('value', (snapshot) => {
            console.log("行程項目資料更新 (來自 Realtime DB)");
            itineraryList.innerHTML = ''; // 清空列表
            const itemsArray = []; // 用於儲存原始順序的陣列

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    itemsArray.push({ key: childSnapshot.key, data: childSnapshot.val() });
                });

                // *** 使用索引迴圈來渲染列表，以便處理項目間的按鈕 ***
                for (let i = 0; i < itemsArray.length; i++) {
                    const itemObj = itemsArray[i];
                    const key = itemObj.key;
                    const item = itemObj.data;
                    const listItem = document.createElement('li');
                    listItem.setAttribute('data-id', key);
                    
                    // --- 渲染列表項目內容 (與之前相同) ---
                    const textSpan = document.createElement('span');
                    const displayDateTime = item.dateTime ? new Date(item.dateTime).toLocaleString('zh-TW') : '未設定時間';
                    textSpan.textContent = `[${displayDateTime}] ${item.type}: ${item.description} ${item.location ? '('+item.location+')' : ''} ${item.cost ? '- 約 $'+item.cost : ''}`;
                    listItem.appendChild(textSpan);
                    const buttonGroup = document.createElement('div');
                    const notesBtn = document.createElement('button');
                    notesBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
                    notesBtn.title = '編輯筆記';
                    notesBtn.classList.add('secondary'); // 使用次要按鈕樣式
                    notesBtn.addEventListener('click', () => { openNotesModal(key); });
                    buttonGroup.appendChild(notesBtn);
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>'; // 使用編輯圖示
                    editBtn.title = '編輯項目'; // 添加 title
                    editBtn.addEventListener('click', () => { editItineraryItem(key); });
                    buttonGroup.appendChild(editBtn);
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>'; // 使用刪除圖示
                    deleteBtn.title = '刪除項目'; // 添加 title
                    deleteBtn.addEventListener('click', () => { deleteItineraryItem(key); });
                    buttonGroup.appendChild(deleteBtn);
                    listItem.appendChild(buttonGroup);
                    itineraryList.appendChild(listItem);
                    // --- 列表項目內容渲染結束 ---

                    // *** 檢查是否有下一個項目，並添加路線規劃按鈕 ***
                    if (i < itemsArray.length - 1) {
                        const nextItemObj = itemsArray[i+1];
                        const currentLocation = item.location?.trim(); // 安全取值並去除空白
                        const nextLocation = nextItemObj.data.location?.trim();

                        // 檢查兩個地點是否都有效
                        if (currentLocation && nextLocation) {
                            const directionsDiv = document.createElement('div');
                            directionsDiv.className = 'directions-link-container'; // 用於 CSS styling
                            
                            const mapsLink = document.createElement('a');
                            // 構建 Google Maps Directions URL
                            const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(currentLocation)}&destination=${encodeURIComponent(nextLocation)}`;
                            mapsLink.href = url;
                            mapsLink.target = '_blank'; // 在新分頁開啟
                            mapsLink.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> 規劃路線至下一站 (${nextLocation})`; 
                            mapsLink.className = 'pico-button pico-button-outline pico-button-sm'; // 使用 Pico 按鈕樣式 (可自訂)
                            mapsLink.style.width = '100%'; // 讓按鈕填滿寬度
                            mapsLink.style.textAlign = 'center';
                            mapsLink.style.marginTop = '0.25rem';
                            mapsLink.style.marginBottom = '0.75rem';

                            directionsDiv.appendChild(mapsLink);
                            itineraryList.appendChild(directionsDiv); // 將按鈕(容器)加到 ul 中 li 之後
                        } else {
                             // 如果其中一個地點缺失，可以選擇顯示提示或不顯示按鈕
                             console.log(`項目 ${key} 或下一個項目缺少地點資訊，無法生成路線連結。`);
                        }
                    }
                }

                // *** 初始化 SortableJS ***
                if (!sortableInstance && typeof Sortable !== 'undefined') {
                    sortableInstance = new Sortable(itineraryList, {
                        animation: 150, // 拖曳動畫毫秒數
                        ghostClass: 'sortable-ghost', // 拖曳時佔位符樣式
                        chosenClass: 'sortable-chosen', // 選中項樣式
                        onEnd: function (evt) {
                            // 拖曳結束後更新順序
                            console.log("拖曳結束，舊索引:", evt.oldIndex, "新索引:", evt.newIndex);
                            updateOrderAfterSort();
                        },
                    });
                    console.log("SortableJS 初始化完成。");
                } else if (typeof Sortable === 'undefined') {
                    console.warn("Sortable library is not loaded.");
                }

            } else {
                itineraryList.innerHTML = '<li>此行程尚無項目，快來新增吧！</li>';
                 // 如果列表為空，也要確保銷毀 Sortable 實例
                 if (sortableInstance) {
                    sortableInstance.destroy();
                    sortableInstance = null;
                 }
            }
        }, (error) => {
            console.error(`監聽 trips/${tripId}/itineraries 時發生錯誤: `, error);
            // 這裡的錯誤比較技術性，可能還是保留 console 或用通知
            // itineraryList.innerHTML = '<li>讀取行程項目時發生錯誤。</li>';
             showNotification("讀取行程項目時發生錯誤，可能需要檢查權限或網路。", 'error');
            if (itineraryListenerRef === currentItineraryRef) {
                itineraryListenerRef = null;
            }
        });
    }

    // *** 新增：拖曳結束後更新 Firebase 中的 order ***
    function updateOrderAfterSort() {
        if (!activeTripId) return;

        const items = itineraryList.querySelectorAll('li[data-id]');
        if (items.length === 0) return; // 如果列表為空則不處理

        const updates = {};
        items.forEach((item, index) => {
            const itemId = item.getAttribute('data-id');
            if (itemId) {
                // 建立要更新的路徑和新的 order 值 (索引)
                updates[`/trips/${activeTripId}/itineraries/${itemId}/order`] = index;
            }
        });

        console.log("準備更新 order:", updates);

        incrementPendingWrites(); // *** 在寫入前檢查並增加計數 ***

        db.ref().update(updates)
            .then(() => {
                console.log("行程項目順序更新成功。");
                // 數據會透過 on('value') 重新觸發渲染，理論上會保持新順序
                // showNotification("順序已儲存", 'success'); // 可選：給用戶提示
            })
            .catch((error) => {
                console.error("更新行程項目順序時發生錯誤: ", error);
                showNotification("儲存順序失敗，請稍後再試。", 'error');
                // 注意：這裡如果更新失敗，前端的顯示可能與後端不一致
                // 可能需要重新觸發一次監聽器來恢復顯示，或者提示使用者重新整理
            });
    }

    function editItineraryItem(itemId) {
        if (!activeTripId) return;
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
        itemRef.get().then((snapshot) => {
            if (snapshot.exists()) {
                const currentItem = snapshot.val();
                editItemIdInput.value = itemId;
                editItemDateInput.value = currentItem.dateTime || '';
                editItemTypeInput.value = currentItem.type || '';
                editItemDescriptionInput.value = currentItem.description || '';
                editItemLocationInput.value = currentItem.location || '';
                editItemCostInput.value = currentItem.cost || 0;
                editModal.style.display = 'block';
            } else {
                 showNotification(`找不到要編輯的項目 ${itemId}`, 'error');
            }
        }).catch(error => {
             console.error(`讀取項目 ${itemId} 資料時發生錯誤: `, error);
             showNotification("讀取項目資料失敗。", 'error');
        });
    }

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemIdToUpdate = editItemIdInput.value;
        if (!itemIdToUpdate || !activeTripId) {
            console.error("無法更新：缺少行程 ID 或項目 ID");
            return;
        }
        // *** 禁用儲存和取消按鈕 ***
        const submitButton = editForm.querySelector('button[type="submit"]');
        const cancelButton = editForm.querySelector('#cancel-edit-btn');
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true'); // Pico.css 載入狀態
        cancelButton.disabled = true; // 避免在儲存過程中取消

        const updatedData = {
            dateTime: editItemDateInput.value,
            type: editItemTypeInput.value,
            description: editItemDescriptionInput.value.trim(),
            location: editItemLocationInput.value.trim(),
            cost: editItemCostInput.value ? parseFloat(editItemCostInput.value) : 0
        };
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemIdToUpdate}`);
        
        incrementPendingWrites(); // *** 在寫入前檢查並增加計數 ***

        itemRef.update(updatedData)
            .then(() => {
                 showNotification("項目更新成功！", 'success');
                closeEditModal();
            })
            .catch((error) => {
                console.error(`更新項目 ${itemIdToUpdate} 時發生錯誤: `, error);
                 showNotification("更新失敗，請稍後再試。", 'error');
            })
            .finally(() => {
                 // *** 啟用按鈕 ***
                 submitButton.disabled = false;
                 submitButton.removeAttribute('aria-busy');
                 cancelButton.disabled = false;
            });
    });

    function closeEditModal() {
        editModal.style.display = 'none';
        editForm.reset();
        editItemIdInput.value = '';
    }

    function deleteItineraryItem(itemId) {
        if (!activeTripId) return;
        // 使用 confirm 仍然比較直觀，暫不替換
        if (confirm("確定要刪除這個行程項目嗎？")) {
            const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
            
            incrementPendingWrites(); // *** 在寫入前檢查並增加計數 ***
            
            itemRef.remove()
                .then(() => {
                     showNotification("項目已刪除。", 'success');
                })
                .catch((error) => {
                    console.error(`刪除項目 ${itemId} 時發生錯誤: `, error);
                     showNotification("刪除失敗，請稍後再試。", 'error');
                });
        } else {
            console.log("使用者取消刪除。");
        }
    }

    itineraryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 基本驗證 (描述是必填的)
        const descriptionInput = document.getElementById('item-description');
        descriptionInput.classList.remove('input-error');
        if (!descriptionInput.value.trim()) {
            showNotification("請輸入行程描述！", 'error');
            descriptionInput.classList.add('input-error');
            descriptionInput.focus();
            return;
        }
        
        if (!activeTripId) {
            showNotification("請先建立或載入一個行程！", 'error');
            return;
        }
        
        const submitButton = itineraryForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
        
        const newItem = {
            dateTime: document.getElementById('item-date').value,
            type: document.getElementById('item-type').value,
            description: descriptionInput.value.trim(),
            location: document.getElementById('item-location').value.trim(),
            cost: document.getElementById('item-cost').value ? parseFloat(document.getElementById('item-cost').value) : 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            order: firebase.database.ServerValue.TIMESTAMP
        };
        
        const currentItineraryRef = db.ref(`trips/${activeTripId}/itineraries`);
        
        if (!isOnline) {
            incrementPendingWrites();
        }
        
        currentItineraryRef.push(newItem)
            .then(() => {
                showNotification("行程項目已新增！", 'success');
                itineraryForm.reset();
                descriptionInput.classList.remove('input-error');
            })
            .catch((error) => {
                console.error(`新增行程項目到 ${activeTripId} 時發生錯誤: `, error);
                 showNotification("新增項目失敗，請稍後再試。", 'error');
            })
            .finally(() => {
                submitButton.disabled = false;
                 submitButton.removeAttribute('aria-busy');
            });
    });

    // --- LocalStorage 操作 --- 
    function loadSavedTrips() {
        try {
            const saved = localStorage.getItem(SAVED_TRIPS_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("讀取已存行程列表時發生錯誤: ", e);
            return {}; // 出錯時返回空物件
        }
    }

    function saveTripInfo(tripId, tripName) {
        if (!tripId || !tripName) return;
        const savedTrips = loadSavedTrips();
        savedTrips[tripId] = tripName; // 新增或更新
        try {
            localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips));
            console.log(`已儲存行程資訊: ${tripId} - ${tripName}`);
            populateSavedTripsDropdown(); // 更新下拉選單
        } catch (e) {
            console.error("儲存行程列表時發生錯誤: ", e);
        }
    }

    function removeSavedTrip(tripId) {
        if (!tripId) return;
        const savedTrips = loadSavedTrips();
        if (savedTrips[tripId]) {
            delete savedTrips[tripId];
            try {
                localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips));
                console.log(`已從儲存列表移除行程: ${tripId}`);
                showNotification("已從列表移除選定行程", 'success');
                // 如果刪除的是最後使用的 ID，也從 localStorage 移除
                if (localStorage.getItem(LAST_TRIP_KEY) === tripId) {
                    localStorage.removeItem(LAST_TRIP_KEY);
                    console.log("同時移除了 lastActiveTripId");
                }
                populateSavedTripsDropdown(); // 更新下拉選單
                // 清空輸入框，因為參照可能已消失
                tripIdInput.value = ''; 
            } catch (e) {
                console.error("移除行程時儲存列表失敗: ", e);
                 showNotification("移除行程時發生錯誤", 'error');
            }
        }
    }

    // --- 下拉選單處理 --- 
    function populateSavedTripsDropdown() {
        const savedTrips = loadSavedTrips();
        const tripIds = Object.keys(savedTrips);

        savedTripsSelect.innerHTML = ''; // 清空選項

        if (tripIds.length === 0) {
            savedTripsSelect.innerHTML = '<option value="">-- 無已存行程 --</option>';
            deleteSelectedTripBtn.disabled = true;
        } else {
            savedTripsSelect.innerHTML = '<option value="">-- 請選擇 --</option>'; // 加入預設選項
            tripIds.forEach(tripId => {
                const option = document.createElement('option');
                option.value = tripId;
                option.textContent = `${savedTrips[tripId]} (${tripId.substring(0, 6)}...)`; // 顯示名稱和部分ID
                savedTripsSelect.appendChild(option);
            });
            // 初始狀態下不選中任何項目，刪除按鈕禁用
            deleteSelectedTripBtn.disabled = true; 
        }
    }

    // *** 新增：更新刪除按鈕狀態函數 ***
    function updateDeleteButtonState() {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            tripIdInput.value = selectedTripId; // 將選中ID填入輸入框
            deleteSelectedTripBtn.disabled = false; // 啟用刪除按鈕
        } else {
            tripIdInput.value = ''; // 清空輸入框
            deleteSelectedTripBtn.disabled = true; // 禁用刪除按鈕
        }
    }

    // *** 新增：刪除選定行程函數 ***
    function deleteSelectedTrip() {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            removeSavedTrip(selectedTripId);
        }
    }

    // 監聽下拉選單變化
    savedTripsSelect.addEventListener('change', () => {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            tripIdInput.value = selectedTripId; // 將選中ID填入輸入框
            deleteSelectedTripBtn.disabled = false; // 啟用刪除按鈕
        } else {
            tripIdInput.value = ''; // 清空輸入框
            deleteSelectedTripBtn.disabled = true; // 禁用刪除按鈕
        }
    });

    // 監聽刪除按鈕點擊
    deleteSelectedTripBtn.addEventListener('click', () => {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            removeSavedTrip(selectedTripId);
        }
    });

    // --- 筆記 Modal 相關函式 ---
    function openNotesModal(itemId) {
        console.log(`準備開啟筆記 Modal，項目 ID: ${itemId}`);
        notesItemIdInput.value = itemId;

        // *** 測試：先嘗試打開 Modal ***
        try {
            notesModal.showModal(); 
            console.log("已嘗試呼叫 notesModal.showModal()");
        } catch (e) {
            console.error("呼叫 notesModal.showModal() 時出錯:", e);
            showNotification("無法開啟筆記視窗", "error");
            return; // 如果打不開就直接返回
        }

        // 1. 初始化 Quill (如果尚未初始化)
        if (!quill) {
            try {
                 quill = new Quill(notesEditorContainer, {
                    modules: {
                        toolbar: {
                            container: [
                                [{ 'header': [1, 2, 3, false] }],
                                [{ 'font': Quill.import('formats/font').whitelist || [] }], 
                                [{ 'size': ['small', false, 'large', 'huge'] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                [{ 'script': 'sub'}, { 'script': 'super' }],
                                [{ 'indent': '-1'}, { 'indent': '+1' }],
                                [{ 'direction': 'rtl' }],
                                [{ 'align': [] }],
                                ['link', 'image', 'video', 'blockquote', 'code-block'], 
                                ['clean']
                            ],
                            handlers: {
                                'image': selectLocalImage // 處理檔案選擇
                            }
                        }
                    },
                    theme: 'snow'
                });
                 console.log("Quill 編輯器已初始化 (準備手動添加拍照按鈕)"); // *** 修改 Log ***
                 addQuillToolbarTooltips(notesEditorContainer); // *** 現在由這個函式負責添加按鈕 ***
                 // ... (text-change 監聽器不變) ...
            } catch (error) {
                 console.error("初始化 Quill 編輯器實例失敗:", error);
                showNotification("無法載入筆記編輯器", "error");
                quill = null; 
                closeNotesModal(); 
                return;
            }
        }
       
        if (!quill) {
             console.error("Quill instance is null after initialization attempt.");
             showNotification("無法載入筆記編輯器", "error");
             closeNotesModal(); // 初始化失敗時關閉已開啟的 Modal
             return;
        }

        // 2. 從 Firebase 讀取現有筆記並載入
        console.log("準備從 Firebase 讀取筆記...");
        const notesPath = `trips/${activeTripId}/itineraries/${itemId}/notes`;
        db.ref(notesPath).once('value')
            .then((snapshot) => {
                console.log("Firebase 筆記讀取成功。");
                const notesHtml = snapshot.val();
                if (quill) { 
                    if (notesHtml) {
                        quill.root.innerHTML = notesHtml; 
                        console.log("已載入現有筆記");
                    } else {
                        quill.setContents([]); 
                        console.log("此項目尚無筆記，編輯器已清空。");
                    }
                    // Modal 已經在前面打開了，這裡不需要再打開
                    // notesModal.showModal(); 
                    console.log("筆記內容已載入/清空。");
                } else {
                     console.error("Quill 實例丟失，無法載入筆記內容。");
                     showNotification("無法載入筆記內容", "error");
                     closeNotesModal(); // 關閉已開啟的 Modal
                }
            })
            .catch((error) => {
                console.error(`讀取筆記失敗 (路徑: ${notesPath}):`, error);
                showNotification("讀取筆記時發生錯誤", 'error');
                // 即使讀取失敗，還是清空編輯器
                if (quill) {
                    quill.setContents([]);
                    console.log("讀取失敗，編輯器已清空。");
                } else {
                    console.error("Quill 實例丟失，無法清空編輯器。");
                }
                 // Modal 已經在前面打開了，這裡不需要再打開
                // notesModal.showModal(); 
                 closeNotesModal(); // 讀取失敗，直接關閉 Modal
            });
    }

    function closeNotesModal() {
        // *** 新增：檢查是否有未儲存的變更 ***
        console.log(`closeNotesModal: 檢查 notesChangedSinceLoad，目前值: ${notesChangedSinceLoad}`); // *** 偵錯 ***
        if (notesChangedSinceLoad) {
            if (!confirm("您有未儲存的變更，確定要關閉嗎？")) {
                console.log("使用者取消關閉 (有變更)");
                return; // 如果使用者取消，則不關閉
            }
            console.log("使用者確認關閉 (有變更)");
        }

        console.log("關閉筆記 Modal");
        notesModal.close();
        notesItemIdInput.value = '';
        // 清空 Quill 內容，避免下次開啟時看到舊資料
        if (quill) {
            quill.setContents([]);
        }
        notesChangedSinceLoad = false;
        console.log("變更標記已重設 (關閉後)");
    }

    function saveNotes() {
        const itemId = notesItemIdInput.value;
        if (!itemId || !quill) {
            console.error("無法儲存筆記：缺少項目 ID 或編輯器未初始化");
            showNotification("無法儲存筆記", 'error');
            return;
        }

        console.log(`準備儲存 ID 為 ${itemId} 的筆記`);
        const notesHtml = quill.root.innerHTML; // 獲取 HTML 內容
        const notesPath = `trips/${activeTripId}/itineraries/${itemId}/notes`;

        // 檢查離線狀態
        if (!isOnline) {
            incrementPendingWrites();
            console.log("離線狀態，增加待同步計數");
        }

        // 寫入 Firebase
        db.ref(notesPath).set(notesHtml)
            .then(() => {
                console.log(`筆記已成功儲存至 ${notesPath}`);
                showNotification("筆記已儲存");
                closeNotesModal();
            })
            .catch((error) => {
                console.error(`儲存筆記失敗 (路徑: ${notesPath}):`, error);
                showNotification("儲存筆記時發生錯誤", 'error');
                // 儲存失敗時不清空編輯器，讓使用者可以重試或複製內容
            });
    }

    // Quill 工具欄提示和相機按鈕添加
    function addQuillToolbarTooltips(editorContainer) {
        console.log("開始添加 Quill 工具欄提示和功能按鈕...");
        try {
            // 等待工具欄元素完成渲染
            setTimeout(() => {
                const toolbar = editorContainer.querySelector('.ql-toolbar');
                if (!toolbar) {
                    console.error("找不到 Quill 工具欄！");
                    return;
                }
                
                console.log("找到 Quill 工具欄，開始尋找圖片按鈕...");
                // 找到圖片按鈕
                const imageButton = toolbar.querySelector('button.ql-image');
                if (!imageButton) {
                    console.error("找不到圖片按鈕！");
                    return;
                }
                
                // 保存圖片按鈕的父元素
                const imageButtonContainer = imageButton.parentElement;
                imageButton.title = "上傳圖片";
                
                // 創建相機按鈕
                const cameraButton = document.createElement('button');
                cameraButton.className = 'ql-camera';
                cameraButton.innerHTML = '<i class="fa-solid fa-camera"></i>';
                cameraButton.title = "拍照";
                cameraButton.style.fontSize = imageButton.style.fontSize;
                cameraButton.style.width = imageButton.style.width;
                cameraButton.style.height = imageButton.style.height;
                
                // 將相機按鈕添加到圖片按鈕的父容器中
                imageButtonContainer.appendChild(cameraButton);
                
                // 給相機按鈕添加點擊事件
                cameraButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log("相機按鈕被點擊");
                    openCameraModal(); // 開啟相機模態框
                });
                
                console.log("相機按鈕已添加到工具欄");
                
                // 添加其他工具提示
                const buttons = toolbar.querySelectorAll('button');
                const tooltips = {
                    'bold': '粗體',
                    'italic': '斜體',
                    'underline': '底線',
                    'strike': '刪除線',
                    'blockquote': '引用',
                    'code-block': '程式碼區塊',
                    'link': '插入連結',
                    'video': '插入影片',
                    'clean': '清除格式'
                };
                
                buttons.forEach(button => {
                    const format = button.className.split('-')[1];
                    if (tooltips[format]) {
                        button.title = tooltips[format];
                    }
                });
                
                // 處理選擇器格式
                const selects = toolbar.querySelectorAll('select');
                const selectTooltips = {
                    'header': '標題',
                    'font': '字型',
                    'size': '字號',
                    'color': '文字顏色',
                    'background': '背景顏色',
                    'align': '對齊方式'
                };
                
                selects.forEach(select => {
                    const format = select.className.split('-')[1];
                    if (selectTooltips[format]) {
                        const span = select.parentElement.querySelector('span');
                        if (span) {
                            span.title = selectTooltips[format];
                        }
                    }
                });
                
                console.log("工具欄提示和相機按鈕設置完成");
            }, 100); // 給工具欄一點時間完成渲染
            
        } catch (error) {
            console.error("添加工具欄提示和按鈕時出錯:", error);
        }
    }

    // --- 圖片上傳相關函式 (稍後重寫為 ImgBB 版本) ---
    function selectLocalImage() {
        // 檢查是否有 ImgBB API Key
        const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
        if (!apiKey) {
            showNotification("請先在設定中輸入 ImgBB API Key 以啟用圖片上傳。", "error");
            openSettingsModal(); // 引導使用者去設定
            return;
        }
        // ... (後續選擇檔案的邏輯類似，但上傳目標改為 ImgBB API) ...
        console.log("準備使用 ImgBB 上傳..."); 
        // 暫時保留舊的 file input 邏輯框架，但 uploadImage 會被替換
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                console.log("選取的圖片:", file.name);
                const range = quill.getSelection(true);
                quill.insertText(range.index, '\n[圖片上傳中(ImgBB)...]\n', { 'color': 'grey', 'italic': true });
                quill.setSelection(range.index + '\n[圖片上傳中(ImgBB)...]\n'.length); 
                uploadImageToImgBB(file, range.index, apiKey); // *** 呼叫新的上傳函式 ***
            } else {
                console.log("未選擇檔案。");
            }
            document.body.removeChild(input);
        };

    }

    // *** 新增：上傳到 ImgBB 的函式 ***
    function uploadImageToImgBB(file, insertionIndex, apiKey) {
         console.log(`uploadImageToImgBB: Uploading ${file.name} using key ${apiKey.substring(0, 4)}...`);
         const placeholderText = '\n[圖片上傳中(ImgBB)...]\n';
         const placeholderLength = placeholderText.length;

         // 1. 使用 FileReader 將圖片轉為 Base64
         const reader = new FileReader();
         reader.onload = (e) => {
             const base64Image = e.target.result.split(',')[1]; // 取出 Base64 部分
             if (!base64Image) {
                  console.error("uploadImageToImgBB: Failed to read file as Base64.");
                  showNotification("讀取圖片檔失敗。", 'error');
                  if (quill) quill.deleteText(insertionIndex, placeholderLength); 
                  return;
             }

             // 2. 建立 FormData
             const formData = new FormData();
             formData.append('key', apiKey);
             formData.append('image', base64Image);
             // 可以選擇性地添加其他參數，例如設定圖片自動刪除時間
             // formData.append('expiration', 600); // 範例：10 分鐘後刪除
             // formData.append('name', file.name); // 可選：指定檔案名稱

             console.log("uploadImageToImgBB: Sending request to ImgBB API...");

             // 3. 使用 fetch API 發送請求
             fetch('https://api.imgbb.com/1/upload', {
                 method: 'POST',
                 body: formData
             })
             .then(response => {
                 console.log(`uploadImageToImgBB: Received response with status: ${response.status}`);
                 if (!response.ok) {
                     // 如果 HTTP 狀態碼不是 2xx，拋出錯誤以便 catch 處理
                     throw new Error(`ImgBB API Error: ${response.statusText} (Status: ${response.status})`);
                 }
                 return response.json(); // 解析 JSON 回應
             })
             .then(data => {
                 console.log("uploadImageToImgBB: ImgBB API Response Data:", data);
                 // 4. 處理回應
                 if (data.success && data.data && data.data.url) {
                     const imageUrl = data.data.url;
                     console.log("uploadImageToImgBB: Upload successful. Image URL:", imageUrl);
                     // 5. 更新 Quill 編輯器
                     if (quill) {
                         try {
                             quill.deleteText(insertionIndex, placeholderLength);
                             quill.insertEmbed(insertionIndex, 'image', imageUrl);
                             quill.setSelection(insertionIndex + 1); 
                             showNotification("圖片已透過 ImgBB 插入。", "success");
                         } catch (embedError) {
                             console.error("uploadImageToImgBB: Error deleting placeholder or embedding image:", embedError);
                             showNotification("插入圖片時出錯。", "error");
                         }
                     } else {
                         console.error("uploadImageToImgBB: Quill instance missing after upload.");
                     }
                 } else {
                     // ImgBB 返回的資料表明失敗
                     const errorMessage = data.error?.message || 'ImgBB 返回未知錯誤'
                     console.error("uploadImageToImgBB: ImgBB API reported failure:", errorMessage, data);
                     showNotification(`圖片上傳失敗: ${errorMessage}`, 'error');
                     if (quill) quill.deleteText(insertionIndex, placeholderLength); 
                 }
             })
             .catch(error => {
                 // 6. 處理 fetch 錯誤或前面拋出的錯誤
                 console.error("uploadImageToImgBB: Fetch Error or API Error:", error);
                 showNotification(`圖片上傳時發生網路或 API 錯誤: ${error.message}`, 'error');
                 if (quill) {
                      try { quill.deleteText(insertionIndex, placeholderLength); } catch(e) {}
                 }
             });
         };

         reader.onerror = (error) => {
            console.error("uploadImageToImgBB: FileReader error:", error);
            showNotification("讀取圖片檔時發生錯誤。", 'error');
            if (quill) { 
                try { quill.deleteText(insertionIndex, placeholderLength); } catch(e) {}
            }
         };

         // 開始讀取檔案
         reader.readAsDataURL(file);
         console.log("uploadImageToImgBB: Started reading file with FileReader.");
    }

    // *** 新增：設定 Modal 相關函式 ***
    function openSettingsModal() {
        console.log("開啟設定 Modal");
        const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY) || '';
        imgbbApiKeyInput.value = apiKey;
        settingsModal.showModal();
    }

    function closeSettingsModal() {
        console.log("關閉設定 Modal");
        settingsModal.close();
    }
    
    // 儲存設定
    function saveSettings(e) {
        e.preventDefault();
        const apiKey = imgbbApiKeyInput.value.trim();
        
        try {
            if (apiKey) {
                localStorage.setItem(IMGBB_API_KEY_STORAGE_KEY, apiKey);
                console.log("ImgBB API Key 已儲存");
                showNotification("設定已儲存！", 'success');
            } else {
                // 如果清空了 Key，也從 localStorage 移除
                localStorage.removeItem(IMGBB_API_KEY_STORAGE_KEY);
                console.log("已清除儲存的 ImgBB API Key");
                showNotification("已清除 ImgBB API Key 設定。", 'success');
            }
            closeSettingsModal();
        } catch (error) {
            console.error("儲存設定失敗:", error);
            showNotification("儲存設定失敗，可能是 localStorage 已滿或被禁用。", 'error');
        }
    }

    // 編輯表單提交處理
    function handleEditFormSubmit(e) {
        e.preventDefault();
        
        const itemId = editItemId.value;
        const date = editItemDate.value;
        const type = editItemType.value;
        const description = editItemDescription.value;
        const location = editItemLocation.value;
        const cost = editItemCost.value ? parseFloat(editItemCost.value) : null;
        
        // 檢查必填項
        if (!date || !type || !description) {
            showNotification("請填寫所有必填欄位", "error");
            return;
        }
        
        // 準備更新資料
        const itemData = {
            date: date,
            type: type,
            description: description,
            location: location || null,
            cost: cost
        };
        
        // 更新資料到 Firebase (如果在離線狀態，Firebase 會暫存並在重新連接時自動同步)
        if (!activeTripId) {
            showNotification("無法編輯項目：未載入行程", "error");
            return;
        }
        
        if (!isOnline) {
            incrementPendingWrites();
        }
        
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
        itemRef.update(itemData)
            .then(() => {
                console.log(`行程項目 ${itemId} 更新成功`);
                showNotification("項目已更新", "success");
                closeEditModal();
            })
            .catch(error => {
                console.error("更新行程項目失敗:", error);
                showNotification("更新項目失敗: " + error.message, "error");
            });
    }

    // --- 相機拍照相關函式 ---
    function openCameraModal() {
        console.log("開啟拍照 Modal");
        // 檢查 API Key
        const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
        if (!apiKey) {
            showNotification("請先設定 ImgBB API Key 以使用拍照功能。", "error");
            openSettingsModal();
            return;
        }
        // 檢查瀏覽器支援性
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification("您的瀏覽器不支援相機功能。", 'error');
            return;
        }
        cameraFeedback.textContent = '';
        cameraModal.showModal();
        startCameraStream();
    }

    function startCameraStream() {
        stopCameraStream(); // 先確保關閉舊的流
        cameraFeedback.textContent = '請求相機權限...';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }) // 優先使用後置鏡頭
            .then(stream => {
                console.log("相機權限獲取成功");
                currentCameraStream = stream;
                cameraView.srcObject = stream;
                cameraFeedback.textContent = '相機已啟動';
                capturePhotoBtn.disabled = false; // 啟用拍照按鈕
            })
            .catch(err => {
                console.error("無法獲取相機權限:", err);
                cameraFeedback.textContent = `無法啟動相機: ${err.name}`;
                showNotification("無法啟動相機，請檢查權限設定。", 'error');
                capturePhotoBtn.disabled = true; // 禁用拍照按鈕
                // 可以考慮短暫顯示後關閉 Modal
                // setTimeout(closeCameraModal, 3000);
            });
    }

    function stopCameraStream() {
        if (currentCameraStream) {
            currentCameraStream.getTracks().forEach(track => track.stop());
            currentCameraStream = null;
            cameraView.srcObject = null;
            console.log("相機流已停止");
        }
         capturePhotoBtn.disabled = true; // 停止後禁用拍照按鈕
    }

    function closeCameraModal() {
        console.log("關閉拍照 Modal");
        stopCameraStream(); // 關閉時停止相機
        cameraModal.close();
    }

    function capturePhoto() {
        if (!cameraView.srcObject) {
            console.warn("相機未啟動，無法拍照。");
            return;
        }
        console.log("準備拍照...");
        capturePhotoBtn.disabled = true; // 拍照中禁用按鈕
        cameraFeedback.textContent = '正在擷取畫面...';

        const context = cameraCanvas.getContext('2d');
        // 設定 Canvas 尺寸與 Video 相同
        cameraCanvas.width = cameraView.videoWidth;
        cameraCanvas.height = cameraView.videoHeight;
        // 將 Video 畫面畫到 Canvas 上
        context.drawImage(cameraView, 0, 0, cameraCanvas.width, cameraCanvas.height);

        // 將 Canvas 轉為 Blob
        cameraCanvas.toBlob((blob) => {
            if (!blob) {
                console.error("無法從 Canvas 創建 Blob。");
                showNotification("拍照失敗，無法處理圖片。", "error");
                capturePhotoBtn.disabled = false; // 重新啟用按鈕
                cameraFeedback.textContent = '拍照失敗';
                return;
            }

            console.log("照片 Blob 已創建，大小:", blob.size);
            closeCameraModal(); // 關閉拍照視窗

            // 獲取 API Key
            const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
            if (!apiKey) { /* 理論上 openCameraModal 已檢查 */ return; }

            // 插入提示並上傳
            const range = quill.getSelection(true);
            const placeholderText = '\n[拍照上傳中(ImgBB)...]\n';
            quill.insertText(range.index, placeholderText, { 'color': 'grey', 'italic': true });
            quill.setSelection(range.index + placeholderText.length); 
            
            // 為 Blob 創建一個檔案名稱
            const fileName = `capture_${Date.now()}.jpg`;
            const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });

            uploadImageToImgBB(capturedFile, range.index, apiKey); // 使用現有的上傳函式

        }, 'image/jpeg', 0.9); // 指定輸出為 JPEG 格式，品質 90%
    }

    // --- 初始狀態 ---
    function initializeApp() {
        console.log("頁面初始化完成，設定連線監聽、載入已存列表並檢查自動載入...");

        // *** 新增：在初始化早期檢查函式庫 ***
        console.log("檢查外部函式庫載入狀態...");
        if (typeof saveAs === 'function') {
            console.log("FileSaver.js (saveAs) 已載入。");
        } else {
            console.warn("FileSaver.js (saveAs) 未載入或未正確定義!");
        }
        if (typeof htmlDocx !== 'undefined') {
             console.log("html-docx-js (htmlDocx) 已載入。");
        } else {
             console.warn("html-docx-js (htmlDocx) 未載入或未正確定義!");
        }
        // *** 檢查結束 ***

        // 初始化主題設定
        setupThemeToggle();

        // 建立連線監聽與同步功能
        setupConnectionListener(); 
        populateSavedTripsDropdown(); 
        updatePendingWritesUI();

        // 必要的事件監聽器設定
        createTripBtn.addEventListener('click', createNewTrip); // 修正為正確的函數名稱
        loadTripBtn.addEventListener('click', function() {
            const tripId = tripIdInput.value.trim();
            if (tripId) loadTrip(tripId);
        });
        scanQrBtn.addEventListener('click', startScan); // 修正為正確的函數名稱
        cancelScanBtn.addEventListener('click', stopScan); // 修正為正確的函數名稱
        savedTripsSelect.addEventListener('change', updateDeleteButtonState);
        deleteSelectedTripBtn.addEventListener('click', deleteSelectedTrip);
        // 使用已有的表單處理邏輯，而不是未定義的 handleItineraryFormSubmit 函數
        itineraryForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // 基本驗證 (描述是必填的)
            const descriptionInput = document.getElementById('item-description');
            descriptionInput.classList.remove('input-error');
            if (!descriptionInput.value.trim()) {
                showNotification("請輸入行程描述！", 'error');
                descriptionInput.classList.add('input-error');
                descriptionInput.focus();
                return;
            }

            if (!activeTripId) {
                showNotification("請先建立或載入一個行程！", 'error');
                return;
            }
            const submitButton = itineraryForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');

            const newItem = {
                dateTime: document.getElementById('item-date').value,
                type: document.getElementById('item-type').value,
                description: descriptionInput.value.trim(),
                location: document.getElementById('item-location').value.trim(),
                cost: document.getElementById('item-cost').value ? parseFloat(document.getElementById('item-cost').value) : 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                order: firebase.database.ServerValue.TIMESTAMP
            };
            const currentItineraryRef = db.ref(`trips/${activeTripId}/itineraries`);
            
            if (!isOnline) {
                incrementPendingWrites();
            }

            currentItineraryRef.push(newItem)
                .then(() => {
                    showNotification("行程項目已新增！", 'success');
                    itineraryForm.reset();
                    descriptionInput.classList.remove('input-error');
                })
                .catch((error) => {
                    console.error(`新增行程項目到 ${activeTripId} 時發生錯誤: `, error);
                    showNotification("新增項目失敗，請稍後再試。", 'error');
                })
                .finally(() => {
                    submitButton.disabled = false;
                    submitButton.removeAttribute('aria-busy');
                });
        });
        // toggleQrCodeBtn.addEventListener('click', toggleQrCode); // <--- 移除此行
        
        // 表單與對話框功能
        // 編輯行程項目對話框
        cancelEditBtn.addEventListener('click', closeEditModal);
        editForm.addEventListener('submit', handleEditFormSubmit); // <-- 使用正確的變數名稱 editForm

        // 筆記對話框
        cancelNotesBtn.addEventListener('click', closeNotesModal);
        saveNotesBtn.addEventListener('click', saveNotes);

        // 設定對話框
        settingsBtn.addEventListener('click', openSettingsModal);
        cancelSettingsBtn.addEventListener('click', closeSettingsModal);
        settingsForm.addEventListener('submit', saveSettings);

        // 拍照對話框
        if (document.getElementById('cancel-camera-action-btn')) {
            document.getElementById('cancel-camera-action-btn').addEventListener('click', closeCameraModal);
        }
        if (document.getElementById('capture-photo-btn')) {
            document.getElementById('capture-photo-btn').addEventListener('click', capturePhoto);
        }

        // *** 新增：綁定匯出 DOCX 按鈕事件 ***
        const exportDocxBtn = document.getElementById('export-notes-docx-btn');
        if (exportDocxBtn) {
            exportDocxBtn.addEventListener('click', exportNotesToDocx);
        } else {
            console.warn("未找到匯出 DOCX 按鈕 (export-notes-docx-btn)");
        }

        // 檢查自動載入
        const lastTripId = localStorage.getItem('lastActiveTripId');
        if (lastTripId) {
            console.log(`發現上次儲存的行程 ID: ${lastTripId}，嘗試自動載入...`);
            tripIdInput.value = lastTripId;
            loadTrip(lastTripId);
        }

        // 掃描相關事件監聽器
        scanQrBtn.addEventListener('click', startScan); // 修正為正確的函數名稱
        cancelScanBtn.addEventListener('click', stopScan); // 修正為正確的函數名稱
        
        // 新增對 header 中關閉按鈕的監聽
        const cancelScanHeaderBtn = document.getElementById('cancel-scan-btn-header');
        if (cancelScanHeaderBtn) {
            cancelScanHeaderBtn.addEventListener('click', stopScan);
        }
    }

    initializeApp(); // 執行初始化

    // --- 匯出筆記為 DOCX --- 
    function exportNotesToDocx() {
        if (!quill) {
            console.error("無法匯出：Quill 編輯器未初始化。");
            showNotification("編輯器未載入，無法匯出筆記。", 'error');
            return;
        }
        if (typeof htmlDocx === 'undefined' || typeof saveAs === 'undefined') {
            console.error("無法匯出：html-docx-js 或 FileSaver.js 未載入。");
            showNotification("匯出功能元件未載入，請檢查網路連線或重新整理。", 'error');
            return;
        }

        try {
            console.log("開始匯出筆記為 DOCX...");
            const notesHtml = quill.root.innerHTML;
            const content = `
                <!DOCTYPE html>
                <html lang="zh-TW">
                <head>
                    <meta charset="UTF-8">
                    <title>行程筆記</title>
                    <style>
                        /* 可選：添加一些基本樣式，例如字體 */
                        body { font-family: 'Noto Sans TC', sans-serif; }
                    </style>
                </head>
                <body>
                    ${notesHtml}
                </body>
                </html>
            `;

            const converted = htmlDocx.asBlob(content);
            console.log("DOCX Blob 已產生，準備觸發下載...");

            // 從筆記 modal 或目前行程名稱獲取一個更有意義的檔名
            const itemId = notesItemIdInput.value; // 獲取目前開啟的 item ID
            let fileName = '行程筆記.docx';
            if (activeTripId && itemId) {
                // 嘗試從列表項目文字中提取部分描述 (需要 DOM 操作)
                const listItem = itineraryList.querySelector(`li[data-id="${itemId}"] span`);
                const itemText = listItem ? listItem.textContent.split(':')[1]?.trim().substring(0, 20) : `項目_${itemId.substring(itemId.length - 4)}`;
                const tripNamePart = currentTripNameSpan.textContent ? currentTripNameSpan.textContent.substring(0, 10) : activeTripId.substring(activeTripId.length - 4);
                fileName = `${tripNamePart}_${itemText}.docx`.replace(/[\\/:*?"<>|]/g, '_'); // 清理檔名中的非法字元
            } else if (currentTripNameSpan.textContent) {
                 fileName = `${currentTripNameSpan.textContent}_筆記.docx`.replace(/[\\/:*?"<>|]/g, '_');
            } 
            
            saveAs(converted, fileName);
            console.log(`檔案 ${fileName} 下載已觸發。`);
            showNotification("筆記已開始匯出為 DOCX 檔案。", 'success');

        } catch (error) {
            console.error("匯出 DOCX 時發生錯誤:", error);
            showNotification("匯出筆記失敗，請參閱控制台錯誤訊息。", 'error');
        }
    }

    // 更新刪除按鈕的狀態
    function updateDeleteButtonState() {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            tripIdInput.value = selectedTripId; // 將選中ID填入輸入框
            deleteSelectedTripBtn.disabled = false; // 啟用刪除按鈕
        } else {
            tripIdInput.value = ''; // 清空輸入框
            deleteSelectedTripBtn.disabled = true; // 禁用刪除按鈕
        }
    }

    // 刪除選定的行程
    function deleteSelectedTrip() {
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            removeSavedTrip(selectedTripId);
        }
    }
});

// --- Firestore 版本的函式 (已不再使用，保留供參考) ---
/*
function loadItineraryItems() { ... }
function setupFirestoreRealtimeListener() { ... }
db.collection('itineraries').add(newItem) { ... }
db.collection('itineraries').orderBy('date', 'asc').get() { ... }
db.collection('itineraries').orderBy('date', 'asc').onSnapshot(...) { ... }
firebase.firestore.FieldValue.serverTimestamp()
*/ 