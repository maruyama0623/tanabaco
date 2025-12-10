import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useSessionStore } from '../../store/sessionStore';
import { useProductStore } from '../../store/productStore';

export function AssignedDetailPage() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const products = useProductStore((s) => s.products);
  const deletePhoto = useSessionStore((s) => s.deletePhoto);

  const firstAssigned = useMemo(
    () => session?.photoRecords.find((p) => p.status === 'assigned') ?? null,
    [session],
  );

  if (!session || !firstAssigned) {
    navigate('/pc/assign');
    return null;
  }

  const product = products.find((p) => p.id === firstAssigned.productId);

  return (
    <div className="min-h-screen bg-white pb-10">
      <AppHeader title="割り当て済み" />
      <div className="mx-auto flex max-w-4xl gap-6 px-6 py-8">
        <div className="h-80 w-80 overflow-hidden rounded border">
          <img src={firstAssigned.imageUrl} alt="assigned" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="text-xs text-gray-500">{product?.productCd}</div>
            <div className="text-2xl font-semibold">{product?.name}</div>
            <div className="text-lg text-gray-700">{product?.supplierName}</div>
          </div>
          <div className="text-4xl font-bold text-primary">{firstAssigned.quantity}</div>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/pc/assign/modal/${firstAssigned.id}`)}>変更する</Button>
            <Button
              variant="secondary"
              onClick={() => {
                deletePhoto(firstAssigned.id);
                navigate('/pc/assign');
              }}
            >
              削除する
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
