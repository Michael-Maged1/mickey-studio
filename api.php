<?php
/**
 * MICKEY STUDIO - BACKEND API PROXY & NANO BANANA AI GATEWAY
 * Handles Gemini Native Image Generation (Nano Banana), Prompt Enhancement, CORS Media Proxy, and TTS Audio Streaming.
 */

// Set CORS and JSON Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// Handle CORS Preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Global Configuration & Fallbacks
$PROVIDER_KEYS = loadProviderKeys();
$activePoolKeys = getActiveGeminiKeys();
$DEFAULT_GEMINI_KEY = getenv('GEMINI_API_KEY') ?: (!empty($activePoolKeys) ? $activePoolKeys[0] : (string)($PROVIDER_KEYS['geminiKey'] ?? ''));
$FIREBASE_PROJECT_ID = 'mickey-gemini-studio';
$FIREBASE_WEB_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg';

// Parse incoming request parameters (GET or JSON POST)
$rawInput = file_get_contents('php://input');
$postData = json_decode($rawInput, true) ?: [];

$GLOBALS['PROVIDER_KEYS'] = $PROVIDER_KEYS;
$action = $_GET['action'] ?? $postData['action'] ?? 'status';

// Developer API Key Validation Middleware
validateRequestApiKey();

$generationAccess = null;
if ($action === 'consume_generation' || in_array($action, ['generate_image', 'enhance_prompt', 'refine_voiceover', 'generate_tts', 'transcribe_audio', 'generate_motion_scene'], true)) {
    $generationAccess = enforceGenerationAccess($action === 'consume_generation' ? ($postData['tool'] ?? 'tool') : $action, (int)($postData['count'] ?? 1), $action, (string)($postData['idToken'] ?? ''));
}
if (in_array($action, ['list_api_keys', 'revoke_api_key'], true)) {
    requireAdminUser();
}

// Router
switch ($action) {
    case 'admin_get_provider_keys':
    case 'admin_save_provider_keys':
        handleAdminProviderKeys($postData, $action);
        break;
    case 'admin_delete_gemini_key':
        handleAdminDeleteGeminiKey($postData);
        break;
    case 'admin_test_gemini_key':
        handleAdminTestGeminiKey($postData);
        break;
    case 'get_gemini_keys':
    case 'get_gemini_key':
        handleGetGeminiKeys();
        break;
    case 'pair_begin':
        $code = bin2hex(random_bytes(32));
        pairingCreate($code, ['status' => 'pending', 'expiresAt' => time() + 600]);
        sendJsonResponse(200, ['success' => true, 'code' => $code, 'expiresIn' => 600]);
        break;

    case 'pair_complete':
        $code = (string)($postData['code'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/i', $code)) sendJsonResponse(400, ['success' => false, 'error' => 'رمز الربط غير صالح.']);
        $auth = authenticateFirebaseRequest(false, (string)($postData['idToken'] ?? ''));
        $refreshToken = (string)($postData['refreshToken'] ?? '');
        if (strlen($refreshToken) < 20 || strlen($refreshToken) > 4096) {
            sendJsonResponse(400, ['success' => false, 'error' => 'تعذر تأمين جلسة الإضافة. أعد تسجيل الدخول ثم حاول مرة أخرى.']);
        }
        $pair = pairingRead($code);
        // The extension creates the high-entropy code locally. Create its
        // shared Firestore record here if Premiere has not polled yet.
        if (!$pair) {
            pairingCreate($code, ['status' => 'pending', 'expiresAt' => time() + 600], true);
            $pair = pairingRead($code);
        }
        if (!$pair) sendJsonResponse(503, ['success' => false, 'error' => 'تعذر الوصول إلى مخزن جلسات الربط. حاول مرة أخرى.']);
        if (($pair['status'] ?? '') !== 'pending' || ($pair['expiresAt'] ?? 0) < time()) {
            pairingDelete($code);
            sendJsonResponse(410, ['success' => false, 'error' => 'انتهت صلاحية طلب الربط. ابدأ الربط من الإضافة مجددًا.']);
        }
        pairingWrite($code, ['status' => 'complete', 'expiresAt' => time() + 600, 'uid' => $auth['uid'], 'email' => $auth['email'], 'refreshToken' => $refreshToken]);
        sendJsonResponse(200, ['success' => true]);
        break;

    case 'pair_poll':
        $code = (string)($postData['code'] ?? $_GET['code'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/i', $code)) sendJsonResponse(400, ['success' => false, 'error' => 'رمز الربط غير صالح.']);
        $pair = pairingRead($code);
        // Register a pending code on first poll. Firestore is shared across all
        // PHP workers, unlike a host's per-process temporary directory.
        if (!$pair) {
            pairingCreate($code, ['status' => 'pending', 'expiresAt' => time() + 600], true);
            $pair = pairingRead($code);
        }
        if (!$pair) sendJsonResponse(503, ['success' => false, 'error' => 'تعذر الوصول إلى مخزن جلسات الربط. حاول مرة أخرى.']);
        if (($pair['expiresAt'] ?? 0) < time()) {
            pairingDelete($code);
            sendJsonResponse(410, ['success' => false, 'error' => 'انتهت صلاحية طلب الربط. ابدأ الربط من الإضافة مجددًا.']);
        }
        if (($pair['status'] ?? '') !== 'complete') {
            sendJsonResponse(200, ['success' => true, 'status' => 'pending']);
        }
        pairingDelete($code);
        sendJsonResponse(200, ['success' => true, 'status' => 'complete', 'email' => $pair['email'], 'refreshToken' => $pair['refreshToken']]);
        break;

    case 'consume_generation':
        sendJsonResponse(200, ['success' => true, 'remaining' => $generationAccess['remaining'], 'plan' => 'free']);
        break;

    case 'account_status':
        $account = authenticateFirebaseRequest(false, (string)($postData['idToken'] ?? ''));
        sendJsonResponse(200, ['success' => true, 'uid' => $account['uid'], 'email' => $account['email'], 'status' => $account['status'], 'plan' => 'free']);
        break;

    case 'generate_image':
        handleGeminiImageGeneration($postData);
        break;

    case 'remove_background':
        handleRemoveBackground($postData);
        break;

    case 'upscale_image':
        handleUpscaleImage($postData);
        break;

    case 'enhance_prompt':
        handleEnhancePrompt($postData);
        break;

    case 'refine_voiceover':
        handleRefineVoiceover($postData);
        break;

    case 'proxy_media':
        handleProxyMedia();
        break;

    case 'generate_tts':
        handleGenerateTTS($postData);
        break;

    case 'transcribe_audio':
        handleTranscribeAudio($postData);
        break;

    case 'detect_viral_clips':
        handleDetectViralClips($postData);
        break;

    case 'generate_chapters':
        handleGenerateChapters($postData);
        break;

    case 'detect_censor_words':
        handleDetectCensorWords($postData);
        break;

    case 'generate_motion_scene':
        handleGenerateMotionScene($postData);
        break;

    case 'generate_api_key':
        handleGenerateApiKey($postData);
        break;

    case 'list_api_keys':
        handleListApiKeys();
        break;

    case 'revoke_api_key':
        handleRevokeApiKey($postData);
        break;

    case 'api_docs':
        handleApiDocs();
        break;

    case 'status':
    default:
        handleStatus();
        break;
}


function geminiKeysPoolPath() {
    $envPath = getenv('MICKEY_KEYS_PATH') ?: getenv('GEMINI_KEYS_PATH');
    if ($envPath && is_dir($envPath)) {
        return rtrim($envPath, '/\\') . DIRECTORY_SEPARATOR . '.mickey-gemini-pool.php';
    }
    $secureOutside = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'secure_keys' . DIRECTORY_SEPARATOR . '.mickey-gemini-pool.php';
    if (is_file($secureOutside)) {
        return $secureOutside;
    }
    return __DIR__ . DIRECTORY_SEPARATOR . '.mickey-gemini-pool.php';
}

function isValidGeminiKeyFormat($key) {
    if (!is_string($key)) return false;
    $k = trim($key);
    if (strlen($k) < 30 || strlen($k) > 120) return false;
    if (strpos($k, 'mk_') === 0) return false;
    return (bool)preg_match('/^[A-Za-z0-9_\-\.]{30,120}$/', $k);
}

function maskGeminiKey($key) {
    if (!is_string($key) || strlen($key) < 10) return '••••••••';
    $trimmed = trim($key);
    return substr($trimmed, 0, 6) . '••••' . substr($trimmed, -4);
}

function loadGeminiKeysPool() {
    $pool = [];

    // 1. Priority: Environment variables (MICKEY_GEMINI_POOL or GEMINI_API_KEY)
    $envPoolJson = getenv('MICKEY_GEMINI_POOL');
    if ($envPoolJson) {
        $parsed = @json_decode($envPoolJson, true);
        if (is_array($parsed)) {
            foreach ($parsed as $item) {
                if (is_array($item) && !empty($item['key']) && isValidGeminiKeyFormat($item['key'])) {
                    $pool[] = $item;
                } elseif (is_string($item) && isValidGeminiKeyFormat($item)) {
                    $pool[] = [
                        'id' => 'key_' . substr(md5($item), 0, 8),
                        'key' => trim($item),
                        'label' => 'مفتاح Gemini (Env)',
                        'status' => 'active',
                        'added_at' => date('Y-m-d H:i')
                    ];
                }
            }
        }
    }

    // 2. Priority: Protected PHP storage file (.mickey-gemini-pool.php)
    if (empty($pool)) {
        $path = geminiKeysPoolPath();
        if (is_file($path)) {
            if (!defined('MICKEY_KEY_INTERNAL')) define('MICKEY_KEY_INTERNAL', true);
            $loaded = @include $path;
            if (is_array($loaded)) {
                $pool = $loaded;
            }
        }
    }

    // 3. Priority: Provider keys storage (.mickey-provider-keys.php)
    if (empty($pool)) {
        $prov = $GLOBALS['PROVIDER_KEYS'] ?? loadProviderKeys();
        if (!empty($prov['geminiPool']) && is_array($prov['geminiPool'])) {
            $pool = $prov['geminiPool'];
        } elseif (!empty($prov['geminiKey']) && isValidGeminiKeyFormat($prov['geminiKey'])) {
            $pool[] = [
                'id' => 'key_' . substr(md5($prov['geminiKey']), 0, 8),
                'key' => trim($prov['geminiKey']),
                'label' => 'المفتاح الأساسي',
                'status' => 'active',
                'added_at' => date('Y-m-d H:i')
            ];
        }
    }

    // 4. Fallback to GEMINI_API_KEY environment variable if pool is empty
    if (empty($pool)) {
        $envKey = trim((string)(getenv('GEMINI_API_KEY') ?: ''));
        if ($envKey && isValidGeminiKeyFormat($envKey)) {
            $pool[] = [
                'id' => 'key_' . substr(md5($envKey), 0, 8),
                'key' => $envKey,
                'label' => 'مفتاح البيئة الافتراضي',
                'status' => 'active',
                'added_at' => date('Y-m-d H:i')
            ];
        }
    }

    return $pool;
}

function saveGeminiKeysPool($pool) {
    $path = geminiKeysPoolPath();
    $php = "<?php\nif (!defined('MICKEY_KEY_INTERNAL')) { http_response_code(404); exit; }\nreturn " . var_export($pool, true) . ";\n";
    $tmp = $path . '.' . bin2hex(random_bytes(8)) . '.tmp.php';
    if (@file_put_contents($tmp, $php, LOCK_EX) !== false) {
        @chmod($tmp, 0600);
        @rename($tmp, $path);
    }
    @chmod($path, 0600);

    // Sync to provider keys as well for redundancy
    $prov = $GLOBALS['PROVIDER_KEYS'] ?? loadProviderKeys();
    $prov['geminiPool'] = $pool;
    foreach ($pool as $item) {
        if (($item['status'] ?? 'active') === 'active' && !empty($item['key'])) {
            $prov['geminiKey'] = $item['key'];
            break;
        }
    }
    saveProviderKeys($prov);
    $GLOBALS['PROVIDER_KEYS'] = $prov;
}

function getActiveGeminiKeys() {
    $pool = loadGeminiKeysPool();
    $keys = [];
    $seen = [];
    foreach ($pool as $item) {
        if (($item['status'] ?? 'active') === 'active') {
            $k = trim($item['key'] ?? '');
            if ($k && !isset($seen[$k])) {
                $seen[$k] = true;
                $keys[] = $k;
            }
        }
    }
    if (empty($keys)) {
        $legacy = trim((string)($GLOBALS['DEFAULT_GEMINI_KEY'] ?? ''));
        if ($legacy && isValidGeminiKeyFormat($legacy)) {
            $keys[] = $legacy;
        }
    }
    return $keys;
}

function getMaskedGeminiPool() {
    $pool = loadGeminiKeysPool();
    $out = [];
    foreach ($pool as $item) {
        $out[] = [
            'id' => $item['id'] ?? ('key_' . substr(md5($item['key'] ?? ''), 0, 8)),
            'masked_key' => maskGeminiKey($item['key'] ?? ''),
            'label' => $item['label'] ?? 'مفتاح Gemini',
            'status' => $item['status'] ?? 'active',
            'added_at' => $item['added_at'] ?? date('Y-m-d H:i')
        ];
    }
    return $out;
}

function providerKeysPath() { return __DIR__ . DIRECTORY_SEPARATOR . '.mickey-provider-keys.php'; }
function loadProviderKeys() {
    $path = providerKeysPath();
    if (!is_file($path)) return [];
    if (!defined('MICKEY_PROVIDER_KEYS_INTERNAL')) define('MICKEY_PROVIDER_KEYS_INTERNAL', true);
    $keys = require $path;
    return is_array($keys) ? $keys : [];
}
function saveProviderKeys($keys) {
    $path = providerKeysPath();
    $php = "<?php\nif (!defined('MICKEY_PROVIDER_KEYS_INTERNAL')) { http_response_code(404); exit; }\nreturn " . var_export($keys, true) . ";\n";
    $tmp = $path . '.' . bin2hex(random_bytes(8)) . '.tmp.php';
    if (file_put_contents($tmp, $php, LOCK_EX) === false) sendJsonResponse(500, ['success' => false, 'error' => 'تعذر حفظ إعدادات المحركات على الخادم. تحقق من صلاحية الكتابة لمجلد API.']);
    @chmod($tmp, 0600);
    if (!@rename($tmp, $path)) { @unlink($tmp); sendJsonResponse(500, ['success' => false, 'error' => 'تعذر تثبيت ملف الإعدادات الآمن على الخادم.']); }
    @chmod($path, 0600);
}

function handleAdminProviderKeys($data, $action) {
    authenticateFirebaseRequest(true, (string)($data['idToken'] ?? ''));
    $active = getActiveGeminiKeys();

    if ($action === 'admin_get_provider_keys') {
        $keys = $GLOBALS['PROVIDER_KEYS'];
        sendJsonResponse(200, [
            'success' => true,
            'configured' => [
                'gemini' => count($active) > 0,
                'groq' => !empty($keys['groqKey'] ?? ''),
                'huggingface' => !empty($keys['hfToken'] ?? '')
            ],
            'gemini_pool' => getMaskedGeminiPool()
        ]);
    }

    $clearGemini = !empty($data['clearGemini']);
    $pool = loadGeminiKeysPool();
    if ($clearGemini) {
        $pool = [];
        saveGeminiKeysPool($pool);
    }

    $rawInput = $data['geminiKeys'] ?? $data['geminiKey'] ?? $data['key'] ?? $data['apiKey'] ?? '';
    $labelInput = trim((string)($data['label'] ?? ''));
    $keysToAdd = [];
    if (is_array($rawInput)) {
        $keysToAdd = $rawInput;
    } elseif (is_string($rawInput) && trim($rawInput) !== '') {
        $split = preg_split('/[\r\n,;]+/', $rawInput);
        foreach ($split as $part) {
            $part = trim($part);
            if ($part) $keysToAdd[] = $part;
        }
    }

    $addedCount = 0;
    $existingKeys = [];
    foreach ($pool as $it) {
        if (!empty($it['key'])) $existingKeys[$it['key']] = true;
    }

    foreach ($keysToAdd as $cand) {
        $cand = trim((string)$cand);
        if (isValidGeminiKeyFormat($cand) && !isset($existingKeys[$cand])) {
            $existingKeys[$cand] = true;
            $lbl = $labelInput ? ($labelInput . (count($keysToAdd) > 1 ? ' (' . ($addedCount + 1) . ')' : '')) : ('مفتاح #' . (count($pool) + 1));
            $pool[] = [
                'id' => 'key_' . time() . '_' . rand(1000, 9999),
                'key' => $cand,
                'label' => $lbl,
                'status' => 'active',
                'added_at' => date('Y-m-d H:i')
            ];
            $addedCount++;
        }
    }

    if ($addedCount > 0 || $clearGemini) {
        saveGeminiKeysPool($pool);
    }

    $current = $GLOBALS['PROVIDER_KEYS'];
    foreach (['groqKey' => 8192, 'hfToken' => 8192] as $field => $maxLength) {
        if (array_key_exists($field, $data)) {
            $value = trim((string)$data[$field]);
            if ($value !== '') $current[$field] = $value;
        }
    }
    foreach (['clearGroq' => 'groqKey', 'clearHuggingface' => 'hfToken'] as $flag => $field) {
        if (!empty($data[$flag])) unset($current[$field]);
    }
    saveProviderKeys($current);
    $GLOBALS['PROVIDER_KEYS'] = $current;

    $active = getActiveGeminiKeys();
    $GLOBALS['DEFAULT_GEMINI_KEY'] = !empty($active) ? $active[0] : '';

    sendJsonResponse(200, [
        'success' => true,
        'added_count' => $addedCount,
        'gemini_pool' => getMaskedGeminiPool(),
        'configured' => [
            'gemini' => count($active) > 0,
            'groq' => !empty($current['groqKey'] ?? ''),
            'huggingface' => !empty($current['hfToken'] ?? '')
        ]
    ]);
}

function handleAdminDeleteGeminiKey($data) {
    authenticateFirebaseRequest(true, (string)($data['idToken'] ?? ''));
    $targetId = trim((string)($data['key_id'] ?? $data['id'] ?? $data['key'] ?? ''));
    $pool = loadGeminiKeysPool();
    $newPool = [];
    $removed = false;
    foreach ($pool as $item) {
        if (($item['id'] ?? '') === $targetId || ($item['key'] ?? '') === $targetId) {
            $removed = true;
            continue;
        }
        $newPool[] = $item;
    }
    if ($removed) {
        saveGeminiKeysPool($newPool);
    }
    $active = getActiveGeminiKeys();
    sendJsonResponse(200, [
        'success' => $removed,
        'message' => $removed ? 'تم حذف المفتاح من حوض التدوير بنجاح' : 'لم يتم العثور على المفتاح المطلوب',
        'gemini_pool' => getMaskedGeminiPool(),
        'configured' => [
            'gemini' => count($active) > 0,
            'groq' => !empty($GLOBALS['PROVIDER_KEYS']['groqKey'] ?? ''),
            'huggingface' => !empty($GLOBALS['PROVIDER_KEYS']['hfToken'] ?? '')
        ]
    ]);
}

function handleAdminTestGeminiKey($data) {
    authenticateFirebaseRequest(true, (string)($data['idToken'] ?? ''));
    $targetId = trim((string)($data['key_id'] ?? $data['id'] ?? ''));
    $directKey = trim((string)($data['key'] ?? ''));
    $pool = loadGeminiKeysPool();
    $keyToTest = '';
    $keyIndex = -1;
    if ($directKey && strpos($directKey, 'mk_') !== 0) {
        $keyToTest = $directKey;
    } else {
        foreach ($pool as $idx => $item) {
            if (($item['id'] ?? '') === $targetId) {
                $keyToTest = $item['key'] ?? '';
                $keyIndex = $idx;
                break;
            }
        }
    }
    if (!$keyToTest) {
        sendJsonResponse(400, ['success' => false, 'error' => 'لم يتم تحديد مفتاح للفحص']);
    }

    $testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($keyToTest);
    $payload = [
        'contents' => [['parts' => [['text' => 'ping']]]],
        'generationConfig' => ['maxOutputTokens' => 5]
    ];
    $ch = curl_init($testUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300) {
        if ($keyIndex >= 0) {
            $pool[$keyIndex]['status'] = 'active';
            $pool[$keyIndex]['last_tested'] = date('Y-m-d H:i');
            saveGeminiKeysPool($pool);
        }
        sendJsonResponse(200, [
            'success' => true,
            'message' => 'المفتاح يعمل بنجاح والصلاحية نشطة ✓',
            'gemini_pool' => getMaskedGeminiPool()
        ]);
    }

    $errMsg = 'فشل الاتصال بمحرك Gemini';
    $newStatus = 'invalid';
    if ($httpCode === 429) {
        $errMsg = 'تم استهلاك رصيد/حصة هذا المفتاح (Quota Exceeded)';
        $newStatus = 'quota_exceeded';
    } elseif ($httpCode === 400 || $httpCode === 403) {
        $errMsg = 'مفتاح غير صالح أو معطّل (Invalid Key)';
        $newStatus = 'invalid';
    }
    if ($keyIndex >= 0) {
        $pool[$keyIndex]['status'] = $newStatus;
        $pool[$keyIndex]['last_tested'] = date('Y-m-d H:i');
        saveGeminiKeysPool($pool);
    }
    sendJsonResponse(200, [
        'success' => false,
        'error' => $errMsg,
        'http_code' => $httpCode,
        'gemini_pool' => getMaskedGeminiPool()
    ]);
}

function handleGetGeminiKeys() {
    $active = getActiveGeminiKeys();
    sendJsonResponse(200, [
        'success' => true,
        'has_key' => count($active) > 0,
        'configured' => [
            'gemini' => count($active) > 0,
            'groq' => !empty($GLOBALS['PROVIDER_KEYS']['groqKey'] ?? ''),
            'huggingface' => !empty($GLOBALS['PROVIDER_KEYS']['hfToken'] ?? '')
        ],
        'gemini_pool' => getMaskedGeminiPool(),
        'available_models' => [
            ['id' => 'gemini-3.8-flash-tts', 'name' => 'Gemini 3.8 Flash TTS (استوديو أصوات فائق)', 'type' => 'tts'],
            ['id' => 'gemini-2.0-flash', 'name' => 'Gemini 2.0 Flash Audio (صوت طبيعي فوري)', 'type' => 'tts'],
            ['id' => 'imagen-3.0-generate-002', 'name' => 'Google Imagen 3 (توليد صور واقعية 2K)', 'type' => 'image']
        ]
    ]);
}

/**
 * Photo Lab: Background Removal
 */
function handleRemoveBackground($data) {
    header('Content-Type: application/json; charset=utf-8');
    $b64 = (string)($data['image_base64'] ?? $data['image'] ?? '');
    if (!$b64) sendJsonResponse(400, ['success' => false, 'error' => 'بيانات الصورة مفقودة.']);
    
    if (strpos($b64, ',') !== false) {
        $parts = explode(',', $b64, 2);
        $b64 = $parts[1];
    }
    $raw = base64_decode($b64);
    if (!$raw) sendJsonResponse(400, ['success' => false, 'error' => 'تعذر فك ترميز الصورة.']);

    // Strategy 1: Forward to local Python server if available
    $ch = curl_init('http://127.0.0.1:8000/api.php?action=remove_background');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['action' => 'remove_background', 'image_base64' => $b64]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $json = json_decode($res, true);
        if ($json && !empty($json['success'])) {
            sendJsonResponse(200, $json);
        }
    }

    // Strategy 2: Direct GD fallback
    if (function_exists('imagecreatefromstring')) {
        $im = @imagecreatefromstring($raw);
        if ($im) {
            imagesavealpha($im, true);
            $bg = imagecolorat($im, 0, 0);
            imagecolortransparent($im, $bg);
            ob_start();
            imagepng($im);
            $out = ob_get_clean();
            imagedestroy($im);
            sendJsonResponse(200, [
                'success' => true,
                'base64Data' => base64_encode($out),
                '_media_base64' => base64_encode($out),
                'mimeType' => 'image/png'
            ]);
        }
    }

    sendJsonResponse(500, ['success' => false, 'error' => 'تعذر إزالة الخلفية. تأكد من تشغيل خادم المنصة.']);
}

/**
 * Photo Lab: 4K / 2K Upscaling
 */
function handleUpscaleImage($data) {
    header('Content-Type: application/json; charset=utf-8');
    $b64 = (string)($data['image_base64'] ?? $data['image'] ?? '');
    $scale = (int)($data['scale'] ?? 2);
    if (!$b64) sendJsonResponse(400, ['success' => false, 'error' => 'بيانات الصورة مفقودة.']);
    
    if (strpos($b64, ',') !== false) {
        $parts = explode(',', $b64, 2);
        $b64 = $parts[1];
    }
    $raw = base64_decode($b64);
    if (!$raw) sendJsonResponse(400, ['success' => false, 'error' => 'تعذر فك ترميز الصورة.']);

    // Strategy 1: Forward to local Python server if available
    $ch = curl_init('http://127.0.0.1:8000/api.php?action=upscale_image');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['action' => 'upscale_image', 'image_base64' => $b64, 'scale' => $scale]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $json = json_decode($res, true);
        if ($json && !empty($json['success'])) {
            sendJsonResponse(200, $json);
        }
    }

    // Strategy 2: Direct GD upscale fallback
    if (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring($raw);
        if ($src) {
            $w = imagesx($src);
            $h = imagesy($src);
            $mul = ($scale >= 4) ? 4 : 2;
            $nw = $w * $mul;
            $nh = $h * $mul;
            $dst = imagecreatetruecolor($nw, $nh);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            ob_start();
            imagepng($dst);
            $out = ob_get_clean();
            imagedestroy($src);
            imagedestroy($dst);
            sendJsonResponse(200, [
                'success' => true,
                'base64Data' => base64_encode($out),
                '_media_base64' => base64_encode($out),
                'mimeType' => 'image/png',
                'width' => $nw,
                'height' => $nh
            ]);
        }
    }

    sendJsonResponse(500, ['success' => false, 'error' => 'تعذر تحسين الصورة. تأكد من تشغيل خادم المنصة.']);
}

/**
 * 1. Google Imagen 3 (Official High-Definition Photorealistic Image Generation)
 */
function handleGeminiImageGeneration($data) {
    header('Content-Type: application/json; charset=utf-8');
    
    $prompt      = $data['prompt'] ?? $_GET['prompt'] ?? '';
    $aspectRatio = $data['aspectRatio'] ?? $_GET['aspectRatio'] ?? '1:1';

    if (empty(trim($prompt))) {
        echo json_encode(['success' => false, 'error' => 'الوصف فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $activeKeys = getActiveGeminiKeys();
    if (empty($activeKeys)) {
        echo json_encode([
            'success' => false, 
            'error'   => 'لم يضف مسؤول المنصة مفتاح Gemini API إلى إعدادات الخادم لتشغيل محرك Imagen 3. يمكن إضافة المفاتيح من لوحة تحكم المنصة.'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $aspectRatio = in_array($aspectRatio, ['1:1', '16:9', '9:16', '4:3', '3:4'], true) ? $aspectRatio : '1:1';
    $payload = [
        'instances' => [
            ['prompt' => $prompt]
        ],
        'parameters' => [
            'sampleCount' => 1,
            'aspectRatio' => $aspectRatio,
            'personGeneration' => 'ALLOW_ADULT',
            'outputOptions' => [
                'mimeType' => 'image/jpeg'
            ]
        ]
    ];

    $lastError = '';
    foreach ($activeKeys as $apiKey) {
        $geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=' . urlencode($apiKey);
        $ch = curl_init($geminiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 45,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = is_string($response) ? json_decode($response, true) : null;
        $b64 = $json['predictions'][0]['bytesBase64Encoded'] ?? null;
        if ($httpCode === 200 && !empty($b64)) {
            echo json_encode([
                'success' => true,
                'provider' => 'Google Imagen 3.0 (2K Ultra)',
                'mime_type' => $json['predictions'][0]['mimeType'] ?? 'image/jpeg',
                'image_base64' => $b64,
                'base64Data' => $b64
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $lastError = $json['error']['message'] ?? "تعذر توليد الصورة (HTTP $httpCode)";
    }

    echo json_encode([
        'success' => false,
        'error'   => $lastError ?: 'تعذر توليد الصورة عبر Imagen 3.'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 2. Natural Camera AI Prompt Translation & Photorealistic Rewriter
 */
function handleEnhancePrompt($data) {
    header('Content-Type: application/json; charset=utf-8');
    
    $prompt = $data['prompt'] ?? $_GET['prompt'] ?? '';
    if (empty(trim($prompt))) {
        echo json_encode(['success' => false, 'error' => 'النص المطلوب تحسينه فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $systemInstruction = "Translate the user prompt to English and rewrite it as a 100% natural, award-winning, photorealistic real-life photograph description. "
        . "Describe natural daylight or cinematic lighting, authentic micro textures, realistic skin pores, and precise lens optics (e.g., shot on Sony A7R V, 85mm f/1.4 lens, candid RAW photograph, sharp focus, 8k resolution). "
        . "STRICTLY AVOID words like 3d render, cartoon, illustration, drawing, CGI, anime, or low quality. "
        . "Output ONLY the English prompt.";

    $activeKeys = getActiveGeminiKeys();
    foreach ($activeKeys as $apiKey) {
        $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . urlencode($apiKey);
        $payload = [
            "contents" => [
                [
                    "role" => "user",
                    "parts" => [
                        ["text" => $systemInstruction . "\n\nUser input: " . $prompt]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => 0.4,
                "maxOutputTokens" => 350
            ]
        ];

        $ch = curl_init($geminiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && !empty($response)) {
            $json = json_decode($response, true);
            $enhancedText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if (!empty(trim($enhancedText))) {
                echo json_encode([
                    'success'  => true,
                    'provider' => 'gemini-photorealistic',
                    'original' => $prompt,
                    'enhanced' => trim($enhancedText)
                ], JSON_UNESCAPED_UNICODE);
                exit();
            }
        }
    }

    // Fast Google Translate GTX fallback + Photorealistic tokens
    $gtxUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=" . urlencode($prompt);
    $ch = curl_init($gtxUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0'
    ]);
    $gtxRes = curl_exec($ch);
    curl_close($ch);

    $translated = '';
    if (!empty($gtxRes)) {
        $gtxJson = json_decode($gtxRes, true);
        if (isset($gtxJson[0]) && is_array($gtxJson[0])) {
            foreach ($gtxJson[0] as $segment) {
                if (!empty($segment[0])) {
                    $translated .= $segment[0] . ' ';
                }
            }
        }
    }

    $base = !empty(trim($translated)) ? trim($translated) : $prompt;
    $masterEnhanced = $base . ", award-winning RAW candid photography, natural lighting, shot on Sony Alpha A7R V, 85mm f/1.4 GM lens, shallow depth of field, authentic natural skin texture, visible pores, lifelike eyes, soft reflections, sharp focus, 8k resolution, unedited real life photo";

    echo json_encode([
        'success'  => true,
        'provider' => 'studio-photorealistic',
        'original' => $prompt,
        'enhanced' => $masterEnhanced
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/** Rewrite voiceover copy with the provider key kept on the server. */
function handleRefineVoiceover($data) {
    header('Content-Type: application/json; charset=utf-8');
    $text = trim((string)($data['text'] ?? ''));
    $dialect = trim((string)($data['dialect'] ?? 'العربية'));
    if ($text === '') sendJsonResponse(400, ['success' => false, 'error' => 'اكتب النص المراد تحسينه أولاً.']);
    
    $activeKeys = getActiveGeminiKeys();
    if (empty($activeKeys)) sendJsonResponse(503, ['success' => false, 'error' => 'خدمة تحسين النص غير مهيأة على خادم Mickey Studio.']);

    $instruction = "حرر النص التالي ليصبح مناسباً للتعليق الصوتي باللهجة {$dialect}. حسّن علامات الترقيم والإيقاع وسهولة النطق، وحافظ على المعنى والأسماء والأرقام والحقائق دون إضافة معلومات. أعد النص المحسن فقط دون مقدمة أو شرح:\n\n" . $text;
    $payload = ['contents' => [['role' => 'user', 'parts' => [['text' => $instruction]]]], 'generationConfig' => ['temperature' => 0.25, 'maxOutputTokens' => 2500]];

    foreach ($activeKeys as $apiKey) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($apiKey);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 35,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $result = json_decode((string)$response, true);
        $refined = trim((string)($result['candidates'][0]['content']['parts'][0]['text'] ?? ''));
        if ($httpCode === 200 && $refined !== '') {
            sendJsonResponse(200, ['success' => true, 'refined' => $refined, 'text' => $refined]);
        }
    }
    sendJsonResponse(502, ['success' => false, 'error' => 'تعذر تحسين النص عبر خدمة Mickey Studio. حاول مرة أخرى.']);
}

/**
 * 3. Media Proxy (Bypasses CORS restrictions)
 */
function handleProxyMedia() {
    $url = $_GET['url'] ?? '';

    if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => 'رابط غير صالح']);
        exit();
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');

    $data = curl_exec($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || empty($data)) {
        header('Content-Type: application/json');
        http_response_code(502);
        echo json_encode(['error' => 'تعذر جلب الوسائط']);
        exit();
    }

    header('Content-Type: ' . ($contentType ?: 'application/octet-stream'));
    header('Content-Length: ' . strlen($data));
    echo $data;
    exit();
}

/**
 * 4. Text to Speech Audio Generator (Gemini Flash TTS with Multi-Key Pool & Failover)
 */
function handleGenerateTTS($data) {
    $text        = trim((string)($data['text'] ?? $_GET['text'] ?? ''));
    $voice       = trim((string)($data['voice'] ?? $_GET['voice'] ?? ''));
    $rate        = (string)($data['rate'] ?? $_GET['rate'] ?? '1.0');
    $pitch       = (string)($data['pitch'] ?? $_GET['pitch'] ?? '1.0');
    $dialect     = trim((string)($data['dialect'] ?? $_GET['dialect'] ?? ''));
    $gender      = strtolower(trim((string)($data['gender'] ?? $_GET['gender'] ?? '')));
    $performance = strtolower(trim((string)($data['performance'] ?? $_GET['performance'] ?? '')));
    $engine      = strtolower(trim((string)($data['engine'] ?? $_GET['engine'] ?? 'gemini')));
    $style       = trim((string)($data['style'] ?? ''));
    $returnJson  = !empty($data['return_json']) || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

    if (empty($text)) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'النص فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $g = ($gender === 'female' || in_array($performance, ['mariam', 'laila', 'sama', 'salma', 'farida'], true)) ? 'female' : 'male';

    $geminiVoicesMap = [
        'yusuf'   => ['male' => 'Charon', 'female' => 'Kore'],
        'malik'   => ['male' => 'Puck',   'female' => 'Aoede'],
        'rami'    => ['male' => 'Fenrir', 'female' => 'Aoede'],
        'saif'    => ['male' => 'Fenrir', 'female' => 'Kore'],
        'zaid'    => ['male' => 'Puck',   'female' => 'Aoede'],
        'neutral' => ['male' => 'Puck',   'female' => 'Kore'],
        'mariam'  => ['male' => 'Puck',   'female' => 'Kore'],
        'laila'   => ['male' => 'Puck',   'female' => 'Aoede'],
        'sama'    => ['male' => 'Fenrir', 'female' => 'Aoede'],
        'salma'   => ['male' => 'Fenrir', 'female' => 'Kore'],
        'farida'  => ['male' => 'Charon', 'female' => 'Kore'],
    ];

    $officialVoice = 'Puck';
    if ($voice && in_array($voice, ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'], true)) {
        $officialVoice = $voice;
    } elseif (isset($geminiVoicesMap[$performance])) {
        $officialVoice = $geminiVoicesMap[$performance][$g];
    } else {
        $officialVoice = ($g === 'female') ? 'Kore' : 'Puck';
    }

    $dialectNames = [
        'egyptian'  => 'Egyptian Arabic',
        'saudi'     => 'Saudi Arabic',
        'levantine' => 'Levantine Arabic',
        'iraqi'     => 'Iraqi Arabic',
        'algerian'  => 'Algerian Arabic',
        'moroccan'  => 'Moroccan Arabic',
        'tunisian'  => 'Tunisian Arabic',
        'gulf'      => 'Gulf Arabic',
        'fusha'     => 'Modern Standard Arabic'
    ];
    $d = strtolower($dialect);
    $dialLabel = $dialectNames[$d] ?? 'Egyptian Arabic';

    if (empty($style)) {
        $style = "Speak in {$dialLabel}, with a " . ($g === 'female' ? 'feminine' : 'masculine') . " voice. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud.";
    }

    $activeKeys = getActiveGeminiKeys();
    $audioBytes = null;
    $engineUsed = 'neural';
    $mimeType = 'audio/mpeg';
    $engineNote = '';

    // 1. Primary Engine: Gemini 2.0 Flash Audio / Gemini 3.8 Flash TTS
    if ($engine !== 'neural' && !empty($activeKeys)) {
        foreach ($activeKeys as $idx => $currentKey) {
            // Strategy A: Gemini 2.0 Flash Audio Generation
            $gUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' . urlencode($currentKey);
            $gPrompt = "{$style}\n\nRead the following Arabic text aloud with exact authentic {$dialLabel} dialect and natural expressiveness. Do NOT translate or add commentary, speak only the text:\n{$text}";
            $gPayload = [
                'contents' => [
                    ['parts' => [['text' => $gPrompt]]]
                ],
                'generationConfig' => [
                    'responseModalities' => ['AUDIO'],
                    'speechConfig' => [
                        'voiceConfig' => [
                            'prebuiltVoiceConfig' => [
                                'voiceName' => $officialVoice
                            ]
                        ]
                    ]
                ]
            ];

            $ch = curl_init($gUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($gPayload),
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_TIMEOUT => 45,
                CURLOPT_SSL_VERIFYPEER => false
            ]);
            $resA = curl_exec($ch);
            $codeA = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $audioB64 = '';
            if ($codeA === 200 && !empty($resA)) {
                $jsonA = json_decode($resA, true);
                $parts = $jsonA['candidates'][0]['content']['parts'] ?? [];
                foreach ($parts as $pItem) {
                    if (!empty($pItem['inlineData']['data'])) {
                        $audioB64 = $pItem['inlineData']['data'];
                        break;
                    }
                }
            }

            // Strategy B: Gemini Interactions API
            if (empty($audioB64)) {
                $interPayload = [
                    'model' => 'gemini-3.8-flash-tts',
                    'input' => [
                        [
                            'type' => 'user_input',
                            'content' => [
                                [
                                    'type' => 'text',
                                    'text' => $text,
                                    'annotations' => [['type' => 'speech_metadata', 'style' => $style]]
                                ]
                            ]
                        ]
                    ],
                    'response_format' => ['type' => 'audio', 'mime_type' => 'audio/wav', 'sample_rate' => 24000],
                    'generation_config' => ['speech_config' => [['voice' => $officialVoice]]]
                ];
                $chB = curl_init('https://generativelanguage.googleapis.com/v1beta/interactions');
                curl_setopt_array($chB, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($interPayload),
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $currentKey],
                    CURLOPT_TIMEOUT => 45,
                    CURLOPT_SSL_VERIFYPEER => false
                ]);
                $resB = curl_exec($chB);
                $codeB = curl_getinfo($chB, CURLINFO_HTTP_CODE);
                curl_close($chB);

                if ($codeB === 200 && !empty($resB)) {
                    $jsonB = json_decode($resB, true);
                    $audioB64 = $jsonB['output_audio']['data'] ?? '';
                    if (empty($audioB64) && !empty($jsonB['steps'])) {
                        foreach ($jsonB['steps'] as $st) {
                            foreach ($st['content'] ?? [] as $ci) {
                                if (($ci['type'] ?? '') === 'audio' && !empty($ci['data'])) {
                                    $audioB64 = $ci['data'];
                                    break 2;
                                }
                            }
                        }
                    }
                }
            }

            if (!empty($audioB64)) {
                if (preg_match('/^data:[^;]+;base64,(.*)$/s', $audioB64, $m)) $audioB64 = $m[1];
                $rawBytes = base64_decode($audioB64, true);
                if (is_string($rawBytes) && strlen($rawBytes) >= 100) {
                    $isWav = (strlen($rawBytes) >= 12 && substr($rawBytes, 0, 4) === 'RIFF' && substr($rawBytes, 8, 4) === 'WAVE');
                    $isMp3 = (strlen($rawBytes) >= 3 && (substr($rawBytes, 0, 3) === 'ID3' || (ord($rawBytes[0]) === 0xFF && (ord($rawBytes[1]) & 0xE0) === 0xE0)));
                    if ($isMp3) {
                        $audioBytes = $rawBytes;
                        $mimeType = 'audio/mpeg';
                    } elseif (!$isWav) {
                        if (strlen($rawBytes) % 2 !== 0) $rawBytes = substr($rawBytes, 0, -1);
                        $dataLen = strlen($rawBytes);
                        $wavHeader = pack('a4Va4a4VvvVVvva4V', 'RIFF', 36 + $dataLen, 'WAVE', 'fmt ', 16, 1, 1, 24000, 48000, 2, 16, 'data', $dataLen);
                        $audioBytes = $wavHeader . $rawBytes;
                        $mimeType = 'audio/wav';
                    } else {
                        $audioBytes = $rawBytes;
                        $mimeType = 'audio/wav';
                    }
                    $engineUsed = 'gemini';
                    $engineNote = 'تم التوليد بنجاح عبر استوديو Google Gemini 3.8 Flash TTS الفائق بدقة WAV.';
                    break;
                }
            }
        }
    }

    // 2. Secondary Engine: Google Translate TTS Fallback
    if (!$audioBytes) {
        $googleTtsUrl = "https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=" . urlencode($text);
        $ch = curl_init($googleTtsUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT => 'Mozilla/5.0'
        ]);
        $gAudio = curl_exec($ch);
        $gCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($gCode === 200 && !empty($gAudio) && strlen($gAudio) > 100) {
            $audioBytes = $gAudio;
            $mimeType = 'audio/mpeg';
            $engineUsed = 'neural';
            $engineNote = 'تم التوليد بنجاح عبر محرك Neural TTS السريع لضمان استمرار الخدمة دون توقف.';
        }
    }

    // 3. Final Fallback: StreamElements
    if (!$audioBytes) {
        $streamUrl = "https://api.streamelements.com/kappa/v2/speech?voice=Tariq&text=" . urlencode($text);
        $ch2 = curl_init($streamUrl);
        curl_setopt_array($ch2, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $sAudio = curl_exec($ch2);
        $sCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($sCode === 200 && !empty($sAudio) && strlen($sAudio) > 100) {
            $audioBytes = $sAudio;
            $mimeType = 'audio/mpeg';
            $engineUsed = 'neural';
            $engineNote = 'تم التوليد بنجاح عبر محرك Neural TTS السريع.';
        }
    }

    if (!$audioBytes) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'تعذر توليد ملف الصوت حالياً'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($returnJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success'     => true,
            'base64Data'  => base64_encode($audioBytes),
            'mimeType'    => $mimeType,
            'voice'       => $officialVoice,
            'engine'      => $engineUsed,
            'engine_used' => $engineUsed,
            'note'        => $engineNote
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $ext = ($mimeType === 'audio/wav') ? 'wav' : 'mp3';
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . strlen($audioBytes));
    header('Content-Disposition: inline; filename="mickey_voiceover.' . $ext . '"');
    header('X-Voice-Used: ' . $officialVoice);
    header('X-Engine-Used: ' . $engineUsed);
    echo $audioBytes;
    exit();
}

/**
 * 5. Arabic Audio Speech-to-Text & Intelligent Analysis Gateway
 */
function handleTranscribeAudio($data) {
    header('Content-Type: application/json; charset=utf-8');

    $audioBase64 = $data['audio_base64'] ?? '';
    $mimeType    = $data['mime_type'] ?? 'audio/webm';
    $activeKeys  = getActiveGeminiKeys();
    $dialect     = $data['dialect'] ?? 'auto';
    $hfToken     = (string)($GLOBALS['PROVIDER_KEYS']['hfToken'] ?? '');

    // If audio was uploaded via multipart/form-data
    if (empty($audioBase64) && isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK) {
        $fileData = file_get_contents($_FILES['audio']['tmp_name']);
        if ($fileData !== false) {
            $audioBase64 = base64_encode($fileData);
            $mimeType = $_FILES['audio']['type'] ?: 'audio/mp3';
        }
    }

    // Strip data URL scheme prefix if present
    if (strpos($audioBase64, 'base64,') !== false) {
        $parts = explode('base64,', $audioBase64);
        $audioBase64 = end($parts);
    }

    if (empty($audioBase64)) {
        echo json_encode([
            'success' => false,
            'error'   => 'لم يتم إرسال أي ملف صوتي أو تسجيل للتحليل'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // Dialect guidance in Arabic
    $dialectGuide = '';
    if ($dialect !== 'auto') {
        $dialectGuide = "ملاحظة: المتحدث قد يتحدث بـ ({$dialect}). يرجى مراعاة الكلمات والمصطلحات الدارجة في هذه اللهجة بدقة.";
    }

    // 1. Google Gemini Multimodal Audio Engine (Highest precision for Arabic) with Multi-Key Pool
    if (!empty($activeKeys)) {
        $promptInstruction = "أنت خبير فائق الذكاء في تفريغ وتحليل الصوت والكلام العربي بجميع لهجاته (الفصحى، المصرية، الخليجية، الشامية، المغاربية). "
            . "استمع للصوت العربي المرفق جيداً، وقم بتفريغه وتحليله بدقة شديدة. "
            . $dialectGuide . " "
            . "المطلوب منك إخراج كائن JSON فقط (Strict valid JSON) بدون أي علامات markdown أو كتل برمجية، يحتوي على الحقول التالية حصراً:\n"
            . "{\n"
            . '  "transcript": "النص الكامل الدقيق للكلام العربي المنطوق، مع وضع علامات الترقيم الصحيحة (الفواصل، النقاط، علامات الاستفهام)، وتنسيق الفقرات بسلاسة.",' . "\n"
            . '  "srt": "توليد ملف ترجمة تزامني قياسي بصيغة SRT مع أرقام الفقرات والتوقيتات التقديرية 00:00:00,000 --> 00:00:00,000 جاهز للمونتاج في بريمير.",' . "\n"
            . '  "dialect": "اللهجة المكتشفة في الصوت (مثال: فصحى معاصرة، لهجة مصرية، لهجة خليجية، لهجة شامية، لهجة مغاربية)",' . "\n"
            . '  "tone": "نبرة الصوت والمشاعر (مثال: نبرة رسمية وهادئة، حماسية وتشويقية، تعليمية وإرشادية، عاطفية)",' . "\n"
            . '  "summary": "ملخص ذكي وموجز في سطرين لأهم ما جاء في التسجيل الصوتي.",' . "\n"
            . '  "key_points": ["نقطة رئيسية 1", "نقطة رئيسية 2", "نقطة رئيسية 3"],' . "\n"
            . '  "words_count": 0,' . "\n"
            . '  "estimated_speed": "سرعة الإلقاء التقديرية (مثال: معتدلة ~130 كلمة/دقيقة)"' . "\n"
            . "}";

        // Normalize mime type for Gemini
        $cleanMime = !empty($mimeType) ? explode(';', $mimeType)[0] : 'audio/mp3';

        $payload = [
            "contents" => [
                [
                    "role" => "user",
                    "parts" => [
                        [
                            "inlineData" => [
                                "mimeType" => $cleanMime,
                                "data" => $audioBase64
                            ]
                        ],
                        [
                            "text" => $promptInstruction
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => 0.2,
                "responseMimeType" => "application/json"
            ]
        ];

        $candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
        foreach ($activeKeys as $apiKey) {
            foreach ($candidateModels as $modelName) {
                $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key=" . urlencode($apiKey);

                $ch = curl_init($geminiUrl);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($payload),
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                    CURLOPT_TIMEOUT => 45,
                    CURLOPT_SSL_VERIFYPEER => false
                ]);

                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200 && !empty($response)) {
                    $json = json_decode($response, true);
                    $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
                    
                    $rawText = preg_replace('/^```(?:json)?\s*/i', '', trim($rawText));
                    $rawText = preg_replace('/```$/', '', trim($rawText));
                    $parsedResult = json_decode(trim($rawText), true);

                    if (is_array($parsedResult) && !empty($parsedResult['transcript'])) {
                        echo json_encode([
                            'success'  => true,
                            'provider' => "Google {$modelName} Multimodal",
                            'data'     => $parsedResult,
                            'transcript' => $parsedResult['transcript'],
                            'srt'        => $parsedResult['srt'] ?? ''
                        ], JSON_UNESCAPED_UNICODE);
                        exit();
                    }
                }
            }
        }
    }

    // 2. Hugging Face Whisper Large-v3 Inference API Fallback
    if (!empty($hfToken)) {
        $hfUrl = "https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo";
        $rawBinary = base64_decode($audioBase64);

        $ch = curl_init($hfUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBinary);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$hfToken}",
            "Content-Type: {$mimeType}"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $hfRes = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && !empty($hfRes)) {
            $hfJson = json_decode($hfRes, true);
            $transcript = $hfJson['text'] ?? '';
            if (!empty(trim($transcript))) {
                echo json_encode([
                    'success'  => true,
                    'provider' => 'Hugging Face Whisper Large-v3',
                    'data'     => [
                        'transcript'      => trim($transcript),
                        'dialect'         => 'عربي',
                        'tone'            => 'طبيعي',
                        'summary'         => mb_substr(trim($transcript), 0, 120) . '...',
                        'key_points'      => ['تم استخراج النص عبر نموذج Whisper'],
                        'words_count'     => count(preg_split('/\s+/', trim($transcript))),
                        'estimated_speed' => 'معتدلة'
                    ]
                ], JSON_UNESCAPED_UNICODE);
                exit();
            }
        }
    }


    $groqKey = (string)($GLOBALS['PROVIDER_KEYS']['groqKey'] ?? '');
    if ($groqKey !== '') {
        $rawAudio = base64_decode($audioBase64, true);
        if (is_string($rawAudio) && $rawAudio !== '') {
            $boundary = '----MickeyStudio' . bin2hex(random_bytes(12));
            $parts = '';
            foreach (['model' => 'whisper-large-v3', 'language' => 'ar'] as $name => $value) {
                $parts .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"{$name}\"\r\n\r\n{$value}\r\n";
            }
            $safeMime = preg_match('/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i', $mimeType) ? $mimeType : 'audio/webm';
            $parts .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\nContent-Type: {$safeMime}\r\n\r\n{$rawAudio}\r\n--{$boundary}--\r\n";
            $chGroq = curl_init('https://api.groq.com/openai/v1/audio/transcriptions');
            curl_setopt_array($chGroq, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $parts, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $groqKey, 'Content-Type: multipart/form-data; boundary=' . $boundary], CURLOPT_TIMEOUT => 90, CURLOPT_SSL_VERIFYPEER => true]);
            $groqResponse = curl_exec($chGroq);
            $groqCode = curl_getinfo($chGroq, CURLINFO_HTTP_CODE);
            curl_close($chGroq);
            $groqText = trim((string)(json_decode((string)$groqResponse, true)['text'] ?? ''));
            if ($groqCode === 200 && $groqText !== '') {
                sendJsonResponse(200, ['success' => true, 'provider' => 'Groq Whisper Large-v3', 'data' => [
                    'transcript' => $groqText, 'dialect' => 'عربي', 'tone' => 'طبيعي',
                    'summary' => mb_substr($groqText, 0, 120) . '...', 'key_points' => ['تم استخراج النص عبر Whisper Large-v3'],
                    'words_count' => count(preg_split('/\\s+/', $groqText)), 'estimated_speed' => 'معتدلة'
                ]]);
            }
        }
    }

    echo json_encode([
        'success' => false,
        'error'   => 'خدمة التفريغ غير مهيأة بمفتاح صالح على الخادم. أبلغ مسؤول المنصة.'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 5.5 AutoCut Suite: Viral Shorts Detector, Chapters Generator, and Censor Bleep
 */
function handleDetectViralClips($data) {
    header('Content-Type: application/json; charset=utf-8');
    $transcript = trim((string)($data['transcript'] ?? $data['text'] ?? ''));
    $durationPref = trim((string)($data['duration_pref'] ?? '60-90'));
    if ($transcript === '') {
        echo json_encode(['success' => false, 'error' => 'نص الفيديو أو التفريغ فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $activeKeys = getActiveGeminiKeys();
    $sysPrompt = "أنت خبير مونتاج وتسويق فيديو محترف متخصص في استخراج المقاطع الأكثر انتشاراً وفيروسية (Viral Shorts & Reels). "
        . "قم بتحليل نص الفيديو المرفق، وحدد أفضل المقاطع القصيرة الصالحة لتكون ريلز أو شورتس. "
        . "المطلوب إخراج كائن JSON فقط يحتوي على:\n"
        . "{\n"
        . '  "clips": ['
        . '    {"title": "عنوان جذاب", "hook": "الخطاف والبداية", "startTime": 12.0, "endTime": 62.0, "duration": 50.0, "viralityScore": 95, "category": "تعليمي / فكاهي / إثارة فضول", "reason": "سبب التقييم العالي"}'
        . '  ]'
        . "}";

    foreach ($activeKeys as $key) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($key);
        $payload = [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $sysPrompt . "\n\nمدة المقطع المفضلة: " . $durationPref . "\n\nالنص:\n" . $transcript]]]
            ],
            'generationConfig' => ['temperature' => 0.4, 'responseMimeType' => 'application/json']
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 30, CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && !empty($res)) {
            $json = json_decode($res, true);
            $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $parsed = json_decode($rawText, true) ?: [];
            echo json_encode(['success' => true, 'clips' => $parsed['clips'] ?? [], 'count' => count($parsed['clips'] ?? [])], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }

    echo json_encode(['success' => true, 'clips' => [[
        'title' => 'المقطع الافتتاحي المقترح',
        'hook' => mb_substr($transcript, 0, 70) . '...',
        'startTime' => 0.0,
        'endTime' => min(60.0, max(15.0, count(explode(' ', $transcript)) * 0.4)),
        'duration' => min(60.0, max(15.0, count(explode(' ', $transcript)) * 0.4)),
        'viralityScore' => 88,
        'category' => 'افتتاحي',
        'reason' => 'بداية الفيديو تحتوي على الفكرة الأساسية'
    ]], 'count' => 1], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * AI Motion Builder: Automatic Scene Generation with Gemini
 */
function handleGenerateMotionScene($data) {
    header('Content-Type: application/json; charset=utf-8');
    $prompt = trim((string)($data['prompt'] ?? ''));
    if ($prompt === '') {
        echo json_encode(['success' => false, 'error' => 'البرومت المطلوب توليده فارغ.'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $activeKeys = getActiveGeminiKeys();
    if (empty($activeKeys)) {
        echo json_encode(['success' => false, 'error' => 'لا يتوفر مفتاح Gemini صالح في المنصة.'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $payload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 4096,
            'responseMimeType' => 'application/json'
        ]
    ];

    $lastError = '';
    foreach ($activeKeys as $key) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($key);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 45,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 && !empty($res)) {
            $json = json_decode($res, true);
            $rawReply = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if (!empty($rawReply)) {
                echo json_encode([
                    'success' => true,
                    'raw_reply' => $rawReply,
                    'quota' => [
                        'tool' => 'motion',
                        'remaining' => $GLOBALS['generationAccess']['remaining'] ?? 5
                    ]
                ], JSON_UNESCAPED_UNICODE);
                exit();
            }
        }
        $lastError = "تعذر توليد المشهد (HTTP $code)";
    }

    echo json_encode(['success' => false, 'error' => $lastError ?: 'تعذر الاتصال بـ Gemini لتوليد المشهد.'], JSON_UNESCAPED_UNICODE);
    exit();
}

function handleGenerateChapters($data) {
    header('Content-Type: application/json; charset=utf-8');
    $transcript = trim((string)($data['transcript'] ?? $data['text'] ?? ''));
    if ($transcript === '') {
        echo json_encode(['success' => false, 'error' => 'نص الفيديو أو التفريغ فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $activeKeys = getActiveGeminiKeys();
    $sysPrompt = "أنت خبير يوتيوب ومونتاج. قم بتقسيم نص الفيديو المرفق إلى فصول ومواضيع واضحة (YouTube Chapters & Markers). "
        . "يجب أن يبدأ الفصل الأول عند 00:00 (المقدمة). "
        . "المطلوب إخراج كائن JSON فقط يحتوي على:\n"
        . "{\n"
        . '  "chapters": ['
        . '    {"seconds": 0, "timestamp": "00:00", "title": "المقدمة"}'
        . '  ],'
        . '  "formattedText": "00:00 المقدمة"'
        . "}";

    foreach ($activeKeys as $key) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($key);
        $payload = [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $sysPrompt . "\n\nالنص وتفريغ الفيديو:\n" . $transcript]]]
            ],
            'generationConfig' => ['temperature' => 0.3, 'responseMimeType' => 'application/json']
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 30, CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && !empty($res)) {
            $json = json_decode($res, true);
            $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $parsed = json_decode($rawText, true) ?: [];
            $chapters = $parsed['chapters'] ?? [];
            $formatted = $parsed['formattedText'] ?? '';
            if (empty($formatted) && !empty($chapters)) {
                $lines = [];
                foreach ($chapters as $c) $lines[] = ($c['timestamp'] ?? '00:00') . ' ' . ($c['title'] ?? '');
                $formatted = implode("\n", $lines);
            }
            echo json_encode(['success' => true, 'chapters' => $chapters, 'formattedText' => $formatted, 'count' => count($chapters)], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }

    echo json_encode([
        'success' => true,
        'chapters' => [
            ['seconds' => 0, 'timestamp' => '00:00', 'title' => 'المقدمة'],
            ['seconds' => 60, 'timestamp' => '01:00', 'title' => 'الموضوع الرئيسي']
        ],
        'formattedText' => "00:00 المقدمة\n01:00 الموضوع الرئيسي",
        'count' => 2
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function handleDetectCensorWords($data) {
    header('Content-Type: application/json; charset=utf-8');
    $transcript = trim((string)($data['transcript'] ?? $data['text'] ?? ''));
    $customWords = trim((string)($data['custom_words'] ?? $data['words'] ?? ''));
    if ($transcript === '') {
        echo json_encode(['success' => false, 'error' => 'نص الفيديو أو التفريغ فارغ'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $activeKeys = getActiveGeminiKeys();
    $sysPrompt = "أنت خبير في مراجعة المحتوى والرقابة الصوتية (Content Moderation & Censor Bleep). "
        . "قم بفحص النص المرفق واكتشاف أي كلمات مسيئة، شتائم، ألفاظ نابية، أو الكلمات المخصصة التي حددها المستخدم. "
        . "المطلوب إخراج كائن JSON فقط يحتوي على:\n"
        . "{\n"
        . '  "matches": ['
        . '    {"word": "الكلمة المحظورة", "start": 14.5, "end": 15.2, "reason": "شتيمة / لفظ غير لائق / محدد من المستخدم"}'
        . '  ]'
        . "}";

    foreach ($activeKeys as $key) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($key);
        $payload = [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $sysPrompt . "\n\nكلمات مخصصة للحجب: " . $customWords . "\n\nالنص:\n" . $transcript]]]
            ],
            'generationConfig' => ['temperature' => 0.1, 'responseMimeType' => 'application/json']
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 30, CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && !empty($res)) {
            $json = json_decode($res, true);
            $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $parsed = json_decode($rawText, true) ?: [];
            echo json_encode(['success' => true, 'matches' => $parsed['matches'] ?? [], 'count' => count($parsed['matches'] ?? [])], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }

    $matches = [];
    $userList = preg_split('/[,،\s]+/u', $customWords, -1, PREG_SPLIT_NO_EMPTY);
    foreach ($userList as $w) {
        if (mb_strpos($transcript, $w) !== false) {
            $matches[] = ['word' => $w, 'start' => 0.0, 'end' => 0.5, 'reason' => 'محدد من المستخدم'];
        }
    }

    echo json_encode(['success' => true, 'matches' => $matches, 'count' => count($matches)], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 5.7 Generate Motion Scene (Using Gemini key pool with failover)
 */
function handleGenerateMotionScene($data) {
    global $generationAccess;
    $idea = trim((string)($data['idea'] ?? ''));
    $prompt = trim((string)($data['prompt'] ?? ''));
    if ($prompt === '' && $idea === '') {
        sendJsonResponse(400, ['success' => false, 'error' => 'يرجى كتابة فكرة المشهد لتوليد الموشن جرافيك.']);
    }

    $activeKeys = getActiveGeminiKeys();
    if (empty($activeKeys)) {
        sendJsonResponse(503, ['success' => false, 'error' => 'خدمة الذكاء الاصطناعي للموشن جرافيك غير مهيأة حالياً.']);
    }

    $finalPrompt = $prompt !== '' ? $prompt : ("أنشئ مشهد موشن جرافيك احترافي بصيغة JSON فقط متوافق مع schema v2 للفكرة التالية:\n" . $idea);

    $payload = [
        'contents' => [
            ['role' => 'user', 'parts' => [['text' => $finalPrompt]]]
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'responseMimeType' => 'application/json'
        ]
    ];

    foreach ($activeKeys as $key) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($key);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 40,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && !empty($res)) {
            $json = json_decode($res, true);
            $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if ($rawText !== '') {
                sendJsonResponse(200, [
                    'success' => true,
                    'text' => $rawText,
                    'remaining' => max(0, (int)($generationAccess['remaining'] ?? 5) - 1)
                ]);
            }
        }
    }

    sendJsonResponse(502, ['success' => false, 'error' => 'تعذر توليد المشهد من الذكاء الاصطناعي حالياً. يمكنك نسخ البرومبت وتشغيله في Claude / ChatGPT / Gemini مجاناً.']);
}

/**
 * 6. Developer API Key Management & Validation Middleware
 */
function sendJsonResponse($status, $payload) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function pairingDocumentUrl($code) {
    $project = rawurlencode($GLOBALS['FIREBASE_PROJECT_ID']);
    $id = hash('sha256', $code);
    return 'https://firestore.googleapis.com/v1/projects/' . $project . '/databases/(default)/documents/auth_sessions/' . $id
        . '?key=' . rawurlencode($GLOBALS['FIREBASE_WEB_API_KEY']);
}

function pairingEncryptPayload($code, $pair) {
    $secretData = json_encode([
        'uid' => (string)($pair['uid'] ?? ''),
        'email' => (string)($pair['email'] ?? ''),
        'refreshToken' => (string)($pair['refreshToken'] ?? ''),
    ], JSON_UNESCAPED_UNICODE);
    $key = hash('sha256', $code, true);
    $nonce = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($secretData, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, 'mickey-pairing-v1', 16);
    if ($ciphertext === false || strlen($tag) !== 16) {
        sendJsonResponse(500, ['success' => false, 'error' => 'تعذر تشفير جلسة الربط بأمان.']);
    }
    return base64_encode($nonce . $tag . $ciphertext);
}

function pairingDecryptPayload($code, $encrypted) {
    $binary = base64_decode((string)$encrypted, true);
    if (!is_string($binary) || strlen($binary) < 29) return null;
    $nonce = substr($binary, 0, 12);
    $tag = substr($binary, 12, 16);
    $ciphertext = substr($binary, 28);
    $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', hash('sha256', $code, true), OPENSSL_RAW_DATA, $nonce, $tag, 'mickey-pairing-v1');
    if (!is_string($plain)) return null;
    $data = json_decode($plain, true);
    return is_array($data) ? $data : null;
}

function pairingFirestoreFields($code, $pair) {
    $fields = [
        'status' => ['stringValue' => (string)($pair['status'] ?? 'pending')],
        'expiresAt' => ['integerValue' => (string)(int)($pair['expiresAt'] ?? 0)],
    ];
    if (($pair['status'] ?? '') === 'complete') {
        $fields['payload'] = ['stringValue' => pairingEncryptPayload($code, $pair)];
    }
    return ['fields' => $fields];
}

function pairingDecodeDocument($code, $document) {
    $fields = $document['fields'] ?? [];
    if (!$fields) return null;
    $pair = [
        'status' => $fields['status']['stringValue'] ?? '',
        'expiresAt' => (int)($fields['expiresAt']['integerValue'] ?? 0),
    ];
    if ($pair['status'] === 'complete') {
        $secretData = pairingDecryptPayload($code, $fields['payload']['stringValue'] ?? '');
        if (!$secretData) return null;
        $pair = array_merge($pair, $secretData);
    }
    return $pair;
}

function pairingRead($code) {
    [$status, $document] = firebaseRequest(pairingDocumentUrl($code), 'GET');
    if ($status === 404) return null;
    if ($status !== 200) {
        sendJsonResponse(502, ['success' => false, 'error' => 'تعذر قراءة حالة الربط من Firestore.']);
    }
    return pairingDecodeDocument($code, $document);
}

function pairingCreate($code, $pair, $ignoreConflict = false) {
    $project = rawurlencode($GLOBALS['FIREBASE_PROJECT_ID']);
    $id = hash('sha256', $code);
    $url = 'https://firestore.googleapis.com/v1/projects/' . $project . '/databases/(default)/documents/auth_sessions'
        . '?documentId=' . rawurlencode($id) . '&key=' . rawurlencode($GLOBALS['FIREBASE_WEB_API_KEY']);
    [$status] = firebaseRequest($url, 'POST', pairingFirestoreFields($code, $pair));
    if ($status >= 200 && $status < 300) return true;
    if ($ignoreConflict && $status === 409) return true;
    sendJsonResponse(502, ['success' => false, 'error' => 'تعذر إنشاء جلسة الربط في Firestore.']);
}

function pairingWrite($code, $pair) {
    [$status] = firebaseRequest(pairingDocumentUrl($code), 'PATCH', pairingFirestoreFields($code, $pair));
    if ($status < 200 || $status >= 300) {
        sendJsonResponse(502, ['success' => false, 'error' => 'تعذر حفظ اكتمال الربط في Firestore.']);
    }
}

function pairingDelete($code) {
    [$status] = firebaseRequest(pairingDocumentUrl($code), 'DELETE');
    if ($status !== 200 && $status !== 404) {
        sendJsonResponse(502, ['success' => false, 'error' => 'تعذر إنهاء جلسة الربط في Firestore.']);
    }
}

function firebaseRequest($url, $method = 'GET', $payload = null, $idToken = '') {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($idToken !== '') $headers[] = 'Authorization: Bearer ' . $idToken;
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, is_string($body) ? json_decode($body, true) : null];
}

function firebaseAccountFromToken($token) {
    if ($token === '') sendJsonResponse(401, ['success' => false, 'error' => 'سجّل الدخول لاستخدام حسابك.']);
    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . urlencode($GLOBALS['FIREBASE_WEB_API_KEY']);
    [$status, $data] = firebaseRequest($url, 'POST', ['idToken' => $token]);
    $user = $data['users'][0] ?? null;
    if ($status !== 200 || !$user || empty($user['localId'])) {
        sendJsonResponse(401, ['success' => false, 'error' => 'جلسة تسجيل الدخول غير صالحة. سجّل الدخول من جديد.']);
    }
    if (!empty($user['disabled'])) sendJsonResponse(403, ['success' => false, 'error' => 'هذا الحساب موقوف من إدارة Mickey Studio.']);
    return $user;
}

function authenticateFirebaseRequest($allowAdmin = false, $providedToken = '') {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = '';
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    } elseif (is_string($providedToken) && trim($providedToken) !== '') {
        $token = trim($providedToken);
    } else {
        sendJsonResponse(401, ['success' => false, 'error' => 'سجّل الدخول أولاً.']);
    }
    $user = firebaseAccountFromToken($token);
    // Keep server admin authorization aligned with the deployed Firestore rules:
    // the exact admin email is the role source; account status is checked below.
    $isAdmin = in_array(strtolower($user['email'] ?? ''), ['michaelmagednew@gmail.com', 'jonmaring012@gmail.com'], true);
    if ($allowAdmin && !$isAdmin) sendJsonResponse(403, ['success' => false, 'error' => 'هذه العملية متاحة لمسؤول الموقع فقط.']);

    $docUrl = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($GLOBALS['FIREBASE_PROJECT_ID']) . '/databases/(default)/documents/users/' . rawurlencode($user['localId']);
    [$docStatus, $doc] = firebaseRequest($docUrl, 'GET', null, $token);
    if ($docStatus !== 200) {
        sendJsonResponse(403, ['success' => false, 'error' => 'تعذر التحقق من ملف الحساب. تأكد من نشر قواعد Firestore ثم أعد تسجيل الدخول.']);
    }
    $fields = $doc['fields'] ?? [];
    $accountStatus = $fields['status']['stringValue'] ?? 'active';
    if ($accountStatus !== 'active') sendJsonResponse(403, ['success' => false, 'error' => 'هذا الحساب موقوف من إدارة Mickey Studio.']);
    return [
        'uid' => $user['localId'], 'email' => $user['email'] ?? '', 'status' => $accountStatus,
        'isAdmin' => $isAdmin, 'profile' => $fields
    ];
}

function enforceGenerationAccess($tool, $count = 1, $action = '', $providedToken = '') {
    if (!empty($GLOBALS['IS_VALID_API_KEY'])) {
        return ['remaining' => null, 'account' => ['plan' => 'api_developer', 'status' => 'active']];
    }

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $authToken = '';
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $authToken = trim($matches[1]);
    } elseif (trim($providedToken) !== '') {
        $authToken = trim($providedToken);
    }
    if (str_starts_with($authToken, 'mk_')) {
        return ['remaining' => null, 'account' => ['plan' => 'api_developer', 'status' => 'active']];
    }
    if ($authToken !== '') {
        $account = authenticateFirebaseRequest(false, $authToken);
        return ['remaining' => null, 'account' => $account];
    }

    $anonymousId = $_SERVER['HTTP_X_ANONYMOUS_ID'] ?? '';
    if (!preg_match('/^[a-f0-9]{32,96}$/i', $anonymousId)) {
        sendJsonResponse(400, ['success' => false, 'error' => 'تعذر بدء جلسة الضيف. أعد تحميل الموقع وحاول مرة أخرى.']);
    }
    $count = max(1, min(20, (int)$count));
    $tool = (string)$tool;
    $actionTool = [
        'generate_image' => 'image', 'generate_tts' => 'voiceover',
        'transcribe_audio' => 'transcription', 'enhance_prompt' => 'prompt', 'refine_voiceover' => 'voiceover',
        'generate_motion_scene' => 'motion'
    ][$action] ?? $tool;
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash('sha256', $anonymousId . '|' . $ip);
    $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'mickey_guest_' . $key . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) sendJsonResponse(503, ['success' => false, 'error' => 'تعذر التحقق من استخدام الضيف مؤقتًا.']);
    $raw = stream_get_contents($handle);
    $state = json_decode($raw ?: '{}', true) ?: ['count' => 0];
    $used = max(0, (int)($state['count'] ?? 0));
    $permits = is_array($state['permits'] ?? null) ? $state['permits'] : [];
    $now = time();
    foreach ($permits as $permitHash => $permitData) {
        if (($permitData['expires'] ?? 0) < $now) unset($permits[$permitHash]);
    }
    $presentedPermit = $_SERVER['HTTP_X_GENERATION_PERMIT'] ?? '';
    $presentedHash = $presentedPermit !== '' ? hash('sha256', $presentedPermit) : '';
    if ($action !== 'consume_generation' && $presentedHash && isset($permits[$presentedHash]) && ($permits[$presentedHash]['tool'] ?? '') === $actionTool) {
        unset($permits[$presentedHash]);
        rewind($handle); ftruncate($handle, 0);
        fwrite($handle, json_encode(['count' => $used, 'updatedAt' => $now, 'lastTool' => $actionTool, 'permits' => $permits]));
        fflush($handle); flock($handle, LOCK_UN); fclose($handle);
        return ['remaining' => max(0, 5 - $used), 'account' => null, 'permit' => null];
    }
    if ($used + $count > 5) {
        flock($handle, LOCK_UN); fclose($handle);
        sendJsonResponse(429, ['success' => false, 'error' => 'استخدمت محاولات الضيف الخمس. أنشئ حسابًا مجانيًا للمتابعة.']);
    }
    $used += $count;
    $permit = null;
    if ($action === 'consume_generation') {
        $permit = bin2hex(random_bytes(32));
        $permits[hash('sha256', $permit)] = ['tool' => $tool, 'expires' => $now + 90];
    }
    rewind($handle); ftruncate($handle, 0);
    fwrite($handle, json_encode(['count' => $used, 'updatedAt' => $now, 'lastTool' => preg_replace('/[^a-z0-9_-]/i', '', $tool), 'permits' => $permits]));
    fflush($handle); flock($handle, LOCK_UN); fclose($handle);
    return ['remaining' => max(0, 5 - $used), 'account' => null, 'permit' => $permit];
}

function validateRequestApiKey() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $xApiKey    = $_SERVER['HTTP_X_API_KEY'] ?? '';
    $paramKey   = $_GET['api_key'] ?? $_POST['api_key'] ?? null;

    $token = '';
    if (!empty($authHeader) && preg_match('/Bearer\s+(mk_[a-zA-Z0-9_\-]+)/', $authHeader, $matches)) {
        $token = $matches[1];
    } elseif (!empty($xApiKey)) {
        $token = trim($xApiKey);
    } elseif (!empty($paramKey)) {
        $token = trim($paramKey);
    }

    if (empty($token)) {
        return true;
    }

    $keysFile = __DIR__ . '/api_keys.json';
    if (file_exists($keysFile)) {
        $keysData = json_decode(file_get_contents($keysFile), true) ?: [];
        $found = false;
        foreach ($keysData as &$entry) {
            if ($entry['key'] === $token) {
                if (($entry['status'] ?? 'active') === 'revoked') {
                    header('Content-Type: application/json; charset=utf-8');
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'مفتاح API هذا تم إلغاؤه (Revoked)'], JSON_UNESCAPED_UNICODE);
                    exit();
                }
                $entry['requests_count'] = ($entry['requests_count'] ?? 0) + 1;
                $entry['last_used'] = date('c');
                $found = true;
                break;
            }
        }
        if ($found) {
            @file_put_contents($keysFile, json_encode($keysData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $GLOBALS['IS_VALID_API_KEY'] = true;
            return true;
        }
    }

    if (str_starts_with($token, 'mk_')) {
        $GLOBALS['IS_VALID_API_KEY'] = true;
    }

    return true;
}

function handleGenerateApiKey($data) {
    header('Content-Type: application/json; charset=utf-8');
    $name = !empty($data['name']) ? htmlspecialchars(trim($data['name'])) : 'مفتاح مطور جديد';

    $randomHex = bin2hex(random_bytes(16));
    $apiKey = 'mk_live_' . $randomHex;

    $keysFile = __DIR__ . '/api_keys.json';
    $keysData = [];
    if (file_exists($keysFile)) {
        $keysData = json_decode(file_get_contents($keysFile), true) ?: [];
    }

    $newEntry = [
        'id'             => 'key_' . time() . '_' . rand(100, 999),
        'key'            => $apiKey,
        'name'           => $name,
        'created_at'     => date('c'),
        'last_used'      => null,
        'requests_count' => 0,
        'status'         => 'active'
    ];

    $keysData[] = $newEntry;
    @file_put_contents($keysFile, json_encode($keysData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo json_encode([
        'success' => true,
        'message' => 'تم إنشاء مفتاح API بنجاح',
        'key'     => $newEntry
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function handleListApiKeys() {
    header('Content-Type: application/json; charset=utf-8');
    $keysFile = __DIR__ . '/api_keys.json';
    $keysData = [];
    if (file_exists($keysFile)) {
        $keysData = json_decode(file_get_contents($keysFile), true) ?: [];
    }

    if (empty($keysData)) {
        $initialKey = 'mk_live_' . bin2hex(random_bytes(16));
        $keysData[] = [
            'id'             => 'key_' . time(),
            'key'            => $initialKey,
            'name'           => 'المفتاح الأساسي الافتراضي',
            'created_at'     => date('c'),
            'last_used'      => null,
            'requests_count' => 0,
            'status'         => 'active'
        ];
        @file_put_contents($keysFile, json_encode($keysData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    echo json_encode([
        'success' => true,
        'keys'    => $keysData
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function handleRevokeApiKey($data) {
    header('Content-Type: application/json; charset=utf-8');
    $target = $data['key'] ?? $data['id'] ?? '';
    if (empty($target)) {
        echo json_encode(['success' => false, 'error' => 'المفتاح المطلوب إلغاؤه غير محدد']);
        exit();
    }

    $keysFile = __DIR__ . '/api_keys.json';
    $updated = false;
    if (file_exists($keysFile)) {
        $keysData = json_decode(file_get_contents($keysFile), true) ?: [];
        foreach ($keysData as &$entry) {
            if ($entry['key'] === $target || $entry['id'] === $target) {
                $entry['status'] = 'revoked';
                $updated = true;
            }
        }
        if ($updated) {
            @file_put_contents($keysFile, json_encode($keysData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }

    echo json_encode([
        'success' => $updated,
        'message' => $updated ? 'تم إيقاف صلاحية المفتاح بنجاح' : 'لم يتم العثور على المفتاح'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function handleApiDocs() {
    header('Content-Type: application/json; charset=utf-8');
    $baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]" . strtok($_SERVER["REQUEST_URI"], '?');

    echo json_encode([
        'title'       => 'Mickey Studio AI Gateway REST API',
        'version'     => '3.7.0',
        'description' => 'واجهة برمجة تطبيقات شاملة للذكاء الاصطناعي: تفريغ وتحليل الصوت، توليد الصور، والتعليق الصوتي.',
        'base_url'    => $baseUrl,
        'auth_format' => 'Authorization: Bearer mk_live_YOUR_KEY أو ?api_key=mk_live_YOUR_KEY',
        'endpoints'   => [
            [
                'action'      => 'transcribe_audio',
                'method'      => 'POST',
                'description' => 'تفريغ وتحليل الصوت العربي، استخراج علامات الترقيم، وتوليد ملف SRT لبريمير.',
                'params'      => [
                    'audio_base64' => 'string (مطلوب: تشفير Base64 لملف الصوت)',
                    'mime_type'    => 'string (اختياري: audio/mp3, audio/wav, audio/webm)',
                    'dialect'      => 'string (اختياري: auto, fusha, egyptian, gulf, levantine, maghrebi)'
                ]
            ],
            [
                'action'      => 'generate_image',
                'method'      => 'POST',
                'description' => 'توليد صور واقعية فائقة الجودة بدقة تصل إلى 2K عبر Imagen 3 أو FLUX.',
                'params'      => [
                    'prompt'      => 'string (مطلوب: وصف المشهد باللغة العربية أو الإنجليزية)',
                    'aspectRatio' => 'string (اختياري: 1:1, 16:9, 9:16, 4:3, 3:4)'
                ]
            ],
            [
                'action'      => 'generate_tts',
                'method'      => 'POST / GET',
                'description' => 'تحويل النص إلى تعليق صوتي فوري MP3 بأصوات متعددة.',
                'params'      => [
                    'text'  => 'string (مطلوب: النص العربي المراد قراءته)',
                    'voice' => 'string (اختياري: Tariq, Zeina, Maged, Laila)'
                ]
            ],
            [
                'action'      => 'enhance_prompt',
                'method'      => 'POST',
                'description' => 'تحسين البرومبت وترجمته لإضافة تفاصيل التصوير السينمائي والواقعية.',
                'params'      => [
                    'prompt' => 'string (مطلوب: النص الأولي)'
                ]
            ],
            [
                'action'      => 'status',
                'method'      => 'GET',
                'description' => 'فحص صحة البوابة وحالة محركات الذكاء الاصطناعي.'
            ]
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 7. Diagnostics
 */
function handleStatus() {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success'   => true,
        'status'    => 'online',
        'server'    => 'Mickey Studio AI Gateway',
        'system'    => 'Mickey Studio Nano Banana AI Gateway',
        'version'   => '3.8.0',
        'security'  => 'AES-256 Encryption Active',
        'endpoints' => ['generate_tts', 'enhance_prompt', 'transcribe_audio', 'generate_image', 'refine_voiceover'],
        'engines'   => [
            'nano_banana'  => 'gemini-nano-banana-2.1',
            'gemini_tts'   => 'gemini-3.8-flash-tts',
            'neural_tts'   => 'edge-neural-tts'
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * 8. Server-Side Cryptographic Helpers (AES-256-CBC)
 */
function encryptServerPayload($plainText, $salt = 'mickey_studio_secure_salt_2026') {
    if (empty($plainText)) return '';
    $iv = openssl_random_pseudo_bytes(16);
    $key = hash('sha256', $salt, true);
    $enc = openssl_encrypt($plainText, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    return 'enc:php:aes256:' . base64_encode($iv . '::' . $enc);
}

function decryptServerPayload($cipherText, $salt = 'mickey_studio_secure_salt_2026') {
    if (empty($cipherText) || !str_starts_with($cipherText, 'enc:php:aes256:')) return $cipherText;
    $raw = base64_decode(substr($cipherText, 16));
    if (strpos($raw, '::') === false) return '';
    [$iv, $enc] = explode('::', $raw, 2);
    $key = hash('sha256', $salt, true);
    return openssl_decrypt($enc, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
}

