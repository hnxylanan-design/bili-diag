/* BILI-DIAG v2.0.0 | 2026-11-17
 * Shadowrocket request/response diagnostic. No network calls or storage.
 * Logs endpoint paths and bounded structure only; never logs queries, headers,
 * cookies, titles, URLs from the body, user IDs, or complete payloads.
 * A missing clue is NOT evidence that an item is not an advertisement.
 * Always completes with $done({}); binary responses are never re-encoded.
 */
(function () {
  "use strict";
  var TAG = "[BILI-DIAG-V2]", lines = 0, MAX_LINES = 72;
  function log(s) {
    if (lines < MAX_LINES) { console.log(TAG + " " + s); lines++; }
  }
  function key(k) { return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k) ? k : "<key>"; }
  function keys(o) { return Object.keys(o).slice(0, 18).map(key).join(","); }
  function header(h, name) {
    var ks = Object.keys(h || {});
    for (var i = 0; i < ks.length; i++) {
      if (ks[i].toLowerCase() === name) return String(h[ks[i]]);
    }
    return "";
  }
  function mime(h) {
    var s = header(h, "content-type").split(";")[0].toLowerCase().trim();
    return /^[a-z0-9.+_-]+\/[a-z0-9.+_-]+$/.test(s) ? s : "unknown";
  }
  function bytes(body) {
    if (typeof ArrayBuffer !== "undefined") {
      if (Object.prototype.toString.call(body) === "[object ArrayBuffer]") return new Uint8Array(body);
      if (ArrayBuffer.isView && ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }
    if (Array.isArray(body)) {
      for (var i = 0; i < body.length; i++) {
        if (typeof body[i] !== "number" || body[i] < 0 || body[i] > 255 || body[i] % 1) return null;
      }
      return new Uint8Array(body);
    }
    return null;
  }
  // Strict UTF-8, with no dependency on TextDecoder in the phone's JS runtime.
  function utf8(b) {
    var out = [], i = 0, a, n, cp, min, c;
    while (i < b.length) {
      a = b[i++];
      if (a < 128) { out.push(String.fromCharCode(a)); continue; }
      if (a >= 194 && a <= 223) { n = 1; cp = a & 31; min = 128; }
      else if (a >= 224 && a <= 239) { n = 2; cp = a & 15; min = 2048; }
      else if (a >= 240 && a <= 244) { n = 3; cp = a & 7; min = 65536; }
      else throw new Error("utf8");
      if (i + n > b.length) throw new Error("utf8");
      while (n--) { c = b[i++]; if ((c & 192) !== 128) throw new Error("utf8"); cp = cp * 64 + (c & 63); }
      if (cp < min || cp > 1114111 || (cp >= 55296 && cp <= 57343)) throw new Error("utf8");
      if (cp <= 65535) out.push(String.fromCharCode(cp));
      else { cp -= 65536; out.push(String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023))); }
    }
    return out.join("");
  }
  var known = /^(av|ad|ad_av|ad_inline_av|ad_inline_3d|ad_web|ad_web_s|ad_player|ad_game|ad_live|cm|banner|picture|game|live|article|vertical_av|small_cover_v2|large_cover_v9)$/;
  var clueKeys = /^(ad_info|adInfo|business_info|businessInfo|cm_mark|cmMark|ad_av|ad_tag|adTag|commercial|commercial_info|commercialInfo)$/;
  function enumValue(v) {
    if (typeof v === "string") return known.test(v) ? v : "<other>";
    if (typeof v === "number" && v >= 0 && v < 1000 && v % 1 === 0) return String(v);
    return "<other>";
  }
  function itemClues(item) {
    var found = [], types = [], visits = 0;
    function walk(o, path, d) {
      if (!o || typeof o !== "object" || d > 5 || ++visits > 120) return;
      if (Array.isArray(o)) {
        for (var j = 0; j < Math.min(o.length, 6); j++) walk(o[j], path + "[" + j + "]", d + 1);
        return;
      }
      Object.keys(o).slice(0, 60).forEach(function (k) {
        var p = path ? path + "." + key(k) : key(k), v = o[k];
        if (clueKeys.test(k)) found.push(p + ":" + (v === null ? "null" : typeof v));
        if (/^(card_goto|goto|card_type|cardType|type)$/.test(k) && v !== null && typeof v !== "object") types.push(p + "=" + enumValue(v));
        if (v && typeof v === "object") walk(v, p, d + 1);
      });
    }
    walk(item, "", 0);
    return "types=" + (types.slice(0, 8).join("|") || "none_observed") + " clue_fields=" + (found.slice(0, 12).join("|") || "none_observed") + " verdict=undetermined";
  }
  function inspectJson(root) {
    var arrays = [], visits = 0, truncated = false;
    function walk(o, path, d) {
      if (!o || typeof o !== "object") return;
      if (d > 8 || ++visits > 6000) { truncated = true; return; }
      if (Array.isArray(o)) {
        if (o.some(function (x) { return x && typeof x === "object" && !Array.isArray(x); })) arrays.push({path: path, arr: o});
        if (o.length > 60) truncated = true;
        for (var j = 0; j < Math.min(o.length, 60); j++) walk(o[j], path + "[" + j + "]", d + 1);
      } else Object.keys(o).slice(0, 80).forEach(function (k) { walk(o[k], path + "." + key(k), d + 1); });
    }
    log("JSON root=" + (Array.isArray(root) ? "array" : typeof root) + " keys=" + (root && typeof root === "object" ? keys(root) : "none"));
    walk(root, "$", 0);
    // Relevant names first; retain other arrays rather than guessing by size.
    arrays.sort(function (a, b) {
      var re = /\.(items|list|cards|relates|story|feed|archives|recommend)(\[|\.|$)/i;
      return Number(re.test(b.path)) - Number(re.test(a.path));
    });
    log("JSON arrays_found=" + arrays.length + " scan=" + (truncated ? "bounded" : "within_limits") + " classification=not_attempted");
    arrays.slice(0, 12).forEach(function (a) {
      log("LIST path=" + a.path + " count=" + a.arr.length + " sample_max=20");
      a.arr.slice(0, 20).forEach(function (it, i) {
        if (it && typeof it === "object" && !Array.isArray(it)) log("ITEM list=" + a.path + " index=" + i + " keys=" + keys(it) + " " + itemClues(it));
      });
    });
    if (arrays.length > 12 || lines >= MAX_LINES) truncated = true;
    // Reserve a final line even when samples exhaust the output budget.
    if (lines >= MAX_LINES) lines = MAX_LINES - 1;
    log("JSON_END output=" + (truncated ? "bounded" : "within_limits") + " missing_clues_do_not_prove_no_ads=true");
  }
  // Schema-free protobuf inspection: field numbers, wire types and lengths only.
  // This does NOT decode video/ad semantics or print numeric field values.
  function inspectProto(b, label) {
    var counts = {}, hints = {}, budget = 5000;
    function readVar(a, p, end, small) {
      var v = 0, mul = 1, count = 0, x;
      do {
        if (p >= end || count++ >= 10) throw new Error("varint");
        x = a[p++]; if (small) { v += (x & 127) * mul; if (v > 4294967295) throw new Error("range"); mul *= 128; }
      } while (x & 128);
      return {n:v, p:p};
    }
    function walk(start, end, depth, path) {
      var p = start, fields = [], t, tag, field, wire, r, len, valueStart;
      while (p < end) {
        if (--budget < 0) return false;
        t = readVar(b, p, end, true); p = t.p; tag = t.n; field = Math.floor(tag / 8); wire = tag & 7;
        if (!field || field > 536870911) return false;
        valueStart = p; len = 0;
        if (wire === 0) { r = readVar(b, p, end, false); p = r.p; }
        else if (wire === 1) p += 8;
        else if (wire === 5) p += 4;
        else if (wire === 2) { r = readVar(b, p, end, true); len = r.n; valueStart = r.p; p = r.p + len; }
        else return false;
        if (p > end) return false;
        fields.push({field:field,wire:wire,start:valueStart,end:p,len:len});
      }
      fields.forEach(function (f) {
        var k = path + f.field + ":w" + f.wire;
        counts[k] = (counts[k] || 0) + 1;
        if (f.wire === 2 && f.len > 0) {
          if (f.len < 40) {
            try { var s = utf8(b.subarray(f.start, f.end)); if (known.test(s) || /^(广告|推广|创作推广|了解更多)$/.test(s)) hints[s] = true; } catch (_) {}
          }
          if (depth < 3 && f.len < 262144) {
            try { walk(f.start, f.end, depth + 1, path + f.field + "."); } catch (_) {}
          }
        }
      });
      return true;
    }
    var valid = false;
    try { valid = walk(0, b.length, 0, ""); } catch (_) {}
    log(label + " wire_parse=" + (valid ? "plausible" : "unconfirmed") + " field_shapes=" + Object.keys(counts).slice(0, 28).map(function(k){return k + "x" + counts[k];}).join(",") + " literal_hints=" + (Object.keys(hints).join("|") || "none_observed") + " budget=" + (budget < 0 ? "limited" : "within_limits") + " coverage=structural_only verdict=undetermined");
  }
  function inspectBinary(b, ct, path) {
    if (b.length >= 2 && b[0] === 31 && b[1] === 139) { log("BINARY gzip_payload=true decoding=not_attempted verdict=undetermined"); return; }
    if (/grpc/.test(ct)) {
      var p = 0, frames = 0, len, flag;
      while (p + 5 <= b.length && frames < 8) {
        flag = b[p]; len = b[p+1] * 16777216 + b[p+2] * 65536 + b[p+3] * 256 + b[p+4];
        if ((flag !== 0 && flag !== 1 && flag !== 128) || p + 5 + len > b.length) break;
        frames++; log("GRPC frame=" + frames + " flags=" + flag + " payload_bytes=" + len);
        if (flag === 0) inspectProto(b.subarray(p+5,p+5+len), "PROTO");
        else log("GRPC frame_decoding=" + (flag === 1 ? "compressed_not_decoded" : "trailer_not_logged") + " verdict=undetermined");
        p += 5 + len;
      }
      if (!frames || p !== b.length) log("GRPC framing=incomplete_or_runtime_unframed remaining_bytes=" + (b.length - p) + " verdict=undetermined");
      if (!frames) inspectProto(b, "PROTO_UNFRAMED_CANDIDATE");
    } else if (/protobuf|octet-stream/.test(ct) || /\/bilibili\./.test(path)) inspectProto(b, "PROTO_CANDIDATE");
    else log("BINARY format=unknown decoding=not_attempted verdict=undetermined");
  }
  try {
    var req = typeof $request === "undefined" ? {} : $request;
    var match = /^https?:\/\/([^\/?#]+)([^?#]*)/.exec(String(req.url || ""));
    var host = match ? match[1].toLowerCase() : "unknown", path = match ? (match[2] || "/") : "/";
    // Defense in depth if a user accidentally broadens the module expression.
    if (!/^(app\.bilibili\.com|api\.bilibili\.com|grpc\.biliapi\.net|api\.biliapi\.net|grpc\.bilibili\.com)$/.test(host) || !/^\/(x\/|pgc\/|bilibili\.)/.test(path)) return;
    path = path.split("/").map(function(s){return /^[0-9]{5,}$/.test(s) || s.length > 90 ? "<segment>" : s;}).join("/");
    var isResponse = typeof $response !== "undefined";
    log("v=2.0.0 phase=" + (isResponse ? "response" : "request") + " host=" + host + " path=" + path);
    if (!isResponse) { log("REQUEST observed=true body_not_read=true"); return; }
    var res = $response || {}, h = res.headers || {}, ct = mime(h), b = bytes(res.body), text = typeof res.body === "string" ? res.body : null;
    var status = Number(res.statusCode || res.status), safeStatus = status >= 100 && status <= 599 ? status : "unknown";
    log("RESPONSE status=" + safeStatus + " mime=" + ct + " body_kind=" + (b ? "bytes" : text !== null ? "string" : "unavailable") + " length=" + (b ? b.length : text !== null ? text.length : 0));
    if (b && b.length > 4194304 || text !== null && text.length > 4194304) { log("BODY skipped=over_4MiB verdict=undetermined"); return; }
    if (b && b.length && (/json/.test(ct) || b[0] === 123 || b[0] === 91 || b[0] === 32 || b[0] === 239)) {
      try { text = utf8(b).replace(/^\uFEFF/, ""); } catch (_) { log("TEXT utf8_decode=failed"); }
    }
    if (text !== null && (/json/.test(ct) || /^\s*[\[{]/.test(text))) {
      try { var root = JSON.parse(text); inspectJson(root); } catch (_) { log("JSON parse=failed details_not_logged=true verdict=undetermined"); }
    } else if (b) inspectBinary(b, ct, path);
    else if (text !== null) log("BODY non_json_string=true binary_bytes_unavailable=true verdict=undetermined");
    else log("BODY unavailable=true verdict=undetermined");
  } catch (_) {
    // Do not print exception messages: a JSON parser can include payload text.
    log("ERROR diagnostics_failed details_not_logged=true verdict=undetermined");
  } finally {
    $done({});
  }
})();
