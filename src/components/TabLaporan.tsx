import React, { useState } from 'react';
import { useStore } from '../store';
import { CheckCircle2, Check } from 'lucide-react';
import { useAppModal } from './ModalContext';

export default function TabLaporan() {
  const { keuangan, bebanAktif, transaksiList, hutangList, updateKeuangan, addTransaksi, deleteTransaksi, updateHutang } = useStore();
  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominalPengeluaran, setNominalPengeluaran] = useState('');
  const [inputPrive, setInputPrive] = useState('');
  
  const getToday = () => new Date().toISOString().split('T')[0];
  const [filterTxMulai, setFilterTxMulai] = useState(getToday());
  const [filterTxAkhir, setFilterTxAkhir] = useState(getToday());
  const [searchName, setSearchName] = useState('');
  const { popup } = useAppModal();

  const formatUang = (val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('id-ID');
  };

  const parseAngka = (val: string) => parseInt(val.replace(/\D/g, ''), 10) || 0;

  const kotor = keuangan.masuk;
  const op = keuangan.keluarOp;
  const stok = keuangan.keluarStok;
  const hppTerjual = keuangan.hppTerjual || 0;
  const bersih = kotor - op - stok - hppTerjual;

  const sisaKasLaci = kotor - op - stok - keuangan.prive;

  const modalAset = bebanAktif.aset.reduce((acc, a) => acc + a.harga, 0);
  const modalBahan = keuangan.modalBahan;
  const totalModal = modalAset + modalBahan;
  const roi = bersih - totalModal;

  const filteredTx = transaksiList.filter(x => {
    let match = true;
    if (filterTxMulai && filterTxAkhir) {
      match = x.tglRaw >= filterTxMulai && x.tglRaw <= filterTxAkhir;
    }
    if (searchName) {
      match = match && x.ident.toLowerCase().includes(searchName.toLowerCase());
    }
    return match;
  });

  // Dynamic filtered values based on active filters (e.g. date range)
  const kotorFiltered = filteredTx.reduce((acc, tx) => {
    const labelTipe = tx.tipe || 'Penjualan';
    if (labelTipe === 'Penjualan' || labelTipe === 'Pelunasan Kasbon') {
      return acc + tx.total;
    }
    return acc;
  }, 0);

  const opFiltered = filteredTx.reduce((acc, tx) => {
    if (tx.tipe === 'Pengeluaran') {
      return acc + tx.total;
    }
    return acc;
  }, 0);

  const stokFiltered = filteredTx.reduce((acc, tx) => {
    if (tx.tipe === 'Belanja Stok') {
      return acc + tx.total;
    }
    return acc;
  }, 0);

  const hppFiltered = filteredTx.reduce((acc, tx) => {
    return acc + (tx.hppTotal || 0);
  }, 0);

  const bersihFiltered = kotorFiltered - opFiltered - stokFiltered - hppFiltered;

  const tambahPengeluaran = async () => {
    const nom = parseAngka(nominalPengeluaran);
    if (!namaPengeluaran || nom <= 0) {
      await popup('alert', "Isi pengeluaran dengan benar!", "Gagal");
      return;
    }
    updateKeuangan({ keluarOp: keuangan.keluarOp + nom });
    
    const txRecord = { tgl: new Date().toLocaleString('id-ID'), tglRaw: getToday(), tipe: 'Pengeluaran', ident: namaPengeluaran, items: [], total: nom, bayar: nom, metode: 'Cash' };
    addTransaksi(txRecord);
    
    await popup('alert', `Pengeluaran "${namaPengeluaran}" Rp ${nom.toLocaleString('id-ID')} dicatat.`, "Berhasil");
    setNamaPengeluaran('');
    setNominalPengeluaran('');
  };

  const tarikPrive = async () => {
    const nom = parseAngka(inputPrive);
    if (nom <= 0) {
      await popup('alert', "Masukkan nominal prive!", "Gagal");
      return;
    }
    if (nom > sisaKasLaci) {
      await popup('alert', "Uang laci tidak mencukupi!", "Saldo Kurang");
      return;
    }
    if (await popup('confirm', `Tarik uang Rp ${nom.toLocaleString('id-ID')} dari laci?`, "Konfirmasi Prive")) {
      updateKeuangan({ prive: keuangan.prive + nom });
      const txRecord = { tgl: new Date().toLocaleString('id-ID'), tglRaw: getToday(), tipe: 'Prive', ident: 'Penarikan Prive', items: [], total: nom, bayar: nom, metode: 'Cash' };
      addTransaksi(txRecord);
      setInputPrive('');
      await popup('alert', "Prive berhasil dicatat sebagai pengeluaran arus keluar.", "Sukses");
    }
  };

  const bayarHutang = async (idx: number) => {
    const h = hutangList[idx];
    const jumlah = await popup('prompt_float', `Sisa hutang ${h.nama}: Rp ${h.sisa.toLocaleString('id-ID')}.\nBayar berapa?`, "Bayar Kasbon");
    
    if (jumlah && jumlah > 0 && jumlah <= h.sisa) {
      updateKeuangan({ masuk: keuangan.masuk + jumlah });
      
      const txRecord = { tgl: new Date().toLocaleString('id-ID'), tglRaw: getToday(), tipe: 'Pelunasan Kasbon', ident: h.nama, items: [], total: jumlah, bayar: jumlah, metode: 'Cash' };
      addTransaksi(txRecord);
      
      const newHutang = [...hutangList];
      newHutang[idx] = {
        ...h,
        sisa: h.sisa - jumlah,
        pembayaran: [...h.pembayaran, { tgl: getToday(), jumlah }]
      };
      
      if (newHutang[idx].sisa <= 0) {
        newHutang.splice(idx, 1);
      }
      updateHutang(newHutang);
      await popup('alert', "Pembayaran hutang berhasil!", "Sukses");
    } else if (jumlah > h.sisa) {
      await popup('alert', "Jumlah bayar melebihi sisa hutang!", "Gagal");
    }
  };

  const hapusTransaksi = async (tx: any) => {
    if (await popup('confirm', `Hapus riwayat transaksi ini?\n(Penghapusan akan mengembalikan saldo & stok seperti sebelum transaksi)`, "Hapus Transaksi")) {
      const originalIdx = transaksiList.indexOf(tx);
      if (originalIdx >= 0) {
        deleteTransaksi(originalIdx);
        await popup('alert', "Transaksi berhasil dihapus & direverse.", "Dihapus");
      }
    }
  };

  let sumIn = 0;
  let sumOut = 0;

  filteredTx.forEach(tx => {
    const labelTipe = tx.tipe || 'Penjualan';
    if (labelTipe === 'Penjualan' || labelTipe === 'Pelunasan Kasbon') {
      sumIn += tx.total;
    } else if (labelTipe === 'Pengeluaran' || labelTipe === 'Prive') {
      sumOut += tx.total;
    } else if (labelTipe === 'Belanja Stok') {
      sumOut += tx.total;
    }
  });

  const filteredHutang = hutangList.filter(x => {
    let match = true;
    if (filterTxMulai && filterTxAkhir) {
      match = x.tglRaw >= filterTxMulai && x.tglRaw <= filterTxAkhir;
    }
    if (searchName) {
      match = match && x.nama.toLowerCase().includes(searchName.toLowerCase());
    }
    return match;
  });

  const tampilkanDetailTransaksi = async (tx: any) => {
    const labelTipe = tx.tipe || 'Penjualan';
    let detailItems = '';
    let calculatedHpp = tx.hppTotal || 0;
    let calculatedBebanOp = tx.bebanOpTotal || 0;

    if (tx.items && tx.items.length > 0) {
      detailItems = tx.items.map((it: any) => `• ${it.name} x${it.qty} (@Rp ${it.harga.toLocaleString('id-ID')})`).join('\n');
      
      if (calculatedHpp === 0 || calculatedBebanOp === 0) {
        tx.items.forEach((it: any) => {
          const m = useStore.getState().menu.find((x: any) => x.id === it.id || x.name === it.name);
          if (m) {
            if (calculatedHpp === 0) calculatedHpp += (m.hppBahan || 0) * it.qty;
            if (calculatedBebanOp === 0) calculatedBebanOp += (m.hppOp || 0) * it.qty;
          }
        });
      }
    } else {
      detailItems = 'Tidak ada rincian item.';
    }
    const totalFormat = tx.total.toLocaleString('id-ID');
    const estimatedProfit = tx.total - calculatedHpp - calculatedBebanOp;

    const msg = `Tipe: ${labelTipe}\nKeterangan/Meja: ${tx.ident}\nTanggal: ${tx.tgl}\nMetode: ${tx.metode}\n\nRincian Pesanan:\n${detailItems}\n\n---------------------------------\nTotal Belanja: Rp ${totalFormat}\nModal Bahan (HPP): Rp ${calculatedHpp.toLocaleString('id-ID')}\nBeban Ops: Rp ${calculatedBebanOp.toLocaleString('id-ID')}\nEstimasi Untung: Rp ${estimatedProfit.toLocaleString('id-ID')}`;
    await popup('alert', msg, `Detail Transaksi`);
  };

  return (
    <>
      <div className="clay-card">
        <h3 style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Riwayat Transaksi & Arus Keuangan Komprehensif</h3>
        
        <div className="flex-between"><span>Total Pemasukan:</span> <strong className="text-green">Rp {sumIn.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between"><span>Total Pengeluaran:</span> <strong className="text-red">Rp {sumOut.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between text-green font-bold" style={{ fontSize: '15px', marginBottom: '15px' }}>
          <span>Total Laba Bersih (Periode):</span>
          <strong>Rp {bersihFiltered.toLocaleString('id-ID')}</strong>
        </div>
        <hr style={{ border: 0, borderTop: '1px dashed rgba(163,177,198,0.4)', margin: '10px 0 15px 0' }} />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input type="text" placeholder="Cari nama..." className="btn-input" style={{ margin: 0, fontSize: '12px', flex: 1 }} value={searchName} onChange={e => setSearchName(e.target.value)} />
          <input type="date" className="btn-input" style={{ margin: 0, fontSize: '12px' }} value={filterTxMulai} onChange={e => setFilterTxMulai(e.target.value)} />
          <input type="date" className="btn-input" style={{ margin: 0, fontSize: '12px' }} value={filterTxAkhir} onChange={e => setFilterTxAkhir(e.target.value)} />
          <button className="btn bg-dim" style={{ margin: 0, padding: '10px 15px', fontSize: '12px', color: 'var(--text-main)' }} onClick={() => { setFilterTxMulai(''); setFilterTxAkhir(''); setSearchName(''); }}>Reset</button>
        </div>
        <table>
          <thead><tr><th>Tgl</th><th>Keterangan / Tipe</th><th>Total</th><th>Via</th><th style={{textAlign: 'right'}}>Aksi</th></tr></thead>
          <tbody>
            {filteredTx.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>Belum ada riwayat keuangan</td></tr>
            ) : (
              [...filteredTx].reverse().map((tx, idx) => {
                const labelTipe = tx.tipe || 'Penjualan';
                let colorClass = 'text-green';
                if (labelTipe === 'Pengeluaran' || labelTipe === 'Prive' || labelTipe === 'Kasbon') colorClass = 'text-red';
                return (
                  <tr key={idx}>
                    <td style={{ fontSize: '10px' }}>{tx.tgl}</td>
                    <td style={{ fontSize: '12px', cursor: 'pointer' }} onClick={() => tampilkanDetailTransaksi(tx)}>
                      <strong>[{labelTipe}]</strong> {tx.ident}
                      {tx.items && tx.items.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {tx.items.map((it: any) => `${it.name} (x${it.qty})`).join(', ')}
                          </div>
                          {(() => {
                            let itemHpp = tx.hppTotal || 0;
                            let itemBebanOp = tx.bebanOpTotal || 0;
                            if (itemHpp === 0 || itemBebanOp === 0) {
                              tx.items.forEach((it: any) => {
                                const m = useStore.getState().menu.find((x: any) => x.id === it.id || x.name === it.name);
                                if (m) {
                                  if (itemHpp === 0) itemHpp += (m.hppBahan || 0) * it.qty;
                                  if (itemBebanOp === 0) itemBebanOp += (m.hppOp || 0) * it.qty;
                                }
                              });
                            }
                            if (itemHpp > 0 || itemBebanOp > 0) {
                              return (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2.5px', fontStyle: 'italic' }}>
                                  Modal Bahan: Rp {itemHpp.toLocaleString('id-ID')} | Beban Ops: Rp {itemBebanOp.toLocaleString('id-ID')}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}
                    </td>
                    <td className={colorClass} style={{ fontSize: '12px', fontWeight: 'bold' }}>Rp {tx.total.toLocaleString('id-ID')}</td>
                    <td style={{ fontSize: '11px' }}>{tx.metode}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn bg-orange" style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '11px', color: 'white' }} onClick={() => hapusTransaksi(tx)}>Hapus</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="clay-card">
        <h3 style={{ color: 'var(--text-muted)' }}>Manajemen Hutang / Kasbon</h3>
        <table>
          <thead><tr><th>Nama / Meja</th><th>Nominal</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
          <tbody>
            {filteredHutang.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Tidak ada kasbon aktif.</td></tr>
            ) : (
              filteredHutang.map((h, i) => {
                const originalIdx = hutangList.findIndex(x => x.id === h.id);
                return (
                  <tr key={h.id}>
                    <td><strong>{h.nama}</strong></td>
                    <td className="text-red" style={{ fontWeight: 600 }}>Rp {h.sisa.toLocaleString('id-ID')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn bg-green" style={{ padding: '6px 12px', borderRadius: '10px' }} onClick={() => bayarHutang(originalIdx)}>
                        <Check size={14} /> Bayar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="split-layout">
        <div className="clay-card" style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Catat Beban Operasional Baru</h3>
          <input type="text" className="btn-input" placeholder="Cth: Bayar Listrik, Gas" value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} />
          <input type="text" inputMode="numeric" className="btn-input" placeholder="Nominal (Rp)" value={nominalPengeluaran} onChange={e => setNominalPengeluaran(formatUang(e.target.value))} />
          <button className="btn bg-red" style={{ width: '100%', marginTop: '15px' }} onClick={tambahPengeluaran}>Catat Pengeluaran</button>
        </div>

        <div className="clay-card" style={{ flex: 1, border: '2px solid var(--orange)' }}>
          <h3 style={{ color: 'var(--orange)', marginBottom: '15px' }}>Tarik Prive (Kebutuhan Pribadi)</h3>
          <p style={{ fontSize: '11px', marginBottom: '10px' }}>Penarikan ini dicatat sebagai arus keluar & memotong laci kas.</p>
          <input type="text" inputMode="numeric" className="btn-input" placeholder="Nominal Tarik Prive (Rp)" value={inputPrive} onChange={e => setInputPrive(formatUang(e.target.value))} />
          <button className="btn bg-orange" style={{ width: '100%', marginTop: '15px', color: 'white' }} onClick={tarikPrive}>Tarik Saldo Kas</button>
          <div className="flex-between" style={{ marginTop: '15px' }}><span>Sisa Uang Di Laci:</span> <strong style={{ fontSize: '18px' }}>Rp {sisaKasLaci.toLocaleString('id-ID')}</strong></div>
        </div>
      </div>

      <div className="clay-card">
        <h3 style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Neraca Laba Bersih Komprehensif</h3>
        <div className="flex-between"><span>Penjualan Kotor (Omset)</span> <strong className="text-blue">Rp {kotor.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between text-orange"><span>(-) HPP (Modal Bahan Terjual)</span> <strong>Rp {hppTerjual.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between text-red"><span>(-) Belanja Operasional Stok</span> <strong>Rp {stok.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between text-red"><span>(-) Pengeluaran Operasional</span> <strong>Rp {op.toLocaleString('id-ID')}</strong></div>
        <hr style={{ border: 0, borderTop: '2px solid rgba(163,177,198,0.3)', margin: '15px 0' }} />
        <div className="flex-between text-green" style={{ fontSize: '18px' }}><span>LABA BERSIH (NET)</span> <strong>Rp {bersih.toLocaleString('id-ID')}</strong></div>
      </div>

      <div className="clay-card" style={{ border: '1px solid var(--blue)' }}>
        <h3 style={{ color: 'var(--blue)', marginBottom: '15px' }}>Status Keseluruhan Modal & ROI (Balik Modal)</h3>
        <div className="flex-between"><span>Modal Aset (Alat/Mesin)</span> <strong>Rp {modalAset.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between"><span>Modal Bahan Baku (Awal)</span> <strong>Rp {modalBahan.toLocaleString('id-ID')}</strong></div>
        <hr style={{ border: 0, borderTop: '1px dashed rgba(163,177,198,0.4)', margin: '10px 0' }} />
        <div className="flex-between" style={{ fontWeight: 'bold' }}><span>Total Keseluruhan Modal</span> <strong className="text-orange">Rp {totalModal.toLocaleString('id-ID')}</strong></div>
        <div className="flex-between" style={{ marginTop: '15px', fontWeight: 'bold' }}>
          <span>Estimasi Balik Modal (ROI):</span> 
          <strong className={roi > 0 ? 'text-green' : roi < 0 ? 'text-red' : 'text-muted'} style={{ fontSize: '18px' }}>
            {roi > 0 ? `+Rp ${roi.toLocaleString('id-ID')} (Untung Murni)` : roi < 0 ? `-Rp ${Math.abs(roi).toLocaleString('id-ID')} (Belum Balik)` : `Rp 0 (Break Even Point)`}
          </strong>
        </div>
      </div>
    </>
  );
}
