import React, { createContext, useState, useContext, ReactNode } from 'react';

type ModalType = 'alert' | 'confirm' | 'prompt_text' | 'prompt_num' | 'print_confirm';

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  msg: string;
  resolve: (value: any) => void;
}

interface ModalContextProps {
  popup: (type: ModalType, msg: string, title?: string) => Promise<any>;
}

const ModalContext = createContext<ModalContextProps | undefined>(undefined);

export const useAppModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useAppModal must be used within ModalProvider");
  return context;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'alert',
    title: '',
    msg: '',
    resolve: () => {},
  });
  const [inputValue, setInputValue] = useState('');

  const popup = (type: ModalType, msg: string, title = 'Informasi') => {
    return new Promise<any>((resolve) => {
      setInputValue('');
      setModal({ isOpen: true, type, title, msg, resolve });
    });
  };

  const handleClose = (value: any) => {
    modal.resolve(value);
    setModal({ ...modal, isOpen: false });
  };

  const parseAngka = (str: string) => {
    return parseInt(String(str).replace(/\D/g, ''), 10) || 0;
  };

  const formatUang = (val: string) => {
    let clean = String(val).replace(/\D/g, '');
    if (clean === '') return '';
    return parseInt(clean, 10).toLocaleString('id-ID');
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (modal.type === 'prompt_num') {
      setInputValue(formatUang(e.target.value));
    } else {
      setInputValue(e.target.value);
    }
  };

  const handleConfirm = () => {
    if (modal.type === 'prompt_num') {
      handleClose(parseAngka(inputValue));
    } else if (modal.type === 'prompt_text') {
      handleClose(inputValue.trim());
    } else {
      handleClose(true);
    }
  };

  return (
    <ModalContext.Provider value={{ popup }}>
      {children}
      <div className={`modal-overlay ${modal.isOpen ? 'active' : ''}`} id="clayModal">
        <div className="clay-card modal-box" style={{ textAlign: 'center', margin: 'auto' }}>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>{modal.title}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
            {modal.msg}
          </p>
          
          {(modal.type === 'prompt_text' || modal.type === 'prompt_num') && (
            <input
              type="text"
              inputMode={modal.type === 'prompt_num' ? 'numeric' : 'text'}
              className="btn-input"
              style={{ textAlign: 'center', fontSize: '18px', display: 'block' }}
              placeholder={modal.type === 'prompt_num' ? 'Ketik nominal angka...' : 'Ketik di sini...'}
              value={inputValue}
              onChange={handleInput}
              autoFocus
            />
          )}

          <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
            {(modal.type === 'confirm' || modal.type === 'print_confirm' || modal.type === 'prompt_text' || modal.type === 'prompt_num') && (
              <button
                className="btn bg-red"
                style={{ flex: 1, display: 'block' }}
                onClick={() => handleClose(false)}
              >
                {modal.type === 'print_confirm' ? 'Tidak Perlu' : 'Batal'}
              </button>
            )}
            <button
              className="btn bg-blue"
              style={{ flex: 1 }}
              onClick={handleConfirm}
            >
              {modal.type === 'alert' ? 'Tutup' : modal.type === 'print_confirm' ? 'Print Struk' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </ModalContext.Provider>
  );
};
