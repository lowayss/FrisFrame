from pathlib import Path

SERVER_PATH = Path("server.py")
TEST_PATH = Path("tests/test_server_security.py")
CONTRACT_PATH = Path("tests/electron-contract.test.cjs")
WORKFLOW_PATH = Path(".github/workflows/tmp-windows-port-fallback-fix.yml")
SELF_PATH = Path(".github/tmp_windows_port_patch.py")

server_text = SERVER_PATH.read_text(encoding="utf-8")
old_server = '''def bind_http_server(host, requested_port, handler, allow_port_fallback=False):
    try:
        return ThreadingHTTPServer((host, requested_port), handler), False
    except OSError as error:
        if (
            not allow_port_fallback
            or int(requested_port or 0) <= 0
            or error.errno != errno.EADDRINUSE
        ):
            raise
        return ThreadingHTTPServer((host, 0), handler), True
'''
new_server = '''def port_bind_unavailable(error):
    error_number = getattr(error, "errno", None)
    windows_error = getattr(error, "winerror", None)
    return (
        error_number == errno.EADDRINUSE
        or windows_error in (10013, 10048)
        or (os.name == "nt" and error_number in (10013, 10048))
    )


def bind_http_server(host, requested_port, handler, allow_port_fallback=False):
    try:
        return ThreadingHTTPServer((host, requested_port), handler), False
    except OSError as error:
        if (
            not allow_port_fallback
            or int(requested_port or 0) <= 0
            or not port_bind_unavailable(error)
        ):
            raise
        return ThreadingHTTPServer((host, 0), handler), True
'''
if server_text.count(old_server) != 1:
    raise SystemExit("server bind helper did not match exactly")
SERVER_PATH.write_text(server_text.replace(old_server, new_server), encoding="utf-8")

test_text = TEST_PATH.read_text(encoding="utf-8")
test_marker = "    def test_local_http_server_falls_back_only_when_requested_port_is_busy(self):\n"
test_addition = '''    def test_windows_bind_errors_are_classified_as_unavailable_ports(self):
        windows_access = OSError("Windows socket access denied")
        windows_access.errno = 10013
        windows_access.winerror = 10013
        windows_in_use = OSError("Windows address in use")
        windows_in_use.errno = 10048
        windows_in_use.winerror = 10048
        unrelated = OSError("unrelated")
        unrelated.errno = 22
        self.assertTrue(server.port_bind_unavailable(windows_access))
        self.assertTrue(server.port_bind_unavailable(windows_in_use))
        self.assertFalse(server.port_bind_unavailable(unrelated))

'''
if test_text.count(test_marker) != 1:
    raise SystemExit("server fallback test marker did not match exactly")
TEST_PATH.write_text(test_text.replace(test_marker, test_addition + test_marker), encoding="utf-8")

contract_text = CONTRACT_PATH.read_text(encoding="utf-8")
contract_marker = "assert.match(server, /errno\\.EADDRINUSE/);\n"
contract_addition = 'assert.match(server, /10013, 10048/, "Windows occupied/reserved persisted ports must use the same explicit fallback path");\n'
if contract_text.count(contract_marker) != 1:
    raise SystemExit("electron contract fallback marker did not match exactly")
CONTRACT_PATH.write_text(contract_text.replace(contract_marker, contract_marker + contract_addition), encoding="utf-8")

WORKFLOW_PATH.unlink(missing_ok=True)
SELF_PATH.unlink(missing_ok=True)
