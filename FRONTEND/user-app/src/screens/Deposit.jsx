import React, { useEffect, useState, useRef } from 'react';
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

// PayQr: Payment complete hone ke baad auto status check
export function PayQr({ amount, profile, uid, toast, go }) {
  const [status, setStatus] = useState('checking');
  const [paymentId, setPaymentId] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    // URL se payment_id lo
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('payment_id') || '';
    const st = params.get('st') || '';

    if (pid) {
      setPaymentId(pid);
      if (st === 'ok') {
        setStatus('success');
      } else {
        startPolling(pid);
      }
    } else {
      setStatus('no_payment');
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(pid) {
    setStatus('checking');
    let attempts = 0;
    const maxAttempts = 30; // 30 * 5 sec = 2.5 min

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollRef.current);
        setStatus('timeout');
        return;
      }

      try {
        const res = await fetch(BACKEND_URL + '/checkout-status.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: pid }),
        });
        const data = await res.json();
        if (data.success && data.status === 'success') {
          clearInterval(pollRef.current);
          setStatus('success');
        }
      } catch (e) {}
    }, 5000);
  }

  if (status === 'success') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9989;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#34c759', marginBottom: 8 }}>Payment Successful!</div>
          <div style={{ fontSize: 14, color: '#86868b', marginBottom: 20 }}>Wallet mein paisa add ho gaya</div>
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  if (status === 'timeout' || status === 'no_payment') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>&#9200;</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {status === 'timeout' ? 'Verification Timeout' : 'Payment Not Found'}
          </div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 20 }}>
            {status === 'timeout'
              ? 'Payment verify nahi ho paya. Admin se contact karo.'
              : 'Payment ID nahi mila.'}
          </div>
          {paymentId && (
            <div style={{ fontSize: 11, color: '#636366', marginBottom: 16 }}>
              Payment ID: {paymentId}
            </div>
          )}
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  // Checking status
  return (
    <div className="section active">
      <TopBar title="Payment" onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <span className="loader-dot" style={{ width: 40, height: 40, marginBottom: 16 }}></span>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Verifying Payment...</div>
        <div style={{ fontSize: 13, color: '#86868b', marginBottom: 16 }}>
          Payment verify ho raha hai. Kuch mat dabao.
        </div>
        {paymentId && (
          <div style={{ fontSize: 11, color: '#636366' }}>
            Payment ID: {paymentId}
          </div>
        )}
      </div>
    </div>
  );
}
