import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { compressPhoto, prizeFor, PLATFORM_FEE_PCT } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

async function sendProofToTelegram(botToken, chatId, photoBlob, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', photoBlob, 'win-proof.jpg');
  form.append('caption', caption);
  const res = await fetch('https://api.telegram.org/bot' + botToken + '/sendPhoto', {
    method: 'POST',
    body: form
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram send fail');
}

function fmtTime(ts) {
  try {
    if (ts && ts.toDate) return ts.toDate().toLocaleString();
  } catch (e) {}
  return '--';
}

// Match page: room-code exchange -> dono confirm -> LIVE -> I WIN / I LOSS
export default function Match({ betId, bets, uid, toast, go }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [claim, setClaim] = useState(null);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [showWinPopup, setShowWinPopup] = useState(false);

  const bet = bets.find((b) => b.id === betId);
  if (!bet) {
    return (
      <div className="section active">
        <TopBar title="Match" onBack={() => go('lobby')} />
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Match nahi mila (cancel/complete ho gaya).
        </div>
      </div>
    );
  }

  const isCreator = bet.creatorId === uid;
  const oppName = isCreator ? bet.joinerName : bet.creatorName;
  const live = bet.status === 'playing';
  const completed = bet.status === 'completed';

  // Meri is match ki claim lao
  useEffect(() => {
    getDocs(query(
      collection(db, 'win_claims'),
      where('betId', '==', bet.id),
      where('userId', '==', uid),
      limit(5)
    )).then((snap) => {
      let latest = null;
      snap.forEach((d) => { latest = { id: d.id, ...d.data() }; });
      if (latest) setClaim(latest);
    }).catch(() => {});
  }, [bet.id, uid]);

  function copyCode() {
    try {
      navigator.clipboard.writeText(bet.roomCode || '');
      toast('Room code copied!', '#34c759');
    } catch (e) {}
  }

  // Creator: room code bhejo
  async function sendRoomCode() {
    const rc = (code || '').trim().toUpperCase();
    if (!rc) return toast('Room code dalo', '#ff3b30');
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'bets', bet.id));
        if (!snap.exists()) throw new Error('Match nahi mila');
        const d = snap.data();
        if (d.creatorId !== uid) throw new Error('Sirf bet lagane wala code bhej sakta hai');
        const upd = { roomCode: rc, creatorConfirmed: true };
        if (d.joinerConfirmed) upd.status = 'playing';
        tx.update(doc(db, 'bets', bet.id), upd);
      });
      toast('Room code bhej diya!', '#34c759');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // I WIN: proof image manga + Telegram pe bheja
  async function iWin() {
    if (!proof) return toast('Pehle win screenshot lagao', '#ff3b30');
    if (claim && claim.status === 'pending') return toast('Proof pehle se bheja hai', '#ff9500');
    setBusy(true);
    try {
      const cfgSnap = await getDoc(doc(db, 'settings', 'win_telegram'));
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      if (!cfg.botToken || !cfg.chatId) throw new Error('Win proof abhi band hai. Thodi der baad try karo.');
      const small = await compressPhoto(proof);
      const caption =
        '🏆✨ WIN PROOF ✨🏆\n\n' +
        '🆔 UID:\n\n' + uid + '\n\n' +
        '🎯 Bet ID:\n\n' + bet.id + '\n\n' +
        '💰 Bet Amount: ₹' + (bet.amount || 0) + '\n\n' +
        '🏅 Prize Won: ₹' + prizeFor(bet.amount) + '\n' +
        '━━━━━━━━━━━━━━━━━━\n' +
        '🎉 CONGRATULATIONS! 🎉\n' +
        '━━━━━━━━━━━━━━━━━━';
      await sendProofToTelegram(cfg.botToken, cfg.chatId, small, caption);
      // Claim record banao
      const ref = await addDoc(collection(db, 'win_claims'), {
        betId: bet.id,
        userId: uid,
        userName: (isCreator ? bet.creatorName : bet.joinerName) || 'Player',
        betAmount: bet.amount || 0,
        result: 'win',
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setClaim({ id: ref.id, status: 'pending' });
      // Bet ko completed mein move karo
      await updateDoc(doc(db, 'bets', bet.id), {
        status: 'completed',
        result: 'win',
        completedBy: uid,
        completedAt: serverTimestamp()
      });
      setProof(null);
      toast('Proof bheja gaya! Approve hote hi payment milega.', '#34c759');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // I LOSS: seedha completed mein move karo
  async function iLoss() {
    if (!confirm('Tum haar gaye? Bet complete ho jayegi.')) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'bets', bet.id), {
        status: 'completed',
        result: 'loss',
        completedBy: uid,
        completedAt: serverTimestamp()
      });
      toast('Bet complete hui. Better luck next time! 🍀', '#ff9500');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // Cancel bet: sirf status change, balance refund admin karega
  async function cancelBet() {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'bets', bet.id), {
        status: 'cancelled',
        cancelledBy: uid,
        cancelledAt: serverTimestamp()
      });
      toast('Bet cancel ho gayi. Admin paisa wapas karega.', '#34c759');
      setShowCancelPopup(false);
      go('lobby');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // WIN PROOF cancel
  async function cancelProof() {
    if (!claim || !claim.id) return;
    if (!confirm('Win proof request cancel karein?')) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'win_claims', claim.id), { status: 'cancelled' });
      setClaim({ ...claim, status: 'cancelled' });
      setProof(null);
      toast('Proof request cancelled', '#ff9500');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section active">
      <TopBar title="Match" onBack={() => go('lobby')} />

      {/* Amount + timing + opponent */}
      <div className="wallet-card" style={{ textAlign: 'center' }}>
        <div className="wallet-label">Bet Amount</div>
        <div className="wallet-amount">₹{bet.amount || 0}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Timing: {fmtTime(bet.matchedAt || bet.timestamp)}
        </div>
      </div>

      {/* Player VS Card */}
      <div className="bet-card-new playing">
        <div className="bet-card-top">
          <div className="bet-user">
            <div className="bet-user-avatar">
              {bet.creatorLogo ? <img src={bet.creatorLogo} alt="" /> : '?'}
            </div>
            <div className="bet-user-name">{bet.creatorName || 'Player'}</div>
          </div>
          <div className="bet-vs-center">
            <div className="bet-amount-green">VS</div>
          </div>
          <div className="bet-user">
            <div className="bet-user-avatar">
              {bet.joinerLogo ? <img src={bet.joinerLogo} alt="" /> : '?'}
            </div>
            <div className="bet-user-name">{bet.joinerName || 'Player'}</div>
          </div>
        </div>
        <div className={`bet-status-badge ${live ? 'playing' : completed ? 'completed' : ''}`}>
          {live ? 'LIVE NOW' : completed ? 'COMPLETED' : 'ROOM CODE EXCHANGE'}
        </div>
      </div>

      {/* ========== COMPLETED STATE ========== */}
      {completed && (
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>
            {bet.result === 'win' ? '🏆' : '😔'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {bet.result === 'win' ? 'Tum Jeete!' : 'Tum Haare!'}
          </div>
          {bet.result === 'win' && claim && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {claim.status === 'pending' && 'Proof review mein hai — approve hone tak wait karo...'}
              {claim.status === 'approved' && <span style={{ color: 'var(--success)', fontWeight: 700 }}>Proof approved! Payment admin karega.</span>}
              {claim.status === 'rejected' && <span style={{ color: 'var(--danger)' }}>Proof rejected. Dobara bhejo.</span>}
            </div>
          )}
          <button className="dp-btn" style={{ marginTop: 14, background: 'var(--primary)' }} onClick={() => go('lobby')}>
            <i className="fas fa-arrow-left"></i> Lobby pe jao
          </button>
        </div>
      )}

      {/* ========== LIVE STATE ========== */}
      {live && (
        <div className="deposit-page-card" style={{ textAlign: 'center' }}>
          <div className="dp-label">Match LIVE hai! Game me jao aur khelo 🍀</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Jeetne wale ko: <strong style={{ color: 'var(--success)', fontSize: 16 }}>₹{prizeFor(bet.amount)}</strong>
            <br />({PLATFORM_FEE_PCT}% platform fee cut ke baad)
          </div>
          {bet.roomCode && (
            <div className="rc-code" style={{ color: 'var(--text)' }}>{bet.roomCode}</div>
          )}
          <button className="dp-btn" style={{ background: 'var(--primary)', marginBottom: 12 }} onClick={copyCode}>
            <i className="fas fa-copy"></i> Copy Room Code
          </button>

          {/* I WIN / I LOSS buttons */}
          <div className="dp-divider"><span>Game khatam hua?</span></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              className="dp-btn"
              style={{ background: 'var(--success)', flex: 1 }}
              onClick={() => setShowWinPopup(true)}
              disabled={busy}
            >
              <i className="fas fa-trophy"></i> I WIN
            </button>
            <button
              className="dp-btn"
              style={{ background: 'var(--danger)', flex: 1 }}
              onClick={iLoss}
              disabled={busy}
            >
              <i className="fas fa-thumbs-down"></i> I LOSS
            </button>
          </div>

          {/* Claim status */}
          {claim && claim.status === 'pending' && (
            <div style={{ marginTop: 12, padding: 10, background: '#fffbe6', borderRadius: 10 }}>
              <span className="loader-dot" style={{ width: 18, height: 18 }}></span>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>
                Proof bheja gaya — approve hone tak wait karo...
              </div>
              <button className="dp-btn" style={{ background: 'var(--danger)', marginTop: 8 }} onClick={cancelProof} disabled={busy}>
                <i className="fas fa-times"></i> {busy ? 'Wait...' : 'Cancel'}
              </button>
            </div>
          )}
          {claim && claim.status === 'approved' && (
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
              Proof approved! Payment admin karega.
            </div>
          )}
        </div>
      )}

      {/* ========== ROOM CODE EXCHANGE — CREATOR ========== */}
      {!live && !completed && isCreator && (
        <div className="deposit-page-card">
          <div className="dp-label">
            Opponent: <strong>{oppName || 'Player'}</strong> tumhare sath khelna chahta hai
          </div>
          {!bet.roomCode ? (
            <>
              <div className="dp-label">Room Code bharo (is code se match hogi)</div>
              <div className="dp-custom">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <button className="dp-btn" onClick={sendRoomCode} disabled={busy}>
                <i className="fas fa-check"></i> {busy ? 'Wait...' : 'Confirm'}
              </button>
            </>
          ) : bet.joinerConfirmed ? (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <span className="loader-dot"></span> Match live ho raha hai...
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <div className="rc-code" style={{ color: 'var(--text)' }}>{bet.roomCode}</div>
              <span className="loader-dot"></span> Opponent ke confirm ka wait...
            </div>
          )}
          {/* Cancel option */}
          <button
            className="dp-btn"
            style={{ background: 'var(--danger)', marginTop: 12 }}
            onClick={() => setShowCancelPopup(true)}
          >
            <i className="fas fa-times"></i> Bet Cancel
          </button>
        </div>
      )}

      {/* ========== ROOM CODE EXCHANGE — JOINER ========== */}
      {!live && !completed && !isCreator && (
        <div className="deposit-page-card">
          <div className="dp-label">
            Opponent: <strong>{oppName || 'Player'}</strong> (bet lagane wala)
          </div>
          {!bet.roomCode ? (
            <div style={{ textAlign: 'center', padding: 10 }}>
              <span className="loader-dot"></span>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Room code aa raha hai... creator bhej raha hai
              </div>
            </div>
          ) : (
            <>
              {/* Room code mil gaya — ab logo + Play button dikhe, Confirm NAHI */}
              <div className="dp-label">Room Code mil gaya! Game kholo:</div>
              <div style={{ textAlign: 'center', margin: '12px 0' }}>
                <img src="./LUDO-KING-GAME-LOGO/ludo-king-game-logo.jpg" alt="Ludo King" className="play-game-logo" />
              </div>
              <div className="play-game-room">Room Code: <strong>{bet.roomCode}</strong></div>
              <a
                href={`https://lk.gggred.com/?rmc=${bet.roomCode}&gt=0&po=0`}
                target="_blank"
                rel="noopener"
                className="play-game-btn"
              >
                <i className="fas fa-play"></i> Play Now
              </a>
            </>
          )}
          {/* Cancel option */}
          <button
            className="dp-btn"
            style={{ background: 'var(--danger)', marginTop: 12 }}
            onClick={() => setShowCancelPopup(true)}
          >
            <i className="fas fa-times"></i> Bet Cancel
          </button>
        </div>
      )}

      {/* ========== CANCEL BET POPUP ========== */}
      {showCancelPopup && (
        <div className="popup-overlay" style={{ display: 'flex' }} onClick={() => setShowCancelPopup(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <i className="fas fa-exclamation-triangle" style={{ color: 'var(--danger)', marginRight: 8 }}></i>
              Bet Cancel Karein?
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
              Kya tum pakka bet cancel karna chahte ho? <br />
              Dono players ka paisa wapas mil jayega.
            </p>
            <button className="btn" style={{ background: 'var(--danger)' }} onClick={cancelBet} disabled={busy}>
              <i className="fas fa-times"></i> {busy ? 'Cancel ho raha hai...' : 'Haan, Cancel Karo'}
            </button>
            <button
              className="btn"
              style={{ background: 'var(--text-muted)', marginTop: 10 }}
              onClick={() => setShowCancelPopup(false)}
            >
              Wapas Jao
            </button>
          </div>
        </div>
      )}

      {/* ========== WIN PROOF POPUP ========== */}
      {showWinPopup && (
        <div className="popup-overlay" style={{ display: 'flex' }} onClick={() => { setShowWinPopup(false); setProof(null); setProofPreview(null); }}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <i className="fas fa-trophy" style={{ color: 'var(--success)', marginRight: 8 }}></i>
              Win Proof Bhejo
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>
              Jeet ka screenshot lagao aur proof bhejo
            </p>

            {/* Image Preview */}
            {proofPreview && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img src={proofPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, border: '2px solid var(--success)' }} />
              </div>
            )}

            {/* File Input Button */}
            <label className="dp-btn" style={{ background: proof ? 'var(--success)' : 'var(--warning)', marginBottom: 10, cursor: 'pointer' }}>
              <i className={`fas ${proof ? 'fa-check-circle' : 'fa-camera'}`}></i> {proof ? 'Screenshot Selected' : 'Select Screenshot'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  setProof(f);
                  // Preview banao
                  const reader = new FileReader();
                  reader.onload = (ev) => setProofPreview(ev.target.result);
                  reader.readAsDataURL(f);
                }}
              />
            </label>

            {/* Send + Cancel */}
            <button className="dp-btn" onClick={iWin} disabled={busy || !proof}>
              <i className="fas fa-paper-plane"></i> {busy ? 'Bheja ja raha hai...' : 'Proof Bhejo'}
            </button>
            <button
              className="dp-btn"
              style={{ background: 'var(--text-muted)', marginTop: 8 }}
              onClick={() => { setShowWinPopup(false); setProof(null); setProofPreview(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
