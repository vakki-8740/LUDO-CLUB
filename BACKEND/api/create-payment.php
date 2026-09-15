<?php
// =====================================================
// CREATE PAYMENT - ZEROTIXE Gateway
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

    $amount = (float)($in['amount'] ?? 0);
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? 'Player')), 0, 60);
    $callbackUrl = trim((string)($in['callback_url'] ?? ''));

    if ($amount <= 0) throw new Exception('Amount invalid');
    if ($userId === '') throw new Exception('userId required');
    if ($callbackUrl === '') throw new Exception('callback_url required');
    if ($ACCOUNT_ID === '' || $SECRET_KEY === '') throw new Exception('Payment gateway config missing');

    // Unique payment ID
    $paymentId = 'LRC_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4));

    // Store in Firestore (Pending)
    $token = fb_token($cfg);
    $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $paymentId;

    fs_commit($cfg, $token, [
        ['update' => [
            'name' => $txnPath,
            'fields' => [
                'userId'   => ['stringValue' => $userId],
                'userName' => ['stringValue' => $userName],
                'type'     => ['stringValue' => 'Deposit'],
                'amount'   => ['integerValue' => (string)(int)$amount],
                'status'   => ['stringValue' => 'Pending'],
                'paymentId' => ['stringValue' => $paymentId],
                'details'  => ['mapValue' => ['fields' => [
                    'method' => ['stringValue' => 'zerotixe'],
                ]]],
                'date'     => ['stringValue' => date('d/m/Y')],
                'time'     => ['stringValue' => date('H:i:s')],
            ],
        ], 'updateMask' => ['fieldPaths' => ['userId', 'userName', 'type', 'amount', 'status', 'paymentId', 'details', 'date', 'time']]],
    ]);

    // Call ZEROTIXE API
    $payload = json_encode([
        'init_payment' => [
            'account_id' => $ACCOUNT_ID,
            'secret_key' => $SECRET_KEY,
            'payment_id' => $paymentId,
            'payment_purpose' => 'Wallet Deposit',
            'payment_amount' => number_format($amount, 2, '.', ''),
            'payment_name' => $userName,
            'payment_phone' => '9999999999',
            'payment_email' => 'noreply@example.com',
            'redirect_url' => $callbackUrl . '?payment_id=' . $paymentId,
        ]
    ]);

    $ch = curl_init($API_BASE . '/api_payment_init');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $result = json_decode((string)$response, true) ?: [];

    if (empty($result['payment_url'])) {
        $error = $result['error'] ?? $result['message'] ?? 'Payment API failed';
        throw new Exception($error);
    }

    echo json_encode([
        'success' => true,
        'order_id' => $paymentId,
        'payment_url' => $result['payment_url'],
        'amount' => $amount,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
