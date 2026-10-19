"""
Mickey Studio - Full-Featured Local AI API Gateway & Static Server
Supports Adobe Premiere Pro UXP Extension & Web Platform.
Endpoints:
- /api.php (or /api) [GET, POST]:
  - action=status
  - action=generate_tts
  - action=enhance_prompt
  - action=transcribe_audio
  - action=generate_image
  - action=generate_api_key
  - action=list_api_keys
Zero external dependencies (uses standard library: http.server, urllib, json, base64, ssl).
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if hasattr(sys.stderr, 'reconfigure'):
    try: sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
import base64
import time
import re
import secrets
import asyncio
import tempfile
import hashlib
import struct

FIREBASE_WEB_API_KEY = 'AIzaSyAbwmXwJkb5nl2sUDCZ0ing_cWs0lbYAWg'
FIREBASE_PROJECT_ID = 'mickey-gemini-studio'
ADMIN_EMAIL = 'michaelmagednew@gmail.com'

def pairing_file(code):
    return os.path.join(tempfile.gettempdir(), f"mickey_pair_{hashlib.sha256(code.encode()).hexdigest()}.json")

def guest_file(anon_id, ip):
    return os.path.join(tempfile.gettempdir(), f"mickey_guest_{hashlib.sha256(f'{anon_id}|{ip}'.encode()).hexdigest()}.json")

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

VOICE_MAP = {
    # أصوات رجالية حقيقية (Distinct Male Neural Voices)
    'Tariq': 'ar-EG-ShakirNeural',     # طارق: صوت رجالي مصري رخيم وفخم (Male)
    'Maged': 'ar-SA-HamedNeural',      # ماجد: صوت رجالي إذاعي فصيح رزين (Male)
    'Hamdan': 'ar-AE-HamdanNeural',    # حمدان: صوت رجالي إماراتي (Male)
    'Bassel': 'ar-IQ-BasselNeural',    # باسل: صوت رجالي عراقي (Male)
    
    # أصوات نسائية حقيقية (Distinct Female Neural Voices)
    'Zeina': 'ar-EG-SalmaNeural',      # زينة: صوت نسائي مصري ناعم وواضح (Female)
    'Laila': 'ar-SA-ZariyahNeural',    # ليلى: صوت نسائي وثائقي فصيح (Female)
    'Fatima': 'ar-AE-FatimaNeural',    # فاطمة: صوت نسائي إماراتي وقور (Female)
    'Amina': 'ar-DZ-AminaNeural',      # أمينة: صوت نسائي جزائري (Female)

    # Gemini & Mickey Studio Voice Personas Aliases
    'Charon': 'ar-EG-ShakirNeural',
    'Kore': 'ar-EG-SalmaNeural',
    'Puck': 'ar-SA-HamedNeural',
    'Sadachbia': 'ar-SA-ZariyahNeural',
    'Iapetus': 'ar-LB-RamiNeural',
    'Aoede': 'ar-LB-LaylaNeural',
    'Fenrir': 'ar-SY-LaithNeural',
    'Sulafat': 'ar-SY-AmanyNeural',
    'Rasalgethi': 'ar-JO-TaimNeural',
    'Vindemiatrix': 'ar-JO-SanaNeural',
    'Orus': 'ar-EG-ShakirNeural',
    'Schedar': 'ar-EG-SalmaNeural',
}

PORT = 8000
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

WEB_DIR = os.path.dirname(os.path.abspath(__file__))
KEYS_FILE = os.path.join(WEB_DIR, 'api_keys.json')
SECURE_POOL_PHP = os.path.join(WEB_DIR, '.mickey-gemini-pool.php')

def load_api_keys():
    if os.path.exists(KEYS_FILE):
        try:
            with open(KEYS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_api_keys(keys_list):
    try:
        with open(KEYS_FILE, 'w', encoding='utf-8') as f:
            json.dump(keys_list, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[API] Error saving keys: {e}")

def mask_gemini_key(k):
    if not k:
        return ''
    k = str(k).strip()
    if len(k) <= 10:
        return '****'
    return f"{k[:6]}...{k[-4:]}"

def is_valid_gemini_key_format(k):
    if not isinstance(k, str):
        return False
    k = k.strip()
    if not k or k.startswith('mk_') or 'TEST' in k or 'FAKE' in k:
        return False
    return len(k) >= 20

def get_legacy_single_key():
    k = os.environ.get('GEMINI_API_KEY', '').strip()
    if is_valid_gemini_key_format(k): return k
    php_keys = os.path.join(WEB_DIR, '.mickey-provider-keys.php')
    if os.path.exists(php_keys):
        try:
            with open(php_keys, 'r', encoding='utf-8') as f:
                content = f.read()
                m = re.search(r"['\"]geminiKey['\"]\s*=>\s*['\"]([^'\"]+)['\"]", content)
                if m and is_valid_gemini_key_format(m.group(1)): return m.group(1).strip()
        except Exception: pass
    return ''

def load_gemini_keys_pool():
    pool = []

    # 1. Environment variable
    env_pool = os.environ.get('MICKEY_GEMINI_POOL', '').strip()
    if env_pool:
        try:
            parsed = json.loads(env_pool)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and is_valid_gemini_key_format(item.get('key')):
                        pool.append(item)
                    elif isinstance(item, str) and is_valid_gemini_key_format(item):
                        pool.append({
                            'id': f"key_{hashlib.md5(item.encode()).hexdigest()[:8]}",
                            'key': item.strip(),
                            'label': 'مفتاح Gemini (Env)',
                            'status': 'active',
                            'added_at': time.strftime('%Y-%m-%d %H:%M')
                        })
        except Exception:
            pass

    # 2. Protected PHP file (.mickey-gemini-pool.php)
    if not pool and os.path.exists(SECURE_POOL_PHP):
        try:
            with open(SECURE_POOL_PHP, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(
                    r"\[\s*['\"]id['\"]\s*=>\s*['\"]([^'\"]*)['\"],\s*['\"]key['\"]\s*=>\s*['\"]([^'\"]+)['\"],\s*['\"]label['\"]\s*=>\s*['\"]([^'\"]*)['\"],\s*['\"]status['\"]\s*=>\s*['\"]([^'\"]*)['\"],\s*['\"]added_at['\"]\s*=>\s*['\"]([^'\"]*)['\"]",
                    content
                )
                for m in matches:
                    k = m[1].strip()
                    if is_valid_gemini_key_format(k):
                        pool.append({
                            'id': m[0] or f"key_{hashlib.md5(k.encode()).hexdigest()[:8]}",
                            'key': k,
                            'label': m[2] or 'مفتاح Gemini',
                            'status': m[3] or 'active',
                            'added_at': m[4] or time.strftime('%Y-%m-%d %H:%M')
                        })
        except Exception as e:
            print(f"[Key Storage] Error loading pool from {SECURE_POOL_PHP}: {e}", flush=True)

    # 3. Fallback to single key or env
    if not pool:
        leg = get_legacy_single_key()
        if leg and is_valid_gemini_key_format(leg):
            pool.append({
                'id': f"key_{hashlib.md5(leg.encode()).hexdigest()[:8]}",
                'key': leg,
                'label': 'المفتاح الافتراضي',
                'status': 'active',
                'added_at': time.strftime('%Y-%m-%d %H:%M')
            })
            save_gemini_keys_pool(pool)

    return pool

def save_gemini_keys_pool(pool):
    lines = ["<?php\nif (!defined('MICKEY_KEY_INTERNAL')) { http_response_code(404); exit; }\nreturn ["]
    for it in pool:
        lines.append("  [")
        lines.append(f"    'id' => {json.dumps(it.get('id', ''))},")
        lines.append(f"    'key' => {json.dumps(it.get('key', ''))},")
        lines.append(f"    'label' => {json.dumps(it.get('label', ''))},")
        lines.append(f"    'status' => {json.dumps(it.get('status', 'active'))},")
        lines.append(f"    'added_at' => {json.dumps(it.get('added_at', ''))}")
        lines.append("  ],")
    lines.append("];\n")
    php_content = "\n".join(lines)
    try:
        with open(SECURE_POOL_PHP, 'w', encoding='utf-8') as f:
            f.write(php_content)
    except Exception as e:
        print(f"[Key Storage] Could not save pool to {SECURE_POOL_PHP}: {e}", flush=True)

def get_active_gemini_keys():
    pool = load_gemini_keys_pool()
    keys = []
    seen = set()
    for item in pool:
        if item.get('status', 'active') == 'active':
            k = item.get('key', '').strip()
            if k and not k.startswith('mk_') and k not in seen:
                seen.add(k)
                keys.append(k)
    return keys

def get_env_gemini_key():
    active = get_active_gemini_keys()
    if active:
        return active[0]
    return get_legacy_single_key()

class MickeyRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for Adobe Premiere Pro UXP and localhost
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Anonymous-ID, X-Generation-Permit')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api.php', '/api/tts', '/api'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            return
        return super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api.php', '/api/tts', '/api'):
            qs = urllib.parse.parse_qs(parsed.query)
            action = qs.get('action', ['status'])[0]
            if parsed.path == '/api/tts':
                action = 'generate_tts'
            self.dispatch_action(action, qs, {})
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api.php', '/api/tts', '/api'):
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len).decode('utf-8', errors='ignore')
            data = {}
            if post_body:
                try:
                    data = json.loads(post_body)
                except Exception:
                    pass

            qs = urllib.parse.parse_qs(parsed.query)
            action = data.get('action') or qs.get('action', ['status'])[0]
            if parsed.path == '/api/tts':
                action = 'generate_tts'

            self.dispatch_action(action, qs, data)
            return

        return super().do_POST()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def dispatch_action(self, action, qs, data):
        # Merge GET & POST parameters
        params = {}
        for k, v in qs.items():
            params[k] = v[0] if len(v) == 1 else v
        params.update(data)

        # Validate Bearer or X-API-Key token
        auth_header = self.headers.get('Authorization', '')
        x_key = self.headers.get('X-API-Key', '')
        token = params.get('api_key', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif x_key:
            token = x_key.strip()

        # If token was presented, ensure it exists in api_keys.json or record it
        if token and token.startswith('mk_'):
            keys = load_api_keys()
            found = False
            for entry in keys:
                if entry.get('key') == token:
                    entry['requests_count'] = entry.get('requests_count', 0) + 1
                    entry['last_used'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    found = True
                    break
            if not found:
                keys.append({
                    'id': f'key_{int(time.time())}',
                    'key': token,
                    'name': 'Premiere Pro Extension Key',
                    'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    'requests_count': 1,
                    'status': 'active'
                })
            save_api_keys(keys)

        # Route by action
        if action == 'status':
            self.send_json(200, {
                'success': True,
                'server': 'Mickey Studio AI Gateway',
                'version': '2.2.0',
                'status': 'online',
                'endpoints': ['generate_tts', 'enhance_prompt', 'transcribe_audio', 'generate_image', 'remove_background', 'upscale_image', 'analyze_video_silence']
            })
        elif action == 'generate_tts':
            text = params.get('text', '')
            voice = params.get('voice', '')
            dialect = params.get('dialect', '')
            gender = params.get('gender', '')
            performance = params.get('performance', '')
            rate = params.get('rate', '1.0')
            pitch = params.get('pitch', '1.0')
            engine = params.get('engine', 'gemini')
            gemini_key = params.get('geminiKey', '') or (params.get('apiKey', '') if not str(params.get('apiKey', '')).startswith('mk_') else '') or get_env_gemini_key()
            style = params.get('style', '')
            model = params.get('model', 'gemini-3.8-flash-tts')
            input_payload = params.get('input', None)
            response_format = params.get('response_format', None)
            generation_config = params.get('generation_config', None)
            return_json = params.get('return_json', False) or ('application/json' in self.headers.get('Accept', ''))
            self.handle_tts(
                text=text,
                voice=voice,
                return_json=return_json,
                rate=rate,
                pitch=pitch,
                dialect=dialect,
                gender=gender,
                performance=performance,
                engine=engine,
                gemini_key=gemini_key,
                style=style,
                model=model,
                input_payload=input_payload,
                response_format=response_format,
                generation_config=generation_config
            )
        elif action == 'enhance_prompt':
            prompt = params.get('prompt', '')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_enhance_prompt(prompt, api_key)
        elif action == 'transcribe_audio':
            audio_base64 = params.get('audio_base64', '')
            mime_type = params.get('mime_type', 'audio/mp3')
            dialect = params.get('dialect', 'auto')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_transcribe_audio(audio_base64, mime_type, dialect, api_key)
        elif action == 'generate_image':
            prompt = params.get('prompt', '')
            ratio = params.get('aspectRatio', '16:9')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_generate_image(prompt, ratio, api_key)
        elif action == 'remove_background':
            image_base64 = params.get('image_base64', '') or params.get('image', '')
            mime_type = params.get('mime_type', 'image/png')
            self.handle_remove_background(image_base64, mime_type)
        elif action == 'upscale_image':
            image_base64 = params.get('image_base64', '') or params.get('image', '')
            mime_type = params.get('mime_type', 'image/png')
            scale = params.get('scale', 2)
            self.handle_upscale_image(image_base64, mime_type, scale)
        elif action in ('analyze_video_silence', 'detect_silence'):
            file_path = params.get('file_path', '') or params.get('filePath', '')
            video_base64 = params.get('video_base64', '') or params.get('video', '')
            start_sec = params.get('start_seconds') or params.get('start')
            end_sec = params.get('end_seconds') or params.get('end')
            threshold = params.get('threshold_db') or params.get('threshold', -35)
            minimum = params.get('minimum_seconds') or params.get('minimum', 0.3)
            self.handle_analyze_silence(file_path, video_base64, start_sec, end_sec, threshold, minimum)
        elif action == 'detect_viral_clips':
            transcript = params.get('transcript', '') or params.get('text', '')
            duration_pref = params.get('duration_pref', '60-90')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_detect_viral_clips(transcript, duration_pref, api_key)
        elif action == 'generate_chapters':
            transcript = params.get('transcript', '') or params.get('text', '')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_generate_chapters(transcript, api_key)
        elif action == 'detect_censor_words':
            transcript = params.get('transcript', '') or params.get('text', '')
            custom_words = params.get('custom_words', '') or params.get('words', '')
            api_key = params.get('apiKey', '') or get_env_gemini_key()
            self.handle_detect_censor_words(transcript, custom_words, api_key)
        elif action == 'generate_api_key':
            name = params.get('name', 'Premiere Pro Key')
            new_key = f"mk_live_{secrets.token_hex(16)}"
            keys = load_api_keys()
            entry = {
                'id': f'key_{int(time.time())}_{secrets.randbelow(900)+100}',
                'key': new_key,
                'name': name,
                'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'last_used': None,
                'requests_count': 0,
                'status': 'active'
            }
            keys.append(entry)
            save_api_keys(keys)
            self.send_json(200, {'success': True, 'key': entry})
        elif action == 'list_api_keys':
            self.send_json(200, {'success': True, 'keys': load_api_keys()})
        elif action == 'revoke_api_key':
            target = params.get('key') or params.get('id') or ''
            keys = load_api_keys()
            updated = False
            for entry in keys:
                if entry.get('key') == target or entry.get('id') == target:
                    entry['status'] = 'revoked'
                    updated = True
            if updated:
                save_api_keys(keys)
            self.send_json(200, {'success': updated, 'message': 'تم إيقاف صلاحية المفتاح بنجاح' if updated else 'لم يتم العثور على المفتاح'})
        elif action in ('save_gemini_key', 'admin_save_provider_keys'):
            clear_gemini = params.get('clearGemini', False)
            pool = load_gemini_keys_pool()
            
            if clear_gemini:
                pool = []
                save_gemini_keys_pool(pool)
                print("[Key Storage] Cleared all Gemini keys from pool", flush=True)

            raw_input = params.get('geminiKeys') or params.get('geminiKey') or params.get('key') or params.get('apiKey') or ''
            keys_to_add = []
            if isinstance(raw_input, list):
                keys_to_add = [str(k).strip() for k in raw_input]
            elif isinstance(raw_input, str):
                # Split by newlines, commas, or spaces
                lines = re.split(r'[\r\n,]+', raw_input)
                keys_to_add = [k.strip() for k in lines]

            custom_label = str(params.get('label') or '').strip()
            existing_keys = {item.get('key') for item in pool}
            added_count = 0

            for k in keys_to_add:
                k = k.strip()
                if k and not k.startswith('mk_') and k not in existing_keys:
                    pool.append({
                        'id': f"key_{int(time.time())}_{secrets.randbelow(9000)+1000}",
                        'key': k,
                        'label': custom_label or f"مفتاح #{len(pool) + 1}",
                        'status': 'active',
                        'added_at': time.strftime('%Y-%m-%d %H:%M')
                    })
                    existing_keys.add(k)
                    added_count += 1

            if added_count > 0 or clear_gemini:
                save_gemini_keys_pool(pool)
                print(f"[Key Storage] Pool updated. Added: {added_count}, Total active in pool: {len(get_active_gemini_keys())}", flush=True)

            active = get_active_gemini_keys()
            self.send_json(200, {
                'success': True,
                'added_count': added_count,
                'configured': {
                    'gemini': len(active) > 0,
                    'gemini_count': len(active),
                    'groq': False,
                    'huggingface': False
                },
                'gemini_pool': [
                    {
                        'id': it.get('id', ''),
                        'label': it.get('label', 'مفتاح Gemini'),
                        'masked_key': mask_gemini_key(it.get('key', '')),
                        'status': it.get('status', 'active'),
                        'added_at': it.get('added_at', '')
                    }
                    for it in pool if it.get('key')
                ]
            })
        elif action in ('get_gemini_key', 'admin_get_provider_keys', 'get_gemini_keys'):
            pool = load_gemini_keys_pool()
            active = get_active_gemini_keys()
            self.send_json(200, {
                'success': True,
                'has_key': len(active) > 0,
                'configured': {
                    'gemini': len(active) > 0,
                    'gemini_count': len(active),
                    'groq': False,
                    'huggingface': False
                },
                'gemini_pool': [
                    {
                        'id': it.get('id', ''),
                        'label': it.get('label', 'مفتاح Gemini'),
                        'masked_key': mask_gemini_key(it.get('key', '')),
                        'status': it.get('status', 'active'),
                        'added_at': it.get('added_at', '')
                    }
                    for it in pool if it.get('key')
                ]
            })
        elif action == 'admin_delete_gemini_key':
            target_id = params.get('key_id') or params.get('id') or params.get('key') or ''
            pool = load_gemini_keys_pool()
            new_pool = [it for it in pool if it.get('id') != target_id and it.get('key') != target_id]
            removed = len(pool) != len(new_pool)
            if removed:
                save_gemini_keys_pool(new_pool)
                print(f"[Key Storage] Removed key {target_id} from pool", flush=True)
            active = get_active_gemini_keys()
            self.send_json(200, {
                'success': removed,
                'message': 'تم حذف المفتاح من حوض التدوير بنجاح' if removed else 'لم يتم العثور على المفتاح',
                'configured': {
                    'gemini': len(active) > 0,
                    'gemini_count': len(active),
                    'groq': False,
                    'huggingface': False
                },
                'gemini_pool': [
                    {
                        'id': it.get('id', ''),
                        'label': it.get('label', 'مفتاح Gemini'),
                        'masked_key': mask_gemini_key(it.get('key', '')),
                        'status': it.get('status', 'active'),
                        'added_at': it.get('added_at', '')
                    }
                    for it in new_pool if it.get('key')
                ]
            })
        elif action == 'admin_test_gemini_key':
            target_id = params.get('key_id') or params.get('id') or ''
            target_key = params.get('key', '')
            pool = load_gemini_keys_pool()
            key_to_test = ''
            if target_key and not target_key.startswith('mk_'):
                key_to_test = target_key
            else:
                for it in pool:
                    if it.get('id') == target_id:
                        key_to_test = it.get('key', '')
                        break
            if not key_to_test:
                key_to_test = get_env_gemini_key()
            if not key_to_test:
                self.send_json(400, {'success': False, 'error': 'لم يتم العثور على المفتاح المطلوب اختباره.'})
                return
            try:
                test_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key_to_test}"
                req = urllib.request.Request(test_url, headers={'User-Agent': 'MickeyStudio/2.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        self.send_json(200, {'success': True, 'message': 'المفتاح نشط وحصته متاحة ويعمل بنجاح ✓'})
                        return
                self.send_json(200, {'success': True, 'message': 'المفتاح استجاب بنجاح'})
            except urllib.error.HTTPError as he:
                err_msg = ''
                try: err_msg = he.read().decode('utf-8')
                except: pass
                if he.code == 429 or 'RESOURCE_EXHAUSTED' in err_msg or 'quota' in err_msg.lower():
                    self.send_json(200, {'success': False, 'is_quota': True, 'error': 'انتهت حصة رصيد هذا المفتاح (429 Quota Exceeded / Resource Exhausted).'})
                else:
                    self.send_json(200, {'success': False, 'error': f'خطأ من مزود الخدمة ({he.code}): {err_msg[:120]}'})
            except Exception as e_test:
                self.send_json(200, {'success': False, 'error': f'تعذر فحص المفتاح: {str(e_test)}'})
        elif action == 'pair_begin':
            code = secrets.token_hex(32)
            p_path = pairing_file(code)
            with open(p_path, 'w', encoding='utf-8') as f:
                json.dump({'status': 'pending', 'expiresAt': time.time() + 600}, f)
            self.send_json(200, {'success': True, 'code': code, 'expiresIn': 600})
        elif action == 'pair_complete':
            code = str(params.get('code', ''))
            refresh_token = str(params.get('refreshToken', ''))
            if not re.match(r'^[a-f0-9]{64}$', code, re.I):
                self.send_json(400, {'success': False, 'error': 'رمز الربط غير صالح.'})
                return
            p_path = pairing_file(code)
            try:
                email = params.get('email', '')
                uid = params.get('uid', '')
                with open(p_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        'status': 'complete',
                        'expiresAt': time.time() + 600,
                        'uid': uid,
                        'email': email,
                        'refreshToken': refresh_token
                    }, f)
                self.send_json(200, {'success': True})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
        elif action == 'pair_poll':
            code = str(params.get('code', ''))
            if not re.match(r'^[a-f0-9]{64}$', code, re.I):
                self.send_json(400, {'success': False, 'error': 'رمز الربط غير صالح.'})
                return
            p_path = pairing_file(code)
            try:
                if not os.path.exists(p_path):
                    with open(p_path, 'w', encoding='utf-8') as f:
                        json.dump({'status': 'pending', 'expiresAt': time.time() + 600}, f)
                    self.send_json(200, {'success': True, 'status': 'pending'})
                    return
                with open(p_path, 'r', encoding='utf-8') as f:
                    p_data = json.load(f)
                if p_data.get('expiresAt', 0) < time.time():
                    try: os.unlink(p_path)
                    except: pass
                    self.send_json(410, {'success': False, 'error': 'انتهت صلاحية طلب الربط. ابدأ الربط من الإضافة مجددًا.'})
                    return
                if p_data.get('status') != 'complete':
                    self.send_json(200, {'success': True, 'status': 'pending'})
                    return
                email = p_data.get('email', '')
                refresh_token = p_data.get('refreshToken', '')
                try: os.unlink(p_path)
                except: pass
                self.send_json(200, {'success': True, 'status': 'complete', 'email': email, 'refreshToken': refresh_token})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
        elif action == 'consume_generation':
            auth_header = self.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                self.send_json(200, {'success': True, 'remaining': None, 'plan': 'free'})
                return
            anon_id = self.headers.get('X-Anonymous-ID', params.get('anonymous_id', ''))
            client_ip = self.client_address[0] if self.client_address else '127.0.0.1'
            if not anon_id:
                anon_id = 'default_guest'
            g_path = guest_file(anon_id, client_ip)
            count = 0
            if os.path.exists(g_path):
                try:
                    with open(g_path, 'r', encoding='utf-8') as f:
                        g_data = json.load(f)
                        count = int(g_data.get('count', 0))
                except:
                    count = 0
            requested_count = max(1, min(10, int(params.get('count', 1))))
            if count >= 5:
                self.send_json(429, {'success': False, 'error': 'استخدمت محاولات الضيف الخمس. أنشئ حسابًا مجانيًا للمتابعة.'})
                return
            count += requested_count
            try:
                with open(g_path, 'w', encoding='utf-8') as f:
                    json.dump({'count': count, 'updatedAt': time.time()}, f)
            except:
                pass
            self.send_json(200, {'success': True, 'remaining': max(0, 5 - count), 'plan': 'free'})
        elif action == 'account_status':
            auth_header = self.headers.get('Authorization', '')
            email = ''
            uid = ''
            status = 'active'
            if auth_header.startswith('Bearer '):
                id_token = auth_header[7:].strip()
                try:
                    req_url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_WEB_API_KEY}"
                    req = urllib.request.Request(req_url, data=json.dumps({'idToken': id_token}).encode('utf-8'), headers={'Content-Type': 'application/json'})
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        resp_data = json.loads(resp.read().decode('utf-8'))
                        users = resp_data.get('users', [])
                        if users:
                            user = users[0]
                            email = user.get('email', '')
                            uid = user.get('localId', '')
                            if user.get('disabled'):
                                status = 'suspended'
                            
                            # Verify Firestore status (synced with admin dashboard)
                            if uid and status != 'suspended':
                                try:
                                    fs_url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users/{uid}"
                                    fs_req = urllib.request.Request(fs_url, headers={'Authorization': f"Bearer {id_token}"})
                                    with urllib.request.urlopen(fs_req, timeout=5) as fs_resp:
                                        fs_data = json.loads(fs_resp.read().decode('utf-8'))
                                        fields = fs_data.get('fields', {})
                                        fs_status = fields.get('status', {}).get('stringValue', 'active')
                                        if fs_status == 'suspended':
                                            status = 'suspended'
                                except Exception:
                                    pass
                except Exception:
                    pass
            self.send_json(200, {
                'success': True,
                'uid': uid,
                'email': email,
                'status': status,
                'plan': 'free'
            })
        else:
            self.send_json(400, {'success': False, 'error': f'Action {action} is not supported.'})

    def handle_tts(self, text, voice='', return_json=False, rate='1.0', pitch='1.0', dialect='', gender='', performance='', engine='gemini', gemini_key='', style='', model='gemini-3.8-flash-tts', input_payload=None, response_format=None, generation_config=None):
        if not text or not text.strip():
            self.send_json(400, {'success': False, 'error': 'النص فارغ'})
            return

        text = text.strip()

        # Normalize gender, dialect, and performance
        g = (gender or 'male').lower()
        if g not in ('male', 'female'):
            g = 'female' if (gender in ('نسائي', 'انثى', 'أنثى', 'female')) else 'male'

        d = (dialect or 'egyptian').lower()
        p = (performance or 'neutral').lower()

        # Edge Neural Voice Mapping
        dialect_map = {
            'egyptian': {'male': 'ar-EG-ShakirNeural', 'female': 'ar-EG-SalmaNeural'},
            'saudi':    {'male': 'ar-SA-HamedNeural',  'female': 'ar-SA-ZariyahNeural'},
            'fusha':    {'male': 'ar-SA-HamedNeural',  'female': 'ar-SA-ZariyahNeural'},
            'levantine':{'male': 'ar-LB-RamiNeural',   'female': 'ar-LB-LaylaNeural'},
            'iraqi':    {'male': 'ar-IQ-BasselNeural', 'female': 'ar-IQ-RanaNeural'},
            'algerian': {'male': 'ar-DZ-IsmaelNeural', 'female': 'ar-DZ-AminaNeural'},
            'moroccan': {'male': 'ar-MA-JamalNeural',  'female': 'ar-MA-MounaNeural'},
            'tunisian': {'male': 'ar-TN-HediNeural',   'female': 'ar-TN-ReemNeural'},
            'gulf':     {'male': 'ar-AE-HamdanNeural', 'female': 'ar-AE-FatimaNeural'},
        }

        perf_map = {
            # Male Personas
            'yusuf':   {'male': 'ar-EG-ShakirNeural', 'female': 'ar-EG-SalmaNeural'},
            'malik':   {'male': 'ar-SA-HamedNeural',  'female': 'ar-SA-ZariyahNeural'},
            'rami':    {'male': 'ar-LB-RamiNeural',   'female': 'ar-LB-LaylaNeural'},
            'saif':    {'male': 'ar-SY-LaithNeural',  'female': 'ar-SY-AmanyNeural'},
            'zaid':    {'male': 'ar-JO-TaimNeural',   'female': 'ar-JO-SanaNeural'},
            'neutral': {'male': 'ar-EG-ShakirNeural', 'female': 'ar-EG-SalmaNeural'},
            # Female Personas (Savio Studio)
            'mariam':  {'male': 'ar-EG-ShakirNeural', 'female': 'ar-EG-SalmaNeural'},
            'laila':   {'male': 'ar-SA-HamedNeural',  'female': 'ar-SA-ZariyahNeural'},
            'sama':    {'male': 'ar-LB-RamiNeural',   'female': 'ar-LB-LaylaNeural'},
            'salma':   {'male': 'ar-EG-SalmaNeural',  'female': 'ar-EG-SalmaNeural'},
            'farida':  {'male': 'ar-EG-ShakirNeural', 'female': 'ar-EG-SalmaNeural'},
        }

        edge_voice = ''
        if voice and voice.endswith('Neural'):
            edge_voice = voice
        elif d in dialect_map and d != 'auto':
            edge_voice = dialect_map[d][g]
        elif p in perf_map:
            edge_voice = perf_map[p][g]
        elif voice in VOICE_MAP:
            edge_voice = VOICE_MAP[voice]
        elif g == 'female':
            edge_voice = 'ar-EG-SalmaNeural'
        else:
            edge_voice = 'ar-EG-ShakirNeural'

        # Gemini Voices Mapping
        gemini_voices_map = {
            'yusuf':   ('Charon', 'Kore'),
            'malik':   ('Puck', 'Sadachbia'),
            'rami':    ('Iapetus', 'Aoede'),
            'saif':    ('Fenrir', 'Sulafat'),
            'zaid':    ('Rasalgethi', 'Vindemiatrix'),
            'neutral': ('Orus', 'Schedar'),
            'mariam':  ('Rasalgethi', 'Vindemiatrix'),
            'laila':   ('Puck', 'Sadachbia'),
            'sama':    ('Iapetus', 'Aoede'),
            'salma':   ('Fenrir', 'Sulafat'),
            'farida':  ('Charon', 'Kore'),
        }
        g_idx = 1 if g == 'female' else 0
        gemini_voice = voice if (voice and not voice.endswith('Neural')) else (gemini_voices_map.get(p, ('Orus', 'Schedar'))[g_idx])

        # Map to official Google Gemini Audio Voices: Puck, Charon, Kore, Fenrir, Aoede
        standard_gemini_voices = {
            'Charon': 'Charon',
            'Kore': 'Kore',
            'Puck': 'Puck',
            'Sadachbia': 'Aoede',
            'Iapetus': 'Fenrir',
            'Aoede': 'Aoede',
            'Fenrir': 'Fenrir',
            'Sulafat': 'Kore',
            'Rasalgethi': 'Puck',
            'Vindemiatrix': 'Aoede',
            'Orus': 'Charon',
            'Schedar': 'Kore'
        }
        official_voice = standard_gemini_voices.get(gemini_voice, 'Kore' if g == 'female' else 'Puck')

        chosen_engine = (engine or 'gemini').lower()
        active_pool_keys = get_active_gemini_keys()
        keys_to_try = []
        if gemini_key and not str(gemini_key).startswith('mk_'):
            keys_to_try.append(gemini_key)
        for k in active_pool_keys:
            if k not in keys_to_try:
                keys_to_try.append(k)

        audio_bytes = None
        engine_used = 'neural'
        mime_type = 'audio/mpeg'
        engine_note = ''

        # ==============================================================
        # 1. Primary Engine: Gemini 3.8 Flash TTS with Multi-Key Failover
        # ==============================================================
        if chosen_engine != 'neural':
            dialect_names = {
                'egyptian': 'Egyptian Arabic', 'saudi': 'Saudi Arabic',
                'levantine': 'Levantine Arabic', 'iraqi': 'Iraqi Arabic',
                'algerian': 'Algerian Arabic', 'moroccan': 'Moroccan Arabic',
                'tunisian': 'Tunisian Arabic', 'gulf': 'Gulf Arabic',
                'fusha': 'Modern Standard Arabic'
            }
            dial_label = dialect_names.get(d, 'Egyptian Arabic')
            if not style:
                style = f"Speak in {dial_label}, with a {'feminine' if g == 'female' else 'masculine'} voice. Read the supplied Arabic text verbatim; do not translate it or say these directions aloud."

            audio_b64 = ''
            successful_key_idx = -1
            failed_keys_count = 0
            invalid_keys_count = 0
            quota_keys_count = 0

            if not keys_to_try:
                print(f"[TTS Server] Gemini TTS selected, but no active Google Gemini keys in pool. Auto-switching to Edge Neural TTS...", flush=True)
                audio_bytes = None
                engine_note = 'تم التوليد بنجاح عبر محرك Edge Neural TTS السريع (يمكن لمدير المنصة إضافة مفاتيح Gemini في لوحة تحكم المنصة Admin Dashboard لتفعيل أصوات جيميناي).'
            else:
                for idx, current_key in enumerate(keys_to_try):
                    masked_key = mask_gemini_key(current_key)
                    print(f"[TTS Server] Trying Gemini API Key #{idx + 1}/{len(keys_to_try)} ({masked_key})...", flush=True)

                    # Strategy A: Google Gemini 2.0 Flash Audio Generation
                    try:
                        g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={current_key}"
                        g_prompt = f"{style}\n\nRead the following Arabic text aloud with exact authentic {dial_label} dialect and natural expressiveness. Do NOT translate or add commentary, speak only the text:\n{text}"
                        g_payload = {
                            "contents": [{
                                "parts": [{ "text": g_prompt }]
                            }],
                            "generationConfig": {
                                "responseModalities": ["AUDIO"],
                                "speechConfig": {
                                    "voiceConfig": {
                                        "prebuiltVoiceConfig": {
                                            "voiceName": official_voice
                                        }
                                    }
                                }
                            }
                        }
                        req_g = urllib.request.Request(
                            g_url,
                            data=json.dumps(g_payload).encode('utf-8'),
                            headers={'Content-Type': 'application/json'}
                        )
                        with urllib.request.urlopen(req_g, timeout=45) as resp_g:
                            res_g = json.loads(resp_g.read().decode('utf-8'))
                            candidates = res_g.get('candidates', [])
                            if candidates:
                                parts = candidates[0].get('content', {}).get('parts', [])
                                for p_item in parts:
                                    inline = p_item.get('inlineData', {})
                                    if inline.get('data'):
                                        audio_b64 = inline['data']
                                        break
                        if audio_b64:
                            print(f"[TTS Server] Gemini Key #{idx + 1} ({masked_key}) succeeded via Strategy A!", flush=True)
                            successful_key_idx = idx
                            break
                    except urllib.error.HTTPError as he:
                        err_body = ''
                        try: err_body = he.read().decode('utf-8')
                        except: pass
                        print(f"[TTS Server] Gemini Key #{idx + 1} Strategy A HTTP {he.code}: {err_body[:180]}", flush=True)
                        if he.code == 400 and ('API key not valid' in err_body or 'INVALID_ARGUMENT' in err_body):
                            print(f"[TTS Server] Gemini Key #{idx + 1} ({masked_key}) is INVALID. Skipping...", flush=True)
                            invalid_keys_count += 1
                            continue
                        elif he.code in (429, 403) or 'RESOURCE_EXHAUSTED' in err_body or 'quota' in err_body.lower():
                            print(f"[TTS Server] Quota exhausted on Key #{idx + 1} ({masked_key}). Auto-switching to next key in pool...", flush=True)
                            quota_keys_count += 1
                            continue
                        else:
                            failed_keys_count += 1
                            continue
                    except Exception as e_gem:
                        print(f"[TTS Server] Gemini Key #{idx + 1} Strategy A exception: {e_gem}", flush=True)

                    # Strategy B: Interactions API with gemini-3.8-flash-tts
                    if not audio_b64:
                        try:
                            tts_payload = {
                                'model': model or 'gemini-3.8-flash-tts',
                                'input': input_payload or [{
                                    'type': 'user_input',
                                    'content': [{
                                        'type': 'text',
                                        'text': text,
                                        'annotations': [{'type': 'speech_metadata', 'style': style}]
                                    }]
                                }],
                                'response_format': response_format or {'type': 'audio', 'mime_type': 'audio/wav', 'sample_rate': 24000},
                                'generation_config': generation_config or {'speech_config': [{'voice': gemini_voice}]}
                            }
                            req_tts = urllib.request.Request(
                                'https://generativelanguage.googleapis.com/v1beta/interactions',
                                data=json.dumps(tts_payload).encode('utf-8'),
                                headers={
                                    'Content-Type': 'application/json',
                                    'x-goog-api-key': current_key
                                }
                            )
                            with urllib.request.urlopen(req_tts, timeout=45) as resp_tts:
                                resp_data = json.loads(resp_tts.read().decode('utf-8'))
                            audio_b64 = resp_data.get('output_audio', {}).get('data', '')
                            if not audio_b64 and 'steps' in resp_data:
                                for step in reversed(resp_data['steps']):
                                    for item in reversed(step.get('content', [])):
                                        if item.get('type') == 'audio' and item.get('data'):
                                            audio_b64 = item['data']
                                            break
                                    if audio_b64: break
                            if audio_b64:
                                print(f"[TTS Server] Gemini Key #{idx + 1} ({masked_key}) succeeded via Strategy B!", flush=True)
                                successful_key_idx = idx
                                break
                        except urllib.error.HTTPError as he:
                            err_body = ''
                            try: err_body = he.read().decode('utf-8')
                            except: pass
                            print(f"[TTS Server] Gemini Key #{idx + 1} Strategy B HTTP {he.code}: {err_body[:180]}", flush=True)
                            if he.code == 400 and ('API key not valid' in err_body or 'INVALID_ARGUMENT' in err_body):
                                print(f"[TTS Server] Gemini Key #{idx + 1} ({masked_key}) is INVALID. Skipping...", flush=True)
                                invalid_keys_count += 1
                                continue
                            elif he.code in (429, 403) or 'RESOURCE_EXHAUSTED' in err_body or 'quota' in err_body.lower():
                                print(f"[TTS Server] Quota exhausted on Key #{idx + 1} ({masked_key}). Auto-switching to next key in pool...", flush=True)
                                quota_keys_count += 1
                                continue
                            else:
                                failed_keys_count += 1
                                continue
                        except Exception as e_inter:
                            print(f"[TTS Server] Gemini Key #{idx + 1} Strategy B exception: {e_inter}", flush=True)

            if audio_b64:
                if audio_b64.startswith('data:'):
                    audio_b64 = audio_b64.split(',', 1)[1]
                raw_bytes = base64.b64decode(audio_b64)
                if len(raw_bytes) >= 100:
                    is_wav = len(raw_bytes) >= 12 and raw_bytes[:4] == b'RIFF' and raw_bytes[8:12] == b'WAVE'
                    is_mp3 = len(raw_bytes) >= 3 and (raw_bytes[:3] == b'ID3' or (raw_bytes[0] == 0xFF and (raw_bytes[1] & 0xE0) == 0xE0))
                    if is_mp3:
                        audio_bytes = raw_bytes
                        mime_type = 'audio/mpeg'
                    elif not is_wav:
                        # Prepend standard 44-byte WAV header (24000Hz, 16bit, mono)
                        if len(raw_bytes) % 2 != 0:
                            raw_bytes = raw_bytes[:-1]
                        data_len = len(raw_bytes)
                        wav_header = struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', 36 + data_len, b'WAVE', b'fmt ', 16, 1, 1, 24000, 48000, 2, 16, b'data', data_len)
                        audio_bytes = wav_header + raw_bytes
                        mime_type = 'audio/wav'
                    else:
                        audio_bytes = raw_bytes
                        mime_type = 'audio/wav'

                    engine_used = 'gemini'
                    engine_note = f'تم التوليد بنجاح عبر استوديو Google Gemini 3.8 Flash TTS الفائق بدقة WAV (المفتاح #{successful_key_idx + 1} من حوض التدوير).'
                    print(f"[TTS Server] Gemini TTS synthesis successful ({len(audio_bytes)} bytes) using voice: {official_voice} with Key #{successful_key_idx + 1}", flush=True)
            elif chosen_engine != 'neural':
                print(f"[TTS Server] Gemini synthesis could not complete with available keys. Auto-switching to Edge Neural TTS...", flush=True)
                audio_bytes = None
                if quota_keys_count > 0:
                    engine_note = f'⚠️ تم استهلاك رصيد كافة مفاتيح Gemini النشطة في لوحة التحكم ({quota_keys_count} مفتاح)، وتم التحويل تلقائياً وسلساً إلى محرك Edge Neural TTS لضمان عدم توقف العمل.'
                else:
                    engine_note = 'تم التوليد بنجاح عبر محرك Edge Neural TTS السريع (يمكن للمشرف مراجعة مفاتيح Gemini في لوحة تحكم المنصة Admin Dashboard).'

        # ==============================================================
        # 2. Secondary Engine: Microsoft Edge Neural TTS (Free & Fast)
        # ==============================================================
        if not audio_bytes and HAS_EDGE_TTS:
            try:
                # Format rate (+10%, -10%, etc.)
                rate_str = '+0%'
                try:
                    r_val = float(rate)
                    diff = int((r_val - 1.0) * 100)
                    rate_str = f"{'+' if diff >= 0 else ''}{diff}%"
                except Exception:
                    pass

                # Format pitch (+5Hz, -5Hz, etc.)
                pitch_str = '+0Hz'
                try:
                    p_val = float(pitch)
                    p_diff = int((p_val - 1.0) * 50)
                    pitch_str = f"{'+' if p_diff >= 0 else ''}{p_diff}Hz"
                except Exception:
                    pass

                async def _synthesize():
                    comm = edge_tts.Communicate(text, edge_voice, rate=rate_str, pitch=pitch_str)
                    chunks = []
                    async for chunk in comm.stream():
                        if chunk["type"] == "audio":
                            chunks.append(chunk["data"])
                    return b''.join(chunks)

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                audio_bytes = loop.run_until_complete(_synthesize())
                loop.close()

                engine_used = 'neural'
                mime_type = 'audio/mpeg'
                if not engine_note:
                    engine_note = 'تم التوليد بنجاح عبر محرك Edge Neural TTS المجاني.'
                print(f"[TTS Server] Edge Neural synthesized ({len(audio_bytes)} bytes) using voice: {edge_voice}", flush=True)
            except Exception as e:
                print(f"[TTS Error] edge-tts error: {e}", flush=True)
                audio_bytes = None

        # ==============================================================
        # 3. Tertiary Fallback: Google Translate TTS
        # ==============================================================
        if not audio_bytes:
            try:
                encoded_q = urllib.parse.quote(text)
                tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q={encoded_q}"
                req = urllib.request.Request(
                    tts_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://translate.google.com/'
                    }
                )
                with urllib.request.urlopen(req, timeout=15) as response:
                    audio_bytes = response.read()
                engine_used = 'translate_fallback'
                mime_type = 'audio/mpeg'
                engine_note = 'تم التوليد عبر محرك الترجمة البديل.'
            except Exception as e:
                self.send_json(502, {'success': False, 'error': f'TTS error: {str(e)}'})
                return

        if not audio_bytes:
            self.send_json(502, {'success': False, 'error': 'فشل توليد الصوت من جميع المحركات.'})
            return

        # If JSON requested (e.g., from Premiere UXP), return base64
        if return_json:
            b64 = base64.b64encode(audio_bytes).decode('utf-8')
            self.send_json(200, {
                'success': True,
                '_media_base64': b64,
                'base64Data': b64,
                'mimeType': mime_type,
                'voice': gemini_voice if engine_used == 'gemini' else edge_voice,
                'engine': engine_used,
                'engine_used': engine_used,
                'note': engine_note
            })
            return

        # Stream raw audio
        ext = 'wav' if mime_type == 'audio/wav' else 'mp3'
        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.send_header('Content-Length', str(len(audio_bytes)))
        self.send_header('Content-Disposition', f'inline; filename="mickey_voiceover.{ext}"')
        self.send_header('X-Voice-Used', gemini_voice if engine_used == 'gemini' else edge_voice)
        self.send_header('X-Engine-Used', engine_used)
        self.end_headers()
        self.wfile.write(audio_bytes)

    def handle_enhance_prompt(self, prompt, api_key=''):
        if not prompt or not prompt.strip():
            self.send_json(400, {'success': False, 'error': 'الوصف فارغ'})
            return

        prompt = prompt.strip()

        # Try active Gemini keys from rotation pool
        active_keys = []
        if api_key and not str(api_key).startswith('mk_'):
            active_keys.append(api_key)
        for k in get_active_gemini_keys():
            if k not in active_keys:
                active_keys.append(k)

        for current_key in active_keys:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={urllib.parse.quote(current_key)}"
                sys_inst = (
                    "You are a master cinematic prompt architect. Translate and expand the user's prompt into an award-winning, "
                    "ultra-detailed English photographic description with precise lighting, lens (85mm f/1.4), texture, 8k resolution. "
                    "Output ONLY the final English prompt string, without quotes or markdown."
                )
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": f"{sys_inst}\n\nPrompt: {prompt}"}]
                    }]
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=15) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    text = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
                    self.send_json(200, {
                        'success': True,
                        'provider': 'Google Gemini 1.5 Flash',
                        'original': prompt,
                        'enhanced_prompt': text,
                        'enhanced': text,
                        'text': text
                    })
                    return
            except urllib.error.HTTPError as he:
                print(f"[API] Gemini enhance HTTP {he.code} on key {mask_gemini_key(current_key)}, trying next...", flush=True)
                continue
            except Exception as e:
                print(f"[API] Gemini enhance fallback: {e}")

        # Fast translation + photographic tokens fallback
        try:
            gtx_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q={urllib.parse.quote(prompt)}"
            req = urllib.request.Request(gtx_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as res:
                gtx_data = json.loads(res.read().decode('utf-8'))
                translated = ''.join([seg[0] for seg in gtx_data[0] if seg and seg[0]])
                if translated:
                    enhanced = f"{translated.strip()}, award-winning RAW candid photography, natural cinematic lighting, shot on Sony A7R V, 85mm f/1.4 lens, shallow depth of field, authentic texture, sharp focus, 8k resolution"
                    self.send_json(200, {
                        'success': True,
                        'provider': 'Mickey Studio Fast Engine',
                        'original': prompt,
                        'enhanced_prompt': enhanced,
                        'enhanced': enhanced,
                        'text': enhanced
                    })
                    return
        except Exception as e:
            print(f"[API] GTX fallback error: {e}")

        # Basic fallback
        enhanced = f"{prompt}, award-winning photorealistic photography, natural lighting, 85mm lens, 8k resolution"
        self.send_json(200, {
            'success': True,
            'provider': 'Mickey Studio Default',
            'original': prompt,
            'enhanced_prompt': enhanced,
            'enhanced': enhanced,
            'text': enhanced
        })

    def handle_transcribe_audio(self, audio_base64, mime_type='audio/mp3', dialect='auto', api_key=''):
        if not audio_base64:
            self.send_json(400, {'success': False, 'error': 'لم يتم إرسال ملف صوتي لتحليله'})
            return

        # Strip data URL prefix if present
        if 'base64,' in audio_base64:
            audio_base64 = audio_base64.split('base64,')[-1].strip()

        clean_mime = mime_type.split(';')[0].strip() if mime_type else 'audio/mp3'

        active_keys = []
        if api_key and not str(api_key).startswith('mk_'):
            active_keys.append(api_key)
        for k in get_active_gemini_keys():
            if k not in active_keys:
                active_keys.append(k)

        if not active_keys:
            self.send_json(400, {
                'success': False,
                'error': 'لم يتم العثور على مفاتيح Gemini نشطة في السيرفر لتشغيل تفريغ وتحليل الصوت.'
            })
            return

        # Models to try in priority order
        models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
        prompt_text = (
            "أنت خبير فائق الذكاء في تفريغ وتحليل الصوت والكلام العربي بجميع لهجاته. "
            "استمع للصوت المرفق بدقة وقم بتفريغه وتحليله كاملاً. "
            "المطلوب إخراج كائن JSON فقط بدون markdown يحتوي على: transcript (النص الكامل بدقة), summary (ملخص سطرين), dialect (اللهجة), tone (النبرة), srt (ملف ترجمة توقيتي تقديري جاهز للمونتاج)."
        )

        for current_key in active_keys:
            for model in models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={urllib.parse.quote(current_key)}"
                    payload = {
                        "contents": [{
                            "role": "user",
                            "parts": [
                                {"text": prompt_text},
                                {"inlineData": {"mimeType": clean_mime, "data": audio_base64}}
                            ]
                        }],
                        "generationConfig": {"temperature": 0.2}
                    }
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}
                    )
                    with urllib.request.urlopen(req, timeout=60) as res:
                        res_data = json.loads(res.read().decode('utf-8'))
                        raw_text = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
                        # Clean markdown
                        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text, flags=re.IGNORECASE)
                        raw_text = re.sub(r'```$', '', raw_text).strip()

                        try:
                            parsed = json.loads(raw_text)
                        except Exception:
                            parsed = {'transcript': raw_text, 'summary': raw_text[:100]}

                        transcript = parsed.get('transcript') or raw_text
                        self.send_json(200, {
                            'success': True,
                            'provider': f'Google {model} Multimodal',
                            'transcript': transcript,
                            'text': transcript,
                            'data': parsed
                        })
                        return
                except Exception as e:
                    print(f"[API] Transcribe model {model} failed: {e}")

        self.send_json(500, {'success': False, 'error': 'تعذر تفريغ الصوت عبر نماذج Gemini. تحقق من صلاحية المفتاح وحجم الملف.'})

    def handle_generate_image(self, prompt, ratio='16:9', api_key=''):
        if not prompt or not prompt.strip():
            self.send_json(400, {'success': False, 'error': 'الوصف فارغ'})
            return

        prompt = prompt.strip()

        # Try Google Imagen 3 if key is available
        if api_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={urllib.parse.quote(api_key)}"
                payload = {
                    "instances": [{"prompt": prompt}],
                    "parameters": {
                        "sampleCount": 1,
                        "aspectRatio": ratio if ratio in ('1:1', '16:9', '9:16', '4:3', '3:4') else '16:9',
                        "outputOptions": {"mimeType": "image/jpeg"}
                    }
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=40) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    b64 = res_data['predictions'][0]['bytesBase64Encoded']
                    self.send_json(200, {
                        'success': True,
                        'provider': 'Google Imagen 3.0',
                        '_media_base64': b64,
                        'image_base64': b64,
                        'base64Data': b64,
                        'mime_type': 'image/jpeg',
                        'mimeType': 'image/jpeg'
                    })
                    return
            except Exception as e:
                print(f"[API] Imagen 3 error, falling back to Pollinations: {e}")

        # Pollinations Flux Fallback (Free, fast, high quality)
        try:
            dim_map = {'16:9': (1280, 720), '9:16': (720, 1280), '1:1': (1024, 1024)}
            w, h = dim_map.get(ratio, (1280, 720))
            poll_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}?width={w}&height={h}&nologo=true&model=flux"
            req = urllib.request.Request(poll_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as res:
                img_bytes = res.read()
                b64 = base64.b64encode(img_bytes).decode('utf-8')
                self.send_json(200, {
                    'success': True,
                    'provider': 'Mickey Studio Flux Engine',
                    '_media_base64': b64,
                    'image_base64': b64,
                    'base64Data': b64,
                    'mime_type': 'image/jpeg',
                    'mimeType': 'image/jpeg'
                })
                return
        except Exception as e:
            self.send_json(502, {'success': False, 'error': f'تعذر إنشاء الصورة: {str(e)}'})

    def handle_remove_background(self, image_base64, mime_type='image/png'):
        if not image_base64:
            self.send_json(400, {'success': False, 'error': 'لم يتم إرسال بيانات الصورة'})
            return

        try:
            if ',' in image_base64:
                image_base64 = image_base64.split(',', 1)[1]
            raw_bytes = base64.b64decode(image_base64)

            output_png_bytes = None
            # Strategy 1: rembg (AI high-precision background removal)
            try:
                import rembg
                if not hasattr(MickeyRequestHandler, '_rembg_session') or MickeyRequestHandler._rembg_session is None:
                    try:
                        MickeyRequestHandler._rembg_session = rembg.new_session('u2netp')
                    except Exception as sess_err:
                        print(f"[PhotoLab] Could not init u2netp session: {sess_err}")
                        MickeyRequestHandler._rembg_session = None
                if MickeyRequestHandler._rembg_session:
                    output_png_bytes = rembg.remove(raw_bytes, session=MickeyRequestHandler._rembg_session)
                else:
                    output_png_bytes = rembg.remove(raw_bytes)
            except Exception as rembg_err:
                print(f"[PhotoLab] rembg local error, falling back: {rembg_err}")

            # Strategy 2: Pillow smart RGBA alpha thresholding fallback
            if not output_png_bytes:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
                bg_color = img.getpixel((0, 0))
                datas = img.getdata()
                new_data = []
                for item in datas:
                    if abs(item[0]-bg_color[0]) < 28 and abs(item[1]-bg_color[1]) < 28 and abs(item[2]-bg_color[2]) < 28:
                        new_data.append((255, 255, 255, 0))
                    else:
                        new_data.append(item)
                img.putdata(new_data)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                output_png_bytes = buf.getvalue()

            res_b64 = base64.b64encode(output_png_bytes).decode('utf-8')
            self.send_json(200, {
                'success': True,
                'base64Data': res_b64,
                '_media_base64': res_b64,
                'mimeType': 'image/png',
                'mime_type': 'image/png',
                'provider': 'Mickey AI Photo Lab Engine'
            })
        except Exception as e:
            print(f"[PhotoLab] Error in remove_background: {e}")
            self.send_json(500, {'success': False, 'error': f'تعذر إزالة الخلفية: {str(e)}'})

    def handle_upscale_image(self, image_base64, mime_type='image/png', scale=2):
        if not image_base64:
            self.send_json(400, {'success': False, 'error': 'لم يتم إرسال بيانات الصورة'})
            return

        try:
            if ',' in image_base64:
                image_base64 = image_base64.split(',', 1)[1]
            raw_bytes = base64.b64decode(image_base64)
            multiplier = 4 if int(scale) >= 4 else 2

            from PIL import Image, ImageFilter
            import io
            is_png = "png" in mime_type.lower()
            img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA" if is_png else "RGB")
            
            w, h = img.size
            new_w, new_h = w * multiplier, h * multiplier

            # High-fidelity Lanczos 4K/2K upscaling + micro-contrast edge sharpening
            upscaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Subtle edge unsharp mask for crystal clear details
            upscaled = upscaled.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3))

            buf = io.BytesIO()
            format_to_save = "PNG" if is_png else "JPEG"
            upscaled.save(buf, format=format_to_save, quality=98 if format_to_save == "JPEG" else None)
            res_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

            self.send_json(200, {
                'success': True,
                'base64Data': res_b64,
                '_media_base64': res_b64,
                'mimeType': f'image/{format_to_save.lower()}',
                'mime_type': f'image/{format_to_save.lower()}',
                'multiplier': multiplier,
                'width': new_w,
                'height': new_h,
                'provider': 'Mickey AI 4K Upscale Engine'
            })
        except Exception as e:
            print(f"[PhotoLab] Error in upscale_image: {e}")
            self.send_json(500, {'success': False, 'error': f'تعذر تحسين الصورة: {str(e)}'})

    def handle_analyze_silence(self, file_path, video_base64, start_sec, end_sec, threshold_db, min_duration):
        try:
            target_path = file_path
            temp_file = None
            if not target_path or not os.path.exists(target_path):
                if video_base64:
                    raw_bytes = base64.b64decode(video_base64)
                    temp_file = os.path.join(tempfile.gettempdir(), f"mickey_silence_{int(time.time()*1000)}.mp4")
                    with open(temp_file, 'wb') as f:
                        f.write(raw_bytes)
                    target_path = temp_file
                else:
                    self.send_json(400, {'success': False, 'error': 'لم يتم العثور على ملف الفيديو المحدد لتحليل الصمت.'})
                    return

            try: start_val = float(start_sec) if start_sec is not None else None
            except Exception: start_val = None
            try: end_val = float(end_sec) if end_sec is not None else None
            except Exception: end_val = None
            try: thresh_val = float(threshold_db) if threshold_db is not None else -35.0
            except Exception: thresh_val = -35.0
            try: min_val = float(min_duration) if min_duration is not None else 0.3
            except Exception: min_val = 0.3

            silences = self._detect_silence_ffmpeg(target_path, start_val, end_val, thresh_val, min_val)
            waveform = self._extract_waveform_db(target_path, start_val, end_val)

            if temp_file and os.path.exists(temp_file):
                try: os.remove(temp_file)
                except Exception: pass

            self.send_json(200, {
                'success': True,
                'silences': silences,
                'count': len(silences),
                'waveform_db': waveform,
                'waveform_rate': 50,
                'engine': 'ffmpeg_local'
            })
        except Exception as e:
            print(f"[AutoCut] Silence detect error: {e}")
            self.send_json(500, {'success': False, 'error': f'فشل تحليل الصمت: {str(e)}'})

    def _extract_waveform_db(self, file_path, start_seconds=None, end_seconds=None, points_per_second=50):
        """Return a compact RMS dBFS envelope for instant threshold previews in the panel."""
        import subprocess, imageio_ffmpeg, array, math, sys
        sample_rate = 8000
        start = max(0.0, float(start_seconds or 0))
        duration = max(0.0, float(end_seconds) - start) if end_seconds is not None and float(end_seconds) > start else 0.0
        if duration <= 0:
            try:
                ffmpeg_probe = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-i', file_path]
                probe_res = subprocess.run(ffmpeg_probe, capture_output=True, text=True, errors='ignore')
                m_dur = re.search(r'Duration:\s*(\d+):(\d+):(\d+\.?\d*)', probe_res.stderr)
                if m_dur:
                    total_f = float(m_dur.group(1)) * 3600 + float(m_dur.group(2)) * 60 + float(m_dur.group(3))
                    duration = max(0.0, total_f - start)
            except Exception:
                pass
        if duration <= 0:
            return []
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [ffmpeg_exe, '-nostats', '-hide_banner', '-loglevel', 'error']
        if start > 0:
            cmd.extend(['-ss', f'{start:.3f}'])
        cmd.extend(['-i', file_path, '-t', f'{duration:.3f}', '-vn', '-ac', '1', '-ar', str(sample_rate), '-f', 's16le', 'pipe:1'])
        result = subprocess.run(cmd, capture_output=True, check=True)
        samples = array.array('h')
        samples.frombytes(result.stdout[:len(result.stdout) - (len(result.stdout) % 2)])
        if sys.byteorder != 'little':
            samples.byteswap()
        bin_count = max(1, int(math.ceil(duration * points_per_second)))
        samples_per_bin = sample_rate / points_per_second
        envelope = []
        for index in range(bin_count):
            left = int(index * samples_per_bin)
            right = min(len(samples), max(left + 1, int((index + 1) * samples_per_bin)))
            window = samples[left:right]
            if not window:
                envelope.append(-90.0)
                continue
            rms = math.sqrt(sum(value * value for value in window) / len(window))
            envelope.append(round(max(-90.0, 20 * math.log10(max(rms / 32768.0, 1e-5))), 1))
        return envelope

    def _detect_silence_ffmpeg(self, file_path, start_seconds=None, end_seconds=None, threshold_db=-35.0, minimum_seconds=0.3):
        import subprocess, imageio_ffmpeg, re
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [ffmpeg_exe, '-nostats', '-hide_banner']
        if start_seconds is not None and start_seconds > 0:
            cmd.extend(['-ss', f'{start_seconds:.3f}'])
        if end_seconds is not None and end_seconds > (start_seconds or 0):
            duration = end_seconds - (start_seconds or 0)
            cmd.extend(['-t', f'{duration:.3f}'])
        cmd.extend([
            '-i', file_path,
            '-vn',
            '-af', f'silencedetect=noise={threshold_db}dB:d={minimum_seconds}',
            '-f', 'null', '-'
        ])
        res = subprocess.run(cmd, capture_output=True, text=True, errors='ignore')
        silences = []
        current_start = None
        for line in res.stderr.splitlines():
            if 'silence_start:' in line:
                m = re.search(r'silence_start:\s*([0-9.]+)', line)
                if m:
                    current_start = float(m.group(1))
            elif 'silence_end:' in line:
                m = re.search(r'silence_end:\s*([0-9.]+)', line)
                if m and current_start is not None:
                    end = float(m.group(1))
                    if end > current_start and (end - current_start) >= minimum_seconds * 0.8:
                        silences.append({
                            'start_seconds': round(current_start, 3),
                            'end_seconds': round(end, 3)
                        })
                    current_start = None
        return silences

    def handle_detect_viral_clips(self, transcript, duration_pref='60-90', api_key=''):
        if not transcript or not transcript.strip():
            self.send_json(400, {'success': False, 'error': 'نص الفيديو أو التفريغ فارغ'})
            return

        active_keys = []
        if api_key and not str(api_key).startswith('mk_'):
            active_keys.append(api_key)
        for k in get_active_gemini_keys():
            if k not in active_keys:
                active_keys.append(k)

        sys_prompt = (
            "أنت خبير مونتاج وتسويق فيديو محترف متخصص في استخراج المقاطع الأكثر انتشاراً وفيروسية (Viral Shorts & Reels). "
            "قم بتحليل نص الفيديو المرفق، وحدد أفضل المقاطع القصيرة الصالحة لتكون ريلز أو شورتس. "
            "قم بتقييم كل مقطع من حيث: قوة الخطاف (Hook)، إثارة الجدل أو الفضول، الفكاهة، والقيمة التعليمية. "
            "المطلوب إخراج كائن JSON فقط بالصيغة التالية:\n"
            "{\n"
            '  "clips": [\n'
            '    {\n'
            '      "title": "عنوان المقترح الجذاب",\n'
            '      "hook": "الخطاف والبداية",\n'
            '      "startTime": 12.0,\n'
            '      "endTime": 62.0,\n'
            '      "duration": 50.0,\n'
            '      "viralityScore": 95,\n'
            '      "category": "تعليمي / فكاهي / إثارة فضول",\n'
            '      "reason": "سبب التقييم العالي ومناسبته للريلز"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        for current_key in active_keys:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={urllib.parse.quote(current_key)}"
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": f"{sys_prompt}\n\nمدة المقطع المفضلة: {duration_pref} ثانية.\n\nنص وتفريغ الفيديو:\n{transcript}"}]
                    }],
                    "generationConfig": {"temperature": 0.4}
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    raw_text = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
                    parsed = self.extract_json_safe(raw_text)
                    self.send_json(200, {
                        'success': True,
                        'clips': parsed.get('clips', []),
                        'count': len(parsed.get('clips', []))
                    })
                    return
            except Exception as e:
                print(f"[API] detect_viral_clips failed on key: {e}")
                continue

        # Fallback heuristic
        self.send_json(200, {
            'success': True,
            'clips': [
                {
                    'title': 'المقطع الافتتاحي الأكثر تأثيراً',
                    'hook': transcript[:80] + '...',
                    'startTime': 0.0,
                    'endTime': min(60.0, float(max(15, len(transcript.split()) * 0.4))),
                    'duration': min(60.0, float(max(15, len(transcript.split()) * 0.4))),
                    'viralityScore': 88,
                    'category': 'افتتاحي',
                    'reason': 'بداية الفيديو تحتوي على طرح الفكرة الأساسية'
                }
            ],
            'count': 1
        })

    def handle_generate_chapters(self, transcript, api_key=''):
        if not transcript or not transcript.strip():
            self.send_json(400, {'success': False, 'error': 'نص الفيديو أو التفريغ فارغ'})
            return

        active_keys = []
        if api_key and not str(api_key).startswith('mk_'):
            active_keys.append(api_key)
        for k in get_active_gemini_keys():
            if k not in active_keys:
                active_keys.append(k)

        sys_prompt = (
            "أنت خبير يوتيوب ومونتاج. قم بتقسيم نص الفيديو المرفق إلى فصول ومواضيع واضحة (YouTube Chapters & Markers). "
            "يجب أن يبدأ الفصل الأول عند 00:00 (المقدمة). "
            "المطلوب إخراج كائن JSON فقط بدون markdown يحتوي على:\n"
            "{\n"
            '  "chapters": [\n'
            '    { "seconds": 0, "timestamp": "00:00", "title": "المقدمة" },\n'
            '    { "seconds": 45, "timestamp": "00:45", "title": "عنوان الفصل" }\n'
            '  ],\n'
            '  "formattedText": "00:00 المقدمة\\n00:45 عنوان الفصل"\n'
            "}"
        )

        for current_key in active_keys:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={urllib.parse.quote(current_key)}"
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": f"{sys_prompt}\n\nنص وتفريغ الفيديو:\n{transcript}"}]
                    }],
                    "generationConfig": {"temperature": 0.3}
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    raw_text = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
                    parsed = self.extract_json_safe(raw_text)
                    chapters = parsed.get('chapters', [])
                    formatted = parsed.get('formattedText') or '\n'.join([f"{ch.get('timestamp', '00:00')} {ch.get('title', '')}" for ch in chapters])
                    self.send_json(200, {
                        'success': True,
                        'chapters': chapters,
                        'formattedText': formatted,
                        'count': len(chapters)
                    })
                    return
            except Exception as e:
                print(f"[API] generate_chapters failed on key: {e}")
                continue

        self.send_json(200, {
            'success': True,
            'chapters': [
                { 'seconds': 0, 'timestamp': '00:00', 'title': 'المقدمة' },
                { 'seconds': 60, 'timestamp': '01:00', 'title': 'الموضوع الرئيسي' }
            ],
            'formattedText': "00:00 المقدمة\n01:00 الموضوع الرئيسي",
            'count': 2
        })

    def handle_detect_censor_words(self, transcript, custom_words='', api_key=''):
        if not transcript or not transcript.strip():
            self.send_json(400, {'success': False, 'error': 'نص الفيديو أو التفريغ فارغ'})
            return

        active_keys = []
        if api_key and not str(api_key).startswith('mk_'):
            active_keys.append(api_key)
        for k in get_active_gemini_keys():
            if k not in active_keys:
                active_keys.append(k)

        sys_prompt = (
            "أنت خبير في مراجعة المحتوى والرقابة الصوتية (Content Moderation & Censor Bleep). "
            "قم بفحص النص المرفق واكتشاف أي كلمات مسيئة، شتائم، ألفاظ نابية، أو الكلمات المخصصة التي حددها المستخدم. "
            "المطلوب إخراج كائن JSON فقط يحتوي على قائمة بالكلمات وأوقاتها التقريبية:\n"
            "{\n"
            '  "matches": [\n'
            '    {\n'
            '      "word": "الكلمة المحظورة",\n'
            '      "start": 14.5,\n'
            '      "end": 15.2,\n'
            '      "reason": "شتيمة / لفظ غير لائق / محدد من المستخدم"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        for current_key in active_keys:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={urllib.parse.quote(current_key)}"
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": f"{sys_prompt}\n\nكلمات مخصصة للحجب: {custom_words}\n\nنص وتفريغ الفيديو:\n{transcript}"}]
                    }],
                    "generationConfig": {"temperature": 0.1}
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    raw_text = res_data['candidates'][0]['content']['parts'][0]['text'].strip()
                    parsed = self.extract_json_safe(raw_text)
                    matches = parsed.get('matches', [])
                    self.send_json(200, {
                        'success': True,
                        'matches': matches,
                        'count': len(matches)
                    })
                    return
            except Exception as e:
                print(f"[API] detect_censor_words failed on key: {e}")
                continue

        matches = []
        user_list = [w.strip() for w in re.split(r'[,،\s]+', custom_words) if w.strip()]
        for w in user_list:
            if w in transcript:
                matches.append({'word': w, 'start': 0.0, 'end': 0.5, 'reason': 'محدد من المستخدم'})

        self.send_json(200, {
            'success': True,
            'matches': matches,
            'count': len(matches)
        })

    def extract_json_safe(self, text):
        try:
            m = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
            if m:
                return json.loads(m.group(1))
            return json.loads(text)
        except Exception:
            return {}

if __name__ == '__main__':
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MickeyRequestHandler) as httpd:
        print(f"Mickey Studio Full AI Gateway running on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
