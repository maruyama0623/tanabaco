import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface Props {
  title?: string;
  rightSlot?: React.ReactNode;
  rightSlotMobile?: React.ReactNode;
}

export function AppHeader({ title, rightSlot, rightSlotMobile }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const menuItems = [
    { label: '棚卸開始', to: '/start' },
    { label: '商品割り当て', to: '/assign' },
    { label: '棚卸表', to: '/report' },
    { label: '商品一覧', to: '/products' },
    { label: '事業部一覧', to: '/departments' },
    { label: '担当者一覧', to: '/staff' },
    { label: '仕入先一覧', to: '/suppliers' },
  ];

  const handleNavigate = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            aria-label="menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <div className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-black" />
              <span className="block h-0.5 w-5 bg-black" />
              <span className="block h-0.5 w-5 bg-black" />
            </div>
          </button>
          <Link to="/start" className="flex items-center gap-2">
            <img src="/logo.svg" alt="ソトバコロゴ" className="h-8 w-auto" />
          </Link>
        {title && <span className="ml-3 hidden text-lg font-semibold md:inline">{title}</span>}
      </div>
      <div className="hidden items-center md:flex">{rightSlot}</div>
      <div className="flex items-center md:hidden">{rightSlotMobile}</div>

      {open && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/30"
              onClick={() => setOpen(false)}
              aria-label="menu-backdrop"
            />
            <nav className="fixed left-0 top-0 z-30 h-full w-64 bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-base font-semibold">メニュー</span>
                <button
                  aria-label="close menu"
                  className="text-2xl leading-none text-gray-600 hover:text-gray-900"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <ul className="p-2">
                {menuItems.map((item) => (
                  <li key={item.to}>
                    <button
                      className="flex w-full items-center justify-between rounded px-3 py-3 text-left text-sm font-semibold hover:bg-muted"
                      onClick={() => handleNavigate(item.to)}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-gray-500">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
      </header>
      {title && (
        <div className="md:hidden border-b border-border px-4 py-2 text-base font-semibold">
          {title}
        </div>
      )}
    </>
  );
}
