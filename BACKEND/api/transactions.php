<?php
// =====================================================
// TRANSACTIONS - List + Create + Update
// GET ?uid=xxx (user transactions)
// POST {uid, type, amount, utr} (create deposit)
// =====================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

try {
    $db = db_get();

    if ($method === 'GET') {
        // List user transactions
        $uid = preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['uid'] ?? ''));
        if ($uid === '') throw new Exception('uid required');

        $result = $db->query("SELECT * FROM transactions WHERE user_uid = '$uid' ORDER BY created_at DESC LIMIT 100");
        $txns = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $txns[] = [
                'id' => $row['id'],
                'order_id' => $row['order_id'],
                'user_uid' => $row['user_uid'],
                'user_name' => $row['user_name'],
                'type' => $row['type'],
                'amount' => (int)$row['amount'],
                'status' => $row['status'],
                'utr' => $row['utr'],
                'method' => $row['method'],
                'date' => $row['date'],
                'time' => $row['time'],
                'created_at' => $row['created_at'],
            ];
        }

        echo json_encode(['success' => true, 'transactions' => $txns]);

    } elseif ($method === 'POST') {
        // Create deposit transaction
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $uid = preg_replace('/[^A-Za-z0-9]/', '', (string)($in['uid'] ?? ''));
        $userName = trim((string)($in['user_name'] ?? 'Player'));
        $amount = (int)($in['amount'] ?? 0);
        $utr = preg_replace('/[^0-9]/', '', (string)($in['utr'] ?? ''));

        if ($uid === '') throw new Exception('uid required');
        if ($amount <= 0) throw new Exception('Amount required');
        if ($utr === '') throw new Exception('UTR required');

        $orderId = 'LRC_' . $uid . '_' . time() . '_' . bin2hex(random_bytes(4));
        $date = date('d/m/Y');
        $time = date('H:i:s');

        $stmt = $db->prepare("INSERT INTO transactions (order_id, user_uid, user_name, type, amount, status, utr, method, date, time) VALUES (:order_id, :user_uid, :user_name, 'Deposit', :amount, 'Pending', :utr, 'manual_upi', :date, :time)");
        $stmt->bindValue(':order_id', $orderId, SQLITE3_TEXT);
        $stmt->bindValue(':user_uid', $uid, SQLITE3_TEXT);
        $stmt->bindValue(':user_name', $userName, SQLITE3_TEXT);
        $stmt->bindValue(':amount', $amount, SQLITE3_INTEGER);
        $stmt->bindValue(':utr', $utr, SQLITE3_TEXT);
        $stmt->bindValue(':date', $date, SQLITE3_TEXT);
        $stmt->bindValue(':time', $time, SQLITE3_TEXT);
        $stmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'Deposit request submitted',
            'order_id' => $orderId,
        ]);

    } else {
        throw new Exception('Method not allowed');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
