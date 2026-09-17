<?php
// =====================================================
// WALLET - Update user balance
// POST {uid, action, amount}
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

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $uid = preg_replace('/[^A-Za-z0-9]/', '', (string)($in['uid'] ?? ''));
    $action = strtolower(trim((string)($in['action'] ?? '')));
    $amount = (int)($in['amount'] ?? 0);

    if ($uid === '') throw new Exception('uid required');
    if ($amount <= 0) throw new Exception('Amount required');

    $db = db_get();

    $row = $db->querySingle("SELECT balance FROM users WHERE uid = '$uid' LIMIT 1", true);
    if (!$row) throw new Exception('User not found');

    $currentBalance = (int)$row['balance'];

    if ($action === 'credit') {
        $newBalance = $currentBalance + $amount;
        $db->exec("UPDATE users SET balance = $newBalance, total_deposit = total_deposit + $amount WHERE uid = '$uid'");
        echo json_encode(['success' => true, 'balance' => $newBalance]);

    } elseif ($action === 'debit') {
        if ($currentBalance < $amount) throw new Exception('Insufficient balance');
        $newBalance = $currentBalance - $amount;
        $db->exec("UPDATE users SET balance = $newBalance, total_withdraw = total_withdraw + $amount WHERE uid = '$uid'");
        echo json_encode(['success' => true, 'balance' => $newBalance]);

    } elseif ($action === 'set') {
        $db->exec("UPDATE users SET balance = $amount WHERE uid = '$uid'");
        echo json_encode(['success' => true, 'balance' => $amount]);

    } else {
        throw new Exception('Invalid action: credit/debit/set');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
