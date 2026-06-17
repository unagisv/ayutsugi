"""
スプライト加工スクリプト
1. チェッカーパターン背景をフラッドフィルで透過化
2. 余白をトリミング（キャラ部分だけ切り出し）
3. 128×128にリサイズ（高品質バイキュービック）
"""
import sys
from pathlib import Path
from collections import deque
from PIL import Image

RAW_DIR = Path(__file__).parent.parent / "web" / "assets" / "sprites" / "raw"
OUT_DIR = Path(__file__).parent.parent / "web" / "assets" / "sprites"

FILES = [
    "male_child", "male_student", "male_youth", "male_prime", "male_elder",
    "female_child", "female_student", "female_youth", "female_prime", "female_elder",
]

TARGET_SIZE = 128
GRAY_TOLERANCE = 18  # R≈G≈Bの許容差（色味のある背景にも対応）
BG_RANGE = (140, 255)  # 背景グレーの輝度範囲（暗めのチェッカーにも対応）

DIRS_8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]


def is_bg_candidate(r, g, b):
    """チェッカー背景のグレーピクセルかどうか判定"""
    if abs(r - g) > GRAY_TOLERANCE or abs(g - b) > GRAY_TOLERANCE or abs(r - b) > GRAY_TOLERANCE:
        return False
    avg = (r + g + b) // 3
    return BG_RANGE[0] <= avg <= BG_RANGE[1]


def flood_fill_remove_bg(img):
    """全辺ピクセルから8方向フラッドフィルして背景を透過化"""
    pixels = img.load()
    w, h = img.size
    visited = [[False]*h for _ in range(w)]
    queue = deque()

    # 全辺ピクセルをシードにする
    for x in range(w):
        for y in [0, h-1]:
            r, g, b, a = pixels[x, y]
            if is_bg_candidate(r, g, b) and not visited[x][y]:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in [0, w-1]:
            r, g, b, a = pixels[x, y]
            if is_bg_candidate(r, g, b) and not visited[x][y]:
                queue.append((x, y))
                visited[x][y] = True

    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        if is_bg_candidate(r, g, b):
            pixels[x, y] = (0, 0, 0, 0)
            for dx, dy in DIRS_8:
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    return img


def handle_edge_alpha(img):
    """キャラ境界のアンチエイリアス処理：半透明ピクセルの補正"""
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            # 透過隣接ピクセルに面しているグレー寄りのピクセルは半透明に
            has_transparent_neighbor = False
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h:
                    _, _, _, na = pixels[nx, ny]
                    if na == 0:
                        has_transparent_neighbor = True
                        break

            if has_transparent_neighbor and is_bg_candidate(r, g, b):
                avg = (r + g + b) // 3
                # 背景色に近いほど透明に
                alpha_factor = max(0, min(255, int((255 - avg) * 3)))
                pixels[x, y] = (r, g, b, alpha_factor)

    return img


def trim_to_content(img, padding=4):
    """透過でない領域にトリミング（余白を除去）"""
    bbox = img.getbbox()
    if bbox is None:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)
    return img.crop((x0, y0, x1, y1))


def resize_square(img, size):
    """正方形にリサイズ（アスペクト比を維持してパディング）"""
    w, h = img.size
    scale = size / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset_x = (size - new_w) // 2
    offset_y = size - new_h  # 足元を下端に揃える
    result.paste(resized, (offset_x, offset_y))
    return result


def process_one(name):
    src = RAW_DIR / f"{name}.png"
    if not src.exists():
        print(f"  SKIP: {src} not found")
        return

    img = Image.open(src).convert("RGBA")
    print(f"  raw: {img.size}")

    img = flood_fill_remove_bg(img)
    img = handle_edge_alpha(img)
    print(f"  bg removed")

    img = trim_to_content(img)
    print(f"  trimmed: {img.size}")

    img = resize_square(img, TARGET_SIZE)
    print(f"  resized: {img.size}")

    out_path = OUT_DIR / f"{name}.png"
    img.save(out_path, "PNG", optimize=True)
    print(f"  saved: {out_path} ({out_path.stat().st_size} bytes)")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        print(f"Processing {name}...")
        process_one(name)
    print("\nDone! All sprites processed.")


if __name__ == "__main__":
    main()
