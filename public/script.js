// إعداد مشغل الفيديو Plyr
const player = new Plyr('#player');
let currentSeries = null;
let currentEpisodeIndex = 0;

// --- 1. قسم تسجيل الدخول (Login) ---
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert("يرجى إدخال اسم المستخدم وكلمة السر");
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            // تخزين البيانات في المتصفح ليبقى المستخدم مسجلاً دخوله
            localStorage.setItem('username', data.username);
            localStorage.setItem('role', data.role);

            alert("تم تسجيل الدخول بنجاح!");

            // التوجيه التلقائي حسب الرتبة
            if (data.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            alert("خطأ: " + (data.error || "بيانات الدخول غير صحيحة"));
        }
    } catch (err) {
        alert("تعذر الاتصال بالسيرفر. تأكد من تشغيل node server.js");
    }
}

// --- 2. قسم صفحة المشاهدة (Watch Page) ---

async function initWatchPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) return;

    try {
        const res = await fetch('/api/series');
        const allSeries = await res.json();
        currentSeries = allSeries.find(s => s._id === id);

        if (currentSeries) {
            document.getElementById('video-title').innerText = currentSeries.title;
            document.getElementById('series-desc').innerText = currentSeries.desc;
            
            renderEpisodes();
            if (currentSeries.episodes && currentSeries.episodes.length > 0) {
                selectEpisode(0); // تشغيل أول حلقة تلقائياً
            }
            displayComments();
        }
    } catch (error) {
        console.error("خطأ في جلب البيانات:", error);
    }
}

// عرض قائمة الحلقات في الجانب
function renderEpisodes() {
    const epList = document.getElementById('episodes-list');
    if (!epList) return;

    epList.innerHTML = currentSeries.episodes.map((ep, index) => `
        <button class="ep-btn ${index === 0 ? 'active' : ''}" 
                id="btn-ep-${index}" 
                onclick="selectEpisode(${index})">
            ${ep.title}
        </button>
    `).join('');
}

// عند الضغط على حلقة معينة: عرض الجودات والتحميل
function selectEpisode(index) {
    currentEpisodeIndex = index;
    const episode = currentSeries.episodes[index];
    
    // تفعيل الزر المختار
    document.querySelectorAll('.ep-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-ep-${index}`);
    if (activeBtn) activeBtn.classList.add('active');

    // عرض أزرار اختيار الجودة (Feature المضافة)
    const qualityBox = document.getElementById('quality-container');
    if (qualityBox) {
        qualityBox.innerHTML = `<strong>📺 اختر الجودة:</strong> ` + episode.sources.map((src, i) => `
            <button class="btn-quality ${i === 0 ? 'active-q' : ''}" 
                    onclick="playVideo('${src.link}', this)">
                ${src.quality}
            </button>
        `).join('');
    }

    // عرض روابط التحميل لكل جودة
    const downloadBox = document.getElementById('download-container');
    if (downloadBox) {
        downloadBox.innerHTML = `<strong>⬇️ روابط التحميل:</strong> ` + episode.sources.map(src => `
            <a href="/video/${src.link}" target="_blank" class="btn-download" download>
                تحميل ${src.quality}
            </a>
        `).join('');
    }

    // تشغيل أول جودة متوفرة تلقائياً
    if (episode.sources.length > 0) {
        playVideo(episode.sources[0].link, document.querySelector('.btn-quality'));
    }
}

// تغيير الفيديو في المشغل
function playVideo(link, btnElement) {
    const videoSource = `/video/${link}`;
    player.source = {
        type: 'video',
        sources: [{ src: videoSource, type: 'video/mp4' }]
    };
    player.play();

    // تحديث شكل أزرار الجودة
    if (btnElement) {
        document.querySelectorAll('.btn-quality').forEach(btn => btn.classList.remove('active-q'));
        btnElement.classList.add('active-q');
    }
}

// --- 3. تشغيل الدوال عند تحميل الصفحة ---
window.onload = () => {
    if (window.location.pathname.includes('watch.html')) {
        initWatchPage();
    }
};