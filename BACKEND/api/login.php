<?php
// =====================================================
// LOGIN - User login karta hai
// POST {mobile, password}
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

    $mobile = preg_replace('/[^0-9]/', '', (string)($in['mobile'] ?? ''));
    $password = trim((string)($in['password'] ?? ''));

    if (strlen($mobile) !== 10) throw new Exception('10 digit mobile required');
    if ($password === '') throw new Exception('Password required');

    $db = db_get();

    $row = $db->querySingle("SELECT * FROM users WHERE mobile = '$mobile' LIMIT 1", true);
    if (!$row) throw new Exception('Account not found');

    if (!password_verify($password, $row['password'])) {
        throw new Exception('Wrong password');
    }

    if ($row['status'] === 'blocked') {
        throw new Exception('Account blocked');
    }

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'uid' => $row['uid'],
        'name' => $row['name'],
        'mobile' => $row['mobile'],
        'balance' => (int)$row['balance'],
        'total_deposit' => (int)$row['total_deposit'],
        'total_withdraw' => (int)$row['total_withdraw'],
        'total_win' => (int)$row['total_win'],
        'referral_code' => $row['referral_code'],
        'kyc_status' => $row['kyc_status'],
        'profile_logo' => $row['profile_logo'] ?? '',
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
