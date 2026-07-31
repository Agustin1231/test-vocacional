"""RAG sobre los documentos de la institución (hoy: el plan de estudios).

Tres piezas, cada una en su archivo:

- `pdf.py`        — saca el texto del PDF y lo trocea en fragmentos.
- `embeddings.py` — convierte texto en vectores con la API de Google.
- `store.py`      — guarda y busca en pgvector (base aparte del MySQL de la memoria).

El agente no importa nada de acá directamente: usa la herramienta
`buscar_documentos_oficiales` que se arma en `agent/tools.py`, y el modelo decide cuándo
llamarla (ver `docs/adr/0004-rag-en-pgvector.md`).

Todo el subsistema es **opcional**: si `VECTOR_STORE_URL` está vacía, `store.py`
reporta que no está disponible, la herramienta no se le ofrece al modelo y el
asesor funciona como antes de que esto existiera.
"""
