/* --- FIREBASE CONFIG --- */
const API_KEY = "AIzaSyBZg9NpbBAg8dKHkCbYf4J_2bpHH2ZJWWI";
const DATABASE_URL = "https://absensi-4389a-default-rtdb.firebaseio.com/";
const IMGBB_KEY = "67650d8ee67ebb8bba94f3bb2c72eb4f"; 

/* --- LOCAL STORAGE HELPER --- */
const DB_KEY = 'absensi_app_db_v9';

const initialData = {
    schoolName: "SMK Teknologi Maju",
    users: [
        { id: 1, nama: "Administrator", email: "admin@sekolah.sch.id", password: "admin123", role: "admin", photoUrl: "https://ui-avatars.com/api/?name=Admin&background=ff9800&color=fff" },
        { id: 2, nama: "Budi Santoso (Guru)", email: "guru@sekolah.sch.id", password: "guru123", role: "guru", photoUrl: "https://ui-avatars.com/api/?name=Guru&background=00bcd4&color=fff" }
    ],
    attendance: [],
    codes: [],
    currentUser: null
};

function getDB() {
    const stored = localStorage.getItem(DB_KEY);
    if (stored) return JSON.parse(stored);
    
    // Initialize defaults if empty
    const db = JSON.parse(JSON.stringify(initialData));
    saveDB(db);
    return db;
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* --- FIREBASE SYNC FUNCTIONS --- */
async function syncUserToFirebase(user) {
    const url = `${DATABASE_URL}users/${user.id}.json`;
    const firebaseData = {
        id: parseInt(user.id),
        nama: user.nama,
        kelas: user.kelas,
        jurusan: user.jurusan,
        delayOut: parseInt(user.delayOut || 60)
    };
    try {
        await fetch(url, { method: 'PUT', body: JSON.stringify(firebaseData) });
        console.log("Firebase synced user", user.id);
    } catch(e) { console.error("Firebase Sync Error:", e); }
}

async function syncAttendanceToFirebase(log, user) {
    const dateStr = new Date(log.timestamp).toISOString().split('T')[0];
    const timeStr = new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    const url = `${DATABASE_URL}absensi/${dateStr}/${log.studentId}.json`;
    
    const firebaseData = {
        nama: user.nama,
        kelas: user.kelas,
        jurusan: user.jurusan,
        in: timeStr,
        out: "" 
    };
    try {
        await fetch(url, { method: 'PUT', body: JSON.stringify(firebaseData) });
        console.log("Firebase synced attendance", log.id);
    } catch(e) { console.error("Firebase Sync Error:", e); }
}

async function uploadImageToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if(data.success) return `https://wsrv.nl/?url=${encodeURIComponent(data.data.image.url)}`;
        return null;
    } catch(e) { return null; }
}