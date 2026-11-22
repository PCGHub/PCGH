import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { postMessage, webUrl } from '../../supabase/functions/facebook-publisher/post.mjs';

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2';
const button = 'rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50';
const primary = 'rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50';

export default function FacebookPublisher({ campaign, onClose }) {
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const [caption, setCaption] = useState(campaign?.ad_copy || '');
  const [link, setLink] = useState(campaign?.tracking_link || campaign?.demand_gen_plan?.destination || '');
  const [image, setImage] = useState('');
  const [page, setPage] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [feedback, setFeedback] = useState('');
  const valid = Boolean(caption.trim() && (!link.trim() || webUrl(link.trim())) && (!image.trim() || webUrl(image.trim())));

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    let current = true;
    supabase.functions.invoke('facebook-publisher', { body: { action: 'status' } })
      .then(({ data }) => { if (current) setPage(data?.enabled ? data : { enabled: false }); })
      .catch(() => { if (current) setPage({ enabled: false }); });
    return () => { current = false; element.close(); };
  }, []);

  function change(setter) {
    return event => {
      setter(event.target.value);
      setConfirmed(false);
      setFeedback('');
    };
  }

  async function publish() {
    if (inFlight.current || !page?.enabled || !valid || (!confirmed && !attempt)) return;
    inFlight.current = true;
    const payload = attempt || {
      action: 'publish', requestId: crypto.randomUUID(), pageId: page.pageId, confirmed: true,
      caption: caption.trim(), link: link.trim(), image: image.trim()
    };
    setAttempt(payload);
    setBusy(true);
    setFeedback('');
    try {
      const body = attempt ? { action: 'check', requestId: attempt.requestId } : payload;
      const { data, error } = await supabase.functions.invoke('facebook-publisher', { body });
      if (error || data?.state !== 'published') {
        setFeedback('Publication could not be confirmed. Check the Page before starting a new attempt. Checking this attempt again will not send another post.');
        return;
      }
      setResult(data.url);
      setFeedback('Published to the Facebook Page.');
    } catch {
      setFeedback('Publication could not be confirmed. Check the Page before starting a new attempt.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function close() {
    if (inFlight.current) return;
    if (attempt && !result && !window.confirm('This post may already be on the Page. Close and check the Page before trying again?')) return;
    onClose();
  }

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(postMessage(caption, link));
      setFeedback('Caption and destination link copied.');
    } catch {
      setFeedback('Clipboard access failed. Select and copy the preview manually.');
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="facebook-publisher-title"
      onCancel={event => { event.preventDefault(); close(); }}
      className="w-[calc(100%-2rem)] max-w-2xl rounded-xl p-5 shadow-xl backdrop:bg-slate-900/50">
      <h2 id="facebook-publisher-title" className="text-2xl font-bold text-slate-900">Publish to Facebook</h2>
      <p className="mb-4 text-sm text-slate-600">Prepare an organic Page post with no ad spend.</p>
      <fieldset disabled={Boolean(attempt)} className="space-y-3">
        <label className="block text-sm font-medium">Caption
          <textarea className={field} rows={4} maxLength={2200} value={caption} onChange={change(setCaption)} />
        </label>
        <label className="block text-sm font-medium">Destination link (optional)
          <input className={field} type="url" maxLength={2000} value={link} onChange={change(setLink)} />
        </label>
        <label className="block text-sm font-medium">Public HTTPS image URL (optional)
          <input className={field} type="url" maxLength={2000} value={image} onChange={change(setImage)} />
        </label>
      </fieldset>
      <section aria-labelledby="post-preview" className="my-4 rounded-lg bg-slate-50 p-3">
        <h3 id="post-preview" className="font-semibold">Post preview</h3>
        <p className="whitespace-pre-wrap break-words text-sm">{postMessage(caption, link) || 'Add a caption to start.'}</p>
        {image && <p className="break-all text-sm text-slate-600">Image: {image}</p>}
      </section>
      {page?.enabled ? (
        <div className="space-y-2">
          <p className="text-sm">Facebook Page: <strong>{page.pageName}</strong></p>
          {!attempt && <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            I authorize PCGH to publish this preview to {page.pageName} now.
          </label>}
          {!result && <button type="button" className={primary} disabled={busy || !valid || (!confirmed && !attempt)} onClick={publish}>
            {busy ? 'Contacting Facebook…' : attempt ? 'Check publication' : 'Publish now'}
          </button>}
        </div>
      ) : <p className="text-sm text-slate-600">{page
        ? 'Direct publishing is unavailable for this account. Copy the post and publish it manually on your Page.'
        : 'Checking Page publishing access…'}</p>}
      <p role="status" className="my-3 text-sm text-slate-700">{feedback}</p>
      {result && <a className="font-medium text-blue-700 underline" href={result} target="_blank" rel="noopener noreferrer">Open published post</a>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={button} disabled={!caption.trim()} onClick={copyPost}>Copy post</button>
        <button type="button" className={button} disabled={busy} onClick={close}>Close</button>
      </div>
    </dialog>
  );
}
