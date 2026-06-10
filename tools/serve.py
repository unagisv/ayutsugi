# 開発用静的サーバー（web/ を配信・キャッシュ無効）
# 使い方: python tools/serve.py [port]
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8350
    handler = functools.partial(NoCacheHandler, directory='web')
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'serving web/ at http://localhost:{port}/ (no-cache)')
        httpd.serve_forever()
