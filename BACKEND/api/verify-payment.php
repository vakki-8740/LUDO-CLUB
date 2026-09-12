<?php
// =====================================================
// VERIFY PAYMENT - PayU se status check karo
// POST {txnid} -> PayU verify API -> status return
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $txnid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnid'] ?? ''));
    if ($txnid === '') throw new Exception('txnid required');

    $key = $cfg['payu_key'] ?? '';
    $salt = $cfg['payu_salt'] ?? '';
    $base = rtrim($cfg['payu_base'] ?? 'https://secure.payu.in', '/');
    if ($key === '' || $salt === '') throw new Exception('Server config incomplete');

    // PayU verify API hash
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
        CURLOPT_TIMEOUT => 25,
    ]);
    $out = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $vj = json_decode((string)$out, true) ?: [];
    $td = $vj['transaction_details'][$txnid] ?? null;

    if (!$td) {
        echo json_encode(['success' => true, 'status' => 'pending', 'message' => 'Payment abhi process ho raha hai']);
        exit;
    }

    $status = strtolower(trim($td['status'] ?? ''));
    $amount = (int)round((float)($td['amt'] ?? $td['amount'] ?? 0));
    $payId = $td['mihpayid'] ?? '';

    if ($status === 'success') {
        // Payment mila — credit karo (idempotent)
        $token = fb_token($cfg);
        $txn = fs_doc_get($cfg, $token, 'transactions/' . $txnid);
        if ($txn && ($txn['status'] ?? '') === 'Pending') {
            $uid = $txn['userId'] ?? '';
            $amt = (int)$txn['amount'];
            if ($uid !== '' && $amt > 0) {
                $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $txnid;
                $userPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $uid;
                fs_commit($cfg, $token, [
                    ['update' => [
                        'name' => $txnPath,
                        'fields' => [
                            'status' => ['stringValue' => 'Success'],
                            'details' => ['mapValue' => ['fields' => [
                                'method' => ['stringValue' => 'payu'],
                                'mihpayid' => ['stringValue' => $payId],
                            ]]],
                        ],
                    ], 'updateMask' => ['fieldPaths' => ['status', 'details']]],
                    ['updateTransforms' => [
                        'document' => $userPath,
                        'fieldTransforms' => [
                            ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$amt]],
                            ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$amt]],
                        ],
                    ]],
                ]);
            }
        }
        echo json_encode(['success' => true, 'status' => 'success', 'amount' => $amount]);
    } else {
        echo json_encode(['success' => true, 'status' => $status, 'message' => 'Payment ' . $status]);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
