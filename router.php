<?php
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$decoded = rawurldecode($path);
$base = basename($decoded);
if (str_starts_with($base, '.') || preg_match('/^(?:gemini_key\.txt|gemini_keys\.json|api_keys\.json)$/i', $base) || preg_match('/\.php(?:\.|$)/i', $base) && $base !== 'api.php') {
    http_response_code(404);
    exit;
}
if ($decoded === '/api.php') {
    require __DIR__ . '/api.php';
    return true;
}
return false;
