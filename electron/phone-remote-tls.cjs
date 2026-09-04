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

function localCaConfig() {
  return [
    "[req]",
    "distinguished_name=dn",
    "x509_extensions=v3_ca",
    "prompt=no",
    "[dn]",
    "CN=FrisFrame Phone Camera Local CA",
    "[v3_ca]",
    "basicConstraints=critical,CA:TRUE",
    "keyUsage=critical,keyCertSign,cRLSign",
    "subjectKeyIdentifier=hash",
    "authorityKeyIdentifier=keyid:always,issuer",
    "",
  ].join("\n");
}

function pemCertificateToDer(buffer) {
  const certificate = new crypto.X509Certificate(buffer);
  return Buffer.from(certificate.raw);
}

function isCertificateAuthority(buffer) {
  try { return new crypto.X509Certificate(buffer).ca === true; }
  catch { return false; }
}

function fingerprint(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").match(/.{1,2}/g).join(":").toUpperCase();
}

function ensureTlsMaterial({ directory, hosts = [], run = execFileSync } = {}) {
  if (!directory) throw new Error("phone_remote_tls_directory_required");
  fs.mkdirSync(directory, { recursive:true, mode:0o700 });
  const caKey = path.join(directory, "frisframe-phone-ca.key.pem");
  const caCert = path.join(directory, "frisframe-phone-ca.crt.pem");
  const caConfigFile = path.join(directory, "frisframe-phone-ca.ext.cnf");
  const serverKey = path.join(directory, "frisframe-phone-server.key.pem");
  const serverCsr = path.join(directory, "frisframe-phone-server.csr.pem");
  const serverCert = path.join(directory, "frisframe-phone-server.crt.pem");
  const extFile = path.join(directory, "frisframe-phone-server.ext.cnf");

  let caPem = fs.existsSync(caCert) ? fs.readFileSync(caCert) : null;
  if (!fs.existsSync(caKey) || !caPem || !isCertificateAuthority(caPem)) {
    fs.writeFileSync(caConfigFile, localCaConfig(), "utf8");
    try { fs.rmSync(caKey, { force:true }); fs.rmSync(caCert, { force:true }); } catch { /* best effort */ }
    run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "3650", "-config", caConfigFile, "-keyout", caKey, "-out", caCert], { stdio:"ignore" });
    caPem = fs.readFileSync(caCert);
    if (!isCertificateAuthority(caPem)) throw new Error("phone_remote_tls_ca_certificate_invalid");
  }
  fs.writeFileSync(extFile, extensionConfig(hosts), "utf8");
  run("openssl", ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=FrisFrame Phone Camera", "-keyout", serverKey, "-out", serverCsr], { stdio:"ignore" });
  run("openssl", ["x509", "-req", "-sha256", "-days", "825", "-in", serverCsr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", serverCert, "-extfile", extFile, "-extensions", "v3_req"], { stdio:"ignore" });
  try { fs.chmodSync(caKey, 0o600); fs.chmodSync(serverKey, 0o600); } catch { /* Windows permissions are ACL based. */ }
  const ca = pemCertificateToDer(caPem);
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

module.exports = { sanitizeHosts, extensionConfig, localCaConfig, pemCertificateToDer, isCertificateAuthority, fingerprint, ensureTlsMaterial, tryEnsureTlsMaterial };
