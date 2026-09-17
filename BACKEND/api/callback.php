<?php
// =====================================================
// CALLBACK - ZEROTIXE redirect ke baad
// User payment ke baad yahan redirect hoga
// GET ?payment_id=xxx
// =====================================================

require __DIR__ . '/firebase.php';

$cfg = fb_cfg();

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

$ACCOUNT_ID = $env('ZT_ACCOUNT_ID', '');
$SECRET_KEY = $env('ZT_SECRET_KEY', '');
$API_BASE = 'https://zerotize.in';

$paymentId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_GET['payment_id'] ?? ''));
$frontend = rtrim($cfg['frontend_base'] ?? '', '/');
$backend = rtrim($env('BACKEND_BASE', 'https://php-vakki-8740.wasmer.app'), '/');

if ($paymentId === '') {
    header('Location: ' . $frontend);
    exit;
}

try {
    // ZEROTIXE se payment status check karo
    $payload = json_encode([
        'fetch_payment' => [
            'account_id' => $ACCOUNT_ID,
            'secret_key' => $SECRET_KEY,
            'payment_id' => $paymentId,
        ]
    ]);

    $ch = curl_init($API_BASE . '/api_payment_status');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $result = json_decode((string)$response, true) ?: [];
    $payment = $result['payment'] ?? $result;

    $status = strtolower(trim($payment['payment_status'] ?? $payment['status'] ?? ''));

    $token = fb_token($cfg);
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $paymentId);

    if (!$txn) throw new Exception('Transaction not found');

    // Already credited?
    if (($txn['status'] ?? '') === 'Success') {
        $uid = $txn['userId'] ?? '';
        header('Location: ' . $backend . '/redirect.html?payment_id=' . $paymentId . '&user_id=' . $uid);
        exit;
    }

    if ($status === 'success' || $status === 'completed') {
        // Wallet credit
        $uid = $txn['userId'] ?? '';
        $amt = (int)($txn['amount'] ?? 0);

        if ($uid !== '' && $amt > 0) {
            $userPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $uid;
            $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $paymentId;

            fs_commit($cfg, $token, [
                ['update' => [
                    'name' => $txnPath,
                    'fields' => [
                        'status' => ['stringValue' => 'Success'],
                        'details' => ['mapValue' => ['fields' => [
                            'method' => ['stringValue' => 'zerotixe'],
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

            header('Location: ' . $backend . '/redirect.html?payment_id=' . $paymentId . '&user_id=' . $uid . '&status=success');
        } else {
            header('Location: ' . $backend . '/redirect.html?payment_id=' . $paymentId . '&status=pending');
        }
    } else {
        $uid = $txn['userId'] ?? '';
        header('Location: ' . $backend . '/redirect.html?payment_id=' . $paymentId . '&user_id=' . $uid . '&status=pending');
    }

} catch (Exception $e) {
    header('Location: ' . $backend . '/redirect.html');
}

exit;
