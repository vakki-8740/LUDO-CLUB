import React, { useEffect, useState, useRef, useCallback } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { todayStr } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000];
const BACKEND_URL = 'https://ludo-club-bacend.onrender.com';

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'settings', 'app'))
      .then((d) => {
        if (d.exists() && d.data().depositOptions) {
          const arr = String(d.data().depositOptions)
            .split(',')
            .map((x) => parseInt(x))
            .filter((x) => x > 0);
          if (arr.length) setAmounts(arr);
        }
      })
      .catch(() => {});
  }, []);

  async function next() {
    const amt = parseInt(custom);
    let minDep = 100;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit ₹' + minDep, '#ff3b30');
    go('payqr:' + amt);
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Select Amount</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div
              key={amt}
              className={`dp-chip ${parseInt(custom) === amt ? 'selected' : ''}`}
              onClick={() => setCustom(String(amt))}
            >
              ₹{amt}
            </div>
          ))}
        </div>
        <div className="dp-divider"><span>or enter custom amount</span></div>
        <div className="dp-custom">
          <span className="dp-rupee">₹</span>
          <input type="number" placeholder="Enter amount (min ₹100)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <button className="dp-btn" onClick={next}>
          <i className="fas fa-arrow-right"></i> Next
        </button>
      </div>
    </div>
  );
}

// Payment Page: QR Code + Timer + Auto Verify
export function PayQr({ amount, profile, uid, toast, go }) {
  const [txnid, setTxnid] = useState('');
  const [qrData, setQrData] = useState('');
  const [timer, setTimer] = useState(300); // 5 min
  const [status, setStatus] = useState('loading'); // loading | pending | success | failed
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  // Create PayU order
  const createOrder = useCallback(async () => {
    setBusy(true);
    setStatus('loading');
    try {
      const res = await fetch(BACKEND_URL + '/payu-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(amount),
          userId: uid,
          userName: profile.name || 'Player',
          email: profile.email || 'noreply@example.com',
          phone: '9999999999',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Order create failed');

      setTxnid(data.txnid);

      // UPI QR code generate karo
      const upiId = '13764891@payu'; // PayU merchant UPI
      const qrUrl = `upi://pay?pa=${upiId}&pn=Ludo Royal Club&am=${amount}&tn=Deposit ${data.txnid}&cu=INR`;
      setQrData(qrUrl);

      setStatus('pending');
      setTimer(300);
      startPolling(data.txnid);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
      setStatus('failed');
    } finally {
      setBusy(false);
    }
  }, [amount, uid, profile, toast]);

  // Polling: har 5 sec pe verify karo
  function startPolling(id) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(BACKEND_URL + '/verify-payment.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txnid: id }),
        });
        const data = await res.json();
        if (data.success && data.status === 'success') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus('success');
        }
      } catch (e) {
        // Retry on next tick
      }
    }, 5000);
  }

  // Timer
  useEffect(() => {
    if (status !== 'pending') return;
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          setStatus('expired');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, [status]);

  // Order create on mount
  useEffect(() => {
    createOrder();
  }, []);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  // SUCCESS
  if (status === 'success') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>
            Payment Successful!
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
            ₹{amount} wallet mein add ho gaya
          </div>
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  // EXPIRED
  if (status === 'expired') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>⏰</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Time Expired!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Payment ka time khatam ho gaya. Dobara try karo.
          </div>
          <button className="dp-btn" onClick={createOrder} disabled={busy}>
            <i className="fas fa-sync-alt"></i> {busy ? 'Loading...' : 'Try Again'}
          </button>
          <button className="dp-btn" style={{ background: 'var(--text-muted)', marginTop: 10 }} onClick={() => go('wallet')}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // LOADING
  if (status === 'loading') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span className="loader-dot" style={{ width: 30, height: 30 }}></span>
          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted)' }}>Order ban raha hai...</div>
        </div>
      </div>
    );
  }

  // PENDING — QR + Timer
  return (
    <div className="section active">
      <TopBar title={`Pay ₹${amount}`} onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ textAlign: 'center' }}>
        {/* Timer */}
        <div style={{
          fontSize: 28, fontWeight: 800, marginBottom: 16,
          color: timer < 60 ? 'var(--danger)' : 'var(--text)'
        }}>
          <i className="fas fa-clock" style={{ marginRight: 6 }}></i>
          {formatTime(timer)}
        </div>

        {/* QR Code */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            QR scan karke pay karo
          </div>
          {qrData ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=220x220`}
              alt="Payment QR"
              style={{ width: 220, height: 220, borderRadius: 12, border: '2px solid #e5e5ea' }}
            />
          ) : (
            <div style={{ width: 220, height: 220, background: '#f5f5f5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <span className="loader-dot"></span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>₹{amount}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Koi bhi UPI app se scan karo
        </div>

        {/* Status */}
        <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#856404' }}>
            <span className="loader-dot" style={{ width: 12, height: 12, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}></span>
            Payment verify ho raha hai...
          </div>
        </div>

        {/* Transaction ID */}
        {txnid && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Order ID: {txnid}
          </div>
        )}

        {/* Retry */}
        <button className="dp-btn" style={{ background: 'var(--text-muted)' }} onClick={createOrder} disabled={busy}>
          <i className="fas fa-sync-alt"></i> {busy ? 'Loading...' : 'New QR Generate'}
        </button>
      </div>
    </div>
  );
}
