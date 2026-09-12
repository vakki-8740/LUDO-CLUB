<?php
// =====================================================
// LUDO ROYAL CLUB - Payment Server CONFIG (TEMPLATE)
// Render par: Dashboard > Environment me keys banao.
// =====================================================

$env = function ($k, $d = '') {
    $v = getenv($k);
    return ($v === false || $v === '') ? $d : $v;
};

return [
    // PayU Dashboard > Settings
    'payu_key'   => $env('PAYU_KEY', 'YOUR_PAYU_KEY'),
    'payu_salt'  => $env('PAYU_SALT', 'YOUR_PAYU_SALT'),
    'payu_merchant_id' => $env('PAYU_MERCHANT_ID', 'YOUR_MERCHANT_ID'),
    'payu_base'  => $env('PAYU_BASE', 'https://secure.payu.in'),

    // Firebase Console > Project settings > Service accounts
    'firebase_project_id'   => $env('FIREBASE_PROJECT_ID', 'your-project-id'),
    'firebase_service_json' => $env('FIREBASE_SERVICE_JSON', '{ "type": "service_account", ... }'),

    // Frontend URL
    'frontend_base' => $env('FRONTEND_BASE', 'https://your-app.vercel.app'),
    'allowed_origins' => $env('ALLOWED_ORIGINS', 'https://your-app.vercel.app'),
];
