<?php
// =====================================================
// CREATE PAYMENT ORDER
// =====================================================

// CORS headers FIRST (before anything else)
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
fb_cors($cfg);

// Payment Gateway Config (env vars se)
$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

$API_KEY = $env('PG_API_KEY', '');
$API_SECRET = $env('PG_API_SECRET', '');
$API_BASE = $env('PG_API_BASE', 'https://test.demotry.shop');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $amount = number_format((float)($in['amount'] ?? 0), 2, '.', '');
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? 'Player')), 0, 60);
    $callbackUrl = trim((string)($in['callback_url'] ?? ''));

    if ($amount <= 0) throw new Exception('Amount invalid');
    if ($userId === '') throw new Exception('userId required');
    if ($callbackUrl === '') throw new Exception('callback_url required');
    if ($API_KEY === '' || $API_SECRET === '') throw new Exception('Payment gateway config missing');

    // Generate unique order ID
    $orderId = 'LRC_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4));

    // Store in Firestore (Pending)
    $token = fb_token($cfg);
    $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $orderId;

    fs_commit($cfg, $token, [
        ['update' => [
            'name' => $txnPath,
            'fields' => [
                'userId'   => ['stringValue' => $userId],
                'userName' => ['stringValue' => $userName],
                'type'     => ['stringValue' => 'Deposit'],
                'amount'   => ['integerValue' => (string)(int)$amount],
                'status'   => ['stringValue' => 'Pending'],
                'orderId'  => ['stringValue' => $orderId],
                'details'  => ['mapValue' => ['fields' => [
                    'method' => ['stringValue' => 'payment_gateway'],
                ]]],
                'date'     => ['stringValue' => date('d/m/Y')],
                'time'     => ['stringValue' => date('H:i:s')],
            ],
        ], 'updateMask' => ['fieldPaths' => ['userId', 'userName', 'type', 'amount', 'status', 'orderId', 'details', 'date', 'time']]],
    ]);

    // Call Payment Gateway API
    $payload = json_encode([
        'amount' => $amount,
        'order_id' => $orderId,
        'customer_name' => $userName,
        'callback_url' => $callbackUrl,
    ]);

    $ch = curl_init($API_BASE . '/api/create-order');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . $API_KEY,
            'X-API-Secret: ' . $API_SECRET,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode((string)$response, true) ?: [];

    // Response format: {status: "success", data: {payment_url: "..."}}
    if (($result['status'] ?? '') !== 'success' || empty($result['data']['payment_url'])) {
        $errorMsg = $result['error'] ?? $result['message'] ?? 'Payment API failed';
        throw new Exception($errorMsg);
    }

    $paymentUrl = $result['data']['payment_url'];

    echo json_encode([
        'success' => true,
        'order_id' => $orderId,
        'payment_url' => $paymentUrl,
        'amount' => $amount,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
