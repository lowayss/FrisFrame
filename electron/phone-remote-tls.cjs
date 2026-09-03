"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

function sanitizeHosts(hosts = []) {
  return [...new Set(["127.0.0.1", "localhost", ...hosts].map((value) => String(value || "").trim()).filter(Boolean))];
}

function extensionConfig(hosts = []) {
  const cleaned = sanitizeHosts(hosts);
  let dns = 1;
  let ip = 1;
  const lines = [
    "[v3_req]",
    "basicConstraints=CA:FALSE",
    "keyUsage=digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    "subjectAltName=@alt_names",
    "[alt_names]",
  ];
  for (const host of cleaned) {
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) lines.push(`IP.${ip++}=${host}`);
    else lines.push(`DNS.${dns++}=${host}`);
  }
  return `${lines.join("\n")}\n`;
}

function fingerprint(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").match(/.{1,2}/g).join(":").toUpperCase();
}

function ensureTlsMaterial({ directory, hosts = [], run = execFileSync } = {}) {
  if (!directory) throw new Error("phone_remote_tls_directory_required");
  fs.mkdirSync(directory, { recursive:true, mode:0o700 });
  const caKey = path.join(directory, "frisframe-phone-ca.key.pem");
  const caCert = path.join(directory, "frisframe-phone-ca.crt.pem");
  const serverKey = path.join(directory, "frisframe-phone-server.key.pem");
  const serverCsr = path.join(directory, "frisframe-phone-server.csr.pem");
  const serverCert = path.join(directory, "frisframe-phone-server.crt.pem");
  const extFile = path.join(directory, "frisframe-phone-server.ext.cnf");

  if (!fs.existsSync(caKey) || !fs.existsSync(caCert)) {
    run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "3650", "-subj", "/CN=FrisFrame Phone Camera Local CA", "-keyout", caKey, "-out", caCert], { stdio:"ignore" });
  }
  fs.writeFileSync(extFile, extensionConfig(hosts), "utf8");
  run("openssl", ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=FrisFrame Phone Camera", "-keyout", serverKey, "-out", serverCsr], { stdio:"ignore" });
  run("openssl", ["x509", "-req", "-sha256", "-days", "825", "-in", serverCsr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", serverCert, "-extfile", extFile, "-extensions", "v3_req"], { stdio:"ignore" });
  try { fs.chmodSync(caKey, 0o600); fs.chmodSync(serverKey, 0o600); } catch { /* Windows permissions are ACL based. */ }
  const ca = fs.readFileSync(caCert);
  return {
    available:true,
    key:fs.readFileSync(serverKey),
    cert:fs.readFileSync(serverCert),
    ca,
    caPath:caCert,
    fingerprintSha256:fingerprint(ca),
    hosts:sanitizeHosts(hosts),
  };
}

function tryEnsureTlsMaterial(options = {}) {
  try { return ensureTlsMaterial(options); }
  catch (error) { return { available:false, error:String(error?.message || error), hosts:sanitizeHosts(options.hosts) }; }
}

module.exports = { sanitizeHosts, extensionConfig, fingerprint, ensureTlsMaterial, tryEnsureTlsMaterial };
