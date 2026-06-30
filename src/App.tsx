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

  useEffect(() => {
    document.body.classList.add('dark-mode');
  }, []);

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
