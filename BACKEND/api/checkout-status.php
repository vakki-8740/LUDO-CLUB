<?php
// =====================================================
// CHECKOUT STATUS - ZEROTIXE se payment status check
// POST {payment_id}
// =====================================================

// CORS headers FIRST
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/firebase.php';

$cfg = fb_cfg();

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

$ACCOUNT_ID = $env('ZT_ACCOUNT_ID', '');
$SECRET_KEY = $env('ZT_SECRET_KEY', '');
$API_BASE = 'https://zerotize.in';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $paymentId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['payment_id'] ?? ''));
    if ($paymentId === '') throw new Exception('payment_id required');
    if ($ACCOUNT_ID === '' || $SECRET_KEY === '') throw new Exception('Payment gateway config missing');

    // Call ZEROTIXE API
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

    $gatewayStatus = strtolower(trim($payment['payment_status'] ?? $payment['status'] ?? ''));

    // If success, credit wallet
    if ($gatewayStatus === 'success' || $gatewayStatus === 'completed') {
        $token = fb_token($cfg);
        $txn = fs_doc_get($cfg, $token, 'transactions/' . $paymentId);

        if ($txn && ($txn['status'] ?? '') !== 'Success') {
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

                $payment['wallet_updated'] = true;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'status' => $gatewayStatus,
        'amount' => $payment['payment_amount'] ?? '',
        'payment_id' => $paymentId,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
