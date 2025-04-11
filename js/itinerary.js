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

    // --- 全域變數 ---
    let activeTripId = null;
    let itineraryListenerRef = null;
    let notificationTimeout = null; // 用於追蹤通知消失的計時器

    // --- 取得 HTML 元素 ---
    // 行程管理區
    const tripNameInput = document.getElementById('trip-name');
    const createTripBtn = document.getElementById('create-trip-btn');
    const tripIdInput = document.getElementById('trip-id-input');
    const loadTripBtn = document.getElementById('load-trip-btn');
    const currentTripIdSpan = document.getElementById('current-trip-id');
    const itineraryContentDiv = document.getElementById('itinerary-content');
    const loadingIndicator = document.getElementById('loading-indicator'); // *** 新增 ***
    const notificationArea = document.getElementById('notification-area'); // *** 新增 ***

    // QR Code 相關元素
    const toggleQrCodeBtn = document.getElementById('toggle-qrcode-btn');
    const qrCodeContainer = document.getElementById('qrcode-container');

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

    // --- 通知函式 ---
    function showNotification(message, type = 'success') { // type 可以是 'success' 或 'error'
        if (notificationTimeout) {
            clearTimeout(notificationTimeout); // 清除之前的計時器
        }
        notificationArea.textContent = message;
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

    // --- 行程管理事件監聽 ---

    createTripBtn.addEventListener('click', () => {
        const tripName = tripNameInput.value.trim();
        if (!tripName) {
            // alert("請輸入行程名稱！");
            showNotification("請輸入行程名稱！", 'error'); // *** 修改 ***
            return;
        }
        // (可選) 可以在建立時也加入載入提示
        createNewTrip(tripName);
    });

    loadTripBtn.addEventListener('click', () => {
        const tripIdToLoad = tripIdInput.value.trim();
        if (!tripIdToLoad) {
            // alert("請輸入要載入的行程 ID！");
            showNotification("請輸入要載入的行程 ID！", 'error'); // *** 修改 ***
            return;
        }
        loadTrip(tripIdToLoad);
    });

    // --- 行程操作函式 ---

    function createNewTrip(name) {
        console.log(`嘗試建立新行程: ${name}`);
        // (可選) 禁用按鈕，顯示載入中
        createTripBtn.disabled = true;

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
                showNotification(`新行程 "${name}" 建立成功！`, 'success'); // *** 新增 ***
                tripNameInput.value = '';
                loadTripData(newTripId);
            })
            .catch((error) => {
                console.error("建立新行程時發生錯誤: ", error);
                // alert("建立行程失敗，請稍後再試。");
                showNotification("建立行程失敗，請稍後再試。", 'error'); // *** 修改 ***
            })
            .finally(() => {
                 // (可選) 重新啟用按鈕
                 createTripBtn.disabled = false;
            });
    }

    function loadTrip(tripId) {
        console.log(`嘗試載入行程 ID: ${tripId}`);
        const tripMetadataRef = db.ref(`trips/${tripId}/metadata`);

        // *** 開始：顯示載入提示，禁用按鈕 ***
        loadingIndicator.style.display = 'inline';
        loadTripBtn.disabled = true;
        tripIdInput.disabled = true; // 同時禁用輸入框

        tripMetadataRef.get().then((snapshot) => {
            if (snapshot.exists()) {
                console.log(`行程 ${tripId} 存在，開始載入資料...`);
                showNotification(`已載入行程: ${snapshot.val().name || tripId}`, 'success');
                tripIdInput.value = '';
                loadTripData(tripId);
            } else {
                console.warn(`行程 ID: ${tripId} 不存在。`);
                showNotification(`找不到行程 ID: ${tripId}，請確認 ID 是否正確。`, 'error');
                // 如果自動載入時 ID 失效，清除 localStorage 中的記錄
                if (localStorage.getItem('lastActiveTripId') === tripId) {
                    localStorage.removeItem('lastActiveTripId');
                    console.log('已清除無效的 lastActiveTripId');
                }
            }
        }).catch((error) => {
            console.error("載入行程時發生錯誤: ", error);
            showNotification("載入行程時發生錯誤，請稍後再試。", 'error');
        }).finally(() => {
            // *** 結束：隱藏載入提示，啟用按鈕 ***
            loadingIndicator.style.display = 'none';
            loadTripBtn.disabled = false;
            tripIdInput.disabled = false; // 同時啟用輸入框
        });
    }

    function loadTripData(tripId) {
        activeTripId = tripId;
        currentTripIdSpan.textContent = activeTripId;
        console.log(`目前作用中的行程 ID: ${activeTripId}`);

        // *** 儲存到 localStorage ***
        try {
            localStorage.setItem('lastActiveTripId', activeTripId);
            console.log(`已將 ${activeTripId} 儲存到 localStorage`);
        } catch (e) {
            console.warn("無法儲存行程 ID 到 localStorage: ", e);
            // 即便無法儲存，也繼續執行
        }

        toggleQrCodeBtn.style.display = 'inline-block';
        qrCodeContainer.innerHTML = '';
        qrCodeContainer.style.display = 'none';

        itineraryList.innerHTML = '<li>載入中...</li>';

        setupItineraryListener(activeTripId);

        itineraryContentDiv.style.display = 'block';
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
        }
    });

    // --- 行程項目相關 ---

    function setupItineraryListener(tripId) {
        if (itineraryListenerRef) {
            itineraryListenerRef.off('value');
            console.log("已移除舊的行程監聽器。");
        }
        const currentItineraryRef = db.ref(`trips/${tripId}/itineraries`).orderByChild('dateTime');
        itineraryListenerRef = currentItineraryRef;
        console.log(`開始監聽路徑: trips/${tripId}/itineraries，按 dateTime 排序`);

        itineraryListenerRef.on('value', (snapshot) => {
            console.log("行程項目資料更新 (來自 Realtime DB)");
            itineraryList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const key = childSnapshot.key;
                    const item = childSnapshot.val();
                    const listItem = document.createElement('li');
                    listItem.setAttribute('data-id', key);
                    const textSpan = document.createElement('span');
                    const displayDateTime = item.dateTime ? new Date(item.dateTime).toLocaleString('zh-TW') : '未設定時間';
                    textSpan.textContent = `[${displayDateTime}] ${item.type}: ${item.description} ${item.location ? '('+item.location+')' : ''} ${item.cost ? '- 約 $'+item.cost : ''}`;
                    listItem.appendChild(textSpan);
                    const buttonGroup = document.createElement('div');
                    const editBtn = document.createElement('button');
                    editBtn.textContent = '編輯';
                    editBtn.addEventListener('click', () => { editItineraryItem(key); });
                    buttonGroup.appendChild(editBtn);
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '刪除';
                    deleteBtn.addEventListener('click', () => { deleteItineraryItem(key); });
                    buttonGroup.appendChild(deleteBtn);
                    listItem.appendChild(buttonGroup);
                    itineraryList.appendChild(listItem);
                });
            } else {
                itineraryList.innerHTML = '<li>此行程尚無項目，快來新增吧！</li>';
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
        // (可選) 禁用儲存按鈕
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        const updatedData = {
            dateTime: editItemDateInput.value,
            type: editItemTypeInput.value,
            description: editItemDescriptionInput.value.trim(),
            location: editItemLocationInput.value.trim(),
            cost: editItemCostInput.value ? parseFloat(editItemCostInput.value) : 0
        };
        const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemIdToUpdate}`);
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
                 // (可選) 重新啟用儲存按鈕
                 submitButton.disabled = false;
            });
    });

    function closeEditModal() {
        editModal.style.display = 'none';
        editForm.reset();
        editItemIdInput.value = '';
    }

    cancelEditBtn.addEventListener('click', closeEditModal);

    function deleteItineraryItem(itemId) {
        if (!activeTripId) return;
        // 使用 confirm 仍然比較直觀，暫不替換
        if (confirm("確定要刪除這個行程項目嗎？")) {
            const itemRef = db.ref(`trips/${activeTripId}/itineraries/${itemId}`);
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
        if (!activeTripId) {
             showNotification("請先建立或載入一個行程！", 'error');
            return;
        }
        // (可選) 禁用新增按鈕
        const submitButton = itineraryForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        const newItem = {
            dateTime: document.getElementById('item-date').value,
            type: document.getElementById('item-type').value,
            description: document.getElementById('item-description').value.trim(),
            location: document.getElementById('item-location').value.trim(),
            cost: document.getElementById('item-cost').value ? parseFloat(document.getElementById('item-cost').value) : 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        const currentItineraryRef = db.ref(`trips/${activeTripId}/itineraries`);
        currentItineraryRef.push(newItem)
            .then(() => {
                 showNotification("行程項目已新增！", 'success');
                itineraryForm.reset();
            })
            .catch((error) => {
                console.error(`新增行程項目到 ${activeTripId} 時發生錯誤: `, error);
                 showNotification("新增項目失敗，請稍後再試。", 'error');
            })
            .finally(() => {
                // (可選) 重新啟用新增按鈕
                submitButton.disabled = false;
            });
    });

    // --- 初始狀態 ---
    console.log("頁面初始化完成，檢查是否有上次儲存的行程...");

    // *** 檢查 localStorage 並嘗試自動載入 ***
    const savedTripId = localStorage.getItem('lastActiveTripId');
    if (savedTripId) {
        console.log(`發現上次儲存的行程 ID: ${savedTripId}，嘗試自動載入...`);
        loadTrip(savedTripId); // 嘗試載入儲存的 ID
    } else {
        console.log("未發現上次儲存的行程 ID。");
        // 如果沒有儲存的 ID，保持初始狀態 (隱藏行程內容等)
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