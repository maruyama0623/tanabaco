import { useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { formatNumber } from '../../utils/number';
import { Modal } from '../common/Modal';

interface Props {
  initialValue?: number | null;
  initialFormula?: string;
  onConfirm: (value: number, formula: string | undefined) => void;
  onCancel: () => void;
}

type KeyConfig = {
  label: string;
  className?: string;
  colSpan?: number;
};

const keyBg = 'bg-[#e8eff8]';
const keyOp = 'text-[#0f7bff]';
const keyEqual = 'bg-[#0f7bff] text-white';

const isSimpleNumber = (val: string) => /^-?\d+(\.\d+)?$/.test(val.trim());

// 4列グリッド。スクショの配置に合わせて行ごとに並べる。
const keypad: KeyConfig[] = [
  // Row1
  { label: 'AC', colSpan: 2, className: `${keyBg} ${keyOp} text-xl` },
  { label: '.', className: `${keyBg} text-xl` },
  { label: '÷', className: `${keyBg} ${keyOp} text-xl` },
  // Row2
  { label: '7', className: `${keyBg} text-xl` },
  { label: '8', className: `${keyBg} text-xl` },
  { label: '9', className: `${keyBg} text-xl` },
  { label: '×', className: `${keyBg} ${keyOp} text-xl` },
  // Row3
  { label: '4', className: `${keyBg} text-xl` },
  { label: '5', className: `${keyBg} text-xl` },
  { label: '6', className: `${keyBg} text-xl` },
  { label: '-', className: `${keyBg} ${keyOp} text-xl` },
  // Row4
  { label: '1', className: `${keyBg} text-xl` },
  { label: '2', className: `${keyBg} text-xl` },
  { label: '3', className: `${keyBg} text-xl` },
  { label: '+', className: `${keyBg} ${keyOp} text-xl` },
  // Row5
  { label: '00', className: `${keyBg} text-xl` },
  { label: '0', className: `${keyBg} text-xl` },
  { label: '⌫', className: `${keyBg} text-lg` },
  { label: '=', className: `${keyEqual} text-xl` },
];

export function NumericPad({ initialValue, initialFormula, onConfirm, onCancel }: Props) {
  const [expression, setExpression] = useState('');
  const [lastFormula, setLastFormula] = useState('');
  const [display, setDisplay] = useState('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [readyToConfirm, setReadyToConfirm] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);

  useEffect(() => {
    if (initialValue != null) {
      setExpression(initialFormula || String(initialValue));
      setLastFormula(initialFormula || '');
      setDisplay(String(initialValue));
      setReadyToConfirm(isSimpleNumber(initialFormula || String(initialValue)));
    }
  }, [initialFormula, initialValue]);

  const evaluate = (exp: string) => {
    const normalized = exp
      .replace(/÷/g, '/')
      .replace(/×/g, '*')
      .replace(/−/g, '-')
      .replace(/[^0-9+\-/*.]/g, '');
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict";return (${normalized || 0})`)();
      const num = Number(result);
      if (Number.isFinite(num)) {
        setDisplay(String(num));
        return num;
      }
      return Number(display);
    } catch {
      return Number(display);
    }
  };

  const handleInput = (val: string) => {
    const key = val === '◀️' ? '⌫' : val;
    if (key !== '=') {
      setJustEvaluated(false);
    }
    if (key !== '=') {
      if (lastFormula) setLastFormula('');
    }
    if (val !== '=' && lastFormula) {
      setLastFormula('');
    }
    if (key === 'AC') {
      setExpression('');
      setLastFormula('');
      setDisplay('0');
      setReadyToConfirm(false);
      return;
    }
    if (key === '⌫') {
      setExpression((prev) => {
        const next = prev.slice(0, -1);
        setDisplay(next || '0');
        setReadyToConfirm(isSimpleNumber(next));
        return next;
      });
      return;
    }
    const isOperator = ['+', '-', '×', '÷', '−'].includes(key);
    if (readyToConfirm && lastFormula && isOperator) {
      const next = `${lastFormula}${key}`;
      setExpression(next);
      setDisplay(next);
      setReadyToConfirm(false);
      return;
    }
    if (key === '=') {
      if (readyToConfirm) {
        confirm();
        return;
      }
      const num = evaluate(expression || display);
      const formula = expression || display;
      setLastFormula(formula);
      setExpression(String(num));
      setDisplay(String(num));
      setReadyToConfirm(true);
      setJustEvaluated(true);
      return;
    }
    setExpression((prev) => {
      const isOp = ['+', '-', '×', '÷', '−'].includes(key);
      const base = !isOp && justEvaluated ? '' : prev;
      const next = base + key;
      setDisplay(next);
      setReadyToConfirm(isSimpleNumber(next));
      return next;
    });
  };

  const confirm = () => {
    const num = evaluate(expression || display);
    const formulaForSave = (lastFormula || expression || '').trim() || undefined;
    onConfirm(num, formulaForSave);
    setReadyToConfirm(false);
  };

  const displayText = (() => {
    const numericPattern = /^-?\d+(\.\d+)?$/;
    if (numericPattern.test(display)) {
      return formatNumber(Number(display));
    }
    return display;
  })();

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-end gap-1 px-3">
          <div className="text-right text-lg text-gray-700">
            {lastFormula ? `${lastFormula}` : expression}
          </div>
          <div className="text-right text-5xl font-semibold leading-none text-black">
            {displayText}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 px-1 auto-rows-[64px]">
          {keypad.map((key) => (
            <button
              key={key.label}
              onClick={() => handleInput(key.label)}
              className={`flex h-full items-center justify-center rounded-[14px] text-xl font-semibold shadow-sm text-gray-800 ${key.className ?? keyBg}`}
              style={{
                gridColumn: key.colSpan ? `span ${key.colSpan} / span ${key.colSpan}` : undefined,
              }}
            >
              {key.label === '=' ? (readyToConfirm ? '確定' : '=') : key.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 px-1">
          <Button variant="secondary" onClick={() => setConfirmOpen(true)} block>
            削除
          </Button>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4">
          <div className="text-lg font-semibold text-gray-800">写真を削除しますか？</div>
          <p className="text-sm text-gray-600">入力した数量も削除されます。この操作は取り消せません。</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onCancel();
              }}
            >
              削除する
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
