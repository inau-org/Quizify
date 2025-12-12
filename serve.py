#!/usr/bin/env python3
"""
Minimal HTTPS server for local development.
Usage: python serve.py --cert cert.pem --key key.pem --port 8000
"""
import http.server
import ssl
import argparse
import sys
import os
import shutil
import threading

def build_site(source_dir, output_dir, app_name):
    """Copy site files to output directory with URL prefix."""
    output_path = os.path.join(output_dir, app_name)
    
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    
    if os.path.exists(source_dir):
        shutil.copytree(source_dir, output_path, dirs_exist_ok=True)
        print(f"Built site: {source_dir} -> {output_path}")
    else:
        print(f"Warning: Source directory not found: {source_dir}")


def main():
    parser = argparse.ArgumentParser(description='Simple HTTPS server')
    parser.add_argument('--cert', default='cert.pem', help='Certificate file (default: cert.pem)')
    parser.add_argument('--key', default='key.pem', help='Key file (default: key.pem)')
    parser.add_argument('--port', type=int, default=8000, help='Port (default: 8000)')
    parser.add_argument('--host', default='localhost', help='Host (default: localhost)')
    parser.add_argument('--build', action='store_true', help='Build site before serving')
    parser.add_argument('--source', default='./site', help='Source directory for build (default: site)')
    parser.add_argument('--output', default='./bin', help='Output directory for build (default: bin)')
    parser.add_argument('--app-name', default='Quizify', help='App URL path name (default: Quizify)')
    
    args = parser.parse_args()
    
    # Build site if requested
    if args.build:
        build_site(args.source, args.output, args.app_name)
    

    # Resolve certificate paths to absolute paths before changing directory
    cert_path = os.path.abspath(args.cert)
    key_path = os.path.abspath(args.key)
    output_abs = os.path.abspath(args.output)
    source_abs = os.path.abspath(args.source)

    # Check certificate files exist
    if not os.path.exists(cert_path):
        print(f"Error: Certificate not found: {cert_path}")
        print(f"\nGenerate with:")
        print(f"  python -m trustme")
        sys.exit(1)
    
    if not os.path.exists(key_path):
        print(f"Error: Key file not found: {key_path}")
        sys.exit(1)
    
    # Change to specified directory
    if args.output != '.':
        os.chdir(args.output)
    

    def start_server():
        """Create and return a new server instance."""
        httpd = http.server.HTTPServer((args.host, args.port), http.server.SimpleHTTPRequestHandler)
        return httpd


    def stop_server(server):
        """stop and return a new server instance."""
        print("\nStopping server...")
        server.shutdown()

    # Create server
    server = start_server()
    
    # Wrap with SSL using SSLContext
    #try:
    #    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    #    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    #    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    #    print(f"HTTPS Server running at: https://{args.host}:{args.port}/Quizify/")
    #except Exception as e:
    #    print(f"SSL error: {e}")
    #    sys.exit(1)
    
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    print(f"HTTP Server running at: http://{args.host}:{args.port}/Quizify/")
    print(f"Serving directory: {os.getcwd()}")
    print(f"Press Ctrl+C to stop\n")
    print(f"\nCommands (enter to confirm):")
    print(f"  r - Rebuild and reload")
    print(f"  q - Quit\n")


    try:
        while True:
            cmd = input().strip().lower()
            
            if cmd == 'r':
                print("\nReloading...")
                stop_server(server)
                server_thread.join()
                
                # Go back to original directory for build
                os.chdir(os.path.dirname(os.path.abspath(__file__)))
                build_site(source_abs, output_abs, args.app_name)
                os.chdir(output_abs)
                
                # Restart server
                server = start_server()
                server_thread = threading.Thread(target=server.serve_forever, daemon=True)
                server_thread.start()

                print(f"Server reloaded at: http://{args.host}:{args.port}/Quizify/\n")
                
            elif cmd == 'q':
                stop_server(server)
                break
                
    except KeyboardInterrupt:
        print("\nServer stopped")
        stop_server(server)
        sys.exit(0)

if __name__ == '__main__':
    main()