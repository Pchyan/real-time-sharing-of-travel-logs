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
    const GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey'; // 新增 Gemini Key 的儲存鍵值

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
    // const createTripBtn = document.getElementById('create-trip-btn'); // 將在 initializeApp 中重新獲取
    const tripIdInput = document.getElementById('trip-id-input');
    const loadTripBtn = document.getElementById('load-trip-btn');
    const currentTripIdSpan = document.getElementById('current-trip-id');
    const currentTripNameSpan = document.getElementById('current-trip-name');
    const savedTripsSelect = document.getElementById('saved-trips-select');
    const deleteSelectedTripBtn = document.getElementById('delete-selected-trip-btn');
    const itineraryContentDiv = document.getElementById('itinerary-content');
    const loadingIndicator = document.getElementById('loading-indicator');
    const notificationArea = document.getElementById('notification-area');
    // AI Generation Elements
    const tripLocationInput = document.getElementById('trip-location');
    const tripDaysInput = document.getElementById('trip-days');
    const tripPreferencesInput = document.getElementById('trip-preferences');
    const tripTransportInput = document.getElementById('trip-transport');
    const tripStartDateInput = document.getElementById('trip-start-date'); // 新增：出發日期
    const tripStartTimeInput = document.getElementById('trip-start-time'); // 新增：出發時間
    const generateTripAiBtn = document.getElementById('generate-trip-ai-btn');
    const aiLoadingIndicator = document.getElementById('ai-loading-indicator');

    // QR Code 相關元素
    const scanQrBtn = document.getElementById('scan-qr-btn');
    const toggleQrCodeBtn = document.getElementById('toggle-qrcode-btn');
    const qrCodeContainer = document.getElementById('qrcode-container');

    // QR Code 掃描 Modal 元素
    const scanModal = document.getElementById('scan-modal');
    const scanVideo = document.getElementById('scan-video');
    const scanCanvas = document.getElementById('scan-canvas');
    const scanCanvasContext = scanCanvas?.getContext('2d'); // Add null check
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    const scanFeedback = document.getElementById('scan-feedback');

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

    // 設定 Modal 相關元素
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const imgbbApiKeyInput = document.getElementById('imgbb-api-key-input');
    const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

    // 拍照 Modal 相關元素
    const cameraModal = document.getElementById('camera-modal');
    const cameraView = document.getElementById('camera-view');
    const cameraCanvas = document.getElementById('camera-canvas');
    const cameraFeedback = document.getElementById('camera-feedback');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');

    // 全域變數
    let currentCameraStream = null;
    let mediaStream = null; // For QR Scanner
    let scanInterval = null; // For QR Scanner

    // --- 通知函式 ---
    function showNotification(message, type = 'success', duration = 3000) { // Add duration param
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }
        if (!notificationArea) return; // Add null check
        
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = '<i class="fa-solid fa-check-circle"></i> ';
        } else if (type === 'error') {
            iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i> ';
        } else if (type === 'warning') { // Add warning type
            iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i> ';
        }
        
        notificationArea.innerHTML = iconHtml + message; 
        notificationArea.className = 'alert'; // Reset class
        notificationArea.classList.add(type);
        notificationArea.style.display = 'block';
        notificationArea.style.opacity = 1;

        if (duration > 0) {
        notificationTimeout = setTimeout(() => {
                 if (notificationArea) {
            notificationArea.style.opacity = 0;
            setTimeout(() => {
                         if (notificationArea) notificationArea.style.display = 'none';
                     }, 500);
                 }
             }, duration);
        }
    }

    // --- 待同步操作 UI 更新 --- 
    function updatePendingWritesUI() {
        if (!pendingWritesIndicator) return; // Add null check
        if (pendingWritesCount > 0 && !isOnline) {
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
        if (typeof firebase === 'undefined' || typeof firebase.database !== 'function') return; // Add check
        const connectedRef = firebase.database().ref(".info/connected");
        connectedRef.on("value", (snap) => {
            isOnline = !!snap.val();
            updateConnectionStatus(isOnline);
            if (isOnline && pendingWritesCount > 0) {
                console.log("重新連線，擱置的寫入操作將被同步。");
                pendingWritesCount = 0;
                updatePendingWritesUI();
            }
        });
    }

    // --- 行程操作函式 ---

    function loadTrip(tripId) {
        console.log(`嘗試載入行程 ID: ${tripId}`);
        if (!tripId) {
             showNotification("無效的行程 ID。", 'error');
             return;
        }
        const tripRef = db.ref(`trips/${tripId}`);

        if(loadingIndicator) loadingIndicator.style.display = 'inline';
        if(loadTripBtn) {
        loadTripBtn.disabled = true;
            loadTripBtn.setAttribute('aria-busy', 'true');
        }
        if(tripIdInput) tripIdInput.disabled = true;
        if(scanQrBtn) scanQrBtn.disabled = true;
        if(savedTripsSelect) savedTripsSelect.disabled = true;
        if(deleteSelectedTripBtn) deleteSelectedTripBtn.disabled = true;

        tripRef.get().then((snapshot) => {
            if (snapshot.exists()) {
                const tripData = snapshot.val();
                const tripName = tripData.metadata?.name || '未命名行程';
                console.log(`行程 ${tripId} (${tripName}) 存在，開始載入資料...`);
                showNotification(`已載入行程: ${tripName}`, 'success');
                if(tripIdInput) tripIdInput.value = '';
                saveTripInfo(tripId, tripName); 
                loadTripData(tripId, tripName); 
            } else {
                console.warn(`行程 ID: ${tripId} 不存在。`);
                showNotification(`找不到行程 ID: ${tripId}，請確認 ID 是否正確。`, 'error');
                if (localStorage.getItem(LAST_TRIP_KEY) === tripId) {
                    localStorage.removeItem(LAST_TRIP_KEY);
                    console.log('已清除無效的 lastActiveTripId');
                }
                removeSavedTrip(tripId);
            }
        }).catch((error) => {
            console.error("載入行程 metadata 時發生錯誤: ", error);
            showNotification("載入行程時發生錯誤，請稍後再試。", 'error');
        }).finally(() => {
            if(loadingIndicator) loadingIndicator.style.display = 'none';
            if(loadTripBtn) {
            loadTripBtn.disabled = false;
            loadTripBtn.removeAttribute('aria-busy');
            }
            if(tripIdInput) tripIdInput.disabled = false;
            if(scanQrBtn) scanQrBtn.disabled = false;
            if(savedTripsSelect) savedTripsSelect.disabled = false;
            if (savedTripsSelect?.value && deleteSelectedTripBtn) { // Check if select has value
                 deleteSelectedTripBtn.disabled = false;
            } else if (deleteSelectedTripBtn) {
                 deleteSelectedTripBtn.disabled = true; // Ensure disabled if no selection
            }
        });
    }

    function loadTripData(tripId, tripName) {
        activeTripId = tripId;
        if(currentTripIdSpan) currentTripIdSpan.textContent = activeTripId;
        if(currentTripNameSpan) currentTripNameSpan.textContent = tripName;
        console.log(`目前作用中: ${tripName} (${activeTripId})`);

        // *** 新增：呼叫 displayTripInfo 來更新行程資訊卡 ***
        displayTripInfo(tripId, { name: tripName });

        try {
            localStorage.setItem(LAST_TRIP_KEY, activeTripId);
            console.log(`已將 ${activeTripId} 儲存到 localStorage (${LAST_TRIP_KEY})`);
        } catch (e) {
            console.warn("無法儲存 lastActiveTripId 到 localStorage: ", e);
        }

        if(toggleQrCodeBtn) toggleQrCodeBtn.style.display = 'inline-block';
        if(qrCodeContainer) {
        qrCodeContainer.innerHTML = '';
        qrCodeContainer.style.display = 'none';
        }
        if(itineraryList) itineraryList.innerHTML = '<li>載入中...</li>';
        setupItineraryListener(activeTripId);
        if(itineraryContentDiv) itineraryContentDiv.style.display = 'block';
        calculateTotalCost(); // Calculate cost when loading trip data
    }

    function clearCurrentTripDisplay() {
        activeTripId = null;
        if(currentTripIdSpan) currentTripIdSpan.textContent = '尚未載入';
        if(currentTripNameSpan) currentTripNameSpan.textContent = '';
        if(itineraryContentDiv) itineraryContentDiv.style.display = 'none';
        if(toggleQrCodeBtn) toggleQrCodeBtn.style.display = 'none';
        if(qrCodeContainer) {
         qrCodeContainer.innerHTML = '';
         qrCodeContainer.style.display = 'none';
        }
        if (itineraryListenerRef) {
            itineraryListenerRef.off('value');
            itineraryListenerRef = null;
            console.log("已移除行程監聽器 (clear display)");
        }
        if(itineraryList) itineraryList.innerHTML = '';
        if(document.getElementById('total-cost-display')) document.getElementById('total-cost-display').textContent = '--'; // Reset total cost
    }

    // --- QR Code 相關 ---
    if (toggleQrCodeBtn) {
    toggleQrCodeBtn.addEventListener('click', () => {
            if (!qrCodeContainer) return;
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
                        toggleQrCodeBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                } catch (error) {
                    console.error("產生 QR Code 時發生錯誤: ", error);
                        showNotification("產生 QR Code 失敗。", 'error');
                }
            } else {
                    showNotification("尚未載入行程，無法產生 QR Code。", 'error');
            }
        } else {
            qrCodeContainer.style.display = 'none';
            qrCodeContainer.innerHTML = '';
            console.log("隱藏 QR Code");
                toggleQrCodeBtn.innerHTML = '<i class="fa-solid fa-qrcode"></i>';
        }
    });
    }

    // --- QR Code 掃描相關 --- 
    function startScan() {
        console.log("開始掃描 QR Code");
        if (!scanModal || !scanVideo || !scanCanvas || !scanCanvasContext || !navigator.mediaDevices) {
            console.error("QR 掃描元件未正確初始化或瀏覽器不支援。");
            alert("無法啟動掃描功能。請確認您的瀏覽器支援相機存取。");
            return;
        }
        
        if (scanModal.showModal) {
            scanModal.showModal();
        } else {
            scanModal.style.display = 'block';
        }
        if (scanFeedback) scanFeedback.textContent = '請求相機權限...';
        
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                .then(function(stream) {
                mediaStream = stream; // Store stream
                    scanVideo.srcObject = stream;
                scanVideo.setAttribute("playsinline", true);
                    scanVideo.play();
                if (scanFeedback) scanFeedback.textContent = '相機已啟動，請對準 QR Code';
                scanInterval = setInterval(tick, 200); // Scan more frequently
                    console.log("掃描相機已啟動");
                })
                .catch(function(error) {
                    console.error("無法存取相機: ", error);
                if (scanFeedback) scanFeedback.textContent = `無法啟動相機: ${error.name}`;// Show error
                let alertMsg = `無法啟動掃描功能：${error.message}` ;
                    if (error.name === 'NotAllowedError') {
                    alertMsg = "無法啟動掃描功能：相機權限被拒絕。請在瀏覽器設定中允許相機存取。";
                    } else if (error.name === 'NotFoundError') {
                    alertMsg = "無法啟動掃描功能：找不到相機裝置。";
                    }
                alert(alertMsg);
                    stopScan();
                });
    }

    function tick() {
        // Ensure context exists before proceeding
        if (!scanCanvasContext || !mediaStream || !scanVideo || scanVideo.readyState !== scanVideo.HAVE_ENOUGH_DATA) return;
        
        if (scanCanvas.width !== scanVideo.videoWidth) {
            scanCanvas.width = scanVideo.videoWidth;
            scanCanvas.height = scanVideo.videoHeight;
        }
        scanCanvasContext.drawImage(scanVideo, 0, 0, scanCanvas.width, scanCanvas.height);
        const imageData = scanCanvasContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        
        try {
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (qrCode && qrCode.data) {
                console.log("QR Code 掃描成功:", qrCode.data);
                const tripIdScanned = qrCode.data.trim();
                stopScan();
                if (tripIdScanned) {
                    if (tripIdInput) {
                        tripIdInput.value = tripIdScanned;
                    }
                    if (scanFeedback) scanFeedback.textContent = "掃描成功！";
                    showNotification("QR Code 掃描成功，請點擊「載入」按鈕。", "success");
                    // Optionally auto-load
                    // loadTrip(tripIdScanned);
                } else {
                    if (scanFeedback) scanFeedback.textContent = "掃描到無效的 QR Code。";
                    showNotification("掃描到的 QR Code 沒有包含有效資料。", "error");
                }
            }
        } catch (error) {
            console.error("QR Code 掃描處理錯誤:", error);
            // Avoid showing error in loop, maybe handle outside
        }
    }

    function stopScan() {
        console.log("停止掃描");
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (scanVideo) scanVideo.srcObject = null;

        if (scanModal) {
        if (scanModal.close) {
            scanModal.close();
             } else {
                 scanModal.style.display = "none";
        }
        }
        if (scanFeedback) scanFeedback.textContent = ''; // Clear feedback
    }

    // Add listeners (moved to initializeApp)

    // --- 行程項目相關 ---
    let currentItineraryItemsData = []; // 新增：儲存當前行程數據

    function setupItineraryListener(tripId) {
        if (itineraryListenerRef) {
            itineraryListenerRef.off('value');
            console.log("已移除舊的行程監聽器。");
        }
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
            console.log("已銷毀舊的 SortableJS 實例。");
        }

        const currentItineraryRef = db.ref(`trips/${tripId}/itineraries`).orderByChild('order');
        itineraryListenerRef = currentItineraryRef;
        console.log(`開始監聽路徑: trips/${tripId}/itineraries，按 order 排序`);

        itineraryListenerRef.on('value', (snapshot) => {
            console.log("行程項目資料更新 (來自 Realtime DB)");
            if (!itineraryList) return; 
            itineraryList.innerHTML = '';
            const itemsArray = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    itemsArray.push({ key: childSnapshot.key, data: childSnapshot.val() });
                });

                 // *** 新增：更新全局變數 ***
                 currentItineraryItemsData = itemsArray;
                 console.log("currentItineraryItemsData updated:", currentItineraryItemsData);

                // Render items
                itemsArray.forEach((itemObj, index) => {
                    renderItineraryItem(itemObj.key, itemObj.data, index, itemsArray);
                });

                calculateTotalCost(); 

                // Initialize SortableJS (邏輯不變)
                if (!sortableInstance && typeof Sortable !== 'undefined') {
                    sortableInstance = new Sortable(itineraryList, {
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        chosenClass: 'sortable-chosen',
                        handle: '.drag-handle', 
                        onEnd: updateOrderAfterSort,
                    });
                    console.log("SortableJS 初始化完成。");
                } else if (typeof Sortable === 'undefined') {
                    console.warn("Sortable library is not loaded.");
                }
            } else {
                 currentItineraryItemsData = []; // 清空數據
                itineraryList.innerHTML = '<li>此行程尚無項目，快來新增吧！</li>';
                if (sortableInstance) {
                    sortableInstance.destroy();
                    sortableInstance = null;
                }
                 calculateTotalCost(); 
            }
        }, (error) => {
            console.error(`監聽 trips/${tripId}/itineraries 時發生錯誤: `, error);
             showNotification("讀取行程項目時發生錯誤。", 'error');
            if (itineraryListenerRef === currentItineraryRef) {
                itineraryListenerRef = null;
            }
        });
    }

    function renderItineraryItem(key, item, index, itemsArray) {
        if (!itineraryList) return;
                    const listItem = document.createElement('li');
                    listItem.setAttribute('data-id', key);
        listItem.classList.add('itinerary-item'); // Add class for styling

        // Drag Handle
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        listItem.appendChild(handle);

        // Item Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';

        // Type Badge
        const typeBadge = document.createElement('span');
        typeBadge.className = `item-type-badge item-type-${item.type || 'other'}`;
        typeBadge.textContent = getItemTypeDisplayName(item.type);
        contentDiv.appendChild(typeBadge);

        // Text Span
        const textSpan = document.createElement('span');
        let displayDateTime = '未定時間';
        if (item.dateTime && typeof item.dateTime === 'string' && item.dateTime.includes('T')) {
            try {
                const [datePart, timePart] = item.dateTime.split('T');
                const dateObj = new Date(datePart + 'T00:00:00'); // Create Date object just for formatting date
                const formattedDate = dateObj.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                
                // Format time part manually or with Date object (less reliable for formatting HH:MM)
                const [hour, minute] = timePart.split(':');
                // Basic AM/PM formatting
                let period = '上午';
                let displayHour = parseInt(hour);
                if (displayHour === 0) {
                    displayHour = 12;
                    period = '上午'; // Midnight
                } else if (displayHour === 12) {
                    period = '下午'; // Noon
                } else if (displayHour > 12) {
                    displayHour -= 12;
                    period = '下午';
                }
                const formattedTime = `${period} ${String(displayHour).padStart(2, ' ')}:${minute}`; // Pad hour with space for alignment if needed

                displayDateTime = `${formattedDate} ${formattedTime} (當地時間)`;
            } catch (e) {
                console.warn(`Error formatting dateTime string ${item.dateTime}:`, e);
                displayDateTime = `${item.dateTime} (格式錯誤)`; // Show raw string on error
            }
        } else if (item.dateTime) {
            displayDateTime = `${item.dateTime} (格式未知)`; // Handle cases where dateTime might exist but not in expected format
        }
        
        let itemText = `<strong>${displayDateTime}</strong> - ${item.description || '未描述'}`;
        if (item.location) itemText += ` <small>@ ${item.location}</small>`;
        if (item.cost && typeof item.cost === 'number') itemText += ` <strong class="item-cost">(約 $${item.cost.toFixed(2)})</strong>`;
        textSpan.innerHTML = itemText;
        contentDiv.appendChild(textSpan);
        listItem.appendChild(contentDiv);

        // Button Group
                    const buttonGroup = document.createElement('div');
        buttonGroup.className = 'item-actions';

                    // *** 新增：AI 建議按鈕 ***
                    const suggestBtn = document.createElement('button');
                    suggestBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                    suggestBtn.title = 'AI 建議下個地點';
                    suggestBtn.classList.add('secondary', 'outline', 'small');
                    suggestBtn.addEventListener('click', (e) => {
                        // 暫存按鈕狀態並顯示 loading
                        const originalHtml = suggestBtn.innerHTML;
                        const targetButton = e.currentTarget; // 確保操作的是被點擊的按鈕
                        targetButton.disabled = true;
                        targetButton.innerHTML = '<span class="pico-loading" aria-busy="true"></span>'; 
                        
                        handleSuggestNextStop(key)
                            .finally(() => {
                                // 無論成功或失敗，恢復按鈕狀態
                                targetButton.disabled = false;
                                targetButton.innerHTML = originalHtml;
                            });
                    });
                    buttonGroup.appendChild(suggestBtn);

                    const notesBtn = document.createElement('button');
                    notesBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
                    notesBtn.title = '編輯筆記';
        notesBtn.classList.add('secondary', 'outline', 'small');
                    notesBtn.addEventListener('click', () => { openNotesModal(key); });
                    buttonGroup.appendChild(notesBtn);

                    const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        editBtn.title = '編輯項目';
        editBtn.classList.add('secondary', 'outline', 'small');
                    editBtn.addEventListener('click', () => { editItineraryItem(key); });
                    buttonGroup.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = '刪除項目';
        deleteBtn.classList.add('contrast', 'outline', 'small');
                    deleteBtn.addEventListener('click', () => { deleteItineraryItem(key); });
                    buttonGroup.appendChild(deleteBtn);

                    listItem.appendChild(buttonGroup);
                    itineraryList.appendChild(listItem);

        // Add directions link if applicable
        renderDirectionsLink(item, index, itemsArray);
    }

    function getItemTypeDisplayName(type) {
        switch (type) {
            case 'transport': return '交通';
            case 'accommodation': return '住宿';
            case 'activity': return '活動';
            case 'food': return '餐飲';
            case 'other': return '其他';
            default: return type || '未知';
        }
    }

    function renderDirectionsLink(currentItemData, index, itemsArray) {
        if (index < itemsArray.length - 1) {
            const nextItemObj = itemsArray[index + 1];
            const currentLocation = currentItemData.location?.trim();
                        const nextLocation = nextItemObj.data.location?.trim();

                        if (currentLocation && nextLocation) {
                            const directionsDiv = document.createElement('div');
                directionsDiv.className = 'directions-link-container';
                            
                            const mapsLink = document.createElement('a');
                            const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(currentLocation)}&destination=${encodeURIComponent(nextLocation)}`;
                            mapsLink.href = url;
                mapsLink.target = '_blank';
                mapsLink.rel = 'noopener noreferrer';
                            mapsLink.innerHTML = `<i class="fa-solid fa-diamond-turn-right"></i> 規劃路線至下一站 (${nextLocation})`; 
                mapsLink.className = 'secondary outline small'; // Consistent button style

                            directionsDiv.appendChild(mapsLink);
                if (itineraryList) itineraryList.appendChild(directionsDiv);
            }
        }
    }

    function updateOrderAfterSort(evt) { // evt 參數由 SortableJS 提供
        if (!activeTripId || !itineraryList || !currentItineraryItemsData || currentItineraryItemsData.length === 0) return;

        console.log("SortableJS onEnd event triggered");

        const items = itineraryList.querySelectorAll('li[data-id]');
        if (items.length !== currentItineraryItemsData.length) {
            console.error("DOM item count does not match data count. Aborting update.");
            showNotification("更新順序時發生內部錯誤，請稍後再試。", "error");
            // 可能需要強制重新渲染或提醒使用者
            return;
        }

        const updates = {};
        const DEFAULT_INTERVAL_MS = 90 * 60 * 1000; // 90 分鐘
        let previousDateTime = null;

        // 建立一個快速查找 item data 的 Map
        const itemDataMap = new Map(currentItineraryItemsData.map(item => [item.key, item.data]));

        console.log("Starting order and time update calculation...");

        items.forEach((itemElement, index) => {
            const itemId = itemElement.getAttribute('data-id');
            if (!itemId) {
                console.warn(`Found list item without data-id at index ${index}. Skipping.`);
                return; // 跳過沒有 ID 的元素
            }

            const currentItemData = itemDataMap.get(itemId);
            if (!currentItemData) {
                console.warn(`Data for item ${itemId} not found in itemDataMap. Skipping.`);
                return; // 跳過數據丟失的項目
            }

            // 1. 更新 Order
            updates[`/trips/${activeTripId}/itineraries/${itemId}/order`] = index;
            console.log(`  - Item ${itemId} (Index ${index}): Setting order to ${index}`);

            // 2. 更新時間 (從第二個項目開始)
            if (index === 0) {
                // 第一個項目，時間不變，但記錄其時間作為下一個的基準
                previousDateTime = currentItemData.dateTime ? new Date(currentItemData.dateTime) : null;
                if (!previousDateTime) {
                    console.warn(`First item ${itemId} is missing dateTime. Subsequent times may be incorrect.`);
                    // 如果第一個項目沒有時間，可以考慮設個預設值或拋出錯誤
                    // 這裡暫時允許 previousDateTime 為 null
                }
                console.log(`  - First item ${itemId}: Time remains ${currentItemData.dateTime}. Recorded as base.`);
            } else {
                // 後續項目
                if (previousDateTime) {
                    const newDateTime = new Date(previousDateTime.getTime() + DEFAULT_INTERVAL_MS);
                    const newDateTimeString = newDateTime.toISOString().slice(0, 16); 

                    // 只有當計算出的新時間與原始時間不同時才更新
                    if (newDateTimeString !== currentItemData.dateTime) {
                        updates[`/trips/${activeTripId}/itineraries/${itemId}/dateTime`] = newDateTimeString;
                        console.log(`  - Item ${itemId}: Updating time from ${currentItemData.dateTime} to ${newDateTimeString}`);
                    } else {
                         console.log(`  - Item ${itemId}: Calculated time ${newDateTimeString} is same as original. No time update needed.`);
                    }
                    // 更新 previousDateTime 以供下一次迭代使用
                    previousDateTime = newDateTime;
                } else {
                    // 如果前一個項目沒有時間，則無法計算當前時間
                    console.warn(`  - Item ${itemId}: Previous item had no dateTime. Cannot calculate new time.`);
                     // 保持其原始時間？或者也設為 null？保持原始時間可能較好
                     previousDateTime = currentItemData.dateTime ? new Date(currentItemData.dateTime) : null; // 嘗試使用自己的時間做基準
                }
            }
        });

        // 執行批量更新
        if (Object.keys(updates).length > 0) {
            console.log("準備更新 order 和 dateTime:", updates);
            incrementPendingWrites();
            db.ref().update(updates)
                .then(() => {
                    console.log("行程項目順序和時間更新成功。");
                    showNotification("行程順序和時間已更新", "success", 2000); // 縮短成功提示時間
                })
                .catch((error) => {
                    console.error("更新行程項目順序或時間時發生錯誤: ", error);
                    showNotification("儲存順序或時間失敗。", 'error');
                });
        } else {
            console.log("No order or time changes detected to update.");
        }
    }

    function editItineraryItem(itemId) {
        if (!activeTripId || !editModal) return;
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
        itemRef.get().then((snapshot) => {
            if (snapshot.exists()) {
                const currentItem = snapshot.val();
                if (editItemIdInput) editItemIdInput.value = itemId;
                if (editItemDateInput) editItemDateInput.value = currentItem.dateTime || '';
                if (editItemTypeInput) editItemTypeInput.value = currentItem.type || '';
                if (editItemDescriptionInput) editItemDescriptionInput.value = currentItem.description || '';
                if (editItemLocationInput) editItemLocationInput.value = currentItem.location || '';
                if (editItemCostInput) editItemCostInput.value = currentItem.cost ?? ''; // Use nullish coalescing for empty value

                if (editModal.showModal) {
                   editModal.showModal();
                } else {
                   editModal.style.display = 'block'; // Fallback
                }
            } else {
                 showNotification(`找不到要編輯的項目 ${itemId}`, 'error');
            }
        }).catch(error => {
             console.error(`讀取項目 ${itemId} 資料時發生錯誤: `, error);
             showNotification("讀取項目資料失敗。", 'error');
        });
    }

    function closeEditModal() {
        if (!editModal) return;
        if (editModal.close) {
            editModal.close();
        } else {
        editModal.style.display = 'none';
    }
        if (editForm) editForm.reset();
        if (editItemIdInput) editItemIdInput.value = '';
    }
    // Add listener in initializeApp

    function deleteItineraryItem(itemId) {
        if (!activeTripId) return;
        if (confirm("確定要刪除這個行程項目嗎？相關筆記也會一併刪除。")) {
            const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
            incrementPendingWrites();
            itemRef.remove()
                .then(() => {
                     showNotification("項目已刪除。", 'success');
                     calculateTotalCost(); // Recalculate cost
                })
                .catch((error) => {
                    console.error(`刪除項目 ${itemId} 時發生錯誤: `, error);
                     showNotification("刪除失敗，請稍後再試。", 'error');
                });
        } else {
            console.log("使用者取消刪除。");
        }
    }
    // Add form submit listener in initializeApp

    // --- 計算總花費 ---
    function calculateTotalCost() {
        const totalCostDisplay = document.getElementById('total-cost-display');
        if (!itineraryList || !totalCostDisplay) {
            if(totalCostDisplay) totalCostDisplay.textContent = '--';
            return;
        }
        
        let totalCost = 0;
        const items = itineraryList.querySelectorAll('li[data-id]');
        items.forEach(itemElement => {
            // This requires reading data directly, which is inefficient.
            // It's better to calculate during the 'value' event of the listener.
            // For now, let's rely on the calculation within setupItineraryListener.
        });
         // The actual calculation happens in setupItineraryListener now.
         // This function might be redundant or could be used for manual recalculation if needed.
         console.log("calculateTotalCost called (calculation now primarily in listener).");
    }


    // --- LocalStorage 操作 --- 
    function loadSavedTrips() {
        try {
            const saved = localStorage.getItem(SAVED_TRIPS_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("讀取已存行程列表時發生錯誤: ", e);
            return {};
        }
    }

    function saveTripInfo(tripId, tripName) {
        if (!tripId || !tripName) return;
        const savedTrips = loadSavedTrips();
        savedTrips[tripId] = tripName;
        try {
            localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips));
            console.log(`已儲存行程資訊: ${tripId} - ${tripName}`);
            populateSavedTripsDropdown();
        } catch (e) {
            console.error("儲存行程列表時發生錯誤: ", e);
        }
    }

    function removeSavedTrip(tripId) {
        if (!tripId) return;
        const savedTrips = loadSavedTrips();
        if (savedTrips[tripId]) {
            const tripNameToConfirm = savedTrips[tripId];
            if (confirm(`確定要從瀏覽器儲存列表中移除行程 "${tripNameToConfirm}" 嗎？這不會刪除雲端資料。`)) {
            delete savedTrips[tripId];
            try {
                localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips));
                console.log(`已從儲存列表移除行程: ${tripId}`);
                showNotification("已從列表移除選定行程", 'success');
                if (localStorage.getItem(LAST_TRIP_KEY) === tripId) {
                    localStorage.removeItem(LAST_TRIP_KEY);
                    console.log("同時移除了 lastActiveTripId");
                }
                    populateSavedTripsDropdown();
                    if(tripIdInput) tripIdInput.value = '';
                    if (activeTripId === tripId) { // If removing the active trip
                        clearCurrentTripDisplay();
                    }
            } catch (e) {
                console.error("移除行程時儲存列表失敗: ", e);
                 showNotification("移除行程時發生錯誤", 'error');
                }
            }
        }
    }

    // --- 下拉選單處理 --- 
    function populateSavedTripsDropdown() {
        if (!savedTripsSelect) return;
        const savedTrips = loadSavedTrips();
        const tripIds = Object.keys(savedTrips);

        savedTripsSelect.innerHTML = '';

        if (tripIds.length === 0) {
            savedTripsSelect.innerHTML = '<option value="">-- 無已存行程 --</option>';
            if (deleteSelectedTripBtn) deleteSelectedTripBtn.disabled = true;
        } else {
            savedTripsSelect.innerHTML = '<option value="">-- 請選擇 --</option>';
            tripIds.forEach(tripId => {
                const option = document.createElement('option');
                option.value = tripId;
                // Display name and first 6 chars of ID for uniqueness
                option.textContent = `${savedTrips[tripId]} (${tripId.substring(0, 6)}...)`;
                // Set selected if it matches the last active trip ID
                if (tripId === localStorage.getItem(LAST_TRIP_KEY)) {
                     option.selected = true;
                }
                savedTripsSelect.appendChild(option);
            });
            // Update delete button state based on initial selection
            updateDeleteButtonState();
        }
    }


    function updateDeleteButtonState() {
        if (!savedTripsSelect || !deleteSelectedTripBtn) return;
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            if(tripIdInput && !tripIdInput.value) { // Only fill if empty, avoid overriding user input
                 tripIdInput.value = selectedTripId;
            }
            deleteSelectedTripBtn.disabled = false;
        } else {
            // Don't clear tripIdInput here automatically
            deleteSelectedTripBtn.disabled = true;
        }
    }

    function deleteSelectedTrip() {
        if (!savedTripsSelect) return;
        const selectedTripId = savedTripsSelect.value;
        if (selectedTripId) {
            removeSavedTrip(selectedTripId);
        }
    }
    // Add listeners in initializeApp

    // --- 筆記 Modal 相關函式 ---
    function openNotesModal(itemId) {
        if (!notesModal || !notesItemIdInput || !activeTripId) {
             console.error("無法開啟筆記: 元件未找到或行程未載入。");
             showNotification("無法開啟筆記視窗", "error");
             return;
        }
        console.log(`準備開啟筆記 Modal，項目 ID: ${itemId}`);
        notesItemIdInput.value = itemId;
        notesChangedSinceLoad = false; // Reset change tracking

        try {
            if (notesModal.showModal) notesModal.showModal();
            else notesModal.style.display = 'block';
        } catch (e) {
            console.error("呼叫 notesModal.showModal() 時出錯:", e);
            showNotification("無法開啟筆記視窗", "error");
            return;
        }

        if (!quill) {
            try {
                 quill = new Quill(notesEditorContainer, {
                    modules: {
                        toolbar: {
                            container: [
                                [{'header': [1, 2, 3, false]}],
                                [{'font': Quill.import('formats/font').whitelist || []}],
                                [{'size': ['small', false, 'large', 'huge']}],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{'color': [] }, { 'background': [] }],
                                [{'list': 'ordered'}, { 'list': 'bullet' }],
                                [{'script': 'sub'}, { 'script': 'super' }],
                                [{'indent': '-1'}, { 'indent': '+1' }],
                                [{'direction': 'rtl' }],
                                [{'align': [] }],
                                ['link', 'image', 'video', 'blockquote', 'code-block'], 
                                ['clean']
                            ],
                            handlers: {
                                'image': selectLocalImage
                            }
                        }
                    },
                    theme: 'snow'
                });
                 console.log("Quill 編輯器已初始化");
                 addQuillToolbarTooltips(notesEditorContainer);
                 // Add text-change listener
                 quill.on('text-change', (delta, oldDelta, source) => {
                     if (source === 'user') {
                         notesChangedSinceLoad = true;
                         console.log("筆記內容已變更 (來自使用者操作)");
                     }
                 });
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
             closeNotesModal();
             return;
        }

        console.log("準備從 Firebase 讀取筆記...");
        const notesPath = `trips/${activeTripId}/itineraries/${itemId}/notes`;
        db.ref(notesPath).once('value')
            .then((snapshot) => {
                console.log("Firebase 筆記讀取成功。");
                const notesHtml = snapshot.val();
                if (quill) { 
                    quill.root.innerHTML = notesHtml || '<p><br></p>'; // Ensure editor is not empty
                    console.log(notesHtml ? "已載入現有筆記" : "此項目尚無筆記，編輯器已清空。");
                    quill.history.clear(); // Clear undo history after loading
                    notesChangedSinceLoad = false; // Reset after loading
                } else {
                     console.error("Quill 實例丟失，無法載入筆記內容。");
                     showNotification("無法載入筆記內容", "error");
                     closeNotesModal();
                }
            })
            .catch((error) => {
                console.error(`讀取筆記失敗 (路徑: ${notesPath}):`, error);
                showNotification("讀取筆記時發生錯誤", 'error');
                if (quill) {
                    quill.root.innerHTML = '<p>讀取筆記失敗。</p>';
                    quill.history.clear();
                    notesChangedSinceLoad = false;
                } else {
                    console.error("Quill 實例丟失，無法處理讀取失敗。");
                }
                 closeNotesModal();
            });
    }

    function closeNotesModal() {
        if (!notesModal) return;
        console.log(`closeNotesModal: 檢查 notesChangedSinceLoad，目前值: ${notesChangedSinceLoad}`);
        if (notesChangedSinceLoad) {
            if (!confirm("您有未儲存的變更，確定要關閉嗎？")) {
                console.log("使用者取消關閉 (有變更)");
                return;
            }
            console.log("使用者確認關閉 (有變更)");
        }

        console.log("關閉筆記 Modal");
        if (notesModal.close) notesModal.close();
        else notesModal.style.display = 'none';
        if (notesItemIdInput) notesItemIdInput.value = '';
        // Don't clear content here, let openNotesModal handle it
        notesChangedSinceLoad = false;
        console.log("變更標記已重設 (關閉後)");
    }
    // Add listeners in initializeApp

    function saveNotes() {
        const itemId = notesItemIdInput?.value;
        if (!itemId || !quill || !activeTripId) {
            console.error("無法儲存筆記：缺少項目 ID、行程 ID 或編輯器未初始化");
            showNotification("無法儲存筆記", 'error');
            return;
        }

        console.log(`準備儲存 ID 為 ${itemId} 的筆記`);
        const notesHtml = quill.root.innerHTML;
        const notesPath = `trips/${activeTripId}/itineraries/${itemId}/notes`;

            incrementPendingWrites();

        // Disable button
        if(saveNotesBtn) saveNotesBtn.disabled = true;
        if(saveNotesBtn) saveNotesBtn.setAttribute('aria-busy', 'true');

        db.ref(notesPath).set(notesHtml)
            .then(() => {
                console.log(`筆記已成功儲存至 ${notesPath}`);
                showNotification("筆記已儲存");
                notesChangedSinceLoad = false; // Reset change tracking
                closeNotesModal();
            })
            .catch((error) => {
                console.error(`儲存筆記失敗 (路徑: ${notesPath}):`, error);
                showNotification("儲存筆記時發生錯誤", 'error');
            })
            .finally(() => {
                 // Re-enable button
                if(saveNotesBtn) saveNotesBtn.disabled = false;
                if(saveNotesBtn) saveNotesBtn.removeAttribute('aria-busy');
            });
    }
    // Add listener in initializeApp

    // Quill 工具欄提示和相機按鈕添加
    function addQuillToolbarTooltips(editorContainer) {
        if (!editorContainer) return;
        console.log("開始添加 Quill 工具欄提示和功能按鈕...");
        try {
            setTimeout(() => {
                const toolbar = editorContainer.querySelector('.ql-toolbar');
                if (!toolbar) {
                    console.error("找不到 Quill 工具欄！");
                    return;
                }
                
                console.log("找到 Quill 工具欄，開始尋找圖片按鈕...");
                const imageButton = toolbar.querySelector('button.ql-image');
                if (imageButton) {
                const imageButtonContainer = imageButton.parentElement;
                imageButton.title = "上傳圖片";
                
                     // Check if camera button already exists
                     if (!toolbar.querySelector('.ql-camera')) {
                const cameraButton = document.createElement('button');
                cameraButton.className = 'ql-camera';
                cameraButton.innerHTML = '<i class="fa-solid fa-camera"></i>';
                cameraButton.title = "拍照";
                         cameraButton.type = 'button'; // Prevent form submission
                
                         if (imageButtonContainer) imageButtonContainer.appendChild(cameraButton);
                         else toolbar.appendChild(cameraButton); // Fallback
                
                cameraButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log("相機按鈕被點擊");
                             openCameraModal();
                });
                console.log("相機按鈕已添加到工具欄");
                     } else {
                          console.log("相機按鈕已存在。");
                     }
                } else {
                     console.warn("找不到圖片按鈕！相機按鈕將無法添加。");
                }

                
                // 添加其他工具提示
                const buttons = toolbar.querySelectorAll('button');
                const tooltips = {
                    'bold': '粗體', 'italic': '斜體', 'underline': '底線', 'strike': '刪除線',
                    'blockquote': '引用', 'code-block': '程式碼區塊', 'link': '插入連結',
                    'video': '插入影片', 'clean': '清除格式', 'image': '上傳圖片' // Add tooltip for image
                };
                buttons.forEach(button => {
                    for (const format in tooltips) {
                         if (button.classList.contains(`ql-${format}`)) {
                             // Only add tooltip if it doesn't have one already
                             if (!button.title) {
                        button.title = tooltips[format];
                             }
                             break;
                         }
                    }
                });
                
                const selects = toolbar.querySelectorAll('select');
                const selectTooltips = {
                    'header': '標題', 'font': '字型', 'size': '字號',
                    'color': '文字顏色', 'background': '背景顏色', 'align': '對齊方式'
                };
                selects.forEach(select => {
                     for (const format in selectTooltips) {
                         if (select.classList.contains(`ql-${format}`)) {
                            const span = select.parentElement?.querySelector('span');
                            if (span && !span.title) { // Only add if no title
                            span.title = selectTooltips[format];
                            }
                             break;
                        }
                    }
                });
                console.log("工具欄提示設置完成");
            }, 150); // Increase delay slightly
        } catch (error) {
            console.error("添加工具欄提示和按鈕時出錯:", error);
        }
    }

    // --- 圖片上傳相關函式 ---
    function selectLocalImage() {
        const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
        if (!apiKey) {
            showNotification("請先在設定中輸入 ImgBB API Key 以啟用圖片上傳。", "error");
            openSettingsModal();
            return;
        }
        console.log("準備使用 ImgBB 上傳..."); 
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
        input.onchange = () => {
            const file = input.files?.[0];
            if (file && quill) {
                console.log("選取的圖片:", file.name);
                const range = quill.getSelection(true);
                const placeholderText = '\n[圖片上傳中(ImgBB)...]\n';
                quill.insertText(range.index, placeholderText, { 'color': 'grey', 'italic': true });
                quill.setSelection(range.index + placeholderText.length);
                uploadImageToImgBB(file, range.index, apiKey);
            } else {
                console.log("未選擇檔案或 Quill 未初始化。");
            }
            // Ensure input is removed even if no file selected
            if (input.parentNode === document.body) {
            document.body.removeChild(input);
            }
        };
         // Add focusout listener to remove input if user cancels file dialog
         input.addEventListener('focusout', () => {
             // Delay removal slightly to allow onchange to potentially fire
             setTimeout(() => {
                 if (input.parentNode === document.body) {
                     document.body.removeChild(input);
                     console.log("File input removed after focus out.");
                 }
             }, 300);
         });
    }


    function uploadImageToImgBB(file, insertionIndex, apiKey) {
         console.log(`uploadImageToImgBB: Uploading ${file.name} using key ${apiKey.substring(0, 4)}...`);
         if (!quill) {
              console.error("uploadImageToImgBB: Quill instance is missing.");
              return;
         }
         const placeholderText = '\n[圖片上傳中(ImgBB)...]\n';
         const placeholderLength = placeholderText.length;

         const reader = new FileReader();
         reader.onload = (e) => {
             const base64Image = e.target?.result?.split(',')[1];
             if (!base64Image) {
                  console.error("uploadImageToImgBB: Failed to read file as Base64.");
                  showNotification("讀取圖片檔失敗。", 'error');
                  try { quill.deleteText(insertionIndex, placeholderLength); } catch(delErr) {}
                  return;
             }

             const formData = new FormData();
             formData.append('key', apiKey);
             formData.append('image', base64Image);

             console.log("uploadImageToImgBB: Sending request to ImgBB API...");

             fetch('https://api.imgbb.com/1/upload', {
                 method: 'POST',
                 body: formData
             })
             .then(response => {
                 console.log(`uploadImageToImgBB: Received response with status: ${response.status}`);
                 if (!response.ok) {
                     return response.text().then(text => { // Read body before throwing
                         throw new Error(`ImgBB API Error: ${response.statusText} (Status: ${response.status}) - ${text}`);
                     });
                 }
                 return response.json();
             })
             .then(data => {
                 console.log("uploadImageToImgBB: ImgBB API Response Data:", data);
                 if (data.success && data.data?.url) {
                     const imageUrl = data.data.url;
                     console.log("uploadImageToImgBB: Upload successful. Image URL:", imageUrl);
                         try {
                             quill.deleteText(insertionIndex, placeholderLength);
                             quill.insertEmbed(insertionIndex, 'image', imageUrl);
                             quill.setSelection(insertionIndex + 1); 
                             showNotification("圖片已透過 ImgBB 插入。", "success");
                         notesChangedSinceLoad = true; // Mark notes as changed
                         } catch (embedError) {
                             console.error("uploadImageToImgBB: Error deleting placeholder or embedding image:", embedError);
                             showNotification("插入圖片時出錯。", "error");
                         }
                     } else {
                     const errorMessage = data.error?.message || 'ImgBB 返回未知錯誤';
                     console.error("uploadImageToImgBB: ImgBB API reported failure:", errorMessage, data);
                     showNotification(`圖片上傳失敗: ${errorMessage}`, 'error');
                     try { quill.deleteText(insertionIndex, placeholderLength); } catch(delErr) {}
                 }
             })
             .catch(error => {
                 console.error("uploadImageToImgBB: Fetch Error or API Error:", error);
                 showNotification(`圖片上傳時發生網路或 API 錯誤: ${error.message}`, 'error');
                 try { quill.deleteText(insertionIndex, placeholderLength); } catch(delErr) {}
             });
         };

         reader.onerror = (error) => {
            console.error("uploadImageToImgBB: FileReader error:", error);
            showNotification("讀取圖片檔時發生錯誤。", 'error');
            if (quill) { 
                try { quill.deleteText(insertionIndex, placeholderLength); } catch(delErr) {}
            }
         };
         reader.readAsDataURL(file);
         console.log("uploadImageToImgBB: Started reading file with FileReader.");
    }

    // --- 設定 Modal 相關函式 ---
    function openSettingsModal() {
        if (!settingsModal || !imgbbApiKeyInput || !geminiApiKeyInput) return;
        console.log("開啟設定 Modal");
        const imgbbApiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY) || '';
        const geminiApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '';
        imgbbApiKeyInput.value = imgbbApiKey;
        geminiApiKeyInput.value = geminiApiKey;
        if (settingsModal.showModal) settingsModal.showModal();
        else settingsModal.style.display = 'block';
    }

    function closeSettingsModal() {
        if (!settingsModal) return;
        console.log("關閉設定 Modal");
        if (settingsModal.close) settingsModal.close();
        else settingsModal.style.display = 'none';
    }
    // Add listeners in initializeApp
    
    function saveSettings(e) {
        e.preventDefault();
        if (!imgbbApiKeyInput || !geminiApiKeyInput) return;
        const imgbbApiKey = imgbbApiKeyInput.value.trim();
        const geminiApiKey = geminiApiKeyInput.value.trim();
        
        try {
            if (imgbbApiKey) {
                localStorage.setItem(IMGBB_API_KEY_STORAGE_KEY, imgbbApiKey);
                console.log("ImgBB API Key 已儲存");
            } else {
                localStorage.removeItem(IMGBB_API_KEY_STORAGE_KEY);
                console.log("已清除儲存的 ImgBB API Key");
            }

            if (geminiApiKey) {
                localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, geminiApiKey);
                console.log("Google Gemini API Key 已儲存");
            } else {
                localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
                console.log("已清除儲存的 Google Gemini API Key");
            }

            showNotification("設定已儲存！", 'success');
            closeSettingsModal();
        } catch (error) {
            console.error("儲存設定失敗:", error);
            showNotification("儲存設定失敗，可能是 localStorage 已滿或被禁用。", 'error');
        }
    }
    // Add listener in initializeApp

    // --- 相機拍照相關函式 ---
    function openCameraModal() {
        if (!cameraModal || !cameraView || !cameraCanvas || !cameraFeedback || !capturePhotoBtn || !cancelCameraBtn) {
            console.error("相機元件未完全初始化。");
            showNotification("無法開啟相機。", "error");
            return;
        }
        console.log("開啟拍照 Modal");
        const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
        if (!apiKey) {
            showNotification("請先設定 ImgBB API Key 以使用拍照功能。", "error");
            openSettingsModal();
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            showNotification("您的瀏覽器不支援相機功能。", 'error');
            return;
        }
        cameraFeedback.textContent = '';
        if (cameraModal.showModal) cameraModal.showModal();
        else cameraModal.style.display = 'block';
        startCameraStream();
    }

    function startCameraStream() {
        stopCameraStream();
        if (!cameraFeedback || !cameraView || !capturePhotoBtn) return;
        cameraFeedback.textContent = '請求相機權限...';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                console.log("相機權限獲取成功");
                currentCameraStream = stream;
                cameraView.srcObject = stream;
                cameraFeedback.textContent = '相機已啟動';
                capturePhotoBtn.disabled = false;
            })
            .catch(err => {
                console.error("無法獲取相機權限:", err);
                cameraFeedback.textContent = `無法啟動相機: ${err.name}`;
                showNotification("無法啟動相機，請檢查權限設定。", 'error');
                capturePhotoBtn.disabled = true;
            });
    }

    function stopCameraStream() {
        if (currentCameraStream) {
            currentCameraStream.getTracks().forEach(track => track.stop());
            currentCameraStream = null;
            if (cameraView) cameraView.srcObject = null;
            console.log("相機流已停止");
        }
         if (capturePhotoBtn) capturePhotoBtn.disabled = true;
    }

    function closeCameraModal() {
        if (!cameraModal) return;
        console.log("關閉拍照 Modal");
        stopCameraStream();
        if (cameraModal.close) cameraModal.close();
        else cameraModal.style.display = 'none';
    }
    // Add listeners in initializeApp

    function capturePhoto() {
        if (!cameraView?.srcObject || !cameraCanvas || !capturePhotoBtn || !quill) {
            console.warn("相機未啟動、Canvas 無法使用或 Quill 未初始化。");
            return;
        }
        console.log("準備拍照...");
        capturePhotoBtn.disabled = true;
        if(cameraFeedback) cameraFeedback.textContent = '正在擷取畫面...';

        const context = cameraCanvas.getContext('2d');
        if (!context) {
            console.error("無法獲取 Canvas 2D context。");
            capturePhotoBtn.disabled = false;
            if(cameraFeedback) cameraFeedback.textContent = '拍照失敗';
            return;
        }
        cameraCanvas.width = cameraView.videoWidth;
        cameraCanvas.height = cameraView.videoHeight;
        context.drawImage(cameraView, 0, 0, cameraCanvas.width, cameraCanvas.height);

        cameraCanvas.toBlob((blob) => {
            if (!blob) {
                console.error("無法從 Canvas 創建 Blob。");
                showNotification("拍照失敗，無法處理圖片。", "error");
                capturePhotoBtn.disabled = false;
                if(cameraFeedback) cameraFeedback.textContent = '拍照失敗';
                return;
            }

            console.log("照片 Blob 已創建，大小:", blob.size);
            closeCameraModal();

            const apiKey = localStorage.getItem(IMGBB_API_KEY_STORAGE_KEY);
            if (!apiKey) { return; }

            const range = quill.getSelection(true);
            const placeholderText = '\n[拍照上傳中(ImgBB)...]\n';
            quill.insertText(range.index, placeholderText, { 'color': 'grey', 'italic': true });
            quill.setSelection(range.index + placeholderText.length); 
            
            const fileName = `capture_${Date.now()}.jpg`;
            const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });

            uploadImageToImgBB(capturedFile, range.index, apiKey);

        }, 'image/jpeg', 0.9);
    }

    // --- AI Trip Generation Functions ---

    async function generateTripWithAI() {
        console.log("AI 生成行程按鈕點擊 - 函式已觸發"); // <--- 加入這一行確認函式呼叫

        // 1. Get Input Values
        const tripName = tripNameInput.value.trim();
        const location = tripLocationInput.value.trim();
        const days = tripDaysInput.value.trim();
        const preferences = tripPreferencesInput.value.trim();
        const transport = tripTransportInput.value.trim();
        const startDate = tripStartDateInput?.value || ''; // 可選的出發日期
        const startTime = tripStartTimeInput?.value || ''; // 可選的出發時間

        // 2. Validate Inputs
        tripNameInput.classList.remove('input-error');
        tripLocationInput.classList.remove('input-error');
        tripDaysInput.classList.remove('input-error');
        let isValid = true;
        if (!tripName) {
            showNotification("請輸入行程名稱！", 'error');
            tripNameInput.classList.add('input-error');
            tripNameInput.focus();
            isValid = false;
        }
        if (!location) {
            showNotification("請輸入目的地！", 'error');
            tripLocationInput.classList.add('input-error');
            if (isValid) tripLocationInput.focus(); // Focus only if previous was valid
            isValid = false;
        }
        if (!days || parseInt(days) <= 0) {
            showNotification("請輸入有效的旅遊天數！", 'error');
            tripDaysInput.classList.add('input-error');
            if (isValid) tripDaysInput.focus();
            isValid = false;
        }
        if (!isValid) return;

        // 3. Check API Key
        const geminiApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
        if (!geminiApiKey) {
            showNotification("請先在設定中輸入 Google Gemini API Key 以使用 AI 生成功能。", "error");
            openSettingsModal(); // Guide user to settings
            return;
        }

        // 4. Update UI (Loading State)
        aiLoadingIndicator.style.display = 'block';
        // 注意：createTripBtn 現在可能是手動建立按鈕的 ID
        const manualCreateBtn = document.getElementById('create-trip-btn');
        if (manualCreateBtn) manualCreateBtn.disabled = true;
        if (generateTripAiBtn) {
            generateTripAiBtn.disabled = true;
            generateTripAiBtn.setAttribute('aria-busy', 'true');
        }

        try {
            // 5. Construct Prompt
            const prompt = constructAIPrompt(location, days, preferences, transport, startTime);
            console.log("Generated Prompt for AI:", prompt);

            // 6. Call Gemini API
            const aiResponseText = await callGeminiAPI(prompt, geminiApiKey);
            console.log("Raw AI Response Text:", aiResponseText);

            // 7. Parse AI Response (Assuming JSON structure)
            const parsedItinerary = parseAIResponse(aiResponseText, parseInt(days), location, startDate, startTime); // 傳入出發日期和時間
            console.log("Parsed Itinerary:", parsedItinerary);

            if (!parsedItinerary || parsedItinerary.length === 0) {
                throw new Error("AI 未能生成有效的行程建議或解析失敗。");
            }

            // 8. Create New Trip in Firebase
            const newTripData = await createNewTripInFirebase(tripName);
            const newTripId = newTripData.id;
            console.log(`New trip created with ID: ${newTripId}`);

            // 9. Add AI Generated Items to Firebase
            await addParsedItemsToFirebase(newTripId, parsedItinerary);
            console.log("AI generated items added to Firebase.");

            // 10. Load the New Trip
            showNotification(`AI 已生成行程 "${tripName}" 並載入！`, 'success');
            saveTripInfo(newTripId, tripName); // Save to local storage list
            loadTripData(newTripId, tripName); // Load the data and set up listener

            // Clear input fields after successful generation
            tripNameInput.value = '';
            tripLocationInput.value = '';
            tripDaysInput.value = '';
            tripPreferencesInput.value = '';
            tripTransportInput.value = '';
            if(tripStartDateInput) tripStartDateInput.value = '';
            if(tripStartTimeInput) tripStartTimeInput.value = '';

        } catch (error) {
            console.error("AI 生成行程失敗:", error);
            showNotification(`AI 生成行程時發生錯誤: ${error.message}`, 'error');
        } finally {
            // 11. Reset UI
            aiLoadingIndicator.style.display = 'none';
             if (manualCreateBtn) manualCreateBtn.disabled = false;
            if (generateTripAiBtn) {
                generateTripAiBtn.disabled = false;
                generateTripAiBtn.removeAttribute('aria-busy');
            }
        }
    }

    // Helper function to construct the prompt
    function constructAIPrompt(location, days, preferences, transport, startTime) {
        let prompt = `請為一個為期 ${days} 天的 ${location} 旅行生成詳細的每日行程建議。`;
        if (preferences) {
            prompt += ` 旅行者的喜好包含：${preferences}。`;
        }
        if (transport) {
            prompt += ` 主要交通方式為：${transport}。`;
        }
        // 強調出發時間
        if (startTime) {
            prompt += ` **重要：行程必須在第一天的 ${startTime} 準時開始。**`;
        } else {
            prompt += ` 預設第一天從上午 9:00 開始。`;
        }
        prompt += `\n\n針對每天的行程，請包含：\n1.  **住宿建議**：(若適用，可提供區域或類型建議)。\n2.  **活動安排**：列出當天建議的景點或活動，包含簡短描述。明確標示活動地點。\n3.  **餐飲推薦**：針對每個主要活動地點，推薦附近至少一個知名的當地美食或特色小吃，並附上簡短描述。明確標示美食地點 (或註明在景點附近)。如果有多個活動，請盡量為每個活動都提供餐飲建議。\n\n**極重要時間考量 (務必遵循):**\n1. **景點營業時間**：請**務必**查詢並考慮每個推薦景點的**實際營業時間**，不要推薦在非營業時間前往的行程。在 \`openingHours\` 欄位註明營業時間。\n2. **合理時間安排**：不要在半夜 (00:00-06:00) 安排活動，除非是特殊景點（如看日出）。活動之間需預留合理的交通和緩衝時間。\n3. **用餐時間**：合理安排早午晚三餐的時間，與參觀景點時間不要衝突。\n4. **出發時間**：${startTime ? `**第一天的第一個活動必須安排在 ${startTime} 開始。** 後續活動依次安排。` : '第一天行程從上午 9:00 開始。'}\n\n請以 JSON 格式回應，不要包含任何 JSON 格式標籤外的文字或說明。JSON 結構如下：\n\`\`\`json\n{\n  \"tripName\": \"自動生成的行程名稱 (例如：${location}${days}天精選之旅)\",\n  \"days\": [\n    {\n      \"day\": 1,\n      \"theme\": \"當日主題 (可選)\",\n      \"accommodation\": \"住宿建議文字\",\n      \"activities\": [\n        {\n          \"time\": \"建議時間 (如: 9:00-11:00 或 14:00，必須符合營業時間和出發時間要求)\",\n          \"description\": \"活動/景點描述\",\n          \"location\": \"活動/景點地點 (必須填寫)\",\n          \"openingHours\": \"景點營業時間 (如: 週一至週五 9:00-17:00，盡力提供)\",\n          \"foodRecommendation\": {\n            \"name\": \"推薦美食名稱\",\n            \"description\": \"美食簡短描述\",\n            \"location\": \"美食地點 (必須填寫，或註明在景點附近)\",\n            \"openingHours\": \"餐廳營業時間 (如果知道的話)\"\n          }\n        }\n        // ... 更多活動 ...\n      ]\n    }\n    // ... 更多天 ...\n  ]\n}\n\`\`\`\n請確保 JSON 格式正確無誤，所有 location 欄位都有值，並且**嚴格遵守上述時間考量**。活動安排應考慮時間先後順序，讓行程合理流暢。`;
        return prompt;
    }


    // Helper function to call Gemini API
    async function callGeminiAPI(prompt, apiKey) {
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
              responseMimeType: "application/json",
            },
            // safetySettings: [ ... ] // Consider adding safety settings
        };

        console.log("正在向 Gemini API 發送請求...");

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API 錯誤回應主體:", errorBody);
            let errorMessage = `Gemini API 請求失敗: ${response.status} ${response.statusText}`;
            try {
                 const errorJson = JSON.parse(errorBody);
                 if (errorJson.error && errorJson.error.message) {
                     errorMessage += ` - ${errorJson.error.message}`;
                 }
            } catch (e) {
                errorMessage += ` - ${errorBody}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("Gemini API 成功回應結構:", data);

        // Robust extraction of text part
        const candidate = data.candidates?.[0];
        const textPart = candidate?.content?.parts?.[0]?.text;

        if (textPart) {
            return textPart;
        } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
             console.error(`Gemini API request finished with reason: ${candidate.finishReason}`);
             throw new Error(`AI 回應因 ${candidate.finishReason} 而終止。`);
        } else if (data.promptFeedback?.blockReason) {
            const blockReason = data.promptFeedback.blockReason;
            const safetyRatings = data.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || '無安全評級資訊';
            console.error(`Gemini API 請求被阻擋。原因: ${blockReason}. 安全評級: ${safetyRatings}`);
            throw new Error(`AI 請求因安全原因被阻擋 (${blockReason})。`);
        } else {
             console.error("非預期的 Gemini API 回應結構:", data);
            throw new Error("從 AI 回應中提取內容失敗。結構不符預期。");
        }
    }


    // **修改：不再修改 Date 物件，僅解析並回傳 HH:MM 字串**
    function parseAndReturnTimeString(timeString) {
        const timeLower = timeString?.toLowerCase() || '';
        let hour = 10, minute = 0; // Default time

        const rangeMatch = timeLower.match(/(\d+):(\d+)\s*-\s*\d+:\d+/);
        const specificMatch = timeLower.match(/(\d+):(\d+)/);

        if (rangeMatch && rangeMatch.length >= 3) {
            // Use the start time of the range
            hour = parseInt(rangeMatch[1]);
            minute = parseInt(rangeMatch[2]);
        } else if (specificMatch && specificMatch.length >= 3) {
            // Use the specific time
            hour = parseInt(specificMatch[1]);
            minute = parseInt(specificMatch[2]);
        } else if (timeLower.includes("上午")) {
            hour = 10; minute = 0;
        } else if (timeLower.includes("下午")) {
            hour = 14; minute = 0;
        } else if (timeLower.includes("傍晚") || timeLower.includes("晚上")) {
            hour = 18; minute = 0;
        } else if (timeLower.includes("早上") || timeLower.includes("早晨")) {
            hour = 8; minute = 0;
        } else if (timeLower.includes("中午")) {
            hour = 12; minute = 0;
        } else {
            console.warn(`無法解析 AI 提供的時間 '${timeString}'，使用預設 10:00`);
        }

        // Validate parsed hours and minutes
        if (isNaN(hour) || hour < 0 || hour >= 24) hour = 10;
        if (isNaN(minute) || minute < 0 || minute >= 60) minute = 0;

        // Format to HH:MM string
        const formattedHour = String(hour).padStart(2, '0');
        const formattedMinute = String(minute).padStart(2, '0');
        return `${formattedHour}:${formattedMinute}`;
    }

    // Helper function to parse the AI response (stringified JSON) into structured data
    function parseAIResponse(jsonString, totalDays, defaultLocation, startDate, startTime) {
        try {
            const aiData = JSON.parse(jsonString);
            if (!aiData.days || !Array.isArray(aiData.days)) {
                throw new Error("AI 回應缺少有效的 'days' 陣列。");
            }

            const parsedItems = [];
            
            // 設定起始日期（如果提供了）
            let baseDateObj;
            if (startDate) {
                // Try to parse YYYY-MM-DD or other formats robustly
                baseDateObj = new Date(startDate + 'T00:00:00'); // Assume local if no tz
                if (isNaN(baseDateObj.getTime())) { // Check if parsing failed
                    console.warn("無法解析提供的 startDate，使用今天日期");
                    baseDateObj = new Date();
                }
            } else {
                baseDateObj = new Date();
            }
            baseDateObj.setHours(0, 0, 0, 0);

            // Helper to format Date object to YYYY-MM-DD
            const formatDate = (dateObj) => dateObj.toISOString().slice(0, 10);

            aiData.days.forEach(dayData => {
                const dayNumber = dayData.day;
                if (typeof dayNumber !== 'number' || dayNumber < 1 || dayNumber > totalDays) {
                    console.warn(`忽略無效的天數編號: ${dayNumber}`);
                    return; 
                }

                const currentDayDateObj = new Date(baseDateObj);
                currentDayDateObj.setDate(baseDateObj.getDate() + dayNumber - 1); 
                const currentDayDateStr = formatDate(currentDayDateObj);

                if (dayData.accommodation) {
                     // 住宿通常是當天下午入住，時間相對固定
                     const accommodationTimeStr = "15:00"; 
                     parsedItems.push({
                        dateTime: `${currentDayDateStr}T${accommodationTimeStr}`,
                        type: 'accommodation',
                        description: `住宿建議: ${dayData.accommodation}`,
                        location: defaultLocation, 
                        cost: null,
                        notes: dayData.theme ? `當日主題: ${dayData.theme}` : null 
                    });
                }

                if (dayData.activities && Array.isArray(dayData.activities)) {
                    dayData.activities.forEach((activity, activityIndex) => {
                        if (!activity.description || !activity.location) {
                            console.warn("忽略缺少描述或地點的活動:", activity);
                            return; 
                        }
                         
                         let activityTimeStr = "10:00"; // Default time if parsing fails

                         // **修改：強制第一天第一個活動使用 startTime**
                         if (dayNumber === 1 && activityIndex === 0 && startTime) { 
                             const timeParts = startTime.split(':');
                             if (timeParts.length === 2) {
                                 const hour = parseInt(timeParts[0]);
                                 const minute = parseInt(timeParts[1]);
                                 if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                                     activityTimeStr = startTime; // Use user's valid HH:MM directly
                                     console.log(`強制設定第一天第一個活動時間為使用者指定的: ${activityTimeStr}`);
                                 } else {
                                     console.warn(`解析使用者提供的 startTime (${startTime}) 失敗，將使用 AI 建議時間或預設值。`);
                                     activityTimeStr = parseAndReturnTimeString(activity.time); 
                                 }
                             } else {
                                  console.warn(`使用者提供的 startTime (${startTime}) 格式不符 (HH:MM)，將使用 AI 建議時間或預設值。`);
                                  activityTimeStr = parseAndReturnTimeString(activity.time);
                             }
                         } else {
                             // 對於其他活動，或第一天沒有指定 startTime 的情況，解析 AI 提供的時間
                             activityTimeStr = parseAndReturnTimeString(activity.time);
                         }

                         let notes = '';
                         if (activity.openingHours) {
                             notes += `營業時間: ${activity.openingHours}\n`;
                         }
                         // 記錄 AI 原始建議的時間，方便 debug
                         if (activity.time) {
                             if (notes) notes += '\n';
                             notes += `AI 建議時間: ${activity.time}\n`; 
                         }
                         
                         parsedItems.push({
                            dateTime: `${currentDayDateStr}T${activityTimeStr}`,
                            type: 'activity',
                            description: activity.description,
                            location: activity.location,
                            cost: null,
                            notes: notes || null
                        });

                        // 處理 foodRecommendation
                        if (activity.foodRecommendation && activity.foodRecommendation.name && activity.foodRecommendation.location) {
                             // 估算用餐時間 - 這裡仍需 Date 物件輔助計算小時
                             let foodTimeStr = "12:00"; // Default lunch time
                             const activityHour = parseInt(activityTimeStr.split(':')[0]);
                             if (!isNaN(activityHour)) {
                                 if (activityHour < 11) {
                                     foodTimeStr = "11:30";
                                 } else if (activityHour < 16) {
                                     // Rough check if it's close to previous activity
                                     foodTimeStr = `${String(activityHour + 1).padStart(2, '0')}:30`;
                                 } else {
                                     foodTimeStr = "19:00";
                                 }
                             }
                             
                             let foodNotes = activity.foodRecommendation.description || '';
                             if (activity.foodRecommendation.openingHours) {
                                 if (foodNotes.length > 0 && foodNotes[foodNotes.length-1] !== '\n') {
                                     foodNotes += '\n';
                                 }
                                 foodNotes += `營業時間: ${activity.foodRecommendation.openingHours}`;
                             }

                             parsedItems.push({
                                dateTime: `${currentDayDateStr}T${foodTimeStr}`,
                                type: 'food',
                                description: `美食推薦: ${activity.foodRecommendation.name}`,
                                location: activity.foodRecommendation.location,
                                cost: null,
                                notes: foodNotes || null
                            });
                        } else if (activity.foodRecommendation) {
                            console.warn("忽略缺少名稱或地點的美食推薦:", activity.foodRecommendation);
                        }
                    });
                }
            });

            // Sort by dateTime string (YYYY-MM-DDTHH:MM) - should be mostly correct chronologically
            parsedItems.sort((a, b) => a.dateTime.localeCompare(b.dateTime)); 
            return parsedItems;

        } catch (error) {
            console.error("解析 AI 回應失敗:", error, "原始字串:", jsonString);
            throw new Error(`無法解析 AI 回應的 JSON: ${error.message}`);
        }
    }

    // **移除舊的輔助函式：解析 AI 提供的時間並修改 Date 物件** 
    // function parseAndSetAIProvidedTime(dateTimeObject, timeString) { ... } 

    // Helper function to create a new trip (refactored from original createTripBtn handler)
    async function createNewTripInFirebase(name) {
        console.log(`在 Firebase 建立新行程: ${name}`);
        const tripsRef = db.ref('trips');
        const newTripRef = tripsRef.push();
        const newTripId = newTripRef.key;
        if (!newTripId) {
            throw new Error("無法從 Firebase 取得新的行程 ID。");
        }
        const tripMetadata = {
            name: name,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        await newTripRef.child('metadata').set(tripMetadata);
        return { id: newTripId, name: name };
    }

    // Helper function to add parsed items to Firebase
    async function addParsedItemsToFirebase(tripId, items) {
        if (!tripId || !items || items.length === 0) {
             console.log("沒有要添加到 Firebase 的 AI 生成項目。 tripId:", tripId, "items:", items);
             return;
        }
        console.log(`準備將 ${items.length} 個 AI 生成的項目添加到行程 ${tripId}`);
        const itineraryRef = db.ref(`trips/${tripId}/itineraries`);
        const updates = {}; // Use multi-location updates for efficiency
        let orderCounter = Date.now(); // Use timestamp for initial order

        items.forEach(item => {
            const newItemRef = itineraryRef.push(); // Generate a unique key for each item
            const newItemKey = newItemRef.key;
            if (newItemKey) {
                 const itemData = {
                     ...item,
                     createdAt: firebase.database.ServerValue.TIMESTAMP,
                     order: orderCounter++
                 };
                 updates[newItemKey] = itemData;
        } else {
                 console.warn("Failed to generate push key for item:", item);
            }
        });

        if (Object.keys(updates).length > 0) {
            await itineraryRef.update(updates); // Perform all updates at once
            console.log(`已成功將 ${Object.keys(updates).length} 個項目添加到 Firebase 行程 ${tripId}`);
        } else {
             console.log("No valid items to add to Firebase.");
        }
    }

    // --- END OF AI Trip Generation Functions ---


    // --- 初始狀態 ---
    function initializeApp() {
        console.log("頁面初始化完成，設定連線監聽、載入已存列表並檢查自動載入...");

        // 檢查外部函式庫
        console.log("檢查外部函式庫載入狀態...");
        if (typeof saveAs === 'function') console.log("FileSaver.js (saveAs) 已載入。");
        else console.warn("FileSaver.js (saveAs) 未載入!");
        if (typeof htmlDocx !== 'undefined') console.log("html-docx-js (htmlDocx) 已載入。");
        else console.warn("html-docx-js (htmlDocx) 未載入!");

        // 初始化主題設定
        setupThemeToggle();

        // 建立連線監聽與同步功能
        setupConnectionListener(); 
        populateSavedTripsDropdown(); 
        updatePendingWritesUI();

        // --- 事件監聽器設定 ---

        // 手動建立按鈕
        const manualCreateTripBtn = document.getElementById('create-trip-btn');
        if (manualCreateTripBtn) {
            manualCreateTripBtn.addEventListener('click', () => {
                const tripName = tripNameInput?.value.trim();
                if(tripNameInput) tripNameInput.classList.remove('input-error');
                if (!tripName) {
                    showNotification("請輸入行程名稱！", 'error');
                    if(tripNameInput) {
                         tripNameInput.classList.add('input-error');
                         tripNameInput.focus();
                    }
                    return;
                }
                manualCreateTripBtn.disabled = true;
                manualCreateTripBtn.setAttribute('aria-busy', 'true');
                if(generateTripAiBtn) generateTripAiBtn.disabled = true;

                createNewTripInFirebase(tripName)
                   .then(newTripData => {
                        console.log(`手動建立新行程成功，ID: ${newTripData.id}`);
                        showNotification(`新行程 "${newTripData.name}" 建立成功！`, 'success');
                        if(tripNameInput) tripNameInput.value = '';
                        if(tripLocationInput) tripLocationInput.value = '';
                        if(tripDaysInput) tripDaysInput.value = '';
                        if(tripPreferencesInput) tripPreferencesInput.value = '';
                        if(tripTransportInput) tripTransportInput.value = '';
                        saveTripInfo(newTripData.id, newTripData.name);
                        loadTripData(newTripData.id, newTripData.name);
                   })
                   .catch(error => {
                        console.error("手動建立新行程時發生錯誤: ", error);
                        showNotification("建立行程失敗，請稍後再試。", 'error');
                   })
                   .finally(() => {
                       manualCreateTripBtn.disabled = false;
                       manualCreateTripBtn.removeAttribute('aria-busy');
                       if(generateTripAiBtn) generateTripAiBtn.disabled = false;
                   });
           });
        } else {
            console.warn("找不到手動建立按鈕 (create-trip-btn)");
        }

        // AI 生成按鈕
        // const generateTripAiBtn = document.getElementById('generate-trip-ai-btn'); // Already defined globally
        if (generateTripAiBtn) {
            generateTripAiBtn.addEventListener('click', generateTripWithAI);
        } else {
            console.warn("找不到 AI 生成按鈕 (generate-trip-ai-btn)");
        }

        // 載入行程按鈕
        if (loadTripBtn) {
        loadTripBtn.addEventListener('click', function() {
                const tripId = tripIdInput?.value.trim();
            if (tripId) loadTrip(tripId);
                else showNotification("請輸入或選擇要載入的行程 ID。", 'warning');
            });
        }

        // QR 掃描按鈕
        if (scanQrBtn) scanQrBtn.addEventListener('click', startScan);
        if (cancelScanBtn) cancelScanBtn.addEventListener('click', stopScan);
        const cancelScanHeaderBtn = document.getElementById('cancel-scan-btn-header');
        if (cancelScanHeaderBtn) cancelScanHeaderBtn.addEventListener('click', stopScan);


        // 已存行程下拉選單 & 刪除按鈕
        if (savedTripsSelect) savedTripsSelect.addEventListener('change', updateDeleteButtonState);
        if (deleteSelectedTripBtn) deleteSelectedTripBtn.addEventListener('click', deleteSelectedTrip);

        // 行程項目表單提交 (手動新增項目)
        if (itineraryForm) {
        itineraryForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const descriptionInput = document.getElementById('item-description');
                if (!descriptionInput) return;
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
                if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');
                }

            const newItem = {
                    dateTime: document.getElementById('item-date')?.value || null,
                    type: document.getElementById('item-type')?.value || null,
                description: descriptionInput.value.trim(),
                    location: document.getElementById('item-location')?.value.trim() || '',
                    cost: document.getElementById('item-cost')?.value ? parseFloat(document.getElementById('item-cost').value) : null,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                    order: Date.now() // Use timestamp for initial order
            };
            
                const currentItineraryRef = db.ref(`trips/${activeTripId}/itineraries`);
                incrementPendingWrites();

            currentItineraryRef.push(newItem)
                .then(() => {
                    showNotification("行程項目已新增！", 'success');
                    itineraryForm.reset();
                    descriptionInput.classList.remove('input-error');
                        // calculateTotalCost(); // Listener will handle this
                })
                .catch((error) => {
                    console.error(`新增行程項目到 ${activeTripId} 時發生錯誤: `, error);
                    showNotification("新增項目失敗，請稍後再試。", 'error');
                })
                .finally(() => {
                        if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.removeAttribute('aria-busy');
                        }
                });
        });
        }
        
        // 編輯行程項目對話框
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
        if (editForm) editForm.addEventListener('submit', handleEditFormSubmit); // Keep handleEditFormSubmit for now

        // 筆記對話框
        if (cancelNotesBtn) cancelNotesBtn.addEventListener('click', closeNotesModal);
        const cancelNotesHeaderBtn = document.getElementById('cancel-notes-btn-header-equivalent');
        if (cancelNotesHeaderBtn) cancelNotesHeaderBtn.addEventListener('click', closeNotesModal);
        if (saveNotesBtn) saveNotesBtn.addEventListener('click', saveNotes);
        const exportDocxBtn = document.getElementById('export-notes-docx-btn');
         if (exportDocxBtn) exportDocxBtn.addEventListener('click', exportNotesToDocx);
         else console.warn("未找到匯出 DOCX 按鈕 (export-notes-docx-btn)");


        // 設定對話框
        if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
        if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettingsModal);
        const cancelSettingsFormBtn = document.getElementById('cancel-settings-form-btn');
        if (cancelSettingsFormBtn) cancelSettingsFormBtn.addEventListener('click', closeSettingsModal);
        if (settingsForm) settingsForm.addEventListener('submit', saveSettings);

        // 拍照對話框
        if (cancelCameraBtn) cancelCameraBtn.addEventListener('click', closeCameraModal);
        const cancelCameraHeaderBtn = document.getElementById('cancel-camera-btn'); // ID is same? Need verification in HTML
        if (cancelCameraHeaderBtn && cancelCameraHeaderBtn !== cancelCameraBtn) { // Avoid double listener if ID is same
            cancelCameraHeaderBtn.addEventListener('click', closeCameraModal);
        }
        if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', capturePhoto);


        // 檢查自動載入
        const lastTripId = localStorage.getItem(LAST_TRIP_KEY);
        if (lastTripId) {
            console.log(`發現上次儲存的行程 ID: ${lastTripId}，嘗試自動載入...`);
            if(tripIdInput) tripIdInput.value = lastTripId; // Pre-fill input for context
            // Ensure dropdown reflects the loaded trip if possible
            if(savedTripsSelect) savedTripsSelect.value = lastTripId;
            updateDeleteButtonState(); // Update button based on selection
            loadTrip(lastTripId);
        } else {
            populateSavedTripsDropdown(); // Populate dropdown even if no auto-load
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

    // 編輯表單提交處理 (之前未定義但被使用的函式)
    function handleEditFormSubmit(e) {
        e.preventDefault();
        if (!editItemIdInput || !activeTripId) return;
        
        const itemId = editItemIdInput.value;
        if (!itemId) {
            showNotification("無法編輯項目：無效的項目ID", "error");
            return;
        }
        
        const submitButton = editForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');
        }
        
        const updatedData = {
            dateTime: editItemDateInput?.value || null,
            type: editItemTypeInput?.value || null,
            description: editItemDescriptionInput?.value.trim() || '',
            location: editItemLocationInput?.value.trim() || '',
            cost: editItemCostInput?.value ? parseFloat(editItemCostInput.value) : null
        };
        
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
        
        incrementPendingWrites();
        itemRef.update(updatedData)
            .then(() => {
                showNotification("項目更新成功！", 'success');
                closeEditModal();
            })
            .catch((error) => {
                console.error(`更新項目 ${itemId} 時發生錯誤: `, error);
                showNotification("更新失敗，請稍後再試。", 'error');
            })
            .finally(() => {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.removeAttribute('aria-busy');
                }
            });
    }

    function initializeApp() {
        console.log("頁面初始化完成，設定連線監聽、載入已存列表並檢查自動載入...");

        // 檢查外部函式庫
        console.log("檢查外部函式庫載入狀態...");
        if (typeof saveAs === 'function') console.log("FileSaver.js (saveAs) 已載入。");
        else console.warn("FileSaver.js (saveAs) 未載入!");
        if (typeof htmlDocx !== 'undefined') console.log("html-docx-js (htmlDocx) 已載入。");
        else console.warn("html-docx-js (htmlDocx) 未載入!");

        // 初始化主題設定
        setupThemeToggle();

        // 建立連線監聽與同步功能
        setupConnectionListener(); 
        populateSavedTripsDropdown(); 
        updatePendingWritesUI();

        // --- 事件監聽器設定 ---

        // 手動建立按鈕
        const manualCreateTripBtn = document.getElementById('create-trip-btn');
        if (manualCreateTripBtn) {
            manualCreateTripBtn.addEventListener('click', () => {
                const tripName = tripNameInput?.value.trim();
                if(tripNameInput) tripNameInput.classList.remove('input-error');
                if (!tripName) {
                    showNotification("請輸入行程名稱！", 'error');
                    if(tripNameInput) {
                         tripNameInput.classList.add('input-error');
                         tripNameInput.focus();
                    }
                    return;
                }
                manualCreateTripBtn.disabled = true;
                manualCreateTripBtn.setAttribute('aria-busy', 'true');
                if(generateTripAiBtn) generateTripAiBtn.disabled = true;

                createNewTripInFirebase(tripName)
                   .then(newTripData => {
                        console.log(`手動建立新行程成功，ID: ${newTripData.id}`);
                        showNotification(`新行程 "${newTripData.name}" 建立成功！`, 'success');
                        if(tripNameInput) tripNameInput.value = '';
                        if(tripLocationInput) tripLocationInput.value = '';
                        if(tripDaysInput) tripDaysInput.value = '';
                        if(tripPreferencesInput) tripPreferencesInput.value = '';
                        if(tripTransportInput) tripTransportInput.value = '';
                        saveTripInfo(newTripData.id, newTripData.name);
                        loadTripData(newTripData.id, newTripData.name);
                   })
                   .catch(error => {
                        console.error("手動建立新行程時發生錯誤: ", error);
                        showNotification("建立行程失敗，請稍後再試。", 'error');
                   })
                   .finally(() => {
                       manualCreateTripBtn.disabled = false;
                       manualCreateTripBtn.removeAttribute('aria-busy');
                       if(generateTripAiBtn) generateTripAiBtn.disabled = false;
                   });
           });
        } else {
            console.warn("找不到手動建立按鈕 (create-trip-btn)");
        }

        // AI 生成按鈕
        // const generateTripAiBtn = document.getElementById('generate-trip-ai-btn'); // Already defined globally
        if (generateTripAiBtn) {
            generateTripAiBtn.addEventListener('click', generateTripWithAI);
        } else {
            console.warn("找不到 AI 生成按鈕 (generate-trip-ai-btn)");
        }

        // 載入行程按鈕
        if (loadTripBtn) {
        loadTripBtn.addEventListener('click', function() {
                const tripId = tripIdInput?.value.trim();
            if (tripId) loadTrip(tripId);
                else showNotification("請輸入或選擇要載入的行程 ID。", 'warning');
            });
        }

        // QR 掃描按鈕
        if (scanQrBtn) scanQrBtn.addEventListener('click', startScan);
        if (cancelScanBtn) cancelScanBtn.addEventListener('click', stopScan);
        const cancelScanHeaderBtn = document.getElementById('cancel-scan-btn-header');
        if (cancelScanHeaderBtn) cancelScanHeaderBtn.addEventListener('click', stopScan);


        // 已存行程下拉選單 & 刪除按鈕
        if (savedTripsSelect) savedTripsSelect.addEventListener('change', updateDeleteButtonState);
        if (deleteSelectedTripBtn) deleteSelectedTripBtn.addEventListener('click', deleteSelectedTrip);

        // 行程項目表單提交 (手動新增項目)
        if (itineraryForm) {
        itineraryForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const descriptionInput = document.getElementById('item-description');
                if (!descriptionInput) return;
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
                if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');
                }

            const newItem = {
                    dateTime: document.getElementById('item-date')?.value || null,
                    type: document.getElementById('item-type')?.value || null,
                description: descriptionInput.value.trim(),
                    location: document.getElementById('item-location')?.value.trim() || '',
                    cost: document.getElementById('item-cost')?.value ? parseFloat(document.getElementById('item-cost').value) : null,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                    order: Date.now() // Use timestamp for initial order
            };
            
                const currentItineraryRef = db.ref(`trips/${activeTripId}/itineraries`);
                incrementPendingWrites();

            currentItineraryRef.push(newItem)
                .then(() => {
                    showNotification("行程項目已新增！", 'success');
                    itineraryForm.reset();
                    descriptionInput.classList.remove('input-error');
                        // calculateTotalCost(); // Listener will handle this
                })
                .catch((error) => {
                    console.error(`新增行程項目到 ${activeTripId} 時發生錯誤: `, error);
                    showNotification("新增項目失敗，請稍後再試。", 'error');
                })
                .finally(() => {
                        if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.removeAttribute('aria-busy');
                        }
                });
        });
        }
        
        // 編輯行程項目對話框
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
        if (editForm) editForm.addEventListener('submit', handleEditFormSubmit); // Keep handleEditFormSubmit for now

        // 筆記對話框
        if (cancelNotesBtn) cancelNotesBtn.addEventListener('click', closeNotesModal);
        const cancelNotesHeaderBtn = document.getElementById('cancel-notes-btn-header-equivalent');
        if (cancelNotesHeaderBtn) cancelNotesHeaderBtn.addEventListener('click', closeNotesModal);
        if (saveNotesBtn) saveNotesBtn.addEventListener('click', saveNotes);
        const exportDocxBtn = document.getElementById('export-notes-docx-btn');
         if (exportDocxBtn) exportDocxBtn.addEventListener('click', exportNotesToDocx);
         else console.warn("未找到匯出 DOCX 按鈕 (export-notes-docx-btn)");


        // 設定對話框
        if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
        if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettingsModal);
        const cancelSettingsFormBtn = document.getElementById('cancel-settings-form-btn');
        if (cancelSettingsFormBtn) cancelSettingsFormBtn.addEventListener('click', closeSettingsModal);
        if (settingsForm) settingsForm.addEventListener('submit', saveSettings);

        // 拍照對話框
        if (cancelCameraBtn) cancelCameraBtn.addEventListener('click', closeCameraModal);
        const cancelCameraHeaderBtn = document.getElementById('cancel-camera-btn'); // ID is same? Need verification in HTML
        if (cancelCameraHeaderBtn && cancelCameraHeaderBtn !== cancelCameraBtn) { // Avoid double listener if ID is same
            cancelCameraHeaderBtn.addEventListener('click', closeCameraModal);
        }
        if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', capturePhoto);


        // 檢查自動載入
        const lastTripId = localStorage.getItem(LAST_TRIP_KEY);
        if (lastTripId) {
            console.log(`發現上次儲存的行程 ID: ${lastTripId}，嘗試自動載入...`);
            if(tripIdInput) tripIdInput.value = lastTripId; // Pre-fill input for context
            // Ensure dropdown reflects the loaded trip if possible
            if(savedTripsSelect) savedTripsSelect.value = lastTripId;
            updateDeleteButtonState(); // Update button based on selection
            loadTrip(lastTripId);
        } else {
            populateSavedTripsDropdown(); // Populate dropdown even if no auto-load
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

    // --- AI 建議下一個行程點相關函式 ---

    // 主處理函式
    async function handleSuggestNextStop(currentItemKey) {
        console.log(`請求 AI 建議 ${currentItemKey} 的下一個行程點`);
        if (!activeTripId) {
            showNotification("錯誤：沒有作用中的行程", "error");
            return; // Added return
        }

        const geminiApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
        if (!geminiApiKey) {
            showNotification("請先在設定中輸入 Google Gemini API Key", "error");
            openSettingsModal();
            return; // Added return
        }

        try {
            // 1. 獲取當前項目資料
            const currentItemRef = db.ref(`trips/${activeTripId}/itineraries/${currentItemKey}`);
            const snapshot = await currentItemRef.get();
            if (!snapshot.exists()) {
                throw new Error("找不到當前的行程項目資料");
            }
            const currentItemData = snapshot.val();

            if (!currentItemData.location || !currentItemData.dateTime) {
                 showNotification("目前項目缺少地點或時間資訊，無法提供建議。", "warning");
                 return;
            }

            // 2. 建構提示
            const prompt = constructSuggestNextPrompt(currentItemData);
            console.log("Suggest Next Stop Prompt:", prompt);

            // 3. 呼叫 API
            const aiResponseText = await callGeminiAPI(prompt, geminiApiKey);
            console.log("Suggest Next Stop Raw Response:", aiResponseText);

            // 4. 解析回應
            const baseDate = new Date(currentItemData.dateTime);
            const suggestedItemData = parseSuggestedItem(aiResponseText, baseDate);
            console.log("Parsed Suggested Item:", suggestedItemData);

            if (!suggestedItemData) { // Check if parsing returned null
                throw new Error("AI 回應無法解析或缺少必要資訊。")
            }

            // 5. 插入新項目
            await insertSuggestedItem(currentItemKey, suggestedItemData);

            showNotification("AI 已建議並插入下一個行程點！", "success");

        } catch (error) {
            console.error("AI 建議下一個行程點時發生錯誤:", error);
            showNotification(`AI 建議失敗: ${error.message}`, "error");
        }
        // loading 狀態的解除已移至 renderItineraryItem 的 finally 區塊
    }

    // 建構 AI 提示
    function constructSuggestNextPrompt(currentItemData) {
        const currentLocation = currentItemData.location;
        const currentEndTime = new Date(currentItemData.dateTime); // 假設 dateTime 是開始時間
        // 估算一個合理的結束時間（例如，活動持續2小時，可以根據類型調整）
        // 這裡簡化處理，只基於 dateTime 往後推
        const suggestedStartTime = new Date(currentEndTime.getTime() + 90 * 60000); // 預設 1.5 小時後
        const suggestedStartTimeStr = suggestedStartTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

        let prompt = `我目前在 ${currentLocation}，剛完成一個活動，時間大約是 ${currentEndTime.toLocaleString('zh-TW')}。
請根據以下條件，建議下一個合理的行程點：

1.  **地點相關性**：建議的地點應該在 ${currentLocation} 附近，或是前往下一個可能目的地的路途上。
2.  **時間合理性**：建議活動的開始時間應在 ${suggestedStartTimeStr} 之後，並考慮可能的交通時間。
3.  **類型多樣性**：如果可能，建議不同於目前活動類型的行程（例如，活動後推薦餐廳，或交通後推薦景點）。
4.  **營業時間**：請考慮建議地點的營業時間。
5.  **避免重複**：盡量不要建議完全相同的地點。

請只用 JSON 格式回應一個建議的行程項目，不要包含任何 JSON 以外的文字或說明。結構如下：
\`\`\`json
{
  "time": "建議開始時間 (例如 ${suggestedStartTimeStr} 或 14:30)",
  "type": "行程類型 (transport/accommodation/activity/food/other)",
  "description": "活動/景點/餐廳描述",
  "location": "建議的地點 (必須填寫)",
  "openingHours": "營業時間 (如果知道的話)",
  "notes": "其他備註 (可選，例如交通方式建議)"
}
\`\`\`
請確保 JSON 格式正確且 location 有值。`;
        return prompt;
    }

    // 解析 AI 回應 (單個項目)
    function parseSuggestedItem(jsonString, baseDate) {
        console.log("Raw AI Suggestion String:", jsonString); // 增加日誌：顯示原始字串
        try {
            let suggestion = null;
            const parsedData = JSON.parse(jsonString);
            console.log("Parsed AI Data:", parsedData); // 增加日誌：顯示解析後的物件

            // **修改：處理 AI 可能返回陣列的情況**
            if (Array.isArray(parsedData) && parsedData.length === 1) {
                suggestion = parsedData[0];
                console.log("AI returned an array, using the first element:", suggestion);
            } else if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
                 // 如果是單一物件
                suggestion = parsedData;
                console.log("AI returned a single object:", suggestion);
            } else {
                 // 無法識別的格式
                 console.error("AI response is not a single object or a single-element array.", parsedData);
                 return null;
            }

            // 基本驗證 (現在對 suggestion 操作)
            if (!suggestion || !suggestion.description || !suggestion.location || !suggestion.type) {
                console.error("AI 建議缺少必要欄位 (description, location, type) 或 suggestion 為 null:", suggestion);
                return null; // 返回 null 表示解析失敗
            }

            // 處理時間 (邏輯保持不變，但基於 suggestion)
            const newItemDateTime = new Date(baseDate); 
            let timeParsed = false;
            if (suggestion.time) {
                const timeLower = suggestion.time.toLowerCase();
                const timeMatch = timeLower.match(/(\d+):(\d+)/);
                if (timeMatch && timeMatch.length >= 3) {
                    const hour = parseInt(timeMatch[1]);
                    const minute = parseInt(timeMatch[2]);
                    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
                        const potentialTime = new Date(baseDate);
                        potentialTime.setHours(hour, minute, 0, 0);
                        if (potentialTime > baseDate) {
                             newItemDateTime.setHours(hour, minute, 0, 0);
                             timeParsed = true;
                        } else {
                             newItemDateTime.setDate(newItemDateTime.getDate() + 1);
                             newItemDateTime.setHours(hour, minute, 0, 0);
                             timeParsed = true;
                             console.log("AI 建議時間早於基準，已自動加一天");
                        }
                    }
                }
            }
            
            if (!timeParsed) {
                 newItemDateTime.setTime(baseDate.getTime() + 90 * 60000); 
                 console.log("AI 未提供有效時間，自動設定為 1.5 小時後");
            }

            // 組合筆記 (邏輯保持不變，但基於 suggestion)
            let notes = suggestion.notes || '';
            if (suggestion.openingHours) {
                if (notes) notes += '\n';
                notes += `營業時間: ${suggestion.openingHours}`;
            }
            if (suggestion.time && timeParsed) { 
                if (notes) notes += '\n';
                 notes += `AI建議時間: ${suggestion.time}`;
            }

            // 構建最終項目資料 (邏輯保持不變，但基於 suggestion)
            const newItemData = {
                dateTime: newItemDateTime.toISOString().slice(0, 16),
                type: suggestion.type,
                description: suggestion.description,
                location: suggestion.location,
                cost: null, 
                notes: notes || null,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            return newItemData;

        } catch (error) {
            console.error("解析 AI 建議失敗:", error, "原始字串:", jsonString);
            return null;
        }
    }

    // 插入建議的項目到 Firebase
    async function insertSuggestedItem(currentItemKey, newItemData) {
        if (!activeTripId || !newItemData) {
            console.error("缺少行程 ID 或新項目資料，無法插入");
            return;
        }

        const itineraryRef = db.ref(`trips/${activeTripId}/itineraries`);

        // --- 決定新項目的 Order --- 
        // 為了簡化，我們先使用時間戳作為 Order，或者比 currentItemOrder 稍大一點的值。
        // 獲取當前項目的 order
        const currentItemSnapshot = await itineraryRef.child(currentItemKey).child('order').get();
        const currentOrder = currentItemSnapshot.val() || Date.now(); // 如果沒 order，用當前時間
        
        // 新項目的 order 設為當前 order + 1 (或其他小增量)
        // 這依賴於 orderByChild('order') 的監聽器來正確排序顯示
        newItemData.order = currentOrder + 1; 
        
        console.log(`準備插入新項目，Order 設定為: ${newItemData.order}`);

        // --- 推送新項目 --- 
        incrementPendingWrites(); // 離線時增加計數
        const newItemRef = itineraryRef.push(); // 先產生 key
        await newItemRef.set(newItemData); // 再設定包含 order 的完整資料

        console.log(`已成功插入 AI 建議的項目，Key: ${newItemRef.key}`);
    }

    // --- END OF AI 建議相關函式 ---

    // ... (initializeApp 和其他現有函式) ...

    // Function to generate and display the QR code for sharing
    function displayShareQRCode(tripId) {
        const qrCodeDisplay = document.getElementById('qrcode-display-share');
        if (!qrCodeDisplay) {
            console.error("QR Code display area ('qrcode-display-share') not found.");
            showNotification('無法顯示 QR Code，找不到顯示區域。', 'error');
            return;
        }

        // Clear previous QR code if any
        qrCodeDisplay.innerHTML = '';
        qrCodeDisplay.style.display = 'block'; // Make the area visible

        try {
            // Ensure QRCode library is loaded
            if (typeof QRCode === 'undefined') {
                console.error('QRCode library is not loaded.');
                showNotification('QR Code 功能無法使用，請檢查頁面是否正確載入。', 'error');
                qrCodeDisplay.style.display = 'none';
                return;
            }

            new QRCode(qrCodeDisplay, {
                text: tripId,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            console.log(`Generated QR code for trip ID: ${tripId}`);
        } catch (error) {
            console.error("Error generating QR Code: ", error);
            showNotification('產生 QR Code 時發生錯誤。', 'error');
            qrCodeDisplay.style.display = 'none'; // Hide the area on error
            qrCodeDisplay.innerHTML = '<p>無法產生 QR Code。</p>'; // Show error message
        }
    }

    // --- 地圖初始化與行程顯示 ---
    async function displayTripInfo(tripId, tripData) {
        console.log(`Displaying trip info for: ${tripId}`);
        // *** 修改：使用 HTML 中正確的 ID ***
        const tripInfoDiv = document.getElementById('current-trip-card'); // Use current-trip-card
        const tripTitle = document.getElementById('current-trip-name');   // Use current-trip-name
        const tripIdDisplay = document.getElementById('current-trip-id'); // Use current-trip-id
        const shareQrButton = document.getElementById('share-qr-button');
        const qrCodeDisplay = document.getElementById('qrcode-display-share');

        if (!tripInfoDiv || !tripTitle || !tripIdDisplay || !shareQrButton || !qrCodeDisplay) {
            console.error('Required trip info display elements not found.');
            showNotification('無法顯示行程資訊，缺少必要的頁面元素。', 'error');
            return;
        }

        currentTripId = tripId; // 更新當前行程 ID
        tripTitle.textContent = tripData.name || '未命名行程';
        tripIdDisplay.textContent = tripId;
        tripInfoDiv.style.display = 'block';
        qrCodeDisplay.style.display = 'none'; // Hide QR code area initially
        qrCodeDisplay.innerHTML = ''; // Clear any previous QR code

        // 移除舊的監聽器以防重複添加
        const newShareButton = shareQrButton.cloneNode(true);
        console.log('displayTripInfo: Cloned share button:', newShareButton);
        shareQrButton.parentNode.replaceChild(newShareButton, shareQrButton);

        // Enable the share button
        console.log('displayTripInfo: Before enabling - disabled status:', newShareButton.disabled);
        newShareButton.disabled = false;
        console.log('displayTripInfo: After enabling - disabled status:', newShareButton.disabled);

        // Add event listener for the share button
        newShareButton.addEventListener('click', () => {
            if (currentTripId) {
                displayShareQRCode(currentTripId);
            } else {
                showNotification('沒有可分享的行程 ID。', 'warning');
            }
        });

        // Existing code for copy button...
        const copyButton = document.getElementById('copy-trip-id');
        if (copyButton) {
            // ... (rest of the copy button logic)
        }
    }
});



