import React from 'react';
import { DispatchStatus, PrecheckStatus } from '../../types';
import { DISPATCH_STATUS_LABELS, PRECHECK_STATUS_LABELS } from '../../services/excelService';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Search, HelpCircle, Layers } from 'lucide-react';

export const PrecheckBadge: React.FC<{ status: PrecheckStatus; candidateCount?: number }> = ({
  status,
  candidateCount,
}) => {
  const label = PRECHECK_STATUS_LABELS[status] || status;

  switch (status) {
    case 'exact_1':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {label}
        </span>
      );
    case 'not_found':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          {label}
        </span>
      );
    case 'multiple_matches':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <Layers className="w-3.5 h-3.5 text-amber-600" />
          {label} {candidateCount ? `(${candidateCount}건)` : ''}
        </span>
      );
    case 'region_needed':
    case 'name_mismatch':
    case 'needs_review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {label}
        </span>
      );
    case 'search_error':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          {label}
        </span>
      );
    case 'not_checked':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
      );
  }
};

export const DispatchBadge: React.FC<{ status: DispatchStatus }> = ({ status }) => {
  const label = DISPATCH_STATUS_LABELS[status] || status;

  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {label}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          {label}
        </span>
      );
    case 'needs_review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {label}
        </span>
      );
    case 'sending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {label}
        </span>
      );
    case 'waiting':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
      );
  }
};
