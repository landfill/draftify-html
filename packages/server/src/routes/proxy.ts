import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { IncomingMessage } from "node:http";
import type { Request, Response } from "express";
import { injectSdkTag } from "../inject.js";
import { sendError } from "../errors.js";
import {
  getAllowlist,
  isAllowlisted,
  isBlockedAddress,
  isLoopbackAllowed,
  createGuardedLookup,
} from "../proxy/ssrfGuard.js";

/**
 * 리버스 프록시 (경로 B — technical-spec §3.3, 킥오프 s2 §2).
 *
 * transport는 Node 내장 http/https + `lookup: guardedLookup`. 프록시 라이브러리를 쓰지
 * 않는 이유: SSRF IP 고정을 라이브러리 후킹으로 넣는 것보다 lookup 훅이 단순하다
 * (킥오프 s2 §9 — undici 미설치로 global fetch는 IP 고정 불가).
 *
 * 매 요청 재검증(§4.1 timing ②): 프로토콜 + allowlist를 동기로 재확인(등록 후 좁아졌을 수
 * 있음), IP 검증·고정은 guardedLookup이 연결 시점에 수행(DNS 변경·rebinding 반영).
 */

/** 업스트림/클라이언트 양방향에서 제거할 hop-by-hop 및 재계산 대상 헤더. */
const STRIP_REQUEST = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length", "accept-encoding",
]);
const STRIP_RESPONSE = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "content-length",
  // SDK 동작을 막는 헤더 제거 (§3.3)
  "content-security-policy", "content-security-policy-report-only", "x-frame-options",
]);

function buildUpstreamHeaders(req: Request, targetHost: string): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (STRIP_REQUEST.has(k.toLowerCase())) continue;
    headers[k] = v as string | string[];
  }
  headers["host"] = targetHost;
  headers["accept-encoding"] = "identity"; // 압축 해제·재압축 로직 제거 (사내망 전제)
  return headers;
}

function copyResponseHeaders(req: Request, res: Response, upstream: http.IncomingHttpHeaders): void {
  const isProxyHttp = req.protocol === "http" || req.protocol === "ws"; // req.protocol fallback
  for (const [k, v] of Object.entries(upstream)) {
    if (v === undefined) continue;
    if (STRIP_RESPONSE.has(k.toLowerCase())) continue;

    if (k.toLowerCase() === "set-cookie") {
      let cookies = Array.isArray(v) ? v : [String(v)];
      cookies = cookies.map((c) => {
        let modified = c.replace(/;\s*Domain=[^;]+/gi, "");
        if (isProxyHttp || !req.secure) {
          modified = modified.replace(/;\s*Secure/gi, "");
        }
        return modified;
      });
      res.setHeader(k, cookies);
      continue;
    }

    res.setHeader(k, v);
  }
}

/** HTML 본문 내 등록 오리진의 절대 URL을 프록시 오리진(프로토콜 상대)으로 치환. */
function rewriteAbsoluteUrls(html: string, originHost: string, proxyHost: string | undefined): string {
  if (!proxyHost) return html;
  const esc = originHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`https?://${esc}`, "g"), `//${proxyHost}`);
}

/** 서브도메인 요청을 등록 오리진으로 프록시한다. serveMockup이 proxy 프로젝트일 때 위임. */
export function proxyMockup(req: Request, res: Response, originUrl: string, projectId: string): void {
  let originBase: URL;
  try {
    originBase = new URL(originUrl);
  } catch {
    sendError(res, "INTERNAL", "오리진 URL이 손상되었습니다.");
    return;
  }

  // 매 요청 재검증 (§4.1 timing ②)
  if (originBase.protocol !== "http:" && originBase.protocol !== "https:") {
    sendError(res, "BAD_GATEWAY", "지원하지 않는 오리진 프로토콜입니다.");
    return;
  }
  if (!isAllowlisted(originBase.hostname, getAllowlist())) {
    sendError(res, "BAD_GATEWAY", "오리진이 더 이상 allowlist에 없습니다.");
    return;
  }
  // 오리진이 IP 리터럴이면 Node가 lookup 훅을 호출하지 않아 IP 고정 가드가 우회된다.
  // 리터럴은 여기서 직접 검증한다 (hostname은 IPv6 대괄호를 뺀 형태).
  const literal = originBase.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && isBlockedAddress(literal, { allowLoopback: isLoopbackAllowed() })) {
    sendError(res, "BAD_GATEWAY", "오리진에 연결할 수 없습니다 (차단된 IP).");
    return;
  }

  const target = new URL(req.url, originBase.origin);
  const mod = target.protocol === "https:" ? https : http;
  const lookup = createGuardedLookup(undefined, { allowLoopback: isLoopbackAllowed() });

  const upstream = mod.request(
    target,
    { method: req.method, headers: buildUpstreamHeaders(req, originBase.host), lookup },
    (up) => handleUpstream(req, res, up, originBase, projectId),
  );

  upstream.on("error", () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    // guardedLookup의 ENOTFOUND(차단) 포함 — 오리진 도달 실패
    sendError(res, "BAD_GATEWAY", "오리진에 연결할 수 없습니다 (차단되었거나 도달 불가).");
  });

  if (req.method === "GET" || req.method === "HEAD") {
    upstream.end();
  } else {
    req.pipe(upstream);
  }
}

function handleUpstream(
  req: Request,
  res: Response,
  up: IncomingMessage,
  originBase: URL,
  projectId: string,
): void {
  const status = up.statusCode ?? 502;

  // 리다이렉트 manual 처리 (§3.3): 오리진 내부면 프록시 경로로 재작성, 밖이면 502
  if (status >= 300 && status < 400 && up.headers.location) {
    let loc: URL;
    try {
      loc = new URL(up.headers.location, originBase);
    } catch {
      up.resume();
      sendError(res, "BAD_GATEWAY", "오리진 리다이렉트 Location이 손상되었습니다.");
      return;
    }
    up.resume(); // 본문 드레인
    if (loc.origin !== originBase.origin) {
      sendError(res, "BAD_GATEWAY", "오리진 밖으로의 리다이렉트는 지원하지 않습니다.");
      return;
    }
    copyResponseHeaders(req, res, up.headers);
    res.setHeader("location", loc.pathname + loc.search + loc.hash); // 오리진 제거 → 프록시 유지
    res.status(status).end();
    return;
  }

  copyResponseHeaders(req, res, up.headers);
  const ctype = String(up.headers["content-type"] ?? "");

  // text/html만 버퍼링해 가공, 그 외는 스트림 통과 (§3.3)
  if (ctype.includes("text/html")) {
    const chunks: Buffer[] = [];
    up.on("data", (c: Buffer) => chunks.push(c));
    up.on("end", () => {
      const html = Buffer.concat(chunks).toString("utf8");
      const rewritten = injectSdkTag(rewriteAbsoluteUrls(html, originBase.host, req.headers.host), projectId);
      const body = Buffer.from(rewritten, "utf8");
      res.setHeader("content-length", String(body.length));
      res.status(status).end(body);
    });
    up.on("error", () => {
      if (!res.headersSent) sendError(res, "BAD_GATEWAY", "오리진 응답 처리 오류");
    });
    return;
  }

  res.status(status);
  up.pipe(res);
}
