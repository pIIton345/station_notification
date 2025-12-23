document.addEventListener('DOMContentLoaded', () => {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const statusMessage = document.getElementById('statusMessage');
    const resultContainer = document.getElementById('resultContainer');
    const stationList = document.getElementById('stationList');

    // Monitoring Elements
    const monitoringOverlay = document.getElementById('monitoringOverlay');
    const targetNameEl = document.getElementById('targetName');
    const targetDistanceEl = document.getElementById('targetDistance');
    const cancelMonitoringBtn = document.getElementById('cancelMonitoringBtn');

    let wakeLock = null;
    let watchId = null;
    let targetStation = null;

    getLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            updateStatus('お使いのブラウザは位置情報をサポートしていません。', 'error');
            return;
        }

        updateStatus('位置情報を取得中...', 'loading');
        getLocationBtn.disabled = true;
        resultContainer.classList.add('hidden');
        stationList.innerHTML = '';

        navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    });

    cancelMonitoringBtn.addEventListener('click', stopMonitoring);

    function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        updateStatus('周辺の駅を検索中...', 'loading');
        fetchStations(latitude, longitude);
    }

    function errorCallback(error) {
        getLocationBtn.disabled = false;
        switch (error.code) {
            case error.PERMISSION_DENIED:
                updateStatus('位置情報の利用が許可されませんでした。', 'error');
                break;
            case error.POSITION_UNAVAILABLE:
                updateStatus('位置情報が利用できません。', 'error');
                break;
            case error.TIMEOUT:
                updateStatus('位置情報の取得がタイムアウトしました。', 'error');
                break;
            default:
                updateStatus('不明なエラーが発生しました。', 'error');
                break;
        }
    }

    async function fetchStations(lat, long) {
        const url = `https://express.heartrails.com/api/json?method=getStations&x=${long}&y=${lat}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('API request failed');
            }
            const data = await response.json();


            if (data.response && data.response.station) {
                displayStations(data.response.station);
            } else {
                displayStations([]); // Pass empty to just show the test station
            }
            updateStatus('駅が見つかりました。ベルボタンを押して通知を設定できます。', 'success');
            getLocationBtn.disabled = false;

        } catch (error) {
            console.error('Error fetching stations:', error);
            // Even on error, show the test station
            displayStations([]);
            updateStatus('駅情報の取得に失敗しましたが、テスト用駅を表示します。', 'warning');
            getLocationBtn.disabled = false;
        }
    }

    function displayStations(stations) {
        const stationArray = Array.isArray(stations) ? stations : [stations];
        stationList.innerHTML = '';

        // Add Mock Station for Testing
        const mockStation = {
            name: "localhost (テスト)",
            line: "デバッグ線",
            distance: 5, // Starts outside the 500m zone
            x: 0,
            y: 0,
            isMock: true
        };
        stationArray.unshift(mockStation);

        stationArray.forEach((station, index) => {
            const li = document.createElement('li');
            li.className = 'station-item';
            li.style.animationDelay = `${index * 0.05}s`;

            li.innerHTML = `
                <div class="station-info">
                    <span class="station-name">${station.name}駅</span>
                    <span class="station-line">${station.line}</span>
                </div>
                <div class="station-actions">
                    <div class="station-distance">${station.distance}m</div>
                    <button class="icon-button" aria-label="${station.name}駅に到着したら通知する">
                        🔔
                    </button>
                </div>
            `;

            // Notification Button Click Handler
            const bellBtn = li.querySelector('button');
            bellBtn.addEventListener('click', () => startMonitoring(station));

            stationList.appendChild(li);
        });

        resultContainer.classList.remove('hidden');
    }

    function updateStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        if (type === 'error') {
            statusMessage.style.color = '#ef4444';
        } else if (type === 'success') {
            statusMessage.style.color = '#10b981';
        } else {
            statusMessage.style.color = '#64748b';
        }
    }

    // --- Monitoring & Notification Logic ---

    async function startMonitoring(station) {
        // Request Notification Permission
        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                alert("通知を受け取るために権限を許可してください。");
                return;
            }
        }

        targetStation = station;
        targetNameEl.textContent = station.name + '駅';
        monitoringOverlay.classList.remove('hidden');

        // Request Wake Lock
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Wake Lock failed:', err);
        }

        // Start Watching
        if (station.isMock) {
            // Simulation Mode
            let currentDistance = 600; // Start at 600m
            targetDistanceEl.textContent = currentDistance + 'm';

            watchId = setInterval(() => {
                currentDistance -= 10; // Decrease by 10m every tick
                targetDistanceEl.textContent = currentDistance + 'm';

                if (currentDistance < 500) {
                    triggerAlarm();
                    // Stop simulation after trigger to prevent spam in this demo
                    clearInterval(watchId);
                    watchId = null;
                }
            }, 1000); // Update every 1 second

        } else if (navigator.geolocation) {
            // Real GPS Mode
            watchId = navigator.geolocation.watchPosition(
                checkProximity,
                (err) => console.error(err),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }
    }

    function stopMonitoring() {
        if (targetStation && targetStation.isMock) {
            if (watchId !== null) {
                clearInterval(watchId);
                watchId = null;
            }
        } else {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        }

        if (wakeLock !== null) {
            wakeLock.release();
            wakeLock = null;
        }
        monitoringOverlay.classList.add('hidden');
        targetStation = null;
    }

    function checkProximity(position) {
        if (!targetStation) return;

        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        // Calculate Distance using Haversine Formula
        // Note: The API returns stations with x(long) and y(lat)
        const distance = getDistanceFromLatLonInM(
            currentLat,
            currentLng,
            targetStation.y,
            targetStation.x
        );

        targetDistanceEl.textContent = Math.round(distance) + 'm';

        // Trigger if closer than 500m (adjust as needed)
        if (distance < 500) {
            triggerAlarm();
        }
    }

    function triggerAlarm() {
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([1000, 500, 1000]);
        }

        // Notification
        new Notification("もうすぐ到着します！", {
            body: `${targetStation.name}駅まであと${targetDistanceEl.textContent}`,
            icon: "https://cdn-icons-png.flaticon.com/512/1063/1063305.png"
        });

        // Optional: Stop monitoring after trigger to avoid spam
        // stopMonitoring(); 
        // Or just alert once:
        // alert(`${targetStation.name}駅に近づきました！`);
    }

    // Helper: Haversine Formula for distance
    function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radius of the earth in m
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in m
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
});
