import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import yaml from 'js-yaml';
import { DeviceInfo, SubscriptionProgress } from '../types';

/**
 * Глобальная конфигурация запросов подписки.
 * Полная совместимость с Mikan VPN Panel (Marzban / Remnawave), Koala Clash, Happ, v2rayNG.
 */
export const SUBSCRIPTION_CONFIG = {
  /** Таймаут одного HTTP-запроса подписки в миллисекундах (20 секунд) */
  TIMEOUT_MS: 20000,

  /** Количество повторных попыток при таймауте */
  MAX_RETRIES: 1,

  /** Основной заголовок HWID (используется в Mikan, Marzban, Remnawave) */
  HEADER_HWID: 'X-Hwid',

  /** Заголовки ОС и модели устройства для панели Mikan */
  HEADER_DEVICE_OS: 'X-Device-Os',
  HEADER_VER_OS: 'X-Ver-Os',
  HEADER_DEVICE_MODEL: 'X-Device-Model',

  /** Заголовки совместимости с другими панелями */
  HEADER_DEVICE_ID: 'X-Device-ID',
  HEADER_DEVICE_NAME: 'X-Device-Name',

  /** Флаг: добавлять ли ?device_id=<uuid> в query-параметры URL */
  APPEND_DEVICE_ID_QUERY: false,

  /** Автоматически запрашивать формат Clash/Mihomo для Mikan (?format=clash) */
  ENSURE_CLASH_FORMAT: true,

  /**
   * Шаблон User-Agent по умолчанию:
   * Содержит mihomo/v1.19.32 и clash-meta/v1.19.32, чтобы Mikan распознал клиент
   * как FamilyMihomo (версия 1.19.32) и отдал полный Clash-профиль со всеми протоколами.
   */
  DEFAULT_UA_TEMPLATE: 'Gravity/1.0 (Windows NT 10.0; Win64; x64; DeviceID: {DEVICE_ID}) mihomo/v1.19.32 clash-meta/v1.19.32',
};

/**
 * 1. Управление стабильным Device ID (HWID)
 * Сохраняет и читает уникальный идентификатор в <userData>/device-id.json
 * Mikan требует формат: ^[a-zA-Z0-9=-]{10,64}$ (UUID v4 полностью удовлетворяет этому требованию)
 */
export function getOrCreateDeviceInfo(userDataPath: string): DeviceInfo {
  const filePath = path.join(userDataPath, 'device-id.json');
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.deviceId) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[SubscriptionCore] Error reading device-id.json, regenerating...', err);
  }

  // Генерация стабильного UUID v4
  const newInfo: DeviceInfo = {
    deviceId: crypto.randomUUID(),
    deviceName: os.hostname() || 'Gravity-PC',
    platform: 'Windows',
    createdAt: Date.now(),
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(newInfo, null, 2), 'utf8');
    console.log(`[SubscriptionCore] Generated new stable Device ID (HWID): ${newInfo.deviceId} (${newInfo.deviceName})`);
  } catch (err) {
    console.error('[SubscriptionCore] Failed to save device-id.json:', err);
  }

  return newInfo;
}

/**
 * Генерация строки User-Agent
 */
export function resolveUserAgent(deviceInfo: DeviceInfo, customUserAgent?: string): string {
  if (customUserAgent && customUserAgent.trim()) {
    return customUserAgent.trim();
  }
  return SUBSCRIPTION_CONFIG.DEFAULT_UA_TEMPLATE.replace('{DEVICE_ID}', deviceInfo.deviceId);
}

/**
 * Формирование заголовков запроса к серверу подписки Mikan
 */
export function buildSubscriptionHeaders(deviceInfo: DeviceInfo, customUserAgent?: string): Record<string, string> {
  const ua = resolveUserAgent(deviceInfo, customUserAgent);

  // Определение версии Windows (например, "10.0" или "11.0")
  let osVer = '10.0';
  try {
    osVer = os.release() || '10.0';
  } catch {}

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': '*/*',
    'Accept-Language': 'ru,en;q=0.9',

    // Точные заголовки, которые парсит Mikan в subs/handler.go (lines 400-403):
    // HWID: r.Header.Get("X-Hwid"), OS: r.Header.Get("X-Device-Os"), OSVersion: r.Header.Get("X-Ver-Os")
    // Model: r.Header.Get("X-Device-Model"), App: r.Header.Get("User-Agent")
    [SUBSCRIPTION_CONFIG.HEADER_HWID]: deviceInfo.deviceId,
    [SUBSCRIPTION_CONFIG.HEADER_DEVICE_OS]: 'Windows',
    [SUBSCRIPTION_CONFIG.HEADER_VER_OS]: osVer,
    [SUBSCRIPTION_CONFIG.HEADER_DEVICE_MODEL]: deviceInfo.deviceName,

    // Дополнительные стандартные заголовки
    [SUBSCRIPTION_CONFIG.HEADER_DEVICE_ID]: deviceInfo.deviceId,
    [SUBSCRIPTION_CONFIG.HEADER_DEVICE_NAME]: encodeURIComponent(deviceInfo.deviceName),
  };

  return headers;
}

/**
 * Маскирование чувствительных токенов в URL для безопасного вывода в лог
 */
export function sanitizeUrlForLog(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const searchParams = new URLSearchParams(parsed.search);
    for (const key of Array.from(searchParams.keys())) {
      if (/token|key|secret|pass|auth|sign|hash/i.test(key)) {
        searchParams.set(key, '***');
      }
    }
    parsed.search = searchParams.toString();
    return parsed.toString();
  } catch {
    return urlStr.replace(/([?&](?:token|key|auth|secret)=)[^&]+/gi, '$1***');
  }
}

/**
 * Подготовка целевого URL подписки.
 * Для Mikan автоматически добавляет ?format=clash, если формат не указан явно,
 * чтобы панель сразу отдавала конфигурацию в виде Clash YAML.
 */
export function prepareSubscriptionUrl(urlStr: string, deviceInfo: DeviceInfo): string {
  try {
    const parsed = new URL(urlStr);

    if (SUBSCRIPTION_CONFIG.ENSURE_CLASH_FORMAT && !parsed.searchParams.has('format')) {
      parsed.searchParams.set('format', 'clash');
    }

    if (SUBSCRIPTION_CONFIG.APPEND_DEVICE_ID_QUERY) {
      parsed.searchParams.set('device_id', deviceInfo.deviceId);
    }

    return parsed.toString();
  } catch {
    // Если URL без протокола или некорректен
    if (SUBSCRIPTION_CONFIG.ENSURE_CLASH_FORMAT && !urlStr.includes('format=')) {
      const sep = urlStr.includes('?') ? '&' : '?';
      return `${urlStr}${sep}format=clash`;
    }
    return urlStr;
  }
}

export interface FetchSubscriptionOptions {
  userDataPath: string;
  customUserAgent?: string;
  onProgress?: (progress: SubscriptionProgress) => void;
  onLog?: (type: 'info' | 'warning' | 'error', message: string) => void;
}

/**
 * Запрос подписки с таймаутом 20с, retry и обработкой заголовков Mikan
 */
export async function fetchSubscriptionWithRetry(
  rawUrl: string,
  options: FetchSubscriptionOptions
): Promise<string> {
  const deviceInfo = getOrCreateDeviceInfo(options.userDataPath);
  const targetUrl = prepareSubscriptionUrl(rawUrl, deviceInfo);
  const headers = buildSubscriptionHeaders(deviceInfo, options.customUserAgent);
  const sanitizedUrl = sanitizeUrlForLog(targetUrl);

  const log = (type: 'info' | 'warning' | 'error', msg: string) => {
    if (options.onLog) options.onLog(type, msg);
    console.log(`[SubscriptionCore] [${type.toUpperCase()}] ${msg}`);
  };

  const progress = (phase: SubscriptionProgress['phase'], message: string) => {
    if (options.onProgress) options.onProgress({ phase, message });
  };

  log('info', `Запрос подписки: ${sanitizedUrl}`);
  log('info', `Заголовки: User-Agent="${headers['User-Agent']}", X-Hwid="${deviceInfo.deviceId}", Model="${deviceInfo.deviceName}"`);
  progress('requesting', 'Загрузка подписки…');

  let attempt = 0;
  const maxAttempts = 1 + SUBSCRIPTION_CONFIG.MAX_RETRIES;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      if (attempt > 1) {
        log('warning', `Повторная попытка запроса подписки (${attempt}/${maxAttempts})...`);
        progress('retrying', 'Таймаут, повторная попытка…');
      }

      const { body, resHeaders } = await executeSingleHttpGet(targetUrl, headers, SUBSCRIPTION_CONFIG.TIMEOUT_MS);

      // Проверка специфичных заголовков панели Mikan
      if (resHeaders['x-hwid-active'] === 'true') {
        log('info', 'Сервер Mikan подтвердил успешную привязку устройства (X-Hwid-Active: true)');
      }

      if (resHeaders['x-hwid-not-supported'] === 'true') {
        throw new Error('⛔ Сервер требует ID устройства (X-Hwid). Устройство не распознано.');
      }

      if (resHeaders['x-hwid-max-devices-reached'] === 'true' || resHeaders['x-hwid-limit'] === 'true') {
        throw new Error('⛔ Все места для устройств заняты. Отвяжите неиспользуемое устройство в веб-панели или Telegram-боте.');
      }

      log('info', `Сервер подписки ответил успешно (получено ${(body.length / 1024).toFixed(1)} КБ)`);
      progress('parsing', 'Обработка узлов…');
      return body;
    } catch (err: any) {
      const isTimeout = /ETIMEDOUT|ESOCKETTIMEDOUT|таймаут/i.test(err.message);

      if (isTimeout && attempt < maxAttempts) {
        log('warning', `Таймаут (${SUBSCRIPTION_CONFIG.TIMEOUT_MS / 1000}с) при запросе подписки. Подготовка повторной попытки...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // Диагностика ошибок
      let userFriendlyError = err.message;

      if (err.statusCode === 403 || /device.*(not.*found|limit|unregistered|invalid|block)|не.*распозна/i.test(err.message)) {
        userFriendlyError = 'Сервер не распознал устройство. Проверьте, что ID сохранён, или обновите подписку.';
        log('error', `Ошибка Device ID (HTTP ${err.statusCode || 403}): ${userFriendlyError}`);
      } else if (err.statusCode === 401) {
        userFriendlyError = 'Ошибка авторизации подписки (HTTP 401). Проверьте актуальность ссылки.';
        log('error', userFriendlyError);
      } else if (isTimeout) {
        userFriendlyError = `Превышено время ожидания сервера подписки (${SUBSCRIPTION_CONFIG.TIMEOUT_MS / 1000} сек). Сервер не отвечает.`;
        log('error', userFriendlyError);
      } else {
        log('error', `Ошибка загрузки подписки: ${err.message}`);
      }

      progress('error', userFriendlyError);
      throw new Error(userFriendlyError);
    }
  }

  throw new Error('Не удалось получить ответ от сервера подписки после нескольких попыток');
}

/**
 * Низкоуровневый HTTP/HTTPS GET с обработкой заголовков Mikan, редиректов и таймаута
 */
function executeSingleHttpGet(
  urlStr: string,
  headers: Record<string, string>,
  timeoutMs: number,
  redirectCount = 0
): Promise<{ body: string; resHeaders: http.IncomingHttpHeaders }> {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Слишком много перенаправлений (redirect loop)'));
  }

  return new Promise((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch (e: any) {
      return reject(new Error(`Некорректный URL подписки: ${e.message}`));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(
      urlStr,
      {
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        // Обработка редиректов (301, 302, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, urlStr).toString();
            return resolve(executeSingleHttpGet(redirectUrl, headers, timeoutMs, redirectCount + 1));
          } catch {
            return resolve(executeSingleHttpGet(res.headers.location, headers, timeoutMs, redirectCount + 1));
          }
        }

        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            const error: any = new Error(
              `HTTP ${res.statusCode}${body ? ': ' + body.substring(0, 180) : ''}`
            );
            error.statusCode = res.statusCode;
            error.responseBody = body;
            return reject(error);
          }
          resolve({ body, resHeaders: res.headers });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const err: any = new Error(`Таймаут ожидания ответа (${timeoutMs / 1000}с)`);
      err.isTimeout = true;
      reject(err);
    });

    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

/**
 * Парсинг ответа подписки (Clash YAML, Base64 или URI-список).
 * Включает обнаружение заглушек ошибок панели Mikan (subs/handler.go).
 */
export function parseSubscriptionNodes(rawText: string): any[] {
  const trimmed = rawText.trim();

  // 1. Попытка распарсить как прямой YAML Clash
  try {
    const parsed: any = yaml.load(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.proxies) && parsed.proxies.length > 0) {
        // Проверка на заглушку ошибки Mikan (subs/handler.go line 747: proxies: [{"name": name, "server": "127.0.0.1", "port": 1}])
        if (parsed.proxies.length === 1) {
          const first = parsed.proxies[0];
          const name = first.name || '';
          if (
            name.startsWith('⛔') ||
            name.startsWith('⏸') ||
            (first.server === '127.0.0.1' && first.port === 1)
          ) {
            throw new Error(name);
          }
        }
        return parsed.proxies;
      }
    }
  } catch (e: any) {
    if (e.message && (e.message.startsWith('⛔') || e.message.startsWith('⏸'))) {
      throw e;
    }
  }

  // 2. Попытка Base64-декодирования
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');

    // Проверка на заглушку ошибки Mikan в виде одиночной URI-ссылки 127.0.0.1:1
    if (decoded.includes('127.0.0.1:1') || decoded.includes('⛔') || decoded.includes('⏸')) {
      const match = decoded.match(/(?:#|title=)([^&\r\n]+)/);
      if (match) {
        const decodedMsg = decodeURIComponent(match[1]);
        if (decodedMsg.startsWith('⛔') || decodedMsg.startsWith('⏸')) {
          throw new Error(decodedMsg);
        }
      }
    }

    // Возможно, внутри Base64 находится YAML
    try {
      const parsed: any = yaml.load(decoded);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies) && parsed.proxies.length > 0) {
        return parsed.proxies;
      }
    } catch {}

    // Или список строк URI протоколов
    const lines = decoded.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedNodes = parseUriLines(lines);
    if (parsedNodes.length > 0) {
      return parsedNodes;
    }
  } catch (e: any) {
    if (e.message && (e.message.startsWith('⛔') || e.message.startsWith('⏸'))) {
      throw e;
    }
  }

  // 3. Попытка парсинга сырых строк протоколов (ss://, vmess://, vless://, trojan://)
  const directLines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nodes = parseUriLines(directLines);
  if (nodes.length > 0) {
    return nodes;
  }

  throw new Error('Не удалось распознать формат подписки. Убедитесь, что ссылка ведёт на Clash YAML или Base64 подписку.');
}

function parseUriLines(lines: string[]): any[] {
  const nodes: any[] = [];
  let counter = 1;

  for (const line of lines) {
    try {
      if (line.startsWith('ss://')) {
        const parsed = parseShadowsocks(line, `Node-${counter++}`);
        if (parsed) nodes.push(parsed);
      } else if (line.startsWith('vmess://')) {
        const parsed = parseVmess(line, `Node-${counter++}`);
        if (parsed) nodes.push(parsed);
      } else if (line.startsWith('trojan://')) {
        const parsed = parseTrojan(line, `Node-${counter++}`);
        if (parsed) nodes.push(parsed);
      } else if (line.startsWith('vless://')) {
        const parsed = parseVless(line, `Node-${counter++}`);
        if (parsed) nodes.push(parsed);
      }
    } catch {
      // Пропуск повреждённой строки
    }
  }
  return nodes;
}

function parseShadowsocks(uri: string, fallbackName: string): any {
  const withoutScheme = uri.substring(5);
  const [mainPart, tag] = withoutScheme.split('#');
  const name = tag ? decodeURIComponent(tag) : fallbackName;

  if (mainPart.includes('@')) {
    const [userinfo, serverPart] = mainPart.split('@');
    const [server, port] = serverPart.split(':');
    let cipher = '';
    let password = '';
    if (userinfo.includes(':')) {
      [cipher, password] = userinfo.split(':');
    } else {
      const decoded = Buffer.from(userinfo, 'base64').toString('utf8');
      [cipher, password] = decoded.split(':');
    }
    return { name, type: 'ss', server, port: parseInt(port, 10), cipher, password };
  } else {
    const decoded = Buffer.from(mainPart, 'base64').toString('utf8');
    const [userinfo, serverPart] = decoded.split('@');
    const [cipher, password] = userinfo.split(':');
    const [server, port] = serverPart.split(':');
    return { name, type: 'ss', server, port: parseInt(port, 10), cipher, password };
  }
}

function parseVmess(uri: string, fallbackName: string): any {
  const base64Str = uri.substring(8);
  const jsonStr = Buffer.from(base64Str, 'base64').toString('utf8');
  const obj = JSON.parse(jsonStr);
  return {
    name: obj.ps || fallbackName,
    type: 'vmess',
    server: obj.add,
    port: parseInt(obj.port, 10),
    uuid: obj.id,
    alterId: parseInt(obj.aid || '0', 10),
    cipher: obj.scy || 'auto',
    tls: obj.tls === 'tls',
    network: obj.net || 'tcp',
  };
}

function parseTrojan(uri: string, fallbackName: string): any {
  const url = new URL(uri);
  return {
    name: url.hash ? decodeURIComponent(url.hash.substring(1)) : fallbackName,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port, 10),
    password: decodeURIComponent(url.username),
    sni: url.searchParams.get('sni') || url.hostname,
  };
}

function parseVless(uri: string, fallbackName: string): any {
  const url = new URL(uri);
  return {
    name: url.hash ? decodeURIComponent(url.hash.substring(1)) : fallbackName,
    type: 'vless',
    server: url.hostname,
    port: parseInt(url.port, 10),
    uuid: decodeURIComponent(url.username),
    tls: url.searchParams.get('security') === 'tls' || url.searchParams.get('security') === 'reality',
    flow: url.searchParams.get('flow') || undefined,
    network: url.searchParams.get('type') || 'tcp',
  };
}
