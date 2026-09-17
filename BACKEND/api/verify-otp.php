<?php
// =====================================================
// VERIFY OTP - OTP verify karta hai
// POST {email, otp}
// =====================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $email = strtolower(trim((string)($in['email'] ?? '')));
    $otp = trim((string)($in['otp'] ?? ''));

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Valid email required');
    }
    if ($otp === '' || strlen($otp) !== 4) {
        throw new Exception('4 digit OTP required');
    }

    // OTP file dhundho
    $otpDir = __DIR__ . '/otp_cache';
    $otpFile = $otpDir . '/' . md5($email) . '.json';

    if (!file_exists($otpFile)) {
        throw new Exception('OTP not found. Pehle OTP request karo.');
    }

    $otpData = json_decode(file_get_contents($otpFile), true);

    // Check expiry (5 minutes)
    if (time() > ($otpData['expires_at'] ?? 0)) {
        unlink($otpFile);
        throw new Exception('OTP expire ho gaya. Naya OTP request karo.');
    }

    // Check attempts (max 5)
    if (($otpData['attempts'] ?? 0) >= 5) {
        unlink($otpFile);
        throw new Exception('Bahut zyada attempts. Naya OTP request karo.');
    }

    // Increment attempts
    $otpData['attempts'] = ($otpData['attempts'] ?? 0) + 1;
    file_put_contents($otpFile, json_encode($otpData));

    // Verify OTP
    if ($otp !== $otpData['otp']) {
        throw new Exception('Galat OTP. Dobara try karo. (' . (5 - $otpData['attempts']) . ' attempts left)');
    }

    // OTP verified - file delete karo
    unlink($otpFile);

    echo json_encode([
        'success' => true,
        'message' => 'Email verified successfully',
        'email' => $email,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
