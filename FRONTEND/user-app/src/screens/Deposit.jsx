import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const DEFAULT_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const BACKEND_URL = 'https://php-vakki-8740.wasmer.app';

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(DEFAULT_AMOUNTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const appDoc = await getDoc(doc(db, 'settings', 'app'));
        if (appDoc.exists() && appDoc.data().depositOptions) {
          const arr = String(appDoc.data().depositOptions).split(',').map(x => parseInt(x)).filter(x => x > 0);
          if (arr.length) setAmounts(arr);
        }
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  async function selectAmount(amt) {
    setBusy(amt);
    try {
      const callbackUrl = BACKEND_URL + '/callback.php';
      const res = await fetch(BACKEND_URL + '/create-payment.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          userId: uid,
          userName: profile.name || 'Player',
          callback_url: callbackUrl,
        }),
      });
      const data = await res.json();
      if (data.success && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast(data.error || 'Payment create failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <span className="loader-dot" style={{ width: 24, height: 24 }}></span>
            <div style={{ marginTop: 10, fontSize: 13, color: '#86868b' }}>Loading...</div>
          </div>
        ) : (
          <>
            <div className="dp-label">Select Amount</div>
            <div className="dp-chips">
              {amounts.map((amt) => (
                <div
                  key={amt}
                  className={`dp-chip ${busy === amt ? 'selected' : ''}`}
                  onClick={() => !busy && selectAmount(amt)}
                  style={{ opacity: busy && busy !== amt ? 0.5 : 1 }}
                >
                  {busy === amt ? '...' : '₹' + amt}
                </div>
              ))}
            </div>
            <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#856404', fontWeight: 600, textAlign: 'center' }}>
                Amount select karo → Payment page pe pay karo → Wallet auto update
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PayQr() {
  return (
    <div className="section active">
      <div className="deposit-page-card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, color: '#86868b' }}>Payment page pe redirect ho raha hai...</div>
      </div>
    </div>
  );
}
