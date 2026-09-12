<?php
// =====================================================
// SUBMIT UTR - User UTR bhejta hai, backend store karta hai
// POST {txnid, utr, amount, userId, userName}
// =====================================================
require __DIR__ . '/firebase.php';

$cfg = fb_cfg();
fb_cors($cfg);

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new Exception('POST only');
    $in = json_decode(file_get_contents('php://input'), true) ?: [];

    $txnid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['txnid'] ?? ''));
    $utr = preg_replace('/[^0-9]/', '', (string)($in['utr'] ?? ''));
    $amount = (int)($in['amount'] ?? 0);
    $userId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($in['userId'] ?? ''));
    $userName = substr(trim((string)($in['userName'] ?? 'Player')), 0, 60);

    if ($txnid === '') throw new Exception('txnid required');
    if ($utr === '' || strlen($utr) < 6) throw new Exception('Valid UTR dalo');
    if ($amount <= 0) throw new Exception('Amount invalid');
    if ($userId === '') throw new Exception('userId required');

    $token = fb_token($cfg);

    // Check: same UTR already submit to nahi hua
    // (simple check - transactions collection mein dekho)
    $existing = fs_doc_get($cfg, $token, 'transactions/' . $txnid);
    if ($existing && ($existing['status'] ?? '') === 'Success') {
        throw new Exception('Ye transaction already verify ho chuki hai');
    }

    // Transaction store karo with PENDING status
    $txnName = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/transactions/' . $txnid;
    $userNamePath = 'projects/' . $cfg['firebase_project_id'] . '/databases/(default)/documents/users/' . $userId;

    fs_commit($cfg, $token, [
        ['update' => [
            'name' => $txnName,
            'fields' => [
                'userId'   => ['stringValue' => $userId],
                'userName' => ['stringValue' => $userName],
                'type'     => ['stringValue' => 'Deposit'],
                'amount'   => ['integerValue' => (string)$amount],
                'status'   => ['stringValue' => 'Pending'],
                'utr'      => ['stringValue' => $utr],
                'details'  => ['mapValue' => ['fields' => [
                    'method' => ['stringValue' => 'upi_qr'],
                    'utr'    => ['stringValue' => $utr],
                ]]],
                'date'     => ['stringValue' => date('d/m/Y')],
                'time'     => ['stringValue' => date('H:i:s')],
            ],
        ], 'updateMask' => ['fieldPaths' => ['userId', 'userName', 'type', 'amount', 'status', 'utr', 'details', 'date', 'time']]],
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'UTR submitted. Admin verify karega.',
        'txnid' => $txnid,
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
