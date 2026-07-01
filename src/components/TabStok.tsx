import React, { useState } from 'react';
import { useStore } from '../store';
import { CheckCircle2, Check } from 'lucide-react';
import { useAppModal } from './ModalContext';

export default function TabStok() {
  const { stokData, stokHistory, keuangan, addStok, updateStok, deleteStok, addStokHistory, updateKeuangan, addTransaksi } = useStore();
  const getToday = () => new Date().toISOString().split('T')[0];
  const [filterMulai, setFilterMulai] = useState(getToday());
  const [filterAkhir, setFilterAkhir] = useState(getToday());
  const [searchName, setSearchName] = useState('');
  const { popup } = useAppModal();

  const catatMutasi = (stokId: string, nama: string, tipe: string, qty: number, sisaSebelum: number, sisaSetelah: number) => {
    addStokHistory({
      id: 'h' + Date.now() + Math.random().toString(36).substring(2, 6),
      stokId,
      nama,
      item: nama,
      tipe,
      qty,
      sisaSebelum,
      sisaSetelah,
      tgl: getToday(),
      keterangan: ''
    });
  };

  const bikinStokBaru = async () => {
    const nama = await popup('prompt_text', "Nama bahan baku baru (Cth: Gula):", "Buat Stok");
    if (!nama) return;
    const satuan = await popup('prompt_text', "Satuan (Cth: kg / gr / liter):", "Satuan");
    if (!satuan) return;
    const harga = await popup('prompt_num', `Harga beli per 1 ${satuan} (Rp)?\n(Contoh: Jika 1 kg Rp20.000, maka 1 gr Rp20)`, "Harga Satuan");
    if (harga === false) return;
    
    let qtyAwal = await popup('prompt_float', `Jumlah stok awal yang dibeli saat ini? (Modal Pertama)\nKetik 0 jika hanya input nama dulu.`, "Stok Awal");
    if (qtyAwal === false) qtyAwal = 0;

    const totalModalStok = harga * qtyAwal;
    updateKeuangan({ modalBahan: keuangan.modalBahan + totalModalStok });
    
    const newId = 's' + Date.now();
    addStok({ id: newId, nama, sisa: qtyAwal, unit: satuan, hargaPerUnit: harga });
    
    if (qtyAwal > 0) {
      catatMutasi(newId, nama, 'Modal Awal', qtyAwal, 0, qtyAwal);
    }
    
    await popup('alert', `Item ${nama} ditambahkan.\nStok Awal: ${qtyAwal} ${satuan}\nModal Awal: Rp ${totalModalStok.toLocaleString('id-ID')}`, 'Berhasil');
  };

  const handleTambahStok = async (idx: number) => {
    const item = stokData[idx];
    const n = await popup('prompt_float', `Jumlah ${item.unit} yang dibeli untuk ${item.nama}?`, "Belanja Stok");
    if (n && n > 0) {
      const hargaSatuan = await popup('prompt_num', `Harga beli per 1 ${item.unit} (Rp)?\n(Harga saat ini: Rp ${item.hargaPerUnit})`, "Harga Satuan");
      if (hargaSatuan !== false) {
        const totalBiaya = hargaSatuan * n;
        updateKeuangan({ keluarStok: keuangan.keluarStok + totalBiaya });
        updateStok(idx, { sisa: item.sisa + n, hargaPerUnit: hargaSatuan });
        catatMutasi(item.id, item.nama, 'Masuk (Beli)', n, item.sisa, item.sisa + n);

        const txRecord = {
          tgl: new Date().toLocaleString('id-ID'),
          tglRaw: getToday(),
          tipe: 'Belanja Stok',
          ident: `Beli ${item.nama}`,
          items: [],
          total: totalBiaya,
          bayar: totalBiaya,
          metode: 'Cash'
        };
        addTransaksi(txRecord);

        await popup('alert', `Stok ditambah.\nTotal Pengeluaran Rp ${totalBiaya.toLocaleString('id-ID')} dicatat.\nHarga per ${item.unit} diupdate menjadi Rp ${hargaSatuan.toLocaleString('id-ID')}.`, "Berhasil");
      }
    }
  };

  const handleKurangStok = async (idx: number) => {
    const item = stokData[idx];
    const n = await popup('prompt_float', `Berapa ${item.unit} yang terpakai manual?`, "Pengurangan Stok");
    if (n && n > 0 && item.sisa >= n) {
      updateStok(idx, { sisa: item.sisa - n });
      catatMutasi(item.id, item.nama, 'Keluar (Pakai)', n, item.sisa, item.sisa - n);
    } else if (n) {
      await popup('alert', "Stok tidak mencukupi!", "Gagal");
    }
  };

  const handleHapusStok = async (idx: number) => {
    if (await popup('confirm', `Hapus item bahan "${stokData[idx].nama}" dari sistem?`, "Hapus Stok")) {
      const item = stokData[idx];
      const nilaiStok = item.sisa * item.hargaPerUnit;
      updateKeuangan({ modalBahan: Math.max(0, keuangan.modalBahan - nilaiStok) });
      deleteStok(idx);
    }
  };

  const filteredHistory = stokHistory.filter(d => {
    let match = true;
    if (filterMulai && filterAkhir) {
      match = d.tgl >= filterMulai && d.tgl <= filterAkhir;
    }
    if (searchName) {
      match = match && d.item.toLowerCase().includes(searchName.toLowerCase());
    }
    return match;
  }).reverse();

  return (
    <>
      <div className="clay-card">
        <div className="flex-between">
          <h3 style={{ color: 'var(--text-muted)' }}>Manajemen Item Stok & Bahan Baku</h3>
          <button className="btn bg-green" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={bikinStokBaru}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Item Baru
          </button>
        </div>
        <table>
          <thead>
            <tr><th>Bahan</th><th>Est. Harga/Unit</th><th>Sisa Stok</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
          </thead>
          <tbody>
            {stokData.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Belum ada item stok.</td></tr>
            ) : (
              stokData.map((s, i) => (
                <tr key={s.id}>
                  <td><strong>{s.nama}</strong></td>
                  <td>Rp {s.hargaPerUnit.toLocaleString('id-ID')}/{s.unit}</td>
                  <td>{s.sisa} {s.unit}</td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn bg-red" style={{ padding: '4px 8px', borderRadius: '8px' }} onClick={() => handleKurangStok(i)}>
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button> 
                    <button className="btn bg-blue" style={{ padding: '4px 8px', borderRadius: '8px' }} onClick={() => handleTambahStok(i)}>
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <button className="btn bg-orange" style={{ padding: '4px 8px', borderRadius: '8px', color: 'white', fontSize: '11px' }} onClick={() => handleHapusStok(i)}>Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="clay-card">
        <h3 style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Riwayat Mutasi Stok</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input type="text" placeholder="Cari nama..." value={searchName} onChange={e => setSearchName(e.target.value)} className="btn-input" style={{ margin: 0, fontSize: '12px', flex: 1 }} />
          <input type="date" value={filterMulai} onChange={e => setFilterMulai(e.target.value)} className="btn-input" style={{ margin: 0, fontSize: '12px' }} />
          <input type="date" value={filterAkhir} onChange={e => setFilterAkhir(e.target.value)} className="btn-input" style={{ margin: 0, fontSize: '12px' }} />
          <button className="btn bg-dim" style={{ margin: 0, padding: '10px 15px', fontSize: '12px', color: 'var(--text-main)' }} onClick={() => { setFilterMulai(''); setFilterAkhir(''); setSearchName(''); }}>Reset</button>
        </div>
        <table>
          <thead><tr><th>Tgl</th><th>Item</th><th>Tipe</th><th>Qty</th></tr></thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Tidak ada mutasi</td></tr>
            ) : (
              filteredHistory.map((h, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: '11px' }}>{h.tgl}</td>
                  <td><strong>{h.item}</strong></td>
                  <td className={h.tipe.includes('Masuk') ? 'text-green' : 'text-red'} style={{ fontSize: '11px', fontWeight: 'bold' }}>{h.tipe}</td>
                  <td>{h.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
