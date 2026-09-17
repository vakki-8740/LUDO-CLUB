<?php
// =====================================================
// USER PROFILE - User ki details
// GET ?uid=xxx
// =====================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/database.php';

try {
    $uid = preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['uid'] ?? ''));
    if ($uid === '') throw new Exception('uid required');

    $db = db_get();
    $row = $db->querySingle("SELECT uid, name, mobile, balance, total_deposit, total_withdraw, total_win, referral_code, referred_by, referral_commission, kyc_status, profile_logo, status, created_at FROM users WHERE uid = '$uid' LIMIT 1", true);

    if (!$row) throw new Exception('User not found');

    echo json_encode([
        'success' => true,
        'uid' => $row['uid'],
        'name' => $row['name'],
        'mobile' => $row['mobile'],
        'balance' => (int)$row['balance'],
        'total_deposit' => (int)$row['total_deposit'],
        'total_withdraw' => (int)$row['total_withdraw'],
        'total_win' => (int)$row['total_win'],
        'referral_code' => $row['referral_code'],
        'referred_by' => $row['referred_by'],
        'referral_commission' => (int)$row['referral_commission'],
        'kyc_status' => $row['kyc_status'],
        'profile_logo' => $row['profile_logo'] ?? '',
        'status' => $row['status'],
        'created_at' => $row['created_at'],
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
