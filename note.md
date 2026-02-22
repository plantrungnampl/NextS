Cách dùng ngay bây giờ:

  1. Giữ Neo4j + Ollama chạy:

  docker start graphiti-neo4j-alt
  ollama serve

  2. Nếu MCP server chưa chạy thì start:

  cd /Data/graphiti/mcp_server
  UV_CACHE_DIR=/tmp/uv-cache \
  OPENAI_API_KEY=ollama OPENAI_API_URL=http://localhost:11434/v1 \
  NEO4J_URI=bolt://localhost:7690 NEO4J_USER=neo4j NEO4J_PASSWORD=password \
  EMBEDDER__MODEL=nomic-embed-text EMBEDDER__DIMENSIONS=768 \
  LLM__MODEL=deepseek-r1:7b DATABASE__PROVIDER=neo4j \
  uv run main.py --database-provider neo4j --transport http --host 127.0.0.1 --port 8000

  3. Restart Codex CLI/app để reload ~/.codex/config.toml.

  Nếu muốn, mình đổi luôn sang stdio mode để khỏi cần giữ HTTP server chạy nền.
 Mình sẽ rà luồng + Thêm -> Ngày trong CardQuickAddMenu để xem hiện đang mở panel nào, rồi chốt plan đồng bộ nó với nút Ngày bên ngoài (cùng UI/date
  popover).
  inline mutation (không redirect), update UI ngay bằng TanStack Query.