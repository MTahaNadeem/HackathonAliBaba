'use client';

import React from 'react';
import {
  MapPin,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Scale,
  GraduationCap,
  Coins,
  CheckCircle,
  RefreshCw,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { type University, type VerificationStatus } from '@/lib/catalogue';
import { assessUniversity, calculateUniversityFit, getFeeDisplay, type Profile } from '@/lib/domain';

export interface UniversityCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseUni: University | null;
  targetUni: University | null;
  onSelectTargetUni: (uni: University) => void;
  availableUnis: University[];
  profile: Profile;
}

function StatusPill({ status }: { status: VerificationStatus | undefined }) {
  if (status === 'live_refreshed') {
    return <span className="verification-badge live-refreshed" style={{ fontSize: '10px', padding: '3px 7px' }}><RefreshCw size={10} />Live</span>;
  }
  if (status === 'stale') {
    return <span className="verification-badge stale" style={{ fontSize: '10px', padding: '3px 7px' }}><Clock size={10} />Stale</span>;
  }
  if (status === 'needs_information') {
    return <span className="verification-badge needs-info" style={{ fontSize: '10px', padding: '3px 7px' }}><AlertTriangle size={10} />Check</span>;
  }
  return <span className="verification-badge manual-snapshot" style={{ fontSize: '10px', padding: '3px 7px' }}><CheckCircle size={10} />Verified</span>;
}

export function UniCompareColumn({ uni, profile, isPrimary }: { uni: University; profile: Profile; isPrimary: boolean }) {
  const assessment = assessUniversity(uni, profile);
  const fit = calculateUniversityFit(uni, profile);
  const feeDisplay = getFeeDisplay(uni);

  return (
    <section
      className="uni-compare-column"
      style={{
        background: '#ffffff',
        border: isPrimary ? '2px solid #93c5fd' : '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        boxShadow: isPrimary ? '0 4px 16px rgba(37, 99, 235, 0.08)' : 'none',
      }}
    >
      {/* Column top indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          className="subtle-pill"
          style={{
            fontSize: '10.5px',
            padding: '2px 8px',
            background: isPrimary ? '#eff6ff' : '#f1f5f9',
            color: isPrimary ? '#1d4ed8' : '#475569',
            fontWeight: 700,
            borderRadius: '6px',
          }}
        >
          {isPrimary ? 'SELECTED CAMPUS' : 'COMPARISON OPTION'}
        </span>
        <StatusPill status={uni.verificationStatus} />
      </div>

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            width: '46px',
            height: '46px',
            background: '#f1f5f9',
            color: '#1e3a8a',
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: '14px',
            flexShrink: 0,
            border: '1px solid #e2e8f0',
          }}
        >
          {uni.short}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--midnight)', margin: '0 0 3px', lineHeight: 1.3 }}>
            {uni.name}
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} /> {uni.city}
          </span>
        </div>
      </div>

      {/* Programme */}
      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px' }}>
        <small style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
          OFFERING
        </small>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--midnight)' }}>
          {uni.programme}
        </span>
      </div>

      {/* Fit and Budget Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span
          className={`degree-score-pill ${fit.fitPercentage >= 70 ? 'high' : ''}`}
          style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px' }}
        >
          {fit.fitPercentage}% Preference Fit
        </span>
        <span
          className={`db-uni-budget ${
            assessment.budget === 'Within semester budget'
              ? 'budget-ok'
              : assessment.budget === 'Add your budget' || assessment.budget === 'Costs need checking'
              ? 'budget-neutral'
              : 'budget-high'
          }`}
          style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px' }}
        >
          {assessment.budget}
        </span>
      </div>

      {/* Tuition */}
      <div style={{ padding: '12px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
        <small style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block' }}>
          SEMESTER TUITION
        </small>
        <strong style={{ fontSize: '18px', color: '#1e3a8a', display: 'block', marginTop: '2px' }}>
          {feeDisplay.tuition}
        </strong>
        <span style={{ fontSize: '11px', color: '#64748b' }}>{feeDisplay.mandatory}</span>
      </div>

      {/* Eligibility status */}
      <div>
        <small style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
          ADMISSION &amp; ELIGIBILITY
        </small>
        <div style={{ marginBottom: '6px' }}>
          {assessment.status === 'Academic minimum met' && (
            <span className="eligibility-pill met"><Check size={11} /> Academic minimum met</span>
          )}
          {assessment.status === 'Subject route needs review' && (
            <span className="eligibility-pill review"><AlertCircle size={11} /> Subject route review</span>
          )}
          {assessment.status === 'Check current admissions' && (
            <span className="eligibility-pill check"><HelpCircle size={11} /> Check current admissions</span>
          )}
          {assessment.status === 'Below published minimum' && (
            <span className="eligibility-pill below"><AlertCircle size={11} /> Below published minimum</span>
          )}
        </div>
        {assessment.detail && (
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            {assessment.detail}
          </p>
        )}
      </div>

      {/* Requirements Pills */}
      {(uni.entryTest || uni.minEligibility || uni.aggregateFormula) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: '#475569' }}>
          {uni.entryTest && (
            <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '8px' }}>
              <strong>Entry Test:</strong> {uni.entryTest}
            </div>
          )}
          {uni.minEligibility && (
            <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '8px' }}>
              <strong>Eligibility:</strong> {uni.minEligibility}
            </div>
          )}
          {uni.aggregateFormula && (
            <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '8px' }}>
              <strong>Merit Formula:</strong> {uni.aggregateFormula}
            </div>
          )}
        </div>
      )}

      {/* Match Reasons */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {fit.matchReasons.slice(0, 3).map((reason, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#166534' }}>
            <Check size={12} style={{ flexShrink: 0 }} />
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      {/* Official Admission Form Link */}
      <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
        <a
          href={uni.url}
          target="_blank"
          rel="noreferrer"
          className="button dark"
          style={{ width: '100%', justifyContent: 'center', fontSize: '13px' }}
          title={`Open official admission portal & application form for ${uni.name}`}
        >
          Open Admission Form <ArrowUpRight size={14} />
        </a>
      </div>
    </section>
  );
}

export function UniComparePicker({
  baseUni,
  targetUni,
  candidateUnis,
  onSelectTargetUni,
  profile,
}: {
  baseUni: University;
  targetUni: University | null;
  candidateUnis: University[];
  onSelectTargetUni: (uni: University) => void;
  profile: Profile;
}) {
  return (
    <div
      className="compare-picker-bar"
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '16px 20px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <label
          htmlFor="compare-uni-select"
          style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--midnight)', margin: 0 }}
        >
          Comparing <strong>{baseUni.name}</strong> with:
        </label>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {candidateUnis.length} campus option{candidateUnis.length === 1 ? '' : 's'} available
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          id="compare-uni-select"
          className="coursecompass-select"
          style={{ maxWidth: '360px', flex: '1 1 240px', minHeight: '42px', fontSize: '13px' }}
          value={targetUni?.id || ''}
          onChange={e => {
            const found = candidateUnis.find(u => u.id === e.target.value);
            if (found) onSelectTargetUni(found);
          }}
          aria-label="Select comparison campus"
        >
          <option value="" disabled>Choose a university to compare…</option>
          {candidateUnis.map(u => {
            const fit = calculateUniversityFit(u, profile);
            return (
              <option key={u.id} value={u.id}>
                {u.name} ({u.city}) · {fit.fitPercentage}% fit · {getFeeDisplay(u).tuition}
              </option>
            );
          })}
        </select>

        {/* Quick-choice chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {candidateUnis.slice(0, 4).map(c => (
            <button
              key={c.id}
              type="button"
              className={`chip ${targetUni?.id === c.id ? 'selected' : ''}`}
              style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
              onClick={() => onSelectTargetUni(c)}
            >
              {c.short} ({c.city})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UniversityCompareDialog({
  open,
  onOpenChange,
  baseUni,
  targetUni,
  onSelectTargetUni,
  availableUnis,
  profile,
}: UniversityCompareDialogProps) {
  if (!baseUni) return null;

  // Filter candidates to compare with (exclude the base university)
  const candidateUnis = availableUnis.filter(u => u.id !== baseUni.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="coursecompass-dialog wide" style={{ maxWidth: '980px', width: 'calc(100% - 32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Scale size={24} style={{ color: '#2563eb' }} />
          <DialogTitle className="dialog-title" style={{ margin: 0 }}>
            Compare Universities Side-by-Side
          </DialogTitle>
        </div>
        <DialogDescription style={{ margin: '0 0 16px', color: '#64748b' }}>
          Evaluate admission criteria, semester tuition, and personalized fit side-by-side to make an informed decision.
        </DialogDescription>

        {/* Choice Bar: Choose which university to compare with */}
        <UniComparePicker
          baseUni={baseUni}
          targetUni={targetUni}
          candidateUnis={candidateUnis}
          onSelectTargetUni={onSelectTargetUni}
          profile={profile}
        />

        {/* Comparison Grid */}
        {targetUni ? (
          <div
            className="uni-compare-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            <UniCompareColumn uni={baseUni} profile={profile} isPrimary={true} />
            <UniCompareColumn uni={targetUni} profile={profile} isPrimary={false} />
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 20px',
              border: '1px dashed #cbd5e1',
              borderRadius: '16px',
              background: '#f8fafc',
            }}
          >
            <GraduationCap size={36} style={{ color: '#94a3b8', margin: '0 auto 10px', display: 'block' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--midnight)', margin: '0 0 6px' }}>
              Select a university from the options above
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
              Choose another institution offering this programme to compare fees, admission rules, and your preference fit side-by-side.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
