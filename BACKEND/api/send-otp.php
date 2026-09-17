<?php
// =====================================================
// SEND OTP - Brevo se email pe OTP bhejta hai
// POST {email}
// =====================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

// Brevo API Key - config.php se aayega
$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    $config = include $configFile;
    $BREVO_API_KEY = $config['BREVO_API_KEY'] ?? '';
} else {
    $BREVO_API_KEY = $env('BREVO_API_KEY', '');
}
$SENDER_EMAIL = $env('SENDER_EMAIL', 'ludoroyalclub46@gmail.com');
$SENDER_NAME = $env('SENDER_NAME', 'LUDO ROYAL CLUB');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $email = strtolower(trim((string)($in['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Valid email required');
    }

    // 4 digit OTP generate karo
    $otp = str_pad(random_int(1000, 9999), 4, '0', STR_PAD_LEFT);

    // OTP ko file mein store karo (temporary)
    $otpDir = __DIR__ . '/otp_cache';
    if (!is_dir($otpDir)) mkdir($otpDir, 0777, true);

    $otpFile = $otpDir . '/' . md5($email) . '.json';
    $otpData = [
        'otp' => $otp,
        'email' => $email,
        'created_at' => time(),
        'expires_at' => time() + 300, // 5 minutes
        'attempts' => 0,
    ];
    file_put_contents($otpFile, json_encode($otpData));

    // Brevo API se email bhejo
    $emailBody = '
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 400px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 30px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="font-size: 40px; margin-bottom: 16px;">&#128274;</div>
            <h2 style="color: #1c1c1e; margin-bottom: 8;">Email Verification</h2>
            <p style="color: #636366; font-size: 14px; margin-bottom: 20;">Aapka verification OTP code:</p>
            <div style="font-size: 36px; font-weight: 800; color: #667eea; letter-spacing: 10px; margin-bottom: 20; background: #f8f9fa; padding: 15px; border-radius: 10px;">' . $otp . '</div>
            <p style="color: #86868b; font-size: 12px;">Ye OTP 5 minute mein expire ho jayega.</p>
            <p style="color: #86868b; font-size: 12px;">Agar aapne ye request nahi ki toh ignore karein.</p>
        </div>
    </body>
    </html>';

    $payload = json_encode([
        'sender' => [
            'name' => $SENDER_NAME,
            'email' => $SENDER_EMAIL,
        ],
        'to' => [
            ['email' => $email]
        ],
        'subject' => 'LUDO ROYAL CLUB - Email Verification OTP',
        'htmlContent' => $emailBody,
    ]);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'api-key: ' . $BREVO_API_KEY,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 201) {
        $err = json_decode($response, true);
        throw new Exception('Email send failed: ' . ($err['message'] ?? 'Unknown error'));
    }

    echo json_encode([
        'success' => true,
        'message' => 'OTP sent to ' . $email,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
