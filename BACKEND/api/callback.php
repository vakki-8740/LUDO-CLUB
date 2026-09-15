<?php
// =====================================================
// PAYMENT CALLBACK (Webhook)
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

try {
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $event = strtolower(trim((string)($in['event'] ?? '')));
    $orderId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['order_id'] ?? ''));
    $amount = (float)($in['amount'] ?? 0);
    $utr = preg_replace('/[^0-9]/', '', (string)($in['utr'] ?? ''));
    $status = strtolower(trim((string)($in['status'] ?? '')));

    if ($orderId === '') throw new Exception('order_id required');
    if ($event !== 'payment.success' && $status !== 'success') {
        echo json_encode(['success' => true, 'message' => 'Not success event, ignored']);
        exit;
    }

    $token = fb_token($cfg);

    // Get transaction from Firestore
    $txn = fs_doc_get($cfg, $token, 'transactions/' . $orderId);
    if (!$txn) throw new Exception('Transaction not found');

    // Already credited?
    if (($txn['status'] ?? '') === 'Success') {
        echo json_encode(['success' => true, 'message' => 'Already credited']);
        exit;
    }

    // Amount match?
    $txnAmount = (int)($txn['amount'] ?? 0);
    if ($txnAmount > 0 && abs($txnAmount - (int)$amount) > 1) {
        throw new Exception('Amount mismatch');
    }

    // Credit wallet
    $uid = $txn['userId'] ?? '';
    if ($uid === '' || $txnAmount <= 0) throw new Exception('Invalid transaction data');

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
                ['fieldPath' => 'balance', 'increment' => ['integerValue' => (string)$txnAmount]],
                ['fieldPath' => 'totalDeposit', 'increment' => ['integerValue' => (string)$txnAmount]],
            ],
        ]],
    ]);

    echo json_encode(['success' => true, 'message' => 'Wallet credited']);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
