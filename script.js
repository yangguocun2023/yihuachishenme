let map;
let placeSearch;
let autoComplete;
let currentPosition = null;
let markers = [];
let searchTimer = null;
let allRestaurants = [];
let currentCategory = 'all';
let currentRange = 500;

const addressInput = document.getElementById('address-input');
const addressSuggestions = document.getElementById('address-suggestions');
const locateBtn = document.getElementById('locate-btn');
const searchBtn = document.getElementById('search-btn');
const restaurantList = document.getElementById('restaurant-list');
const loading = document.getElementById('loading');
const resultInfo = document.getElementById('result-info');
const resultCount = document.getElementById('result-count');
const errorMessage = document.getElementById('error-message');
const mapContainer = document.getElementById('map-container');
const randomBtn = document.getElementById('random-btn');

function initMap() {
    if (typeof AMap === 'undefined') {
        showError('地图加载失败，请刷新页面重试');
        return;
    }

    map = new AMap.Map('map-container', {
        zoom: 15,
        center: [116.397428, 39.90923],
        resizeEnable: true
    });

    placeSearch = new AMap.PlaceSearch({
        city: '',
        citylimit: false,
        pageSize: 200,
        pageIndex: 1,
        extensions: 'all'
    });

    AMap.plugin('AMap.AutoComplete', function() {
        autoComplete = new AMap.AutoComplete({
            city: '全国',
            citylimit: false,
            outputType: 'selector',
            pageSize: 10
        });
    });
    
    initEventListeners();
}

function initEventListeners() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            filterAndDisplayResults();
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentRange = parseInt(this.dataset.range);
            if (currentPosition) {
                performSearch();
            }
        });
    });
}

function showLoading() {
    hideError();
    restaurantList.innerHTML = '';
    resultInfo.style.display = 'none';
    loading.style.display = 'block';
    searchBtn.disabled = true;
}

function hideLoading() {
    loading.style.display = 'none';
    searchBtn.disabled = false;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    hideLoading();
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showEmptyState() {
    restaurantList.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">🍽️</div>
            <h3>附近没有找到餐厅</h3>
            <p>试试其他位置或者扩大搜索范围</p>
        </div>
    `;
    resultInfo.style.display = 'none';
}

function getLocation() {
    hideSuggestions();
    
    if (!navigator.geolocation) {
        useAMapIPLocate();
        return;
    }

    locateBtn.classList.add('locating');
    locateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" style="animation: spin 1s linear infinite;">
            <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
        <span>定位中...</span>
    `;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lng = position.coords.longitude;
            const lat = position.coords.latitude;
            currentPosition = [lng, lat];
            reverseGeocode(lng, lat);
        },
        (error) => {
            console.log('浏览器定位失败，使用IP定位:', error.message);
            useAMapIPLocate();
        },
        {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000
        }
    );
}

function useAMapIPLocate() {
    AMap.plugin('AMap.CitySearch', function() {
        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity(function(status, result) {
            locateBtn.classList.remove('locating');
            locateBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
                <span>定位</span>
            `;

            if (status === 'success' && result.rectangle) {
                const rect = result.rectangle.split(';')[0].split(',');
                currentPosition = [parseFloat(rect[0]), parseFloat(rect[1])];
                addressInput.value = result.city || '当前位置';
                
                if (map) {
                    map.setCenter(currentPosition);
                }
                
                setTimeout(() => {
                    performSearch();
                }, 300);
            } else {
                showError('定位失败，请手动输入地址');
            }
        });
    });
}

function reverseGeocode(lng, lat) {
    const geocoder = new AMap.Geocoder({
        radius: 1000,
        extensions: 'all'
    });

    geocoder.getAddress([lng, lat], function(status, result) {
        locateBtn.classList.remove('locating');
        locateBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
            <span>定位</span>
        `;

        if (status === 'complete' && result.regeocode) {
            const address = result.regeocode.formattedAddress;
            addressInput.value = address.replace(/^(中国|北京市|上海市|天津市|重庆市|广东省|浙江省|...)/, '');
            
            if (map) {
                map.setCenter(currentPosition);
            }
            
            setTimeout(() => {
                performSearch();
            }, 300);
        } else {
            addressInput.value = '当前定位';
            setTimeout(() => {
                performSearch();
            }, 300);
        }
    });
}

function searchAddress(keyword) {
    if (!autoComplete || !keyword || keyword.length < 2) {
        hideSuggestions();
        return;
    }

    autoComplete.search(keyword, function(status, result) {
        if (status === 'complete' && result.tips && result.tips.length > 0) {
            showSuggestions(result.tips);
        } else {
            hideSuggestions();
        }
    });
}

function showSuggestions(tips) {
    addressSuggestions.innerHTML = '';
    
    tips.forEach(tip => {
        if (!tip.location) return;
        
        const item = document.createElement('div');
        item.className = 'address-suggestion-item';
        item.innerHTML = `
            <span class="icon">📍</span>
            <span class="name">${tip.name}</span>
            <span class="district">${tip.district || ''}</span>
        `;
        
        item.addEventListener('click', () => {
            selectAddress(tip);
        });
        
        addressSuggestions.appendChild(item);
    });
    
    addressSuggestions.classList.add('show');
}

function hideSuggestions() {
    addressSuggestions.classList.remove('show');
}

function selectAddress(tip) {
    addressInput.value = tip.name;
    currentPosition = [tip.location.lng, tip.location.lat];
    hideSuggestions();
    
    if (map) {
        map.setCenter(currentPosition);
    }
    
    performSearch();
}

function searchRestaurants() {
    const address = addressInput.value.trim();
    
    if (!address && !currentPosition) {
        showError('请输入地址或获取定位');
        return;
    }

    showLoading();

    if (!currentPosition && address) {
        const geocoder = new AMap.Geocoder({
            radius: 1000,
            extensions: 'all'
        });

        geocoder.getLocation(address, function(status, result) {
            if (status === 'complete' && result.geocodes.length) {
                const location = result.geocodes[0].location;
                currentPosition = [location.getLng(), location.getLat()];
                performSearch();
            } else {
                showError('无法找到该地址，请重新输入');
            }
        });
    } else {
        performSearch();
    }
}

function performSearch() {
    if (!placeSearch || !currentPosition) {
        showError('请先选择地址或获取定位');
        return;
    }

    showLoading();

    const type = '餐饮服务|中餐厅|西餐厅|小吃快餐|咖啡厅|茶座|酒吧|蛋糕甜品|面馆|火锅|烧烤|日料|韩餐|东南亚菜|快餐|熟食|生鲜果蔬|便利店|小超市';

    placeSearch.setCity('');
    placeSearch.setType(type);
    placeSearch.setPageSize(200);

    placeSearch.searchNearBy('', currentPosition, currentRange, function(status, result) {
        hideLoading();

        if (status === 'complete' && result.poiList && result.poiList.pois) {
            allRestaurants = result.poiList.pois;
            filterAndDisplayResults();
            showRandomBtn();
        } else if (status === 'no_data') {
            allRestaurants = [];
            filterAndDisplayResults();
            hideRandomBtn();
        } else {
            showError('搜索失败，请重试');
            hideRandomBtn();
        }
    });
}

function filterAndDisplayResults() {
    let filteredResults = allRestaurants;
    
    if (currentCategory === 'restaurant') {
        filteredResults = allRestaurants.filter(poi => {
            const type = poi.type || '';
            return type.includes('餐厅') || type.includes('中餐') || type.includes('西餐') || 
                   type.includes('快餐') || type.includes('火锅') || type.includes('烧烤') || 
                   type.includes('日料') || type.includes('韩餐') || type.includes('面馆');
        });
    } else if (currentCategory === 'drink') {
        filteredResults = allRestaurants.filter(poi => {
            const type = poi.type || '';
            return type.includes('茶') || type.includes('咖啡') || type.includes('饮料') || 
                   type.includes('奶茶') || type.includes('甜品') || type.includes('蛋糕');
        });
    }
    
    displayResults(filteredResults);
}

function displayResults(pois) {
    clearMarkers();
    
    resultCount.textContent = pois.length;
    resultInfo.style.display = 'block';
    
    mapContainer.style.display = 'block';
    map.setCenter(currentPosition);
    map.setZoom(currentRange <= 500 ? 15 : currentRange <= 1000 ? 14 : 13);

    restaurantList.innerHTML = '';

    pois.forEach((poi, index) => {
        const marker = new AMap.Marker({
            position: poi.location,
            title: poi.name,
            icon: new AMap.Icon({
                size: new AMap.Size(32, 32),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                imageSize: new AMap.Size(32, 32)
            })
        });
        
        marker.setMap(map);
        markers.push(marker);

        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.dataset.index = index;
        
        let typeText = poi.type || '餐厅';
        typeText = typeText.replace(/餐饮服务|/g, '').split(';')[0] || '餐厅';
        
        const imgUrl = poi.photos && poi.photos.length > 0 
            ? poi.photos[0].url 
            : `https://img.icons8.com/color/200/restaurant.png`;
        
        card.innerHTML = `
            <img class="restaurant-img" src="${imgUrl}" alt="${poi.name}" onerror="this.src='https://img.icons8.com/color/200/restaurant.png'">
            <div class="restaurant-content">
                <div class="restaurant-header">
                    <div class="restaurant-name">${poi.name}</div>
                    <div class="restaurant-tag">${typeText}</div>
                </div>
                <div class="restaurant-info">
                    <div class="restaurant-info-item">
                        <span>📍</span>
                        <span>${poi.distance ? poi.distance + '米' : '未知'}</span>
                    </div>
                    ${poi.tel ? `
                    <div class="restaurant-info-item">
                        <span>📞</span>
                        <span>${poi.tel}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="restaurant-address">
                    ${poi.address || '地址未知'}
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            map.setCenter(poi.location);
            map.setZoom(17);
            window.open(`https://uri.amap.com/marker?position=${poi.location.lng},${poi.location.lat}&name=${encodeURIComponent(poi.name)}&callnative=1`, '_blank');
        });

        restaurantList.appendChild(card);
    });
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

addressInput.addEventListener('input', function(e) {
    const value = e.target.value.trim();
    
    if (searchTimer) {
        clearTimeout(searchTimer);
    }
    
    if (value.length >= 2) {
        searchTimer = setTimeout(() => {
            searchAddress(value);
        }, 300);
    } else {
        hideSuggestions();
    }
});

addressInput.addEventListener('focus', function() {
    const value = addressInput.value.trim();
    if (value.length >= 2) {
        searchAddress(value);
    }
});

addressInput.addEventListener('blur', function() {
    setTimeout(() => {
        hideSuggestions();
    }, 200);
});

locateBtn.addEventListener('click', getLocation);

searchBtn.addEventListener('click', searchRestaurants);

addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        hideSuggestions();
        const firstSuggestion = addressSuggestions.querySelector('.address-suggestion-item');
        if (firstSuggestion) {
            firstSuggestion.click();
        } else {
            searchRestaurants();
        }
    }
});

function showRandomBtn() {
    if (allRestaurants.length > 0) {
        randomBtn.classList.add('show');
    }
}

function hideRandomBtn() {
    randomBtn.classList.remove('show');
}

function highlightRestaurant(index) {
    const cards = document.querySelectorAll('.restaurant-card');
    cards.forEach(card => card.classList.remove('highlighted'));
    
    if (cards[index]) {
        cards[index].classList.add('highlighted');
        cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const filteredResults = getFilteredResults();
        if (filteredResults[index]) {
            map.setCenter(filteredResults[index].location);
            map.setZoom(17);
        }
    }
}

function getFilteredResults() {
    if (currentCategory === 'all') return allRestaurants;
    
    if (currentCategory === 'restaurant') {
        return allRestaurants.filter(poi => {
            const type = poi.type || '';
            return type.includes('餐厅') || type.includes('中餐') || type.includes('西餐') || 
                   type.includes('快餐') || type.includes('火锅') || type.includes('烧烤') || 
                   type.includes('日料') || type.includes('韩餐') || type.includes('面馆');
        });
    } else if (currentCategory === 'drink') {
        return allRestaurants.filter(poi => {
            const type = poi.type || '';
            return type.includes('茶') || type.includes('咖啡') || type.includes('饮料') || 
                   type.includes('奶茶') || type.includes('甜品') || type.includes('蛋糕');
        });
    }
    return allRestaurants;
}

randomBtn.addEventListener('click', function() {
    const filteredResults = getFilteredResults();
    if (filteredResults.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * filteredResults.length);
    highlightRestaurant(randomIndex);
});

if (document.readyState === 'complete') {
    initMap();
} else {
    window.addEventListener('load', initMap);
}
