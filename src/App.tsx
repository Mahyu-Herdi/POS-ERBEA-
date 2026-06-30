import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import { initAuth, googleSignIn, getAccessToken, logout } from './lib/firebase';
import { createSpreadsheet, uploadLogoToDrive, updateSheetData, clearSheetData, getSheetData, getOrCreateAppFolder, findSpreadsheetInFolder } from './lib/googleApi';
import { CheckCircle2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppModal } from './components/ModalContext';

import TabKasir from './components/TabKasir';
import TabMeja from './components/TabMeja';
import TabStok from './components/TabStok';
import TabLaporan from './components/TabLaporan';
import TabMasterMenu from './components/TabMasterMenu';
import TabAsetOps from './components/TabAsetOps';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'kasir';
  });
  const [activeSubTab, setActiveSubTab] = useState('sub-sistem');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { popup } = useAppModal();
  
  const { toko, setToko, menu, cart, stokData, transaksiList, hutangList } = useStore();

  const isInitialMount = useRef(true);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
    handleSwipe();
  };

  const handleSwipe = () => {
    const tabs = ['kasir', 'meja', 'stok', 'laporan', 'mesin'];
    const currentIndex = tabs.indexOf(activeTab);
    const minSwipeDistance = 120; // Increased distance to require a longer swipe
    const maxVerticalDistance = 60; // Max allowed vertical movement to count as a horizontal swipe
    
    const xDistance = touchEndX.current - touchStartX.current;
    const yDistance = Math.abs(touchEndY.current - touchStartY.current);

    // Only proceed if it's mostly a horizontal swipe
    if (yDistance > maxVerticalDistance) return;

    // Swipe Left (Next tab) - Can also require starting from the right edge if needed, but long swipe is usually enough
    if (xDistance < -minSwipeDistance) {
      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
    }
    // Swipe Right (Previous tab)
    if (xDistance > minSwipeDistance) {
      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
    }
  };

  useEffect(() => {
    const handleNav = () => setActiveTab('kasir');
    window.addEventListener('navToKasir', handleNav);
    return () => window.removeEventListener('navToKasir', handleNav);
  }, []);

  useEffect(() => {
    document.body.classList.add('dark-mode');
    
    const unsubscribe = initAuth(
      (user, token) => {
        setNeedsAuth(false);
        setUser(user);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        useStore.getState().resetStore();
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      pullFromSheets(false);
    }
  }, [user]);

  useEffect(() => {
    const handleOnline = () => {
      if (user) {
        syncToSheets(false);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (user) {
      // Auto-sync ke cloud 5 detik setelah ada perubahan data lokal
      const timeout = setTimeout(() => {
        syncToSheets(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [toko.nama, toko.logoDriveId, menu, stokData, transaksiList, hutangList, user]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await pullFromSheets(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      let errMsg = err.message || 'Login Gagal';
      if (err.code === 'auth/unauthorized-domain') {
        errMsg = 'Domain ini belum diizinkan di Firebase. Buka Firebase Console > Authentication > Settings > Authorized domains, dan tambahkan domain aplikasi ini.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'Login dibatalkan oleh pengguna.';
      }
      await popup('alert', errMsg, "Login Gagal");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (await popup('confirm', 'Yakin ingin logout? Data lokal akan dihapus dan harus sync dari cloud saat login kembali.', 'Konfirmasi Logout')) {
      await logout();
      useStore.getState().resetStore();
      setUser(null);
      setNeedsAuth(true);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setToko({ logoBase64: event.target?.result as string });
    };
    reader.readAsDataURL(file);

    const token = await getAccessToken();
    if (token) {
      try {
        setIsSaving(true);
        const folderId = await getOrCreateAppFolder(token);
        const fileId = await uploadLogoToDrive(file, folderId, token);
        setToko({ logoDriveId: fileId });
        await popup('alert', 'Logo berhasil diunggah ke Google Drive dan tersimpan permanen!', 'Berhasil');
        await syncToSheets(false); 
      } catch (err: any) {
        console.error(err);
        const msg = err.message || String(err);
        if (msg.toLowerCase().includes('invalid authentication') || msg.toLowerCase().includes('oauth 2 access token') || msg.includes('401')) {
          await popup('alert', 'Sesi login Google telah kedaluwarsa. Silakan login kembali.', 'Sesi Berakhir');
          await logout();
          useStore.getState().resetStore();
          setUser(null);
          setNeedsAuth(true);
        } else {
          await popup('alert', `Gagal mengunggah logo: ${msg}`, "Gagal");
        }
      } finally {
        setIsSaving(false);
      }
    } else {
      await popup('alert', 'Harap login Google terlebih dahulu untuk menyimpan ke Drive.', "Gagal");
    }
  };

  const checkOrCreateSpreadsheet = async (token: string, folderId: string, currentSheetId: string | null) => {
    let sheetId = currentSheetId;
    let isValid = false;

    if (sheetId) {
      try {
        await getSheetData(sheetId, 'Toko!A1', token);
        isValid = true;
      } catch (err: any) {
        if (err.message?.toLowerCase().includes('not found') || err.message?.includes('404')) {
          isValid = false;
        }
      }
    }

    if (!isValid) {
      sheetId = await findSpreadsheetInFolder(folderId, token);
      if (!sheetId) {
        sheetId = await createSpreadsheet(`Data POS - ${toko.nama || 'Warkop'}`, folderId, token);
      }
      if (sheetId) {
        setToko({ spreadsheetId: sheetId });
        localStorage.setItem('spreadsheetId', sheetId);
      }
    }
    
    return sheetId;
  };

  const syncToSheets = async (showPrompt = true) => {
    const token = await getAccessToken();
    if (!token) return;

    try {
      if (showPrompt) setIsSaving(true);
      
      const folderId = await getOrCreateAppFolder(token);
      let sheetId = toko.spreadsheetId || localStorage.getItem('spreadsheetId');
      
      sheetId = await checkOrCreateSpreadsheet(token, folderId, sheetId);
      if (!sheetId) throw new Error("Gagal membuat atau menemukan spreadsheet.");

      try {
        const tokoData = [
          ['Nama Toko', 'Logo ID (Drive)'],
          [toko.nama, toko.logoDriveId || '']
        ];
        await updateSheetData(sheetId, 'Toko!A1:B2', tokoData, token);
      } catch(e) { console.warn(e); }
      
      try {
        const menuData = [['ID', 'Nama', 'Harga']];
        menu.forEach(m => menuData.push([m.id, m.name, m.harga.toString()]));
        await clearSheetData(sheetId, 'Menu!A1:C1000', token);
        await updateSheetData(sheetId, 'Menu!A1:C1000', menuData, token);
      } catch(e) { console.warn(e); }

      const state = useStore.getState();

      try {
        const stokArr = [['ID', 'Nama', 'Sisa', 'Unit', 'Harga Per Unit']];
        state.stokData.forEach(s => stokArr.push([s.id, s.nama, s.sisa.toString(), s.unit, s.hargaPerUnit.toString()]));
        await clearSheetData(sheetId, 'Aset!A1:E1000', token);
        await updateSheetData(sheetId, 'Aset!A1:E1000', stokArr, token);
      } catch(e) { console.warn(e); }

      try {
        const txArr = [['Tgl', 'TglRaw', 'Tipe', 'Ident', 'Total', 'Bayar', 'Metode']];
        state.transaksiList.forEach(t => txArr.push([t.tgl, t.tglRaw, t.tipe, t.ident, t.total.toString(), t.bayar.toString(), t.metode]));
        await clearSheetData(sheetId, 'Transaksi!A1:G5000', token);
        await updateSheetData(sheetId, 'Transaksi!A1:G5000', txArr, token);
      } catch(e) { console.warn(e); }

      if (showPrompt) await popup('alert', 'Berhasil! Data telah disinkronisasikan ke Google Sheets.', "Sukses");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || String(error);
      if (msg.toLowerCase().includes('invalid authentication') || msg.toLowerCase().includes('oauth 2 access token') || msg.includes('401')) {
        if (showPrompt) await popup('alert', 'Sesi login Google telah kedaluwarsa. Silakan login kembali.', 'Sesi Berakhir');
        await logout();
        useStore.getState().resetStore();
        setUser(null);
        setNeedsAuth(true);
      } else {
        if (showPrompt) await popup('alert', `Gagal sinkronisasi: ${msg}`, "Gagal");
      }
    } finally {
      if (showPrompt) setIsSaving(false);
    }
  };

  const pullFromSheets = async (showPrompt = true) => {
    const token = await getAccessToken();
    if (!token) return;
    
    try {
      if (showPrompt) setIsSaving(true);

      const folderId = await getOrCreateAppFolder(token);
      let sheetId = toko.spreadsheetId || localStorage.getItem('spreadsheetId');
      
      sheetId = await checkOrCreateSpreadsheet(token, folderId, sheetId);
      if (!sheetId) throw new Error("Gagal membuat atau menemukan spreadsheet.");

      const data = await getSheetData(sheetId, 'Toko!A1:B2', token);
      if (data && data.length > 1) {
        setToko({ nama: data[1][0], logoDriveId: data[1][1] });
      }

      try {
        const menuRes = await getSheetData(sheetId, 'Menu!A1:C1000', token);
        if (menuRes && menuRes.length > 1) {
          const newMenu = menuRes.slice(1).map((row: any) => ({
            id: row[0],
            name: row[1],
            harga: parseFloat(row[2]) || 0
          }));
          useStore.getState().setFullState({ menu: newMenu });
        } else if (menuRes) {
          useStore.getState().setFullState({ menu: [] });
        }
      } catch (e) { console.log('No Menu sheet or empty'); }

      try {
        const stokRes = await getSheetData(sheetId, 'Aset!A1:E1000', token);
        if (stokRes && stokRes.length > 1) {
          const newStok = stokRes.slice(1).map((row: any) => ({
            id: row[0],
            nama: row[1],
            sisa: parseFloat(row[2]) || 0,
            unit: row[3] || '',
            hargaPerUnit: parseFloat(row[4]) || 0
          }));
          useStore.getState().setStokData(newStok);
        } else if (stokRes) {
          useStore.getState().setStokData([]);
        }
      } catch (e) { console.log('No Aset sheet or empty'); }

      try {
        const txRes = await getSheetData(sheetId, 'Transaksi!A1:G5000', token);
        if (txRes && txRes.length > 1) {
          const newTx = txRes.slice(1).map((row: any) => ({
            tgl: row[0],
            tglRaw: row[1],
            tipe: row[2],
            ident: row[3],
            total: parseFloat(row[4]) || 0,
            bayar: parseFloat(row[5]) || 0,
            metode: row[6],
            items: [] // Can't easily retrieve full items from simple rows, but this fulfills basic history
          }));
          useStore.getState().setFullState({ transaksiList: newTx });
        } else if (txRes) {
          useStore.getState().setFullState({ transaksiList: [] });
        }
      } catch (e) { console.log('No Tx sheet or empty'); }

      if (showPrompt) await popup('alert', 'Data berhasil ditarik dari Spreadsheet!', "Berhasil");
    } catch (error: any) {
      console.error(error);
      const msg = error.message || String(error);
      if (msg.toLowerCase().includes('invalid authentication') || msg.toLowerCase().includes('oauth 2 access token') || msg.includes('401')) {
        if (showPrompt) await popup('alert', 'Sesi login Google telah kedaluwarsa. Silakan login kembali.', 'Sesi Berakhir');
        await logout();
        useStore.getState().resetStore();
        setUser(null);
        setNeedsAuth(true);
      } else {
        if (showPrompt) await popup('alert', `Gagal menarik data: ${msg}`, "Gagal");
      }
    } finally {
      if (showPrompt) setIsSaving(false);
    }
  };

  return (
    <div 
      className={document.body?.className || ''} 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '100vh', overflowX: 'hidden' }}
    >
      {isSaving && (
        <div className="modal-overlay active">
          <div className="clay-card modal-box" style={{ textAlign: 'center', margin: 'auto' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Menyimpan Data...</h3>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <div className="spinner"></div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Sinkronisasi dengan Google Workspace</p>
          </div>
        </div>
      )}

      {(activeTab === 'meja') && (
        <header>
          <div className="search-box">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </header>
      )}

      {/* TABS */}
      <section className={`container-tab ${activeTab === 'kasir' ? 'active' : ''}`}>
        <TabKasir />
      </section>
      
      <section className={`container-tab ${activeTab === 'meja' ? 'active' : ''}`}>
        <TabMeja searchQuery={searchQuery} />
      </section>
      
      <section className={`container-tab ${activeTab === 'stok' ? 'active' : ''}`}>
        <TabStok />
      </section>

      <section className={`container-tab ${activeTab === 'laporan' ? 'active' : ''}`}>
        <TabLaporan />
      </section>

      <section className={`container-tab ${activeTab === 'mesin' ? 'active' : ''}`}>
        <div className="clay-card">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <button className={`btn sub-tab-btn ${activeSubTab === 'sub-menu' ? 'active' : ''}`} onClick={() => setActiveSubTab('sub-menu')}>Master Menu</button>
            <button className={`btn sub-tab-btn ${activeSubTab === 'sub-aset' ? 'active' : ''}`} onClick={() => setActiveSubTab('sub-aset')}>Aset & Ops</button>
            <button className={`btn sub-tab-btn ${activeSubTab === 'sub-sistem' ? 'active' : ''}`} onClick={() => setActiveSubTab('sub-sistem')}>Toko & Sistem</button>
          </div>

          <div style={{ position: 'relative' }}>
            <AnimatePresence mode="wait">
              {activeSubTab === 'sub-sistem' && (
                <motion.div 
                  key="sub-sistem"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="sub-tab-content active"
                >
                  <h3 style={{ marginBottom: '15px', textAlign: 'center', color: 'var(--text-main)' }}>Pengaturan Identitas Toko & Integrasi Google Sheets</h3>
              
              {needsAuth ? (
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <button className="btn bg-blue" onClick={handleLogin} disabled={isLoggingIn} style={{ width: '100%', marginBottom: '10px' }}>
                    {isLoggingIn ? 'Memproses...' : 'Sign in with Google untuk Cloud Sync'}
                  </button>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Login diperlukan untuk menyimpan data ke Google Sheets & Drive.</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '13px', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={16} /> Tersambung sebagai: {user?.email} 
                  <button onClick={handleLogout} style={{ marginLeft: '10px', color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Logout</button>
                </div>
              )}

              <div className="bg-dim" style={{ padding: '15px', borderRadius: '15px', marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nama Toko</label>
                <input 
                  type="text" 
                  className="btn-input" 
                  value={toko.nama} 
                  onChange={(e) => setToko({ nama: e.target.value })} 
                  placeholder="Masukkan Nama Toko" 
                  style={{ margin: 0, marginBottom: '15px', width: '100%' }}
                />

                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Upload Logo Toko (Tersimpan ke Google Drive)</label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="file" accept="image/*" className="btn-input" style={{ fontSize: '12px', margin: 0, flex: 1 }} onChange={handleLogoUpload} />
                  <button className="btn bg-green" onClick={() => syncToSheets(true)} style={{padding: '12px 20px', margin: 0}}>Simpan</button>
                </div>
                
                {toko.logoBase64 && (
                  <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <img src={toko.logoBase64} style={{ width: '80px', borderRadius: '10px', boxShadow: 'var(--clay-shadow-out)' }} alt="Logo" />
                    <p style={{fontSize: '11px', color: 'var(--green)', marginTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'}}>
                      <Check size={12} /> Logo Tersimpan Permanen
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                <button className="btn bg-blue" onClick={() => syncToSheets(true)} style={{ width: '100%', padding: '12px' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" style={{marginRight: '5px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Simpan Paksa ke Cloud
                </button>
                <button className="btn bg-orange" onClick={() => pullFromSheets(true)} style={{ width: '100%', padding: '12px', color: 'white' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" style={{marginRight: '5px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Tarik Paksa dari Cloud
                </button>
                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Gunakan tombol di atas untuk sinkronisasi data secara manual jika dirasa perlu.
                </p>
              </div>

              <hr style={{ border: 0, borderTop: '2px solid rgba(163,177,198,0.3)', margin: '25px 0' }} />
              
              <div className="flex-between">
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Tema Gelap (Dark Mode)</span>
                <button className="btn bg-blue" onClick={() => document.body.classList.toggle('dark-mode')}>Alihkan Tema</button>
                  </div>
                </motion.div>
              )}
              
              {activeSubTab === 'sub-menu' && (
                <motion.div 
                  key="sub-menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="sub-tab-content active" 
                >
                  <TabMasterMenu />
                </motion.div>
              )}
              
              {activeSubTab === 'sub-aset' && (
                <motion.div 
                  key="sub-aset"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="sub-tab-content active"
                >
                  <TabAsetOps />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'kasir' ? 'active' : ''}`} onClick={() => setActiveTab('kasir')}>
          <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg> Kasir
        </button>
        <button className={`nav-item ${activeTab === 'meja' ? 'active' : ''}`} onClick={() => setActiveTab('meja')}>
          <svg viewBox="0 0 24 24"><path d="M4 18h16V6H4v12zm9-10h5v3h-5V8zm-7 0h5v5H6V8zm0 7h5v1h-5v-1zm7-2h5v3h-5v-3z"/></svg> Denah
        </button>
        <button className={`nav-item ${activeTab === 'stok' ? 'active' : ''}`} onClick={() => setActiveTab('stok')}>
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg> Stok
        </button>
        <button className={`nav-item ${activeTab === 'laporan' ? 'active' : ''}`} onClick={() => setActiveTab('laporan')}>
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg> Lap
        </button>
        <button className={`nav-item ${activeTab === 'mesin' ? 'active' : ''}`} onClick={() => setActiveTab('mesin')}>
          <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg> Master
        </button>
      </nav>
    </div>
  );
}
