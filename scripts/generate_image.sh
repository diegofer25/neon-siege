#!/bin/bash

# Script para gerar imagens usando Google Gemini API (Imagen 3)
# Uso: ./scripts/generate_image.sh "prompt descritivo" "nome_arquivo"
# 
# Requer:
#   - Python 3.x
#   - Infisical CLI instalado e autenticado (infisical login)
#   - Secret GEMINI_API_KEY configurado no Infisical (env: dev, path: /mandato-em-jogo)
#
# O script usa Infisical para injetar a GEMINI_API_KEY automaticamente.

set -e

# Configuração do Infisical
INFISICAL_ENV="dev"
INFISICAL_PATH="/neon-td"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/assets/images"
VENV_DIR="$PROJECT_ROOT/.venv"

# Validar argumentos
if [ -z "$1" ]; then
    echo "Erro: É necessário fornecer um prompt para gerar a imagem."
    echo "Uso: $0 \"seu prompt aqui\" [nome_arquivo_opcional]"
    exit 1
fi

PROMPT="$1"
FILENAME="${2:-image_$(date +%Y%m%d_%H%M%S)}"

# Garantir que o diretório de saída existe
mkdir -p "$OUTPUT_DIR"

# Criar virtual environment se não existir
if [ ! -d "$VENV_DIR" ]; then
    echo "Criando virtual environment em $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

# Ativar virtual environment
source "$VENV_DIR/bin/activate"

# Instalar dependências se necessário
if ! python -c "from google import genai" 2>/dev/null; then
    echo "Instalando google-genai..."
    pip install --quiet google-genai
fi

# Criar script Python temporário
PYTHON_SCRIPT=$(mktemp)
trap "rm -f $PYTHON_SCRIPT" EXIT

cat > "$PYTHON_SCRIPT" << 'PYTHON_CODE'
import sys
import os
from datetime import datetime

from google import genai

def generate_image(prompt: str, output_path: str):
    # Tentar usar API key do ambiente ou Application Default Credentials
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        client = genai.Client(api_key=api_key)
    else:
        # Usa Application Default Credentials (gcloud auth application-default login)
        client = genai.Client()
    
    print(f"Gerando imagem para: {prompt}")
    
    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        )
    )
    
    # Procurar pela imagem na resposta
    for part in response.candidates[0].content.parts:
        if hasattr(part, 'inline_data') and part.inline_data is not None:
            image_data = part.inline_data.data
            mime_type = part.inline_data.mime_type
            
            # Determinar extensão baseada no mime type
            ext_map = {
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/webp": ".webp",
            }
            ext = ext_map.get(mime_type, ".png")
            
            # Ajustar path se necessário
            if not output_path.endswith(ext):
                output_path = output_path + ext
            
            with open(output_path, "wb") as f:
                f.write(image_data)
            
            print(f"Imagem salva em: {output_path}")
            return output_path
    
    print("Erro: Nenhuma imagem foi gerada na resposta.")
    sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python script.py 'prompt' 'output_path'")
        sys.exit(1)
    
    prompt = sys.argv[1]
    output_path = sys.argv[2]
    generate_image(prompt, output_path)
PYTHON_CODE

# Executar o script Python via Infisical (injeta GEMINI_API_KEY)
echo "Executando com Infisical (env=$INFISICAL_ENV, path=$INFISICAL_PATH)..."
infisical run --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" -- python "$PYTHON_SCRIPT" "$PROMPT" "$OUTPUT_DIR/$FILENAME"
