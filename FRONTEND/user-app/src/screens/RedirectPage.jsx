import React, { useState } from 'react';
import { TopBar } from '../components/ui.jsx';

const BACKEND_URL = 'https://php-vakki-8740.wasmer.app';

export default function RedirectPage({ uid, toast, go }) {
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');

  // URL se payment_id lo
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment_id') || params.get('payment_id') || '';

  async function submitUtr() {
    if (!utr.trim()) {
      toast('UTR number dalo', '#ff3b30');
      return;
    }
    if (utr.trim().length < 6) {
      toast('UTR number kam se kam 6 digits ka hona chahiye', '#ff3b30');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(BACKEND_URL + '/verify-utr.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utr: utr.trim(),
          userId: uid,
          payment_id: paymentId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setOrderId(data.order_id || paymentId);
        toast('UTR submit ho gaya! Admin verify karega.', '#34c759');
      } else {
        toast(data.error || 'Submit failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="section active">
        <TopBar title="Payment Submitted" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9989;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#34c759', marginBottom: 8 }}>
            Request Submitted!
          </div>
          <div style={{ fontSize: 14, color: '#86868b', marginBottom: 8 }}>
            Admin jaldi verify karega. Wallet update ho jayega.
          </div>
          {orderId && (
            <div style={{ fontSize: 11, color: '#636366', marginBottom: 20 }}>
              Order ID: {orderId}
            </div>
          )}
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section active">
      <TopBar title="Enter UTR Number" onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ padding: '30px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>&#128179;</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Payment Complete?
          </div>
          <div style={{ fontSize: 13, color: '#86868b' }}>
            UTR number dalo taake admin verify kar sake
          </div>
        </div>

        {paymentId && (
          <div style={{ fontSize: 11, color: '#636366', marginBottom: 16, textAlign: 'center' }}>
            Payment ID: {paymentId}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 6, display: 'block' }}>
            UTR Number
          </label>
          <input
            type="text"
            placeholder="UTR number yahan dalo"
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={16}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 16,
              border: '2px solid #e5e5ea',
              borderRadius: 12,
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 600,
              letterSpacing: 1,
            }}
          />
        </div>

        <button
          className="dp-btn"
          onClick={submitUtr}
          disabled={loading || !utr.trim()}
          style={{ opacity: loading || !utr.trim() ? 0.6 : 1 }}
        >
          {loading ? (
            <>
              <span className="loader-dot" style={{ width: 16, height: 16 }}></span>
              Submitting...
            </>
          ) : (
            <>
              <i className="fas fa-check-circle"></i> Submit UTR
            </>
          )}
        </button>

        <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#856404', fontWeight: 600, textAlign: 'center' }}>
            UTR number aapko UPI app ke transaction history mein mil jayega
          </div>
        </div>
      </div>
    </div>
  );
}
