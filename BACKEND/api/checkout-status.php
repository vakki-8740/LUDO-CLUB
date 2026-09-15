<?php
// =====================================================
// CHECKOUT STATUS
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

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

$API_KEY = $env('PG_API_KEY', '');
$API_SECRET = $env('PG_API_SECRET', '');
$API_BASE = $env('PG_API_BASE', 'https://api.demotry.shop');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $orderId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['order_id'] ?? ''));
    if ($orderId === '') throw new Exception('order_id required');
    if ($API_KEY === '' || $API_SECRET === '') throw new Exception('Payment gateway config missing');

    // Call Payment Gateway API
    $payload = json_encode(['order_id' => $orderId]);

    $ch = curl_init($API_BASE . '/api/checkout-status');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . $API_KEY,
            'X-API-Secret: ' . $API_SECRET,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    $result = json_decode((string)$response, true) ?: [];

    if (!isset($result['status'])) {
        throw new Exception('Invalid response from payment gateway');
    }

    // If payment success, credit wallet
    $gatewayStatus = strtolower(trim($result['status'] ?? ''));
    if ($gatewayStatus === 'success' || $gatewayStatus === 'completed') {
        $token = fb_token($cfg);
        $txn = fs_doc_get($cfg, $token, 'transactions/' . $orderId);

        if ($txn && ($txn['status'] ?? '') !== 'Success') {
            $uid = $txn['userId'] ?? '';
            $amt = (int)($txn['amount'] ?? 0);
            $utr = preg_replace('/[^0-9]/', '', (string)($result['utr'] ?? ''));

            if ($uid !== '' && $amt > 0) {
                $userPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $uid;
                $txnPath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $orderId;

                fs_commit($cfg, $token, [
                    ['update' => [
                        'name' => $txnPath,
                        'fields' => [
                            'status' => ['stringValue' => 'Success'],
                            'utr'    => ['stringValue' => $utr],
                            'details' => ['mapValue' => ['fields' => [
                                'method' => ['stringValue' => 'payment_gateway'],
                                'utr'    => ['stringValue' => $utr],
                            ]]],
                        ],
                    ], 'updateMask' => ['fieldPaths' => ['status', 'utr', 'details']]],
                    ['updateTransforms' => [
                        'document' => $userPath,
                        'fieldTransforms' => [
                            ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$amt]],
                            ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$amt]],
                        ],
                    ]],
                ]);

                $result['wallet_updated'] = true;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'status' => $result['status'],
        'amount' => $result['amount'] ?? '',
        'utr' => $result['utr'] ?? '',
        'payment_method' => $result['payment_method'] ?? '',
        'paid_at' => $result['paid_at'] ?? '',
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
