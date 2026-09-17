<?php
// =====================================================
// UPDATE PROFILE - User name update
// POST {uid, name}
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
    $name = trim((string)($in['name'] ?? ''));

    if ($uid === '') throw new Exception('uid required');
    if ($name === '') throw new Exception('Name required');

    $db = db_get();
    $db->exec("UPDATE users SET name = '" . SQLite3::escapeString($name) . "' WHERE uid = '$uid'");

    echo json_encode([
        'success' => true,
        'message' => 'Profile updated',
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
