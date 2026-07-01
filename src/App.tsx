import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import { CheckCircle2, Check, Printer, ArrowLeft } from 'lucide-react';
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
  const [activePrintTx, setActivePrintTx] = useState<any | null>(null);
  const [activePrintReport, setActivePrintReport] = useState<any | null>(null);
  const { popup } = useAppModal();
  
  const { toko, setToko, menu, cart, stokData, transaksiList, hutangList, bebanAktif, keuangan } = useStore();

  const isInitialMount = useRef(true);

  useEffect(() => {
    const handlePrint = (e: any) => {
      setActivePrintTx(e.detail);
    };
    window.addEventListener('print-receipt', handlePrint);
    return () => window.removeEventListener('print-receipt', handlePrint);
  }, []);

  useEffect(() => {
    const handlePrintReport = (e: any) => {
      setActivePrintReport(e.detail);
    };
    window.addEventListener('print-financial-report', handlePrintReport);
    return () => window.removeEventListener('print-financial-report', handlePrintReport);
  }, []);

  useEffect(() => {
    if (activePrintTx) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [activePrintTx]);

  useEffect(() => {
    if (activePrintReport) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [activePrintReport]);

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
        if (d.toko) {
          const currentToko = useStore.getState().toko;
          setToko({ 
            nama: d.toko.nama || currentToko.nama || '', 
            logoBase64: d.toko.logoBase64 || currentToko.logoBase64 || null 
          });
        }
        if (d.menu) {
          const sanitizedMenu = d.menu.map((m: any) => ({
            ...m,
            harga: Number(m.harga) || 0,
            hppBahan: Number(m.hppBahan) || 0,
            hppOp: Number(m.hppOp) || 0,
            resep: Array.isArray(m.resep) ? m.resep.map((r: any) => ({
              ...r,
              qty: Number(r.qty) || 0,
              hargaPerUnit: Number(r.hargaPerUnit) || 0
            })) : []
          }));
          useStore.getState().setFullState({ menu: sanitizedMenu });
        }
        if (d.stokData) {
          const sanitizedStok = d.stokData.map((s: any) => ({
            ...s,
            sisa: Number(s.sisa) || 0,
            hargaPerUnit: Number(s.hargaPerUnit) || 0
          }));
          useStore.getState().setStokData(sanitizedStok);
        }
        if (d.bebanAktif) {
          const currentBeban = useStore.getState().bebanAktif;
          useStore.getState().updateBebanAktif({
            aset: Array.isArray(d.bebanAktif.aset) ? d.bebanAktif.aset.map((a: any) => ({
              ...a,
              harga: Number(a.harga) || 0,
              umur: Number(a.umur) || 0
            })) : (currentBeban.aset || []),
            ops: Array.isArray(d.bebanAktif.ops) ? d.bebanAktif.ops.map((o: any) => ({
              ...o,
              biaya: Number(o.biaya) || 0
            })) : (currentBeban.ops || []),
            target: typeof d.bebanAktif.target === 'number' ? d.bebanAktif.target : (Number(d.bebanAktif.target) || currentBeban.target || 1000),
            perPorsi: typeof d.bebanAktif.perPorsi === 'number' ? d.bebanAktif.perPorsi : (Number(d.bebanAktif.perPorsi) || currentBeban.perPorsi || 0)
          });
        }
        if (d.keuangan) {
          const currentKeuangan = useStore.getState().keuangan;
          useStore.getState().updateKeuangan({
            masuk: typeof d.keuangan.masuk === 'number' ? d.keuangan.masuk : (Number(d.keuangan.masuk) || 0),
            keluarOp: typeof d.keuangan.keluarOp === 'number' ? d.keuangan.keluarOp : (Number(d.keuangan.keluarOp) || 0),
            keluarStok: typeof d.keuangan.keluarStok === 'number' ? d.keuangan.keluarStok : (Number(d.keuangan.keluarStok) || 0),
            prive: typeof d.keuangan.prive === 'number' ? d.keuangan.prive : (Number(d.keuangan.prive) || 0),
            modalBahan: typeof d.keuangan.modalBahan === 'number' ? d.keuangan.modalBahan : (Number(d.keuangan.modalBahan) || 0),
            hppTerjual: typeof d.keuangan.hppTerjual === 'number' ? d.keuangan.hppTerjual : (Number(d.keuangan.hppTerjual) || 0)
          });
        }
        if (d.transaksiList) useStore.getState().setFullState({ transaksiList: d.transaksiList });
        if (d.hutangList) useStore.getState().updateHutang(d.hutangList);
        if (d.stokHistory) {
          const sanitizedHistory = d.stokHistory.map((h: any) => {
            const namaVal = h.nama || h.item || '';
            return {
              ...h,
              id: h.id || '',
              stokId: h.stokId || '',
              nama: namaVal,
              item: namaVal,
              tipe: h.tipe || '',
              qty: Number(h.qty) || 0,
              sisaSebelum: Number(h.sisaSebelum) || 0,
              sisaSetelah: Number(h.sisaSetelah) || 0,
              tgl: h.tgl || '',
              keterangan: h.keterangan || '',
              txId: h.txId || ''
            };
          });
          useStore.getState().setFullState({ stokHistory: sanitizedHistory });
        }
        
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
    const savedTheme = localStorage.getItem('pos_theme');
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
    }
    
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
  }, [toko.nama, toko.logoBase64, menu, stokData, transaksiList, hutangList, bebanAktif, keuangan]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/png');
          setToko({ logoBase64: compressedBase64 });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isPrinting = !!(activePrintTx || activePrintReport);

  return (
    <div 
      className={document.body?.className || ''} 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
      style={{ 
        minHeight: '100vh', 
        overflowX: 'hidden', 
        background: isPrinting ? '#f3f4f6' : 'var(--bg-color)',
        color: isPrinting ? '#1a202c' : 'var(--text-main)',
        transition: 'background 0.3s ease'
      }}
    >
      {!isPrinting && (
        <div id="main-app-content">
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
                    <img 
                      src={toko.logoBase64} 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      style={{ width: '80px', borderRadius: '10px', boxShadow: 'var(--clay-shadow-out)' }} 
                      alt="Logo" 
                    />
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
                <button 
                  className="btn bg-blue" 
                  onClick={() => {
                    const isDark = document.body.classList.toggle('dark-mode');
                    localStorage.setItem('pos_theme', isDark ? 'dark' : 'light');
                  }}
                >
                  Alihkan Tema
                </button>
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
      )}

      {isPrinting && (
        <div className="no-print" style={{ maxWidth: activePrintReport ? '850px' : '320px', margin: '20px auto 10px auto', display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
          <button 
            className="btn" 
            onClick={() => {
              setActivePrintTx(null);
              setActivePrintReport(null);
            }} 
            style={{ 
              margin: 0, 
              padding: '10px 16px', 
              fontSize: '13px', 
              background: 'var(--clay-bg)', 
              color: 'var(--text-main)', 
              boxShadow: 'var(--clay-shadow-out)',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={16} /> Tutup & Kembali
          </button>
          <button 
            className="btn" 
            onClick={() => window.print()} 
            style={{ 
              margin: 0, 
              padding: '10px 20px', 
              fontSize: '13px', 
              color: '#ffffff', 
              background: '#4e3629',
              boxShadow: '0 4px 10px rgba(78, 54, 41, 0.3)',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={16} /> Cetak / Simpan PDF
          </button>
        </div>
      )}

      {activePrintTx && (
        <div id="printArea">
          <div className="print-center">
            {toko.logoBase64 && (
              <img 
                src={toko.logoBase64} 
                className="print-logo" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                style={{ width: '50px', display: 'inline-block', marginBottom: '5px' }} 
              />
            )}
            <h3 style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>{toko.nama || 'Toko Kita'}</h3>
            <div style={{ fontSize: '10px' }}>{activePrintTx.tgl}</div>
            <div className="print-line"></div>
          </div>
          
          <div style={{ fontSize: '11px', marginBottom: '5px' }}>
            <strong>Pelanggan: {activePrintTx.ident || '-'}</strong>
          </div>
          <div className="print-line"></div>
          
          {activePrintTx.items.map((item: any, idx: number) => (
            <div key={idx} style={{ marginBottom: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: '500' }}>{item.nama}</div>
              <div className="print-flex">
                <span>{item.qty} x {item.harga.toLocaleString('id-ID')}</span>
                <span>{(item.qty * item.harga).toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))}
          
          <div className="print-line"></div>
          
          <div className="print-flex" style={{ fontWeight: 'bold', fontSize: '12px' }}>
            <span>TOTAL</span>
            <span>Rp {activePrintTx.total.toLocaleString('id-ID')}</span>
          </div>
          
          <div className="print-flex" style={{ fontSize: '11px' }}>
            <span>BAYAR ({activePrintTx.metode})</span>
            <span>Rp {activePrintTx.bayar.toLocaleString('id-ID')}</span>
          </div>
          
          <div className="print-flex" style={{ fontSize: '11px' }}>
            <span>KEMBALI</span>
            <span>Rp {(activePrintTx.bayar - activePrintTx.total).toLocaleString('id-ID')}</span>
          </div>
          
          <div className="print-line"></div>
          
          <div className="print-center" style={{ marginTop: '10px', fontSize: '11px' }}>
            <div>Terima Kasih Atas Kunjungan Anda</div>
          </div>
        </div>
      )}

      {activePrintReport && (
        <div id="printReportArea" style={{ background: '#ffffff', color: '#3e2723', fontFamily: 'sans-serif', padding: '30px', minHeight: '100vh', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #4e3629', paddingBottom: '15px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {toko.logoBase64 && (
                <img 
                  src={toko.logoBase64} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                  style={{ width: '90px', height: '90px', objectFit: 'contain', borderRadius: '8px' }} 
                />
              )}
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#4e3629', margin: 0, lineHeight: '1.2' }}>{toko.nama || 'Toko Kita'}</h1>
                <p style={{ fontSize: '13px', color: '#8d6e63', margin: '4px 0 0 0', fontWeight: '500' }}>Sistem Point of Sales & Keuangan Terintegrasi</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: '#8d6e63', display: 'block' }}>Laporan Komprehensif</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4e3629' }}>Mitra & Investor Report</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#3e2723', letterSpacing: '-0.5px', textTransform: 'uppercase', margin: 0 }}>LAPORAN ARUS KEUANGAN & LABA RUGI</h2>
            <p style={{ fontSize: '13px', color: '#8d6e63', marginTop: '6px', fontWeight: '500' }}>
              Periode: <span style={{ color: '#4e3629', fontWeight: 'bold' }}>{activePrintReport.filterMulai || 'Semua'}</span> s/d <span style={{ color: '#4e3629', fontWeight: 'bold' }}>{activePrintReport.filterAkhir || 'Semua'}</span>
            </p>
            <p style={{ fontSize: '11px', color: '#8d6e63', margin: '4px 0 0 0', fontStyle: 'italic' }}>
              Waktu Cetak: {new Date().toLocaleString('id-ID')}
            </p>
          </div>

          {/* Bento Grid Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
            <div style={{ background: '#fdfbf7', border: '1px solid #d4b28c', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5c3a21', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Total Pendapatan</span>
              <strong style={{ fontSize: '16px', color: '#4e3629' }}>Rp {activePrintReport.pemasukan.toLocaleString('id-ID')}</strong>
            </div>
            <div style={{ background: '#fcfaf7', border: '1px solid #e6ccb2', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8d6e63', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Total Pengeluaran</span>
              <strong style={{ fontSize: '16px', color: '#7c2d12' }}>Rp {activePrintReport.pengeluaran.toLocaleString('id-ID')}</strong>
            </div>
            <div style={{ background: '#fcfaf7', border: '1px solid #e6ccb2', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8d6e63', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Penarikan Prive</span>
              <strong style={{ fontSize: '16px', color: '#7c2d12' }}>Rp {activePrintReport.prive.toLocaleString('id-ID')}</strong>
            </div>
            <div style={{ background: '#f5ebe6', border: '1px solid #c5a880', borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3e2723', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Laba Bersih (Net)</span>
              <strong style={{ fontSize: '16px', color: '#4e3629' }}>Rp {activePrintReport.labaBersih.toLocaleString('id-ID')}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Left Column: Neraca Laba Rugi Komprehensif */}
            <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '18px', background: '#fdfbf7' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#4e3629', borderBottom: '2px solid #d7ccc8', paddingBottom: '8px', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase' }}>Neraca Laba Rugi Komprehensif</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0, fontSize: '12px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #d7ccc8' }}>
                    <td style={{ padding: '8px 0', color: '#8d6e63' }}>Penjualan Kotor (Omset)</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#3e2723' }}>Rp {activePrintReport.penjualan.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d7ccc8' }}>
                    <td style={{ padding: '8px 0', color: '#8d6e63' }}>Pelunasan Kasbon (Pendapatan Lain)</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: '#3e2723' }}>Rp {activePrintReport.pelunasanKasbon.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f5ebe6' }}>
                    <td style={{ padding: '8px 5px', color: '#3e2723', fontWeight: 'bold' }}>Total Pendapatan Kotor</td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', fontWeight: 'bold', color: '#3e2723' }}>Rp {activePrintReport.pemasukan.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d7ccc8' }}>
                    <td style={{ padding: '8px 0', color: '#7c2d12' }}>(-) HPP (Modal Bahan Terjual)</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500', color: '#7c2d12' }}>Rp {activePrintReport.hpp.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d7ccc8' }}>
                    <td style={{ padding: '8px 0', color: '#7c2d12' }}>(-) Belanja Operasional Stok</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500', color: '#7c2d12' }}>Rp {activePrintReport.belanjaStok.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #d7ccc8' }}>
                    <td style={{ padding: '8px 0', color: '#7c2d12' }}>(-) Pengeluaran Operasional</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500', color: '#7c2d12' }}>Rp {activePrintReport.pengeluaranOps.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style={{ background: '#f5ebe6' }}>
                    <td style={{ padding: '10px 5px', fontWeight: 'bold', color: '#3e2723', fontSize: '13px' }}>LABA BERSIH (NET)</td>
                    <td style={{ padding: '10px 5px', textAlign: 'right', fontWeight: 'bold', color: '#3e2723', fontSize: '13px' }}>Rp {activePrintReport.labaBersih.toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Column: Status Keseluruhan Modal, ROI, & Kas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '15px', background: '#fdfbf7' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#4e3629', borderBottom: '2px solid #d7ccc8', paddingBottom: '6px', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase' }}>Status Modal & ROI</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#8d6e63' }}>Modal Aset (Alat/Mesin):</span>
                  <span style={{ fontWeight: '600', color: '#3e2723' }}>Rp {activePrintReport.modalAset.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#8d6e63' }}>Modal Bahan Baku:</span>
                  <span style={{ fontWeight: '600', color: '#3e2723' }}>Rp {activePrintReport.modalBahan.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px dashed #d7ccc8', paddingTop: '6px', marginBottom: '10px', fontWeight: 'bold' }}>
                  <span>Total Modal:</span>
                  <span style={{ color: '#c68642' }}>Rp {activePrintReport.totalModal.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ background: '#f5ebe6', borderRadius: '8px', padding: '8px 12px', borderLeft: '4px solid #4e3629' }}>
                  <span style={{ fontSize: '10px', color: '#8d6e63', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Balik Modal (ROI) Status</span>
                  <strong style={{ fontSize: '12px', color: activePrintReport.roi > 0 ? '#5c3a21' : activePrintReport.roi < 0 ? '#7c2d12' : '#8d6e63' }}>
                    {activePrintReport.roi > 0 ? `+Rp ${activePrintReport.roi.toLocaleString('id-ID')} (Untung Murni)` : activePrintReport.roi < 0 ? `-Rp ${Math.abs(activePrintReport.roi).toLocaleString('id-ID')} (Sisa Modal)` : 'Break Even Point'}
                  </strong>
                </div>
              </div>

              <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '15px', background: '#fdfbf7' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#4e3629', borderBottom: '2px solid #d7ccc8', paddingBottom: '6px', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase' }}>Posisi Uang Kas & Laci</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#8d6e63', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Uang Laci Kas Sekarang</span>
                    <strong style={{ fontSize: '16px', color: '#3e2723' }}>Rp {activePrintReport.sisaKasLaci.toLocaleString('id-ID')}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', marginBottom: '30px' }}>
            {/* Hutang Aktif */}
            <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '15px', background: '#fdfbf7' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c2d12', borderBottom: '2px solid #e6ccb2', paddingBottom: '6px', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase' }}>Kasbon Aktif ({activePrintReport.kasbonAktif.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #d7ccc8', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px', color: '#8d6e63', fontSize: '10px' }}>Nama Pelanggan</th>
                    <th style={{ padding: '6px 4px', color: '#8d6e63', fontSize: '10px', textAlign: 'right' }}>Sisa Kasbon</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintReport.kasbonAktif.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ padding: '10px 4px', textAlign: 'center', color: '#8d6e63' }}>Tidak ada kasbon aktif</td>
                    </tr>
                  ) : (
                    activePrintReport.kasbonAktif.map((k: any, index: number) => (
                      <tr key={index} style={{ borderBottom: '1px solid #d7ccc8' }}>
                        <td style={{ padding: '6px 4px', fontWeight: '500', color: '#3e2723' }}>{k.nama}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#7c2d12' }}>Rp {k.sisa.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ background: '#fcfaf7', fontWeight: 'bold', borderTop: '2px solid #d7ccc8' }}>
                    <td style={{ padding: '6px 4px', color: '#3e2723' }}>Total Kasbon Aktif</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: '#7c2d12' }}>Rp {activePrintReport.totalKasbonAktif.toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pelunasan Kasbon */}
            <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '15px', background: '#fdfbf7' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5c3a21', borderBottom: '2px solid #c5a880', paddingBottom: '6px', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase' }}>Pelunasan Kasbon Periode Ini</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #d7ccc8', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px', color: '#8d6e63', fontSize: '10px' }}>Tgl</th>
                    <th style={{ padding: '6px 4px', color: '#8d6e63', fontSize: '10px' }}>Nama</th>
                    <th style={{ padding: '6px 4px', color: '#8d6e63', fontSize: '10px', textAlign: 'right' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintReport.transaksi.filter((tx: any) => tx.tipe === 'Pelunasan Kasbon').length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '10px 4px', textAlign: 'center', color: '#8d6e63' }}>Tidak ada pelunasan kasbon</td>
                    </tr>
                  ) : (
                    activePrintReport.transaksi.filter((tx: any) => tx.tipe === 'Pelunasan Kasbon').map((tx: any, index: number) => (
                      <tr key={index} style={{ borderBottom: '1px solid #d7ccc8' }}>
                        <td style={{ padding: '6px 4px', color: '#8d6e63' }}>{tx.tgl}</td>
                        <td style={{ padding: '6px 4px', fontWeight: '500', color: '#3e2723' }}>{tx.ident}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#5c3a21' }}>Rp {tx.total.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ background: '#f5ebe6', fontWeight: 'bold', borderTop: '2px solid #d7ccc8' }}>
                    <td colSpan={2} style={{ padding: '6px 4px', color: '#3e2723' }}>Total Pelunasan</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: '#3e2723' }}>
                      Rp {activePrintReport.transaksi.filter((tx: any) => tx.tipe === 'Pelunasan Kasbon').reduce((acc: number, tx: any) => acc + tx.total, 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Expenses, Purchases, Prives */}
          <div style={{ border: '1px solid #d7ccc8', borderRadius: '12px', padding: '15px', marginBottom: '40px', background: '#fdfbf7' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c2d12', borderBottom: '2px solid #e6ccb2', paddingBottom: '6px', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase' }}>Rincian Pengeluaran, Belanja Stok & Prive</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: 0 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #d7ccc8', textAlign: 'left' }}>
                  <th style={{ padding: '8px', color: '#8d6e63' }}>Tanggal</th>
                  <th style={{ padding: '8px', color: '#8d6e63' }}>Kategori</th>
                  <th style={{ padding: '8px', color: '#8d6e63' }}>Keterangan / Detail</th>
                  <th style={{ padding: '8px', color: '#8d6e63', textAlign: 'right' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {activePrintReport.transaksi.filter((tx: any) => ['Pengeluaran', 'Belanja Stok', 'Prive'].includes(tx.tipe)).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '15px', textAlign: 'center', color: '#8d6e63' }}>Tidak ada data pengeluaran operasional / belanja stok / prive</td>
                  </tr>
                ) : (
                  activePrintReport.transaksi.filter((tx: any) => ['Pengeluaran', 'Belanja Stok', 'Prive'].includes(tx.tipe)).map((tx: any, index: number) => (
                    <tr key={index} style={{ borderBottom: '1px solid #d7ccc8' }}>
                      <td style={{ padding: '8px', color: '#8d6e63' }}>{tx.tgl}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          color: tx.tipe === 'Prive' ? '#c68642' : '#7c2d12',
                          background: tx.tipe === 'Prive' ? '#fdfbf7' : '#fcfaf7',
                        }}>
                          {tx.tipe}
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontWeight: '500', color: '#3e2723' }}>{tx.ident}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#7c2d12' }}>Rp {tx.total.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
                <tr style={{ background: '#fcfaf7', fontWeight: 'bold', fontSize: '11px', borderTop: '2px solid #d7ccc8' }}>
                  <td colSpan={3} style={{ padding: '8px', color: '#3e2723' }}>Total Pengeluaran & Prive (Arus Kas Keluar)</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#7c2d12' }}>Rp {activePrintReport.pengeluaran.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Signature Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '100px', marginTop: '50px', fontSize: '12px', textAlign: 'center' }}>
            <div>
              <p style={{ margin: '0 0 60px 0', color: '#8d6e63' }}>Dibuat Oleh,</p>
              <strong style={{ borderTop: '1px solid #d7ccc8', paddingTop: '5px', display: 'inline-block', width: '200px', color: '#3e2723' }}>Manajemen Toko</strong>
            </div>
            <div>
              <p style={{ margin: '0 0 60px 0', color: '#8d6e63' }}>Disetujui Oleh,</p>
              <strong style={{ borderTop: '1px solid #d7ccc8', paddingTop: '5px', display: 'inline-block', width: '200px', color: '#3e2723' }}>Mitra / Investor</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
