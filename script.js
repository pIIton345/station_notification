document.addEventListener('DOMContentLoaded', () => {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const statusMessage = document.getElementById('statusMessage');
    const resultContainer = document.getElementById('resultContainer');
    const stationList = document.getElementById('stationList');

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

    function successCallback(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        updateStatus('周辺の駅を検索中...', 'loading');
        fetchStations(latitude, longitude);
    }

    function errorCallback(error) {
        getLocationBtn.disabled = false;
        switch(error.code) {
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
        // HeartRails Express API
        // http://express.heartrails.com/api.html
        const url = `https://express.heartrails.com/api/json?method=getStations&x=${long}&y=${lat}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('API request failed');
            }
            const data = await response.json();

            if (!data.response || !data.response.station) {
                updateStatus('近くに駅が見つかりませんでした。', 'error');
                getLocationBtn.disabled = false;
                return;
            }

            displayStations(data.response.station);
            updateStatus('検索完了！', 'success');
            getLocationBtn.disabled = false;

        } catch (error) {
            console.error('Error fetching stations:', error);
            updateStatus('駅情報の取得に失敗しました。', 'error');
            getLocationBtn.disabled = false;
        }
    }

    function displayStations(stations) {
        // API might return a single object instead of array if only 1 result
        const stationArray = Array.isArray(stations) ? stations : [stations];

        stationList.innerHTML = '';
        
        stationArray.forEach((station, index) => {
            const li = document.createElement('li');
            li.className = 'station-item';
            li.style.animationDelay = `${index * 0.05}s`; // Staggered animation

            li.innerHTML = `
                <div class="station-info">
                    <span class="station-name">${station.name}駅</span>
                    <span class="station-line">${station.line}</span>
                </div>
                <div class="station-distance">
                    ${station.distance}m
                </div>
            `;
            stationList.appendChild(li);
        });

        resultContainer.classList.remove('hidden');
    }

    function updateStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message'; // Reset classes
        if (type === 'error') {
            statusMessage.style.color = '#ef4444';
        } else if (type === 'success') {
            statusMessage.style.color = '#10b981';
        } else {
            statusMessage.style.color = '#64748b';
        }
    }
});
