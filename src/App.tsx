import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
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
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { popup } = useAppModal();
  
  const { toko, setToko, menu, cart, stokData, transaksiList, hutangList, bebanAktif, keuangan } = useStore();

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

  const GAS_URL = "https://script.google.com/macros/s/AKfycbwlDviJP2_xYtcAm-_j5Co84L3u0dJvaXOgkPj2gu-A1HusgG6Nx2EZV0X6c48B4qNt/exec"; // TEMPEL URL WEB APP APPS SCRIPT ANDA DI SINI

  const syncToSheets = async (showPrompt = true) => {
    if (!GAS_URL) {
      if (showPrompt) await popup('alert', 'URL Apps Script belum diatur di dalam kode sumber.', 'Gagal');
      return;
    }

    try {
      if (showPrompt) setIsSaving(true);
      
      const state = useStore.getState();
      const payload = {
        type: 'SYNC_ALL',
        payload: {
          toko: state.toko,
          menu: state.menu,
          stokData: state.stokData,
          bebanAktif: state.bebanAktif,
          keuangan: state.keuangan,
          transaksiList: state.transaksiList,
          hutangList: state.hutangList,
          stokHistory: state.stokHistory
        }
      };

      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const text = await response.text();
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Apps Script tidak mengembalikan JSON. Cek deployment.");
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("Gagal parsing JSON dari Apps Script.");
      }

      if (result.status === 'success') {
        localStorage.setItem('pos_unsynced', 'false');
        if (showPrompt) await popup('alert', 'Berhasil! Data telah disinkronisasikan ke Google Sheets via Apps Script.', 'Sukses');
      } else {
        throw new Error(result.message || 'Unknown error from Apps Script');
      }
    } catch (error: any) {
      console.error(error);
      if (showPrompt) await popup('alert', `Gagal sinkronisasi: ${error.message}`, "Gagal");
    } finally {
      if (showPrompt) setIsSaving(false);
    }
  };

  const pullFromSheets = async (showPrompt = true) => {
    if (!GAS_URL) {
      if (showPrompt) await popup('alert', 'URL Apps Script belum diatur di dalam kode sumber.', 'Gagal');
      return;
    }
    
    try {
      if (showPrompt) setIsSaving(true);

      const payload = { type: 'PULL_ALL' };
      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const text = await response.text();
      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Apps Script tidak mengembalikan JSON. Cek deployment.");
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("Gagal parsing JSON dari Apps Script.");
      }

      if (result.status === 'success' && result.data) {
        const d = result.data;
        if (d.toko) setToko({ nama: d.toko.nama || '', logoBase64: d.toko.logoBase64 || null });
        if (d.menu) {
          useStore.getState().setFullState({ menu: d.menu });
        }
        if (d.stokData) useStore.getState().setStokData(d.stokData);
        if (d.bebanAktif) {
          const currentBeban = useStore.getState().bebanAktif;
          useStore.getState().updateBebanAktif({
            aset: d.bebanAktif.aset || currentBeban.aset || [],
            ops: d.bebanAktif.ops || currentBeban.ops || [],
            target: d.bebanAktif.target || currentBeban.target || 1000,
            perPorsi: d.bebanAktif.perPorsi || currentBeban.perPorsi || 0
          });
        }
        if (d.keuangan) {
          const currentKeuangan = useStore.getState().keuangan;
          useStore.getState().updateKeuangan({
            masuk: typeof d.keuangan.masuk === 'number' ? d.keuangan.masuk : currentKeuangan.masuk,
            keluarOp: typeof d.keuangan.keluarOp === 'number' ? d.keuangan.keluarOp : currentKeuangan.keluarOp,
            keluarStok: typeof d.keuangan.keluarStok === 'number' ? d.keuangan.keluarStok : currentKeuangan.keluarStok,
            prive: typeof d.keuangan.prive === 'number' ? d.keuangan.prive : currentKeuangan.prive,
            modalBahan: typeof d.keuangan.modalBahan === 'number' ? d.keuangan.modalBahan : currentKeuangan.modalBahan,
            hppTerjual: typeof d.keuangan.hppTerjual === 'number' ? d.keuangan.hppTerjual : currentKeuangan.hppTerjual
          });
        }
        if (d.transaksiList) useStore.getState().setFullState({ transaksiList: d.transaksiList });
        if (d.hutangList) useStore.getState().updateHutang(d.hutangList);
        if (d.stokHistory) useStore.getState().setFullState({ stokHistory: d.stokHistory });
        
        if (showPrompt) await popup('alert', 'Data berhasil ditarik dari Spreadsheet!', "Berhasil");
      } else {
        throw new Error(result.message || 'Unknown error from Apps Script');
      }
    } catch (error: any) {
      console.error(error);
      if (showPrompt) await popup('alert', `Gagal menarik data: ${error.message}`, "Gagal");
    } finally {
      if (showPrompt) setIsSaving(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('dark-mode');
    
    const initSyncAndPull = async () => {
      if (GAS_URL) {
        const isUnsynced = localStorage.getItem('pos_unsynced') === 'true';
        if (navigator.onLine) {
          if (isUnsynced) {
            console.log('Unsynced local changes detected. Syncing to Google Sheets first...');
            await syncToSheets(false);
          }
          console.log('Pulling latest data from Google Sheets...');
          await pullFromSheets(false);
          localStorage.setItem('pos_unsynced', 'false');
        } else {
          console.log('App is offline, using local cached data.');
        }
      }
    };
    initSyncAndPull();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      if (GAS_URL) {
        const isUnsynced = localStorage.getItem('pos_unsynced') === 'true';
        if (isUnsynced) {
          await syncToSheets(false);
          await pullFromSheets(false);
        } else {
          await syncToSheets(false);
        }
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    localStorage.setItem('pos_unsynced', 'true');
    
    if (GAS_URL) {
      // Auto-sync ke cloud 5 detik setelah ada perubahan data lokal
      const timeout = setTimeout(async () => {
        if (navigator.onLine) {
          await syncToSheets(false);
          localStorage.setItem('pos_unsynced', 'false');
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [toko.nama, menu, stokData, transaksiList, hutangList, bebanAktif, keuangan]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setToko({ logoBase64: event.target?.result as string });
    };
    reader.readAsDataURL(file);
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
                  <h3 style={{ marginBottom: '15px', textAlign: 'center', color: 'var(--text-main)' }}>Pengaturan Identitas Toko</h3>

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

                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Upload Logo Toko (Lokal)</label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="file" accept="image/*" className="btn-input" style={{ fontSize: '12px', margin: 0, flex: 1 }} onChange={handleLogoUpload} />
                </div>
                
                {toko.logoBase64 && (
                  <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <img src={toko.logoBase64} style={{ width: '80px', borderRadius: '10px', boxShadow: 'var(--clay-shadow-out)' }} alt="Logo" />
                  </div>
                )}
              </div>

              <hr style={{ border: 0, borderTop: '2px solid rgba(163,177,198,0.3)', margin: '25px 0' }} />
              
              <div className="flex-between" style={{ marginBottom: '15px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Integrasi Google Sheets</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn bg-blue" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => syncToSheets(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg> Sync
                  </button>
                  <button className="btn bg-green" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => pullFromSheets(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg> Tarik
                  </button>
                </div>
              </div>

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
