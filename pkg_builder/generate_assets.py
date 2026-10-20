# pkg_builder/generate_assets.py
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "sce_sys")
os.makedirs(OUT_DIR, exist_ok=True)

def create_icon0():
    # PS4 exige exatamente 512x512 em RGB puro (24-bit, sem canal Alpha)
    img = Image.new("RGB", (512, 512), color=(9, 9, 11))
    draw = ImageDraw.Draw(img)

    # Moldura subtil estilo cartão de sistema
    draw.rounded_rectangle([24, 24, 488, 488], radius=80, outline=(45, 45, 52), width=4)

    # Círculo central de alto contraste (Branco Puro)
    draw.rounded_rectangle([136, 110, 376, 350], radius=64, fill=(255, 255, 255))

    # Desenho minimalista da Coruja (Owl Geometric Vector)
    # Corpo/Topo da cabeça
    draw.polygon([(256, 145), (176, 205), (176, 310), (336, 310), (336, 205)], fill=(9, 9, 11))
    # Olhos da Coruja
    draw.ellipse([202, 215, 238, 251], fill=(255, 255, 255))
    draw.ellipse([274, 215, 310, 251], fill=(255, 255, 255))
    draw.ellipse([214, 227, 226, 239], fill=(9, 9, 11))
    draw.ellipse([286, 227, 298, 239], fill=(9, 9, 11))
    # Bico minimalista
    draw.polygon([(246, 260), (266, 260), (256, 280)], fill=(255, 255, 255))

    # Tipografia inferior
    draw.text((256, 405), "OWL STORE", fill=(255, 255, 255), anchor="mm", font_size=42)
    draw.text((256, 445), "ORBIS FPKG HUB", fill=(130, 130, 140), anchor="mm", font_size=20)

    icon_path = os.path.join(OUT_DIR, "icon0.png")
    img.save(icon_path, "PNG")
    print(f"[OK] icon0.png gerado com sucesso: {icon_path}")

def create_pic1():
    # PS4 exige exatamente 1920x1080 em RGB 24-bit para a tela de abertura (Splash Screen)
    img = Image.new("RGB", (1920, 1080), color=(7, 7, 9))
    draw = ImageDraw.Draw(img)

    # Grelha técnica subtil de fundo
    for x in range(0, 1920, 120):
        draw.line([(x, 0), (x, 1080)], fill=(16, 16, 20), width=1)
    for y in range(0, 1080, 120):
        draw.line([(0, y), (1920, y)], fill=(16, 16, 20), width=1)

    # Emblema central
    draw.rounded_rectangle([860, 340, 1060, 540], radius=48, fill=(255, 255, 255))
    draw.ellipse([900, 415, 940, 455], fill=(9, 9, 11))
    draw.ellipse([980, 415, 1020, 455], fill=(9, 9, 11))
    draw.polygon([(948, 465), (972, 465), (960, 490)], fill=(9, 9, 11))

    # Título e subtítulo
    draw.text((960, 620), "OWL STORE", fill=(255, 255, 255), anchor="mm", font_size=72)
    draw.text((960, 685), "PLAYSTATION 4 PACKAGE MANAGER • LIBSCEBGFT", fill=(140, 140, 155), anchor="mm", font_size=24)

    pic_path = os.path.join(OUT_DIR, "pic1.png")
    img.save(pic_path, "PNG")
    print(f"[OK] pic1.png gerado com sucesso: {pic_path}")

if __name__ == "__main__":
    create_icon0()
    create_pic1()