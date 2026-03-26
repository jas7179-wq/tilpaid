import { formatCurrency, formatDate } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { ArrowUpDown, Pencil, Trash2, Lock } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TransactionCard({ transaction, isScheduled = false }) {
  const { categories, deleteTransactionById } = useApp();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const touchMoved = useRef(false);

  const cat = categories.find((c) => c.id === transaction.categoryId);
  const color = transaction.isAdjustment ? '#888780' : (cat?.color || '#6B7280');
  const isPositive = transaction.amount > 0;
  const isLocked = transaction.isLocked || transaction.isPreAnchor;

  const handleTouchStart = useCallback(() => {
    touchMoved.current = false;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowActions((prev) => !prev);
      setDeleteError('');
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (touchMoved.current) return;

    if (isLongPress.current) {
      isLongPress.current = false;
      e.preventDefault();
      return;
    }

    // Short tap
    if (showActions) {
      setShowActions(false);
      setDeleteError('');
    } else if (!isLocked) {
      navigate(`/edit/${transaction.id}`);
    }
  }, [showActions, navigate, transaction.id, isLocked]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    const result = await deleteTransactionById(transaction.id);
    if (result?.error) {
      setDeleteError(result.error);
      setTimeout(() => setDeleteError(''), 3000);
    } else {
      setShowActions(false);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-3 py-3 px-1 border-b border-border-light ${
          transaction.isAdjustment ? 'opacity-65' : ''
        } ${isLocked ? 'opacity-50' : ''} ${isScheduled ? 'bg-brand-50/30 border-dashed' : ''} select-none`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => {
          isLongPress.current = false;
          longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            setShowActions((prev) => !prev);
            setDeleteError('');
          }, 500);
        }}
        onMouseUp={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          if (!isLongPress.current) {
            if (showActions) {
              setShowActions(false);
              setDeleteError('');
            } else if (!isLocked) {
              navigate(`/edit/${transaction.id}`);
            }
          }
          isLongPress.current = false;
        }}
        onMouseLeave={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
          style={{
            backgroundColor: `${color}15`,
            color: color,
            border: transaction.isAdjustment ? `1.5px dashed ${color}` : 'none',
          }}
        >
          {transaction.isAdjustment ? (
            <ArrowUpDown size={14} />
          ) : isLocked ? (
            <Lock size={12} />
          ) : (
            transaction.description?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${transaction.isAdjustment ? 'italic' : ''}`}>
            {transaction.description}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {transaction.isAdjustment ? 'Balance anchor' : (cat?.name || 'Uncategorized')}
            {isLocked && !transaction.isAdjustment ? ' · Locked' : ''}
            {' · '}
            {formatDate(transaction.date)}
          </p>
        </div>

        {/* Actions or Amount */}
        {showActions && !isLocked ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              onTouchEnd={(e) => { e.stopPropagation(); navigate(`/edit/${transaction.id}`); }}
              onClick={(e) => { e.stopPropagation(); navigate(`/edit/${transaction.id}`); }}
              className="p-2.5 rounded-lg bg-brand-50 text-brand-500"
            >
              <Pencil size={16} />
            </button>
            <button
              onTouchEnd={handleDelete}
              onClick={handleDelete}
              className="p-2.5 rounded-lg bg-danger-50 text-danger-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : showActions && isLocked ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Lock size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted">Locked</span>
          </div>
        ) : (
          <div className="text-right shrink-0">
            <p
              className="text-sm font-medium"
              style={{ color: isPositive ? '#1D9E75' : undefined }}
            >
              {formatCurrency(transaction.amount)}
            </p>
            {transaction.runningBalance !== undefined && (
              <p className="text-[11px] text-text-muted mt-0.5">
                bal {formatCurrency(transaction.runningBalance)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Delete error message */}
      {deleteError && (
        <div className="px-2 py-1.5 mx-1 mb-1 bg-danger-50 rounded-lg">
          <p className="text-[11px] text-danger-700">{deleteError}</p>
        </div>
      )}
    </div>
  );
}
