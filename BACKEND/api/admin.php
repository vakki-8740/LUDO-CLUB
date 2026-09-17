<?php
// =====================================================
// ADMIN - Transaction approve/reject
// POST {order_id, action, admin_key}
// =====================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/database.php';

$ADMIN_KEY = 'vakki8740';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $orderId = trim((string)($in['order_id'] ?? ''));
    $action = strtolower(trim((string)($in['action'] ?? '')));
    $adminKey = trim((string)($in['admin_key'] ?? ''));

    if ($adminKey !== $ADMIN_KEY) throw new Exception('Invalid admin key');
    if ($orderId === '') throw new Exception('order_id required');
    if (!in_array($action, ['approve', 'reject'])) throw new Exception('Action must be approve or reject');

    $db = db_get();
    $txn = $db->querySingle("SELECT * FROM transactions WHERE order_id = '$orderId' LIMIT 1", true);
    if (!$txn) throw new Exception('Transaction not found');
    if ($txn['status'] !== 'Pending') throw new Exception('Already processed');

    if ($action === 'approve') {
        // Credit user wallet
        $uid = $txn['user_uid'];
        $amount = (int)$txn['amount'];

        $db->exec("UPDATE transactions SET status = 'Success' WHERE order_id = '$orderId'");
        $db->exec("UPDATE users SET balance = balance + $amount, total_deposit = total_deposit + $amount WHERE uid = '$uid'");

        echo json_encode(['success' => true, 'message' => 'Approved & wallet credited']);

    } else {
        // Reject
        $db->exec("UPDATE transactions SET status = 'Rejected' WHERE order_id = '$orderId'");
        echo json_encode(['success' => true, 'message' => 'Transaction rejected']);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
