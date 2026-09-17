import React, { useRef } from 'react';
import { TopBar } from '../components/ui.jsx';

const UPI_ID = 'q896598803@ybl';
const UPI_NAME = 'LUDO KILLER';

export default function QrPage({ amount, uid, toast, go }) {
  const canvasRef = useRef(null);
  const amt = parseInt(amount) || 0;
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amt}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}&bgcolor=ffffff&color=000000`;

  function downloadQr() {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = 'LRC_QR_₹' + amt + '.png';
    link.click();
    toast('QR download ho raha hai!', '#34c759');
  }

  return (
    <div className="section active">
      <TopBar title="Scan & Pay" onBack={() => go('deposit')} />
      <div className="deposit-page-card" style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: 14, color: '#86868b', marginBottom: 4 }}>Pay</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#1c1c1e', marginBottom: 16 }}>₹{amt}</div>

        <div style={{
          background: '#fff', borderRadius: 16, padding: 16, display: 'inline-block',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 16
        }}>
          <img src={qrUrl} alt="UPI QR" style={{ width: 220, height: 220, display: 'block' }} />
        </div>

        <div style={{ fontSize: 13, color: '#636366', marginBottom: 4 }}>UPI ID</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e', marginBottom: 6 }}>{UPI_ID}</div>
        <div style={{ fontSize: 12, color: '#86868b', marginBottom: 20 }}>Kisi bhi UPI app se scan karo</div>

        <button className="dp-btn" onClick={downloadQr} style={{ background: '#34c759', marginBottom: 10 }}>
          <i className="fas fa-download"></i> Download QR
        </button>

        <button className="dp-btn" onClick={() => go('utr:' + amt)}>
          <i className="fas fa-arrow-right"></i> Payment Done - Confirm
        </button>
      </div>
    </div>
  );
}
