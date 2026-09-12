<?php
// =====================================================
// VERIFY UTR - Auto verify via PayU + Firebase
// POST {txnid, utr, amount, userId, userName}
// 1. PayU API se verify karo
// 2. Agar match mila → wallet credit
// 3. Agar nahi mila → pending me rakho
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $txnid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnid'] ?? ''));
    $utr = preg_replace('/[^0-9]/', '', (string)($in['utr'] ?? ''));
    $amount = (int)($in['amount'] ?? 0);
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? 'Player')), 0, 60);

    if ($txnid === '') throw new Exception('txnid required');
    if ($utr === '' || strlen($utr) < 6) throw new Exception('Valid UTR dalo');
    if ($amount <= 0) throw new Exception('Amount invalid');
    if ($userId === '') throw new Exception('userId required');

    $token = fb_token($cfg);
    $key = $cfg['payu_key'] ?? '';
    $salt = $cfg['payu_salt'] ?? '';
    $base = rtrim($cfg['payu_base'] ?? 'https://secure.payu.in', '/');

    // 1. PayU se verify karo
    $verified = false;
    $payId = '';

    if ($key !== '' && $salt !== '') {
        try {
            $vhash = strtolower(hash('sha512', implode('|', [$key, 'verify_payment', $txnid, $salt])));
            $ch = curl_init($base . '/merchant/postservice?form=2');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'key' => $key,
                    'command' => 'verify_payment',
                    'hash' => $vhash,
                    'var1' => $txnid,
                ]),
                CURLOPT_TIMEOUT => 15,
            ]);
            $out = curl_exec($ch);
            curl_close($ch);
            $vj = json_decode((string)$out, true) ?: [];
            $td = $vj['transaction_details'][$txnid] ?? null;
            if ($td && strtolower($td['status'] ?? '') === 'success') {
                $verified = true;
                $payId = $td['mihpayid'] ?? '';
            }
        } catch (Exception $e) {}
    }

    // 2. Transaction store karo
    $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $txnid;
    $userPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $userId;

    $status = $verified ? 'Success' : 'Pending';

    fs_commit($cfg, $token, [
        ['update' => [
            'name' => $txnPath,
            'fields' => [
                'userId'   => ['stringValue' => $userId],
                'userName' => ['stringValue' => $userName],
                'type'     => ['stringValue' => 'Deposit'],
                'amount'   => ['integerValue' => (string)$amount],
                'status'   => ['stringValue' => $status],
                'utr'      => ['stringValue' => $utr],
                'details'  => ['mapValue' => ['fields' => [
                    'method' => ['stringValue' => 'upi_qr'],
                    'utr'    => ['stringValue' => $utr],
                    'mihpayid' => ['stringValue' => $payId],
                ]]],
                'date'     => ['stringValue' => date('d/m/Y')],
                'time'     => ['stringValue' => date('H:i:s')],
            ],
        ], 'updateMask' => ['fieldPaths' => ['userId', 'userName', 'type', 'amount', 'status', 'utr', 'details', 'date', 'time']]],
    ]);

    // 3. Agar verified hai to wallet credit karo
    if ($verified && $amount > 0) {
        fs_commit($cfg, $token, [
            ['updateTransforms' => [
                'document' => $userPath,
                'fieldTransforms' => [
                    ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$amount]],
                    ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$amount]],
                ],
            ]],
        ]);
    }

    echo json_encode([
        'success' => true,
        'verified' => $verified,
        'message' => $verified ? 'Payment verified! Wallet updated.' : 'UTR submitted. Admin verify karega.',
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
