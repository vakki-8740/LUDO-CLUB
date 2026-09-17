<?php
// =====================================================
// REGISTER - User account banata hai
// POST {name, mobile, password, referral_code}
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

    $name = trim((string)($in['name'] ?? ''));
    $mobile = preg_replace('/[^0-9]/', '', (string)($in['mobile'] ?? ''));
    $password = trim((string)($in['password'] ?? ''));
    $referralCode = trim((string)($in['referral_code'] ?? ''));

    if ($name === '') throw new Exception('Name required');
    if (strlen($mobile) !== 10) throw new Exception('10 digit mobile required');
    if (strlen($password) < 4) throw new Exception('Password min 4 characters');

    $db = db_get();

    // Check if mobile exists
    $check = $db->querySingle("SELECT COUNT(*) FROM users WHERE mobile = '$mobile'");
    if ($check > 0) throw new Exception('Mobile number already registered');

    // Generate UID + Referral Code
    $uid = 'USR' . str_pad(mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
    $userReferralCode = $uid;

    // Check referral
    $referredBy = '';
    if ($referralCode !== '') {
        $refUser = $db->querySingle("SELECT uid FROM users WHERE referral_code = '$referralCode'");
        if ($refUser) $referredBy = $referralCode;
    }

    // Random profile logo
    $logos = [
        'PROFILES-LOGO/photo_2026-09-02_16-25-41.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-05.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-06.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-07.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-23.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-24.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-26.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-27.jpg',
        'PROFILES-LOGO/photo_2026-09-02_16-26-29.jpg',
    ];
    $profile_logo = $logos[array_rand($logos)];

    // Hash password
    $hashedPass = password_hash($password, PASSWORD_DEFAULT);

    // Insert user
    $stmt = $db->prepare("INSERT INTO users (uid, name, mobile, password, referral_code, referred_by, profile_logo) VALUES (:uid, :name, :mobile, :password, :referral_code, :referred_by, :profile_logo)");
    $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':mobile', $mobile, SQLITE3_TEXT);
    $stmt->bindValue(':password', $hashedPass, SQLITE3_TEXT);
    $stmt->bindValue(':referral_code', $userReferralCode, SQLITE3_TEXT);
    $stmt->bindValue(':referred_by', $referredBy, SQLITE3_TEXT);
    $stmt->bindValue(':profile_logo', $profile_logo, SQLITE3_TEXT);
    $stmt->execute();

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully',
        'uid' => $uid,
        'name' => $name,
        'mobile' => $mobile,
        'referral_code' => $userReferralCode,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
