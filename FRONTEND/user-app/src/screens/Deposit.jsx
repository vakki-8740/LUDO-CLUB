import React, { useEffect, useState, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const BACKEND_URL = 'https://ludo-club-bacend.onrender.com';

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'settings', 'app'))
      .then((d) => {
        if (d.exists() && d.data().depositOptions) {
          const arr = String(d.data().depositOptions).split(',').map((x) => parseInt(x)).filter((x) => x > 0);
          if (arr.length) setAmounts(arr);
        }
      })
      .catch(() => {});
  }, []);

  async function next() {
    const amt = parseInt(custom);
    let minDep = 1;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit Rs.' + minDep, '#ff3b30');
    if (amt > 5000) return toast('Maximum deposit Rs.5000', '#ff3b30');
    go('payqr:' + amt);
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Select Amount</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div key={amt} className={`dp-chip ${parseInt(custom) === amt ? 'selected' : ''}`} onClick={() => setCustom(String(amt))}>
              Rs.{amt}
            </div>
          ))}
        </div>
        <div className="dp-divider"><span>or enter custom amount</span></div>
        <div className="dp-custom">
          <span className="dp-rupee">Rs.</span>
          <input type="number" placeholder="Enter amount (min Rs.1)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <button className="dp-btn" onClick={next}>
          <i className="fas fa-arrow-right"></i> Next
        </button>
      </div>
    </div>
  );
}

export function PayQr({ amount, profile, uid, toast, go }) {
  const [status, setStatus] = useState('loading');
  const [txnid, setTxnid] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(300);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const orderDataRef = useRef(null);

  const createOrder = useCallback(async () => {
    setBusy(true);
    setStatus('loading');
    setErrorMsg('');
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
      orderDataRef.current = data;
      setStatus('ready');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('failed');
    } finally {
      setBusy(false);
    }
  }, [amount, uid, profile]);

  useEffect(() => {
    createOrder();
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  function openPayU() {
    const data = orderDataRef.current;
    if (!data || !data.fields) return;
    const f = data.fields;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.payu_url;

    Object.entries({
      key: f.key, txnid: f.txnid, amount: f.amount, productinfo: f.productinfo,
      firstname: f.firstname, email: f.email, phone: f.phone,
      surl: f.surl, furl: f.furl, hash: f.hash,
    }).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = String(v);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    setStatus('polling');
    setTimer(300);
    startPolling(data.txnid);
  }

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
      } catch (e) {}
    }, 5000);
  }

  useEffect(() => {
    if (status !== 'polling') return;
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

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  if (status === 'loading') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span className="loader-dot" style={{ width: 30, height: 30 }}></span>
          <div style={{ marginTop: 12, fontSize: 14, color: '#86868b' }}>Order ban raha hai...</div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>&#10060;</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Order Failed</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 20 }}>{errorMsg}</div>
          <button className="dp-btn" onClick={createOrder} disabled={busy}>
            <i className="fas fa-sync-alt"></i> {busy ? 'Loading...' : 'Try Again'}
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => go('wallet')}>Cancel</button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9989;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#34c759', marginBottom: 8 }}>Payment Successful!</div>
          <div style={{ fontSize: 14, color: '#86868b', marginBottom: 20 }}>Rs.{amount} wallet mein add ho gaya</div>
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>&#9200;</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Time Expired!</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 20 }}>Dobara try karo.</div>
          <button className="dp-btn" onClick={createOrder} disabled={busy}>
            <i className="fas fa-sync-alt"></i> Try Again
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => go('wallet')}>Cancel</button>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="section active">
        <TopBar title={'Pay Rs.' + amount} onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Secure Payment Gateway</div>
          <div style={{ fontSize: 12, color: '#86868b', marginBottom: 16 }}>
            UPI / Card / Net Banking se pay karo
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#007aff', marginBottom: 4 }}>Rs.{amount}</div>
          {txnid && <div style={{ fontSize: 11, color: '#636366', marginBottom: 20 }}>Order: {txnid}</div>}

          <div style={{ background: '#1c1c1e', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Payment options:</div>
            <div style={{ fontSize: 12, color: '#86868b', lineHeight: 2 }}>
              &#10003; Google Pay / PhonePe / Paytm / BHIM<br/>
              &#10003; Credit / Debit Card<br/>
              &#10003; Net Banking<br/>
              &#10003; Auto verify + Wallet update
            </div>
          </div>

          <button className="dp-btn" onClick={openPayU} disabled={busy} style={{ fontSize: 16 }}>
            <i className="fas fa-lock"></i> Pay Rs.{amount}
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => go('wallet')}>Cancel</button>
        </div>
      </div>
    );
  }

  if (status === 'polling') {
    return (
      <div className="section active">
        <TopBar title={'Pay Rs.' + amount} onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{
            fontSize: 32, fontWeight: 800, marginBottom: 16,
            color: timer < 60 ? '#ff3b30' : '#1c1c1e'
          }}>
            {formatTime(timer)}
          </div>

          <span className="loader-dot" style={{ width: 40, height: 40, marginBottom: 16 }}></span>

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Payment page khula hai</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 4 }}>
            UPI / Card / Net Banking se pay karo
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#007aff', marginBottom: 16 }}>Rs.{amount}</div>

          <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#856404' }}>
              Payment verify ho raha hai... Auto wallet update hoga
            </span>
          </div>

          {txnid && <div style={{ fontSize: 11, color: '#636366', marginBottom: 12 }}>Order: {txnid}</div>}

          <button className="dp-btn" onClick={openPayU}>
            <i className="fas fa-external-link-alt"></i> Payment page dubara kholein
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => go('wallet')}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}
