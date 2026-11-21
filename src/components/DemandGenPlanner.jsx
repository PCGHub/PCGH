import { useEffect, useRef, useState } from 'react';

const steps = ['Objective', 'Measurement', 'Campaign settings', 'Audience', 'Creative', 'Review'];
const initialPlan = {
  step: 0,
  objective: 'traffic',
  goal: 'Conversions',
  verified: false,
  viewThrough: false,
  bid: 'Maximize conversions',
  targetCpa: '',
  group: '',
  headline: '',
  copy: '',
  destination: '',
  media: '',
  channelRequired: false,
  channelLinked: false,
  reviewed: false
};
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2';
const secondary = 'rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = 'rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50';

function webUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function readiness(plan, fields) {
  return [
    { label: 'Campaign name', complete: Boolean(fields.title.trim()), step: 2 },
    { label: 'Conversion action verification', complete: plan.verified, step: 1, advisory: true },
    { label: 'Daily budget and bid', complete: positive(fields.budget) && (plan.bid !== 'Target CPA' || positive(plan.targetCpa)), step: 2 },
    { label: 'Ad group and audience', complete: Boolean(plan.group.trim() && fields.location.trim()), step: 3 },
    { label: 'Creative and destination', complete: Boolean(plan.headline.trim() && plan.copy.trim() && webUrl(plan.destination) && webUrl(plan.media)), step: 4 },
    { label: 'Video channel prerequisite', complete: !plan.channelRequired || plan.channelLinked, step: 4 }
  ];
}

function Field({ label, ...props }) {
  return <label className="block space-y-1 text-sm font-medium">
    <span>{label}</span>
    <input className={inputClass} {...props} />
  </label>;
}

function Select({ label, options, value, onChange }) {
  return <label className="block space-y-1 text-sm font-medium">
    <span>{label}</span>
    <select className={inputClass} value={value} onChange={onChange}>
      {options.map(option => typeof option === 'string'
        ? <option key={option}>{option}</option>
        : <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

function Check({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm font-medium">
    <input type="checkbox" checked={checked} onChange={onChange} /> {label}
  </label>;
}

export default function DemandGenPlanner({ campaign, onSave, onClose }) {
  const [plan, setPlan] = useState(() => ({ ...initialPlan, ...campaign?.demand_gen_plan }));
  const [fields, setFields] = useState(() => ({
    title: campaign?.demand_gen_plan?.title ?? campaign?.title ?? campaign?.name ?? '',
    budget: campaign?.budget == null ? '' : String(campaign.budget),
    currency: campaign?.currency ?? 'NGN',
    location: campaign?.target_audience?.location ?? '',
    interests: campaign?.target_audience?.interests ?? ''
  }));
  const [step, setStep] = useState(() => Number.isInteger(plan.step) && steps[plan.step] ? plan.step : 0);
  const [savedCampaign, setSavedCampaign] = useState(campaign);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dialog = useRef(null);
  const heading = useRef(null);
  const savingRef = useRef(false);
  const checks = readiness(plan, fields);
  const canReview = checks.every(check => check.advisory || check.complete);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => { heading.current?.focus(); }, [step]);

  function edit(setter, name, value) {
    setter(current => ({ ...current, [name]: value }));
    setDirty(true);
    setStatus('');
  }

  const setText = (setter, name) => event => edit(setter, name, event.target.value);
  const setCheck = name => event => edit(setPlan, name, event.target.checked);

  async function save(nextStep, reviewed = false) {
    if (savingRef.current) return;
    if (reviewed && !canReview) return;
    if (fields.budget !== '' && (!Number.isFinite(Number(fields.budget)) || Number(fields.budget) < 0)) {
      setError('Enter a valid non-negative budget.');
      setStep(2);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');
    setStatus('Saving…');
    const nextPlan = { ...plan, step: nextStep, reviewed: reviewed || (plan.reviewed && !dirty) };
    try {
      const saved = await onSave(savedCampaign, fields, nextPlan);
      setSavedCampaign(saved);
      setPlan(nextPlan);
      setStep(nextStep);
      setDirty(false);
      setStatus(reviewed ? 'Plan marked ready for manual launch.' : 'Draft saved.');
    } catch (failure) {
      setStatus('');
      setError(failure.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function close() {
    if (savingRef.current) return;
    if (!dirty || window.confirm('Close without saving your latest changes?')) onClose();
  }

  return (
    <dialog ref={dialog} aria-labelledby="demand-gen-title" onCancel={event => { event.preventDefault(); close(); }}
      className="w-[calc(100%-2rem)] max-w-4xl rounded-xl p-0 shadow-xl backdrop:bg-slate-900/50">
      <div className="border-b border-slate-200 p-5">
        <h2 id="demand-gen-title" className="text-2xl font-bold">Demand Gen planner</h2>
        <p className="text-sm text-slate-600">Prepare a campaign for manual launch.</p>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <ol className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Planning steps">
            {steps.map((label, index) => (
              <li key={label} aria-current={step === index ? 'step' : undefined}>
                <button type="button" disabled={saving} onClick={() => setStep(index)}
                  className={step === index ? 'rounded bg-blue-100 px-2 py-1 font-semibold text-blue-900' : 'rounded px-2 py-1 text-slate-700 hover:bg-slate-100'}>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <h3 ref={heading} tabIndex={-1} className="mb-4 text-lg font-semibold">{steps[step]}</h3>
          <fieldset disabled={saving} className="space-y-4">
            {step === 0 && <Select label="Campaign objective" value={plan.objective} onChange={setText(setPlan, 'objective')}
              options={[{ value: 'traffic', label: 'Website visits' }, { value: 'leads', label: 'Lead generation' }, { value: 'sales', label: 'Sales' }, { value: 'engagement', label: 'Video engagement' }]} />}
            {step === 1 && <>
              <Select label="Optimization goal" value={plan.goal} options={['Conversions', 'Clicks', 'Video engagements']} onChange={setText(setPlan, 'goal')} />
              <Check label="I verified the conversion action on the ad platform" checked={plan.verified} onChange={setCheck('verified')} />
              <Check label="Plan to include view-through conversions" checked={plan.viewThrough} onChange={setCheck('viewThrough')} />
            </>}
            {step === 2 && <>
              <Field label="Campaign name" maxLength={256} value={fields.title} onChange={setText(setFields, 'title')} />
              <Select label="Currency" value={fields.currency} options={['NGN', 'USD']} onChange={setText(setFields, 'currency')} />
              <Field label="Daily budget" type="number" min="0" step="0.01" value={fields.budget} onChange={setText(setFields, 'budget')} />
              <Select label="Bidding strategy" value={plan.bid} options={['Maximize conversions', 'Maximize clicks', 'Target CPA']} onChange={setText(setPlan, 'bid')} />
              {plan.bid === 'Target CPA' && <Field label="Target cost per action" type="number" min="0" step="0.01" value={plan.targetCpa} onChange={setText(setPlan, 'targetCpa')} />}
            </>}
            {step === 3 && <>
              <Field label="Ad group name" maxLength={120} value={plan.group} onChange={setText(setPlan, 'group')} />
              <Field label="Audience location" maxLength={180} value={fields.location} onChange={setText(setFields, 'location')} />
              <Field label="Audience interests" maxLength={180} value={fields.interests} onChange={setText(setFields, 'interests')} />
            </>}
            {step === 4 && <>
              <Field label="Ad headline" maxLength={90} value={plan.headline} onChange={setText(setPlan, 'headline')} />
              <Field label="Ad description" maxLength={180} value={plan.copy} onChange={setText(setPlan, 'copy')} />
              <Field label="Destination URL" type="url" maxLength={2000} value={plan.destination} onChange={setText(setPlan, 'destination')} />
              <Field label="Image or video URL" type="url" maxLength={2000} value={plan.media} onChange={setText(setPlan, 'media')} />
              <Check label="This plan requires a linked video channel" checked={plan.channelRequired} onChange={setCheck('channelRequired')} />
              {plan.channelRequired && <Check label="I linked the channel on the ad platform" checked={plan.channelLinked} onChange={setCheck('channelLinked')} />}
            </>}
            {step === 5 && <div className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold">{fields.title.trim() || 'Untitled campaign'}</p>
              <p>{fields.currency} {fields.budget || '0'} daily · {plan.bid}</p>
              <p>{plan.group || 'No ad group'} · {fields.location || 'No location'}</p>
              <p>{plan.headline || 'No headline'}</p>
              <p>{canReview ? 'Required planning checks are complete.' : 'Resolve the incomplete checks before marking the plan ready.'}</p>
            </div>}
          </fieldset>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          <p role="status" className="mt-4 text-sm text-slate-600">{status}</p>
        </div>
        <aside className="rounded-lg bg-slate-50 p-4" aria-label="Readiness checklist">
          <h3 className="mb-2 font-semibold">Readiness checklist</h3>
          <ul className="space-y-2 text-sm">
            {checks.map(check => <li key={check.label}>
              <button type="button" disabled={saving} onClick={() => setStep(check.step)} className="text-left font-medium text-blue-700 underline">{check.label}</button>
              <span className="block text-slate-600">{check.complete ? 'Complete' : check.advisory ? 'Advisory · verify manually' : 'Incomplete'}</span>
            </li>)}
          </ul>
        </aside>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-5">
        <button type="button" onClick={close} disabled={saving} className={secondary}>Close planner</button>
        <button type="button" onClick={() => save(step)} disabled={saving} className={secondary}>Save draft</button>
        {step < steps.length - 1
          ? <button type="button" onClick={() => save(step + 1)} disabled={saving} className={primary}>Save and continue</button>
          : <button type="button" onClick={() => save(step, true)} disabled={saving || !canReview} className={primary}>Mark plan ready</button>}
      </div>
    </dialog>
  );
}
