const { createApp, ref, computed, onMounted, onUnmounted, reactive, toRefs } = Vue;

createApp({
    setup() {
        // --- STATE ---
        const db = ref(getDB());
        const currentUser = ref(db.value.currentUser);
        const schoolName = ref(db.value.schoolName);
        const authMode = ref('login'); // login | register
        const activeTab = ref('attendance');
        const currentTime = ref('');
        const showPassword = reactive({ login: false });
        
        // Forms
        const loginForm = reactive({ email: '', password: '' });
        const regMode = ref('siswa');
        const regSiswa = reactive({ id: '', email: '', password: '', code: '' });
        const regGuru = reactive({ nama: '', email: '', password: '', code: '' });
        const studentForm = reactive({ mode: 'add', id: '', nama: '', kelas: '', jurusan: '', delay: '60' });
        const profileForm = reactive({ nama: '' });
        const changePassForm = reactive({ old: '', new: '', confirm: '' });
        const genForm = reactive({ type: 'siswa', studentId: '' });
        
        // Filters
        const filterKelas = ref('all');
        const filterJurusan = ref('all');
        const filterDate = ref('all');
        const searchStudent = ref('');
        const searchUser = ref('');

        // UI States
        const modals = reactive({ profile: false, changePass: false, generate: false });
        const toast = reactive({ show: false, message: '', type: 'success', timer: null });
        const generatedCode = ref('');
        
        // Previews
        const siswaPreview = reactive({ nama: '', kelas: '', hasAccount: false, error: '' });

        // --- COMPUTED ---
        const availableTabs = computed(() => {
            const role = currentUser.value?.role;
            const tabs = [
                { id: 'attendance', label: 'Data Absensi' },
                { id: 'students', label: 'Data Siswa (FP)' },
                { id: 'users', label: 'Manajemen User' },
                { id: 'config', label: 'Pengaturan' },
                { id: 'guide', label: 'Panduan' }
            ];
            if (role === 'siswa') return tabs.filter(t => ['attendance', 'guide'].includes(t.id));
            return tabs.filter(t => role === 'guru' ? t.id !== 'config' : true); // Admin all, Guru no config
        });

        const roleBadgeClass = (role) => {
            return role === 'admin' ? 'bg-secondary/20 border border-secondary text-secondary' : 
                   role === 'guru' ? 'bg-primary/20 border border-primary text-primary' : 'bg-gray-600/20 border border-gray-500 text-gray-400';
        };

        const filteredStudents = computed(() => {
            return db.value.users.filter(u => u.role === 'siswa' && u.nama.toLowerCase().includes(searchStudent.value.toLowerCase()));
        });

        const studentsWithoutAccount = computed(() => {
            return db.value.users.filter(u => u.role === 'siswa' && !u.email);
        });

        const uniqueClasses = computed(() => [...new Set(db.value.users.filter(u=>u.role==='siswa').map(s => s.kelas))].sort());
        const uniqueMajors = computed(() => [...new Set(db.value.users.filter(u=>u.role==='siswa').map(s => s.jurusan))].sort());

        const filteredAttendance = computed(() => {
            let data = db.value.attendance.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (filterDate.value === 'today') {
                const today = new Date().toISOString().split('T')[0];
                data = data.filter(r => r.timestamp.includes(today));
            }

            if (currentUser.value.role === 'siswa') {
                data = data.filter(r => r.studentId == currentUser.value.id);
            } else {
                if (filterKelas.value !== 'all') data = data.filter(r => r.kelas === filterKelas.value);
                if (filterJurusan.value !== 'all') data = data.filter(r => r.jurusan === filterJurusan.value);
            }
            return data;
        });

        const sortedCodes = computed(() => [...db.value.codes].reverse());
        
        const filteredUsers = computed(() => {
            return db.value.users.filter(u => 
                u.nama.toLowerCase().includes(searchUser.value.toLowerCase()) || 
                u.email?.toLowerCase().includes(searchUser.value.toLowerCase())
            );
        });

        // --- METHODS ---

        const showToast = (msg, type='success') => {
            toast.message = msg;
            toast.type = type;
            toast.show = true;
            if (toast.timer) clearTimeout(toast.timer);
            toast.timer = setTimeout(() => { toast.show = false; }, 3000);
        };

        const updateDB = () => {
            saveDB(db.value);
            currentUser.value = db.value.currentUser; // Re-sync reactive ref
        };

        const handleLogin = () => {
            const user = db.value.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
            if (user) {
                db.value.currentUser = user;
                updateDB();
                showToast(`Selamat datang, ${user.nama}`);
            } else {
                showToast("Email atau Password salah!", "error");
            }
        };

        const logout = () => {
            db.value.currentUser = null;
            updateDB();
            location.reload();
        };

        const checkSiswaId = () => {
            const id = regSiswa.id;
            const student = db.value.users.find(u => u.id == id && u.role === 'siswa');
            
            if (student) {
                if (student.email) {
                    siswaPreview.nama = student.nama;
                    siswaPreview.kelas = `${student.kelas} - ${student.jurusan}`;
                    siswaPreview.hasAccount = true;
                    siswaPreview.error = '';
                } else {
                    siswaPreview.nama = student.nama;
                    siswaPreview.kelas = `${student.kelas} - ${student.jurusan}`;
                    siswaPreview.hasAccount = false;
                    siswaPreview.error = '';
                }
            } else {
                siswaPreview.nama = '';
                siswaPreview.kelas = '';
                siswaPreview.hasAccount = false;
                siswaPreview.error = "ID Siswa tidak ditemukan di database.";
            }
        };

        const handleRegister = (type) => {
            if (type === 'siswa') {
                const id = regSiswa.id;
                const student = db.value.users.find(u => u.id == id && u.role === 'siswa');
                
                if (!student) return showToast("ID Siswa tidak ditemukan!", "error");
                if (student.email) return showToast("ID Siswa ini sudah memiliki akun!", "error");

                const codeObj = db.value.codes.find(c => c.code === regSiswa.code.toUpperCase() && c.type === 'siswa' && !c.used && c.targetId == id);
                if (!codeObj) return showToast("Kode tidak valid atau tidak cocok dengan ID!", "error");
                if (db.value.users.find(u => u.email === regSiswa.email)) return showToast("Email sudah terdaftar!", "error");

                student.email = regSiswa.email;
                student.password = regSiswa.password;
                codeObj.used = true;
                codeObj.userId = id;
                
                updateDB();
                syncUserToFirebase(student);
                
                regSiswa.id = ''; regSiswa.email = ''; regSiswa.password = ''; regSiswa.code = '';
                siswaPreview.nama = ''; siswaPreview.kelas = ''; siswaPreview.error = '';
                authMode.value = 'login';
                showToast("Akun Siswa berhasil diaktifkan!");

            } else {
                const codeObj = db.value.codes.find(c => c.code === regGuru.code.toUpperCase() && c.type === 'guru' && !c.used);
                if (!codeObj) return showToast("Kode Registrasi Guru tidak valid!", "error");
                if (db.value.users.find(u => u.email === regGuru.email)) return showToast("Email sudah terdaftar!", "error");

                const newId = Date.now();
                const newGuru = {
                    id: newId,
                    nama: regGuru.nama,
                    email: regGuru.email,
                    password: regGuru.password,
                    role: "guru",
                    photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(regGuru.nama)}&background=random`,
                    kelas: "-", jurusan: "Umum", delayOut: 60
                };

                db.value.users.push(newGuru);
                codeObj.used = true;
                codeObj.userId = newId;
                updateDB();
                
                regGuru.nama = ''; regGuru.email = ''; regGuru.password = ''; regGuru.code = '';
                authMode.value = 'login';
                showToast("Akun Guru berhasil dibuat!");
            }
        };

        const saveStudent = () => {
            const id = parseInt(studentForm.id);
            if (studentForm.mode === 'add') {
                if (db.value.users.find(u => u.id == id)) return showToast("ID sudah terdaftar!", "error");
                
                const newUser = {
                    id, nama: studentForm.nama, kelas: studentForm.kelas,
                    jurusan: studentForm.jurusan, delayOut: studentForm.delay,
                    role: "siswa", email: null, password: null,
                    photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(studentForm.nama)}`
                };
                db.value.users.push(newUser);
                updateDB();
                syncUserToFirebase(newUser);
                showToast("Siswa berhasil ditambahkan");
            } else {
                const idx = db.value.users.findIndex(u => u.id == id);
                if (idx !== -1) {
                    db.value.users[idx].nama = studentForm.nama;
                    db.value.users[idx].kelas = studentForm.kelas;
                    db.value.users[idx].jurusan = studentForm.jurusan;
                    db.value.users[idx].delayOut = studentForm.delay;
                    updateDB();
                    syncUserToFirebase(db.value.users[idx]);
                    showToast("Data diperbarui");
                }
            }
            resetStudentForm();
        };

        const editStudent = (id) => {
            const s = db.value.users.find(u => u.id == id);
            if(s) {
                studentForm.id = s.id; studentForm.nama = s.nama; 
                studentForm.kelas = s.kelas; studentForm.jurusan = s.jurusan;
                studentForm.delay = s.delayOut; studentForm.mode = 'edit';
            }
        };

        const deleteStudent = (id) => {
            if(!confirm("Hapus data siswa ini?")) return;
            fetch(`${DATABASE_URL}users/${id}.json`, { method: 'DELETE' }).then(() => {
                db.value.users = db.value.users.filter(s => s.id != id);
                updateDB();
                showToast("Siswa dihapus");
            });
        };

        const resetStudentForm = () => {
            studentForm.mode = 'add'; studentForm.id = ''; studentForm.nama = '';
            studentForm.kelas = ''; studentForm.jurusan = ''; studentForm.delay = '60';
        };

        const openGenerateModal = (type) => {
            genForm.type = type;
            genForm.studentId = '';
            modals.generate = true;
        };

        const confirmGenerate = () => {
            let targetId = null;
            if (genForm.type === 'siswa') {
                targetId = genForm.studentId;
                if (!targetId) return showToast("Pilih siswa terlebih dahulu!", "error");
                
                // Final check duplikasi
                const targetStudent = db.value.users.find(u => u.id == targetId);
                if (targetStudent && targetStudent.email) return showToast("Siswa ini sudah punya akun!", "error");
            }

            const prefix = genForm.type === 'siswa' ? "REG-S" : "REG-G";
            const randomPart = Math.random().toString(36).substring(2, 14).toUpperCase();
            const code = `${prefix}-${randomPart}`;
            
            db.value.codes.push({
                code, type: genForm.type, targetId, used: false,
                createdAt: new Date().toLocaleDateString(), userId: null
            });
            updateDB();
            modals.generate = false;
            generatedCode.value = `Kode Baru (${genForm.type}): ${code}`;
        };

        const getTargetName = (codeObj) => {
            if (codeObj.type === 'siswa' && codeObj.targetId) {
                const s = db.value.users.find(u => u.id == codeObj.targetId);
                return s ? `Target: ${s.nama}` : `ID: ${codeObj.targetId}`;
            }
            return '-';
        };

        const deleteCode = (codeStr) => {
            if(!confirm("Hapus kode ini?")) return;
            db.value.codes = db.value.codes.filter(c => c.code !== codeStr);
            updateDB();
        };

        const deleteUser = (id) => {
            if(!confirm("Hapus user ini?")) return;
            fetch(`${DATABASE_URL}users/${id}.json`, { method: 'DELETE' }).then(() => {
                db.value.users = db.value.users.filter(u => u.id != id);
                db.value.codes = db.value.codes.map(c => { if(c.userId == id) {c.userId=null; c.used=false;} return c; });
                updateDB();
                showToast("User dihapus");
            });
        };

        const changeUserRole = (id) => {
            const u = db.value.users.find(x => x.id == id);
            const roles = ['admin', 'guru', 'siswa'];
            const newRole = prompt(`Ubah role (${u.role}) ke (admin/guru/siswa):`);
            if (newRole && roles.includes(newRole)) {
                u.role = newRole;
                syncUserToFirebase(u);
                updateDB();
                showToast(`Role diubah jadi ${newRole}`);
            }
        };

        const simulateAttendance = () => {
            const students = db.value.users.filter(u => u.role === 'siswa');
            const s = students[Math.floor(Math.random() * students.length)];
            const status = Math.random() > 0.7 ? 'Terlambat' : 'Hadir';
            
            const log = {
                id: Date.now(), studentId: s.id, fingerprintId: s.id, nama: s.nama,
                kelas: s.kelas, jurusan: s.jurusan, timestamp: new Date().toISOString(), status
            };
            db.value.attendance.unshift(log);
            updateDB();
            syncAttendanceToFirebase(log, s);
            showToast(`Scan: ${s.nama} (${status})`);
        };

        const deleteAttendance = (id) => {
            if(!confirm("Hapus log ini?")) return;
            db.value.attendance = db.value.attendance.filter(r => r.id !== id);
            updateDB();
        };
        
        const editAttendance = (id) => {
            const log = db.value.attendance.find(r => r.id === id);
            const s = prompt("Ubah Status:", log.status);
            if(s) { log.status = s; updateDB(); }
        };

        const exportExcel = () => {
            showToast("Downloading Excel...", "neutral");
            setTimeout(() => {
                let csv = "Waktu,Nama,Kelas,Jurusan,Status\n";
                db.value.attendance.forEach(r => {
                    csv += `${new Date(r.timestamp).toLocaleString()},${r.nama},${r.kelas},${r.jurusan},${r.status}\n`;
                });
                const link = document.createElement("a");
                link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
                link.download = "absensi.csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, 1000);
        };

        const openModal = (name) => { modals[name] = true; if(name==='profile') profileForm.nama = currentUser.value.nama; };
        const closeModal = (name) => { modals[name] = false; };

        const updateProfileName = () => {
            if(!profileForm.nama) return showToast("Nama tidak boleh kosong", "error");
            currentUser.value.nama = profileForm.nama;
            const idx = db.value.users.findIndex(u => u.email === currentUser.value.email);
            if(idx !== -1) {
                db.value.users[idx].nama = profileForm.nama;
                updateDB();
                showToast("Nama diupdate");
            }
        };

        const handleChangePassword = () => {
            const u = db.value.users.find(x => x.email === currentUser.value.email);
            if (u.password !== changePassForm.old) return showToast("Password lama salah", "error");
            if (changePassForm.new.length < 6) return showToast("Min 6 karakter", "error");
            if (changePassForm.new !== changePassForm.confirm) return showToast("Konfirmasi salah", "error");
            
            u.password = changePassForm.new;
            currentUser.value.password = changePassForm.new;
            updateDB();
            closeModal('changePass');
            showToast("Password diubah");
        };

        const uploadProfilePhoto = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const url = await uploadImageToImgBB(file);
            if (url) {
                currentUser.value.photoUrl = url;
                const idx = db.value.users.findIndex(u => u.email === currentUser.value.email);
                if(idx !== -1) db.value.users[idx].photoUrl = url;
                updateDB();
                showToast("Foto diupdate");
            }
        };

        const saveSchoolName = () => {
            db.value.schoolName = schoolName.value;
            updateDB();
            showToast("Nama Sekolah diupdate");
        };

        const resetSystem = () => {
            if(confirm("PERINGATAN: Reset Firebase?")) {
                fetch(`${DATABASE_URL}users.json`, { method: 'DELETE' });
                fetch(`${DATABASE_URL}absensi.json`, { method: 'DELETE' });
                setTimeout(() => location.reload(), 2000);
            }
        };

        // Helpers
        const formatTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        const formatDate = (iso) => new Date(iso).toLocaleDateString('id-ID');
        const renderTable = () => {}; // Placeholder for reactivity
        const renderStudentsTable = () => {};
        const renderUsersTable = () => {};
        
        // --- LIFECYCLE ---
        onMounted(() => {
            setInterval(() => { currentTime.value = new Date().toLocaleTimeString('id-ID'); }, 1000);
            if (db.value.currentUser) {
                authMode.value = 'dashboard';
                profileForm.nama = db.value.currentUser.nama;
            }
        });

        return {
            // State
            db, currentUser, schoolName, authMode, activeTab, currentTime, showPassword,
            loginForm, regMode, regSiswa, regGuru, studentForm, profileForm, changePassForm, genForm,
            filterKelas, filterJurusan, filterDate, searchStudent, searchUser,
            modals, toast, generatedCode, siswaPreview,
            
            // Computed
            availableTabs, roleBadgeClass, filteredStudents, studentsWithoutAccount,
            uniqueClasses, uniqueMajors, filteredAttendance, sortedCodes, filteredUsers,
            
            // Methods
            showToast, handleLogin, logout, checkSiswaId, handleRegister,
            saveStudent, editStudent, deleteStudent, resetStudentForm,
            openGenerateModal, confirmGenerate, getTargetName, deleteCode,
            deleteUser, changeUserRole, simulateAttendance, deleteAttendance, editAttendance, exportExcel,
            openModal, closeModal, updateProfileName, handleChangePassword, uploadProfilePhoto,
            saveSchoolName, resetSystem, formatTime, formatDate
        };
    }
}).mount('#app');