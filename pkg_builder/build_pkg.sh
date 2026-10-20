#!/usr/bin/env bash
set -e

TITLE_ID="OWLS00001"
CONTENT_ID="IV0000-${TITLE_ID}_00-OWLSTORE00000001"
APP_TITLE="Owl Store"
APP_VERSION="01.00"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
SYS_DIR="${WORK_DIR}/sce_sys"
PKG_ROOT="${WORK_DIR}/pkg_root"

echo "===================================================="
echo " 🦉 OWL STORE - CONSTRUTOR DE PACOTE PS4 (.PKG)"
echo "===================================================="

# 1. Gera icon0.png (512x512) e pic1.png (1920x1080)
python3 "${WORK_DIR}/generate_assets.py"

# 2. Prepara diretório raiz do pacote
mkdir -p "${PKG_ROOT}/sce_sys"
cp "${SYS_DIR}/icon0.png" "${PKG_ROOT}/sce_sys/icon0.png"
cp "${SYS_DIR}/pic1.png" "${PKG_ROOT}/sce_sys/pic1.png"

# 3. Se o OpenOrbis SDK (OO_PS4_TOOLCHAIN) estiver instalado, gera o param.sfo, gp4 e o .pkg final
if [ -n "${OO_PS4_TOOLCHAIN}" ]; then
  echo "[*] OpenOrbis Toolchain detetado em: ${OO_PS4_TOOLCHAIN}"

  # Compila o main.cpp para eboot.bin
  clang++ --target=x86_64-pc-freebsd12-elf \
    -isysroot "${OO_PS4_TOOLCHAIN}" \
    -I"${OO_PS4_TOOLCHAIN}/include" \
    -L"${OO_PS4_TOOLCHAIN}/lib" \
    -lc -lkernel -lSceSysmodule -lSceUserService -lSceWebBrowserDialog \
    -o "${WORK_DIR}/owlstore.elf" "${WORK_DIR}/main.cpp"

  "${OO_PS4_TOOLCHAIN}/bin/linux/create-fself" \
    -in="${WORK_DIR}/owlstore.elf" \
    -out="${WORK_DIR}/owlstore.oelf" \
    -eboot="${PKG_ROOT}/eboot.bin" \
    --paid 0x3800000000000011

  # Cria o param.sfo oficial com Title ID OWLS00001
  "${OO_PS4_TOOLCHAIN}/bin/linux/create-gp4" \
    -out="${WORK_DIR}/owlstore.gp4" \
    --content-id="${CONTENT_ID}" \
    --files="eboot.bin sce_sys/icon0.png sce_sys/pic1.png"

  echo "[+] Projeto .gp4 e recursos gerados em ${WORK_DIR}!"
else
  echo "[!] Aviso: Variável OO_PS4_TOOLCHAIN não encontrada."
  echo "    Os ícones oficiais (icon0.png e pic1.png) já estão prontos em: ${PKG_ROOT}/sce_sys/"
  echo "    Pode também injetar o seu GAMES_UNIFIED_SORTED.json diretamente no FPKGi!"
fi