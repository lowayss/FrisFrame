#!/usr/bin/env python3
import subprocess
import json
import sys
import time

def run_smoke_test():
    print("Running MCP Server stdio smoke test...")
    
    # Spawn mcp_server.py as a subprocess
    process = subprocess.Popen(
        [sys.executable, "mcp_server.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        # 1. Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "SmokeTestClient", "version": "1.0"}
            }
        }
        process.stdin.write(json.dumps(init_request) + "\n")
        process.stdin.flush()
        
        # Read response
        init_response_str = process.stdout.readline().strip()
        init_response = json.loads(init_response_str)
        assert init_response.get("id") == 1
        assert "capabilities" in init_response.get("result", {})
        print("✓ Initialize request/response passed.")

        # 2. Send tools/list request
        list_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list"
        }
        process.stdin.write(json.dumps(list_request) + "\n")
        process.stdin.flush()
        
        # Read response
        list_response_str = process.stdout.readline().strip()
        list_response = json.loads(list_response_str)
        assert list_response.get("id") == 2
        tools = list_response.get("result", {}).get("tools", [])
        tool_names = [t["name"] for t in tools]
        
        # Verify required tool names exist
        expected_tools = ["list_projects", "get_project", "create_project", "save_project", "create_cut", "update_camera_blocking", "add_actor_to_cut"]
        for expected in expected_tools:
            assert expected in tool_names, f"Missing tool: {expected}"
            
        print("✓ Tools list request/response passed.")
        print(f"✓ Found tools: {', '.join(tool_names)}")
        print("MCP Server smoke test successfully passed!")
        
    finally:
        process.terminate()
        process.wait()

if __name__ == "__main__":
    run_smoke_test()
