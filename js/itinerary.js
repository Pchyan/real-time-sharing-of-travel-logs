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

    // *** 新增：獲取筆記 Modal 相關元素 ***
    const notesModal = document.getElementById('notes-modal');
    const notesEditorContainer = document.getElementById('notes-editor'); // Quill 將附加到這裡
    const saveNotesBtn = document.getElementById('save-notes-btn');
    const cancelNotesBtn = document.getElementById('cancel-notes-btn');
    const notesItemIdInput = document.getElementById('notes-item-id');

    // *** 新增：Quill 編輯器實例變數 ***
    let quill = null;

    // *** 新增：獲取 Firebase Storage 實例 ***
    let storage = null;
    try {
        storage = firebase.storage();
        console.log("Firebase Storage instance obtained.");
    } catch (error) {
        console.error("Failed to get Firebase Storage instance:", error);
        showNotification("無法初始化圖片上傳功能。", "error");
        // 如果 Storage 無法使用，後續相關功能會失敗
    }

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
    const scanCanvasCtx = scanCanvas.getContext('2d'); // *** 新增 ***
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
        const connectedRef = db.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            const wasOnline = isOnline; // 記錄之前的狀態
            isOnline = snap.val(); // 更新目前狀態

            if (isOnline) {
                console.log("Firebase Realtime Database: Online");
                // 加上圖示
                connectionStatusSpan.innerHTML = `<i class="fa-solid fa-wifi"></i> 線上`; 
                connectionStatusSpan.className = 'online';
                if (!wasOnline) { // 如果是從離線恢復
                    showNotification("已恢復線上連線，正在同步資料...", 'success');
                    pendingWritesCount = 0; // 重置計數器
                    updatePendingWritesUI(); // 更新 UI
                    console.log("Pending writes reset to 0.");
                }
            } else {
                console.log("Firebase Realtime Database: Offline");
                // 加上圖示
                connectionStatusSpan.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 離線 (資料將在連線後同步)`; 
                connectionStatusSpan.className = 'offline';
                showNotification("目前為離線狀態，您的變更將在恢復連線後同步。", 'error');
                updatePendingWritesUI(); // 更新 UI (可能已有待同步項目)
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

    function startScan() {
        // 檢查瀏覽器支援性
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification("您的瀏覽器不支援相機存取功能", 'error');
            return;
        }
        if (typeof jsQR === 'undefined') {
             showNotification("QR Code 掃描函式庫載入失敗", 'error');
             return;
        }

        scanModal.style.display = 'block';
        scanFeedback.textContent = '請求相機權限...';

        // 請求後置鏡頭
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                mediaStream = stream;
                scanVideo.srcObject = stream;
                scanVideo.setAttribute("playsinline", true); // iOS 需要
                scanVideo.play();
                scanFeedback.textContent = '相機已啟動，請對準 QR Code';
                // 開始掃描迴圈
                rafId = requestAnimationFrame(tick);
            })
            .catch(err => {
                console.error("無法獲取相機權限: ", err);
                scanFeedback.textContent = `無法啟動相機: ${err.name}`;
                showNotification("無法啟動相機，請檢查權限設定", 'error');
                // 短暫顯示錯誤後自動關閉 Modal
                setTimeout(stopScan, 3000);
            });
    }

    function tick() {
        if (scanVideo.readyState === scanVideo.HAVE_ENOUGH_DATA) {
            scanFeedback.textContent = '掃描中...';
            // 設定 canvas 尺寸匹配 video
            scanCanvas.height = scanVideo.videoHeight;
            scanCanvas.width = scanVideo.videoWidth;
            scanCanvasCtx.drawImage(scanVideo, 0, 0, scanCanvas.width, scanCanvas.height);
            
            // 獲取圖像數據
            const imageData = scanCanvasCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            
            // 使用 jsQR 解碼
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert", // 通常不需要反轉
            });

            if (code) {
                // 掃描成功
                console.log("掃描到 QR Code: ", code.data);
                scanFeedback.textContent = `掃描成功: ${code.data}`; 
                tripIdInput.value = code.data; // 將結果填入輸入框
                stopScan(); // 停止掃描
                showNotification("QR Code 掃描成功！ID 已填入輸入框。", 'success');
                // (可選) 自動觸發載入
                // loadTripBtn.click(); 
                return; // 結束迴圈
            } else {
                 scanFeedback.textContent = '掃描中... 未偵測到 QR Code';
            }
        }
        // 繼續下一幀
        rafId = requestAnimationFrame(tick);
    }

    function stopScan() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
            scanVideo.srcObject = null; // 清除影像來源
            console.log("相機已關閉");
        }
        scanModal.style.display = 'none';
        scanFeedback.textContent = ''; // 清空回饋
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

    itineraryForm.addEventListener('submit', (e) => {
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
        // 其他欄位驗證可按需添加

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
        
        incrementPendingWrites(); // *** 在寫入前檢查並增加計數 ***

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

    // *** 新增：圖片上傳相關函式 ***
    function selectLocalImage() {
        if (!storage) {
            showNotification("圖片上傳功能未初始化。", "error");
            return;
        }
        if (!activeTripId) {
            showNotification("請先載入行程以啟用圖片上傳。", "error");
            return;
        }
        // 創建一個隱藏的 file input
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.style.display = 'none'; // 保持隱藏
        document.body.appendChild(input); // 需要添加到 DOM 才能觸發事件

        input.click(); // 觸發檔案選擇對話框

        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                console.log("選取的圖片:", file.name);
                // 獲取當前選區，true 表示即使失焦也獲取
                const range = quill.getSelection(true);
                // 插入提示文字
                quill.insertText(range.index, '\n[圖片上傳中...]\n', { 'color': 'grey', 'italic': true });
                quill.setSelection(range.index + '\n[圖片上傳中...]\n'.length); // 將游標移到提示後
                // 開始上傳
                uploadImage(file, range.index);
            } else {
                console.log("未選擇檔案。");
            }
            // 移除 input 元素
            document.body.removeChild(input);
        };

        // 如果使用者取消了檔案選擇，也要移除 input
        // 注意：oncancel 事件支援度不佳，改用 focus/blur 技巧判斷
        // 一個簡單的方式是，如果 onchange 沒有在短時間內觸發，就假設被取消了
        // 這裡我們先不處理取消的狀況，僅在選擇後移除 input
    }

    function uploadImage(file, insertionIndex) {
        if (!activeTripId || !storage) {
            console.error("uploadImage: Cannot upload - activeTripId or storage missing.");
            showNotification("圖片上傳失敗。", 'error');
            if (quill) {
                try {
                    const lengthToDelete = '\n[圖片上傳中...]\n'.length;
                    quill.deleteText(insertionIndex, lengthToDelete);
                } catch(e) { console.error("uploadImage: Error removing placeholder on initial check fail", e); }
            }
            return;
        }

        const timestamp = Date.now();
        const imageName = `${timestamp}_${file.name}`;
        const storageRef = storage.ref(`trip_images/${activeTripId}/${imageName}`);

        console.log(`uploadImage: Starting upload to: ${storageRef.fullPath}`);
        const uploadTask = storageRef.put(file); // 使用 Compat SDK 的 put 方法

        // 監聽上傳狀態
        uploadTask.on('state_changed',
            (snapshot) => {
                // 進度回調
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`uploadImage: Progress - ${progress}% done`);
            },
            (error) => {
                // 錯誤回調
                console.error("uploadImage: Upload Error Callback Fired.", error); // 明確記錄錯誤回調
                showNotification(`圖片上傳失敗: ${error.code || error.message}`, 'error');
                if (quill) {
                    try {
                        const lengthToDelete = '\n[圖片上傳中...]\n'.length;
                        console.log(`uploadImage: Error - Attempting to delete placeholder at index ${insertionIndex}, length ${lengthToDelete}`);
                        quill.deleteText(insertionIndex, lengthToDelete);
                    } catch (deleteError) {
                         console.error("uploadImage: Error - Failed to delete placeholder:", deleteError);
                    }
                }
            },
            () => {
                // 完成回調
                console.log("uploadImage: Completion Callback Fired."); // 明確記錄完成回調
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('uploadImage: getDownloadURL() Success. URL:', downloadURL); // 明確記錄獲取 URL 成功
                    if (quill) {
                        try {
                            const lengthToDelete = '\n[圖片上傳中...]\n'.length;
                            console.log(`uploadImage: Completion - Attempting to delete placeholder at index ${insertionIndex}, length ${lengthToDelete}`);
                            quill.deleteText(insertionIndex, lengthToDelete);
                            console.log(`uploadImage: Completion - Attempting to insert image at index ${insertionIndex}`);
                            quill.insertEmbed(insertionIndex, 'image', downloadURL);
                            quill.setSelection(insertionIndex + 1); // 將游標移到圖片後
                            showNotification("圖片已插入。", "success");
                            console.log("uploadImage: Completion - Image inserted successfully."); // 明確記錄插入成功
                        } catch (embedError) {
                            console.error("uploadImage: Completion - Error deleting placeholder or embedding image:", embedError);
                            showNotification("插入圖片時出錯。", "error");
                        }
                    } else {
                         console.error("uploadImage: Completion - Quill instance missing, cannot insert image.");
                    }
                }).catch((error) => {
                     console.error("uploadImage: getDownloadURL() Error Callback Fired.", error); // 明確記錄獲取 URL 失敗
                     showNotification("無法取得圖片 URL。", 'error');
                     if (quill) {
                        try {
                            const lengthToDelete = '\n[圖片上傳中...]\n'.length;
                            console.log(`uploadImage: getDownloadURL Error - Attempting to delete placeholder at index ${insertionIndex}, length ${lengthToDelete}`);
                            quill.deleteText(insertionIndex, lengthToDelete);
                        } catch (deleteError) {
                             console.error("uploadImage: getDownloadURL Error - Failed to delete placeholder:", deleteError);
                        }
                     }
                });
            }
        );
         console.log("uploadImage: Listener attached to upload task."); // 確認監聽器已附加
    }

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
                                ['link', 'image', 'blockquote', 'code-block'],
                                ['clean']
                            ],
                            handlers: {
                                'image': selectLocalImage // 指定自訂處理器
                            }
                        }
                    },
                    theme: 'snow'
                });
                 console.log("Quill 編輯器已初始化 (含自訂圖片處理，移除表格支援)");
            } catch (error) {
                console.error("初始化 Quill 編輯器實例失敗:", error);
                showNotification("無法載入筆記編輯器", "error");
                quill = null; 
                // 即使初始化失敗，Modal 已經嘗試開啟了，這裡不需要 return
                // 但可能需要關閉 Modal 或顯示錯誤訊息在 Modal 內
                closeNotesModal(); // 初始化失敗時關閉已開啟的 Modal
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
        console.log("關閉筆記 Modal");
        notesModal.close();
        notesItemIdInput.value = '';
        // 清空 Quill 內容，避免下次開啟時看到舊資料
        if (quill) {
            quill.setContents([]);
        }
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

    // --- 初始狀態 ---
    console.log("頁面初始化完成，設定連線監聽、載入已存列表並檢查自動載入...");
    setupConnectionListener(); // *** 呼叫連線監聽設定 ***
    populateSavedTripsDropdown(); 
    updatePendingWritesUI(); // *** 初始化待同步 UI ***

    const savedTripId = localStorage.getItem(LAST_TRIP_KEY);
    if (savedTripId) {
        console.log(`發現上次儲存的行程 ID: ${savedTripId}，嘗試自動載入...`);
        loadTrip(savedTripId);
    } else {
        console.log("未發現上次儲存的行程 ID。");
        clearCurrentTripDisplay(); // *** 確保初始狀態乾淨 ***
    }

    // *** 新增：綁定筆記 Modal 關閉/儲存事件 ***
    cancelNotesBtn.addEventListener('click', closeNotesModal);
    saveNotesBtn.addEventListener('click', saveNotes);
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