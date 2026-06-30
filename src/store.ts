import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface StokItem {
  id: string;
  nama: string;
  sisa: number;
  unit: string;
  hargaPerUnit: number;
}

export interface MenuItem {
  id: string;
  name: string;
  harga: number;
  resep: any[];
}

export interface CartItem extends MenuItem {
  qty: number;
  bayar: boolean;
}

export interface Meja {
  meja: string;
  namaIdentitas: string;
  items: CartItem[];
}

export interface TokoData {
  nama: string;
  logoBase64: string | null;
  logoDriveId?: string;
  spreadsheetId?: string;
}

interface PosState {
  menu: MenuItem[];
  cart: CartItem[];
  orderMode: string;
  toko: TokoData;
  stokData: StokItem[];
  stokHistory: any[];
  mejaAktif: Meja[];
  totalMeja: number;
  transaksiList: any[];
  hutangList: any[];
  keuangan: { masuk: number; keluarOp: number; keluarStok: number; prive: number; modalBahan: number; hppTerjual: number };
  bebanAktif: { aset: any[]; ops: any[]; target: number; perPorsi: number };
  tempResep: any[];
  setToko: (toko: Partial<TokoData>) => void;
  setMenu: (menu: MenuItem[]) => void;
  addToCart: (item: MenuItem) => void;
  updateCartQty: (idx: number, qty: number) => void;
  toggleCartBayar: (idx: number) => void;
  clearCart: () => void;
  setOrderMode: (mode: string) => void;
  
  setStokData: (stok: StokItem[]) => void;
  addStok: (item: StokItem) => void;
  updateStok: (idx: number, item: Partial<StokItem>) => void;
  deleteStok: (idx: number) => void;
  addStokHistory: (history: any) => void;

  setMejaAktif: (meja: Meja[]) => void;
  setTotalMeja: (total: number) => void;
  setCart: (cart: CartItem[]) => void;
  
  addTransaksi: (tx: any) => void;
  deleteTransaksi: (txIndex: number) => void;
  addHutang: (hutang: any) => void;
  updateHutang: (hutangList: any[]) => void;
  
  updateKeuangan: (k: Partial<PosState['keuangan']>) => void;
  updateBebanAktif: (b: Partial<PosState['bebanAktif']>) => void;
  
  setTempResep: (resep: any[]) => void;
  
  setFullState: (state: Partial<PosState>) => void;
  resetStore: () => void;
}

const initialState = {
  menu: [],
  cart: [],
  orderMode: 'Takeaway',
  toko: { nama: '', logoBase64: null },
  stokData: [],
  stokHistory: [],
  mejaAktif: [],
  totalMeja: 8,
  transaksiList: [],
  hutangList: [],
  keuangan: { masuk: 0, keluarOp: 0, keluarStok: 0, prive: 0, modalBahan: 0, hppTerjual: 0 },
  bebanAktif: { aset: [], ops: [], target: 0, perPorsi: 0 },
  tempResep: [],
};

export const useStore = create<PosState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setToko: (t) => set((state) => ({ toko: { ...state.toko, ...t } })),
      setMenu: (menu) => set({ menu }),
      setOrderMode: (orderMode) => set({ orderMode }),
      setCart: (cart) => set({ cart }),
      addToCart: (item) => set((state) => {
        const exist = state.cart.findIndex(c => c.id === item.id);
        if (exist >= 0) {
          const newCart = [...state.cart];
          newCart[exist].qty++;
          return { cart: newCart };
        }
        return { cart: [...state.cart, { ...item, qty: 1, bayar: true }] };
      }),
      updateCartQty: (idx, val) => set((state) => {
        const newCart = [...state.cart];
        newCart[idx].qty += val;
        if (newCart[idx].qty <= 0) newCart.splice(idx, 1);
        return { cart: newCart };
      }),
      toggleCartBayar: (idx) => set((state) => {
        const newCart = [...state.cart];
        newCart[idx].bayar = !newCart[idx].bayar;
        return { cart: newCart };
      }),
      clearCart: () => set({ cart: [] }),
      
      setStokData: (stokData) => set({ stokData }),
      addStok: (item) => set((state) => ({ stokData: [...state.stokData, item] })),
      updateStok: (idx, item) => set((state) => {
        const newStok = [...state.stokData];
        newStok[idx] = { ...newStok[idx], ...item };
        return { stokData: newStok };
      }),
      deleteStok: (idx) => set((state) => {
        const newStok = [...state.stokData];
        newStok.splice(idx, 1);
        return { stokData: newStok };
      }),
      addStokHistory: (history) => set((state) => ({ stokHistory: [...state.stokHistory, history] })),
      
      setMejaAktif: (mejaAktif) => set({ mejaAktif }),
      setTotalMeja: (totalMeja) => set({ totalMeja }),
      
      addTransaksi: (tx) => set((state) => ({ transaksiList: [...state.transaksiList, tx] })),
      deleteTransaksi: (txIndex) => set((state) => {
        const tx = state.transaksiList[txIndex];
        if (!tx) return state;
        
        let newKeuangan = { ...state.keuangan };
        let newHutangList = [...state.hutangList];
        let newStokData = [...state.stokData];
        
        if (tx.tipe === 'Penjualan') {
          newKeuangan.masuk -= tx.total;
        } else if (tx.tipe === 'Kasbon') {
          const hutangIdx = newHutangList.findIndex(h => h.id === tx.hutangId || (h.nama === tx.ident && h.nominal === tx.total && h.tglRaw === tx.tglRaw));
          if (hutangIdx >= 0) newHutangList.splice(hutangIdx, 1);
        } else if (tx.tipe === 'Pelunasan Kasbon') {
          newKeuangan.masuk -= tx.total;
          newHutangList.push({ id: Date.now(), nama: tx.ident, nominal: tx.total, tglRaw: tx.tglRaw });
        } else if (tx.tipe === 'Pengeluaran') {
          newKeuangan.keluarOp -= tx.total;
        } else if (tx.tipe === 'Prive') {
          newKeuangan.prive -= tx.total;
        }

        if (tx.tipe === 'Penjualan' || tx.tipe === 'Kasbon') {
          if (tx.items && tx.items.length > 0) {
            tx.items.forEach((cartItem: any) => {
              const masterMenu = state.menu.find(m => m.id === cartItem.id);
              if (masterMenu && masterMenu.resep) {
                masterMenu.resep.forEach((r: any) => {
                  const stokItemIdx = newStokData.findIndex(s => s.id === r.stokId);
                  let currentPrice = r.hargaPerUnit;
                  if (stokItemIdx >= 0) {
                    const stokItem = newStokData[stokItemIdx];
                    currentPrice = stokItem.hargaPerUnit;
                    const totalTerpakai = r.qty * cartItem.qty;
                    newStokData[stokItemIdx] = { ...stokItem, sisa: stokItem.sisa + totalTerpakai };
                  }
                  newKeuangan.hppTerjual = Math.max(0, newKeuangan.hppTerjual - (currentPrice * r.qty * cartItem.qty));
                });
              }
            });
          }
        }

        const newTransaksiList = [...state.transaksiList];
        newTransaksiList.splice(txIndex, 1);
        
        return {
          transaksiList: newTransaksiList,
          keuangan: newKeuangan,
          hutangList: newHutangList,
          stokData: newStokData
        };
      }),
      addHutang: (hutang) => set((state) => ({ hutangList: [...state.hutangList, hutang] })),
      updateHutang: (hutangList) => set({ hutangList }),
      
      updateKeuangan: (k) => set((state) => ({ keuangan: { ...state.keuangan, ...k } })),
      updateBebanAktif: (b) => set((state) => ({ bebanAktif: { ...state.bebanAktif, ...b } })),
      
      setTempResep: (tempResep) => set({ tempResep }),
      setFullState: (newState) => set((state) => ({ ...state, ...newState })),
      resetStore: () => set(initialState),
    }),
    {
      name: 'pos-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
